import path from "path";
import fs from "fs/promises";
import type { BrowsePath, Exchange, OptionChainDoc, OptionRow, OptionSide, Segment } from "./types";
import { classifySegment, isSegment } from "./constants";

export const LOCAL_DATA_ROOT = path.join(process.cwd(), "data", "store");

export function buildLocalDir(parts: {
  exchange: Exchange;
  segment: Segment;
  symbol: string;
  side: OptionSide;
  tradeDate: string;
}): string {
  return path.join(
    LOCAL_DATA_ROOT,
    parts.exchange,
    parts.segment,
    parts.symbol,
    parts.side,
    parts.tradeDate
  );
}

export function expiryFileName(expiryDate: string): string {
  return `expiry_date_${expiryDate}.csv`;
}

export function dropEmptyColumns(rows: OptionRow[]): OptionRow[] {
  if (rows.length === 0) return rows;
  const keys = Object.keys(rows[0]);
  const keep = keys.filter((key) =>
    rows.some((row) => {
      const v = row[key];
      return v !== null && v !== undefined && String(v).trim() !== "";
    })
  );
  return rows.map((row) => {
    const next: OptionRow = {};
    for (const key of keep) next[key] = row[key] ?? null;
    return next;
  });
}

export function sortRowsByStrike(rows: OptionRow[]): OptionRow[] {
  return [...rows].sort((a, b) => {
    const sa = Number(a.StrkPric ?? a.StrikePrice ?? a.strike ?? 0);
    const sb = Number(b.StrkPric ?? b.StrikePrice ?? b.strike ?? 0);
    return sa - sb;
  });
}

export function rowsToCsv(rows: OptionRow[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\n");
}

export async function writeLocalChain(doc: OptionChainDoc): Promise<void> {
  const dir = buildLocalDir(doc);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, expiryFileName(doc.expiryDate));
  await fs.writeFile(filePath, rowsToCsv(doc.rows), "utf8");
}

export async function readLocalChain(
  pathParts: Required<
    Pick<BrowsePath, "exchange" | "segment" | "symbol" | "side" | "tradeDate" | "expiryDate">
  >
): Promise<OptionRow[] | null> {
  const filePath = path.join(
    buildLocalDir({
      exchange: pathParts.exchange!,
      segment: pathParts.segment!,
      symbol: pathParts.symbol!,
      side: pathParts.side!,
      tradeDate: pathParts.tradeDate!,
    }),
    expiryFileName(pathParts.expiryDate!)
  );
  try {
    const text = await fs.readFile(filePath, "utf8");
    return parseCsv(text);
  } catch {
    return null;
  }
}

export function parseCsv(text: string): OptionRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: OptionRow = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function pathFromSegments(segments: string[]): BrowsePath {
  const [exchange, segment, symbol, side, tradeDate, expiryDate] = segments;
  const pathObj: BrowsePath = {};
  if (exchange === "NSE" || exchange === "BSE") pathObj.exchange = exchange;
  if (segment && isSegment(segment)) pathObj.segment = segment;
  if (symbol) pathObj.symbol = decodeURIComponent(symbol).toUpperCase();
  if (side === "CALL" || side === "PUT") pathObj.side = side;
  if (tradeDate) pathObj.tradeDate = tradeDate;
  if (expiryDate) {
    pathObj.expiryDate = expiryDate.replace(/^expiry_date_/, "").replace(/\.csv$/i, "");
  }
  return pathObj;
}

export function hrefForPath(pathObj: BrowsePath): string {
  const parts = [
    pathObj.exchange,
    pathObj.segment,
    pathObj.symbol,
    pathObj.side,
    pathObj.tradeDate,
    pathObj.expiryDate ? `expiry_date_${pathObj.expiryDate}` : undefined,
  ].filter(Boolean) as string[];
  return parts.length ? `/browse/${parts.join("/")}` : "/browse";
}

export function inferSegment(
  exchange: Exchange,
  symbol: string,
  finInstrmTp?: string | null
): Segment {
  return classifySegment(exchange, symbol, finInstrmTp);
}
