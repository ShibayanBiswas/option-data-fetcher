import JSZip from "jszip";
import {
  BSE_FO_URL,
  BSE_HEADERS,
  HTTP_HEADERS,
  NSE_FO_URL,
  classifySegment,
  sideFromOptnTp,
} from "./constants";
import {
  dropEmptyColumns,
  sortRowsByStrike,
  writeLocalChain,
} from "./storage";
import { ensureIndexes, getChainsCollection } from "./mongodb";
import type { Exchange, OptionChainDoc, OptionRow, SyncResult } from "./types";

async function fetchWithRetries(
  url: string,
  headers: Record<string, string>,
  retries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        cache: "no-store",
      });
      if (response.status === 404) return response;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 400));
      }
    }
  }
  throw lastError ?? new Error("Request failed");
}

function parseCsvText(text: string): OptionRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: OptionRow = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

async function downloadNseRows(tradeDate: string): Promise<OptionRow[] | "missing"> {
  const yyyymmdd = tradeDate.replace(/-/g, "");
  const url = NSE_FO_URL.replace("{yyyymmdd}", yyyymmdd);
  const response = await fetchWithRetries(url, HTTP_HEADERS);
  if (response.status === 404) return "missing";

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(`NSE response for ${tradeDate} is not a zip archive`);
  }

  const zip = await JSZip.loadAsync(buffer);
  const csvName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!csvName) throw new Error(`No CSV in NSE archive for ${tradeDate}`);
  const raw = await zip.files[csvName].async("string");
  return parseCsvText(raw);
}

async function downloadBseRows(tradeDate: string): Promise<OptionRow[] | "missing"> {
  const yyyymmdd = tradeDate.replace(/-/g, "");
  const url = BSE_FO_URL.replace("{yyyymmdd}", yyyymmdd);
  const response = await fetchWithRetries(url, BSE_HEADERS);
  if (response.status === 404) return "missing";
  const text = await response.text();
  if (!text.includes("TradDt") && !text.includes("TckrSymb")) {
    throw new Error(`BSE response for ${tradeDate} is not a bhavcopy CSV`);
  }
  return parseCsvText(text);
}

function groupIntoDocs(
  exchange: Exchange,
  tradeDate: string,
  rows: OptionRow[]
): OptionChainDoc[] {
  const buckets = new Map<string, OptionRow[]>();

  for (const row of rows) {
    const symbol = String(row.TckrSymb ?? "").toUpperCase();
    const side = sideFromOptnTp(String(row.OptnTp ?? ""));
    const expiryDate = String(row.XpryDt ?? "").slice(0, 10);
    if (!symbol || !side || !expiryDate) continue;

    const segment = classifySegment(
      exchange,
      symbol,
      String(row.FinInstrmTp ?? "")
    );
    const key = `${segment}|${symbol}|${side}|${expiryDate}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const now = new Date();
  const docs: OptionChainDoc[] = [];

  for (const [key, bucketRows] of buckets) {
    const [segment, symbol, side, expiryDate] = key.split("|");
    const cleaned = sortRowsByStrike(dropEmptyColumns(bucketRows));
    docs.push({
      exchange,
      segment: segment as OptionChainDoc["segment"],
      symbol,
      side: side as OptionChainDoc["side"],
      tradeDate,
      expiryDate,
      rows: cleaned,
      rowCount: cleaned.length,
      updatedAt: now,
    });
  }

  return docs;
}

export async function upsertDocs(docs: OptionChainDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  await ensureIndexes();
  const col = await getChainsCollection();

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: {
        exchange: doc.exchange,
        segment: doc.segment,
        symbol: doc.symbol,
        side: doc.side,
        tradeDate: doc.tradeDate,
        expiryDate: doc.expiryDate,
      },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const chunkSize = 250;
  for (let i = 0; i < ops.length; i += chunkSize) {
    await col.bulkWrite(ops.slice(i, i + chunkSize), { ordered: false });
  }

  await Promise.all(
    docs.map(async (doc) => {
      try {
        await writeLocalChain(doc);
      } catch {
        // Ephemeral hosts may not allow local writes — MongoDB remains source of truth.
      }
    })
  );

  return docs.length;
}

export async function syncTradeDate(
  tradeDate: string,
  exchanges: Exchange[] = ["NSE", "BSE"],
  options: { force?: boolean } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    ok: true,
    tradeDate,
    saved: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    errors: [],
    message: "",
  };

  const col = await getChainsCollection();
  const existingCount = await col.countDocuments({ tradeDate });
  result.alreadyHad = existingCount > 0;

  if (existingCount > 0 && !options.force) {
    result.skipped = existingCount;
    result.status = "already_synced";
    result.ok = true;
    result.message = `Archive already has ${tradeDate} (${existingCount.toLocaleString()} chain files). No changes needed.`;
    return result;
  }

  for (const exchange of exchanges) {
    try {
      const rows =
        exchange === "NSE"
          ? await downloadNseRows(tradeDate)
          : await downloadBseRows(tradeDate);

      if (rows === "missing") {
        result.missing += 1;
        continue;
      }

      const optionRows = rows.filter((r) => {
        const tp = String(r.OptnTp ?? "");
        return tp === "CE" || tp === "PE";
      });

      const docs = groupIntoDocs(exchange, tradeDate, optionRows);
      if (docs.length === 0) {
        result.missing += 1;
        continue;
      }

      const saved = await upsertDocs(docs);
      result.saved += saved;
    } catch (err) {
      result.failed += 1;
      result.errors.push(
        `${exchange} ${tradeDate}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  result.ok = result.failed === 0;

  if (result.failed > 0 && result.saved === 0 && result.skipped === 0) {
    result.status = "failed";
    result.message = `Sync failed for ${tradeDate}. ${result.errors[0] ?? ""}`.trim();
  } else if (result.missing > 0 && result.saved === 0 && result.skipped === 0) {
    result.status = "missing";
    result.message = `Bhavcopy not published yet for ${tradeDate}. Try again after market settlement.`;
  } else if (result.skipped > 0 && result.saved === 0 && result.failed === 0) {
    result.status = "already_synced";
    result.message = `Archive already has ${tradeDate} (${existingCount.toLocaleString()} chain files). No changes needed.`;
  } else if (result.failed > 0 || (result.missing > 0 && result.saved > 0)) {
    result.status = "partial";
    result.message = `Partial sync for ${tradeDate}: saved ${result.saved}, missing ${result.missing}, failed ${result.failed}.`;
  } else {
    result.status = "synced";
    result.message = `Synced ${tradeDate}: ${result.saved.toLocaleString()} chain files stored in MongoDB.`;
  }

  return result;
}

export async function fetchTradingDates(years = 2): Promise<string[]> {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - years);

  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000) + 86_400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&period1=${period1}&period2=${period2}`;

  const response = await fetch(url, {
    headers: HTTP_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch trading calendar: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const timestamps: number[] = payload?.chart?.result?.[0]?.timestamp ?? [];
  return timestamps
    .map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))
    .sort();
}

export function latestWeekday(from = new Date()): string {
  const d = new Date(from);
  // Approximate IST (UTC+5:30). Before ~18:30 IST, today's bhavcopy is rarely ready.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffsetMs);
  const istMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (istMinutes < 18 * 60 + 30) {
    ist.setUTCDate(ist.getUTCDate() - 1);
  }
  while (ist.getUTCDay() === 0 || ist.getUTCDay() === 6) {
    ist.setUTCDate(ist.getUTCDate() - 1);
  }
  return ist.toISOString().slice(0, 10);
}

export function previousWeekdays(fromDate: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${fromDate}T12:00:00Z`);
  for (let i = 0; i < count; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Sync Today: prefer latest ready session; walk back if bhavcopy not published. */
export async function syncLatestAvailable(
  options: { force?: boolean; lookback?: number } = {}
): Promise<SyncResult> {
  const lookback = options.lookback ?? 5;
  const start = latestWeekday();
  const candidates = [start, ...previousWeekdays(start, lookback)];

  let lastMissing: SyncResult | null = null;
  for (const date of candidates) {
    const result = await syncTradeDate(date, ["NSE", "BSE"], { force: options.force });
    if (result.status === "missing") {
      lastMissing = result;
      continue;
    }
    return result;
  }

  return (
    lastMissing ?? {
      ok: false,
      tradeDate: start,
      saved: 0,
      skipped: 0,
      missing: 1,
      failed: 0,
      errors: [],
      status: "missing",
      message: `No bhavcopy found for the last ${lookback + 1} sessions.`,
    }
  );
}
