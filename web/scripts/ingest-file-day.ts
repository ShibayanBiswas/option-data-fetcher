/**
 * Ingest a local NSE zip/CSV or BSE CSV into the archive for one trade date.
 *
 *   npx tsx --env-file=.env.local scripts/ingest-file-day.ts NSE 2025-12-12 /path/to/file.zip
 *   npx tsx --env-file=.env.local scripts/ingest-file-day.ts BSE 2025-12-12 /path/to/file.CSV
 */
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { closeDb, ensureSchema, getDbClient } from "../src/lib/db";
import { upsertDocs } from "../src/lib/pipeline";
import { parseCsv } from "../src/lib/storage";
import { classifySegment, sideFromOptnTp } from "../src/lib/constants";
import type { Exchange, OptionRow, Segment } from "../src/lib/types";

async function loadRows(path: string): Promise<OptionRow[]> {
  const buf = await readFile(path);
  if (path.toLowerCase().endsWith(".zip") || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    const zip = await JSZip.loadAsync(buf);
    const csvName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".csv"));
    if (!csvName) throw new Error("No CSV inside zip");
    const raw = await zip.files[csvName].async("string");
    return parseCsv(raw);
  }
  return parseCsv(buf.toString("utf8"));
}

function groupIntoDocs(exchange: Exchange, tradeDate: string, rows: OptionRow[]) {
  const buckets = new Map<string, OptionRow[]>();
  for (const row of rows) {
    const symbol = String(row.TckrSymb ?? "").toUpperCase();
    const side = sideFromOptnTp(String(row.OptnTp ?? ""));
    const expiryDate = String(row.XpryDt ?? "").slice(0, 10);
    if (!symbol || !side || !expiryDate) continue;
    const segment = classifySegment(exchange, symbol, String(row.FinInstrmTp ?? ""));
    const key = `${segment}|${symbol}|${side}|${expiryDate}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  const now = new Date();
  return [...buckets.entries()].map(([key, bucketRows]) => {
    const [segment, symbol, side, expiryDate] = key.split("|");
    return {
      exchange,
      segment: segment as Segment,
      symbol,
      side: side as "CALL" | "PUT",
      tradeDate,
      expiryDate,
      rows: bucketRows,
      rowCount: bucketRows.length,
      updatedAt: now,
    };
  });
}

async function main() {
  const exchange = process.argv[2]?.toUpperCase() as Exchange;
  const date = process.argv[3];
  const path = process.argv[4];
  if (!["NSE", "BSE"].includes(exchange) || !date || !path) {
    console.error("Usage: ingest-file-day.ts NSE|BSE YYYY-MM-DD /path/to/file");
    process.exit(2);
  }

  await ensureSchema();
  console.log(`Loading ${path}…`);
  const rows = await loadRows(path);
  const optionRows = rows.filter((r) => {
    const tp = String(r.OptnTp ?? "");
    return tp === "CE" || tp === "PE";
  });
  console.log(`Parsed ${rows.length} rows, ${optionRows.length} CE/PE`);
  const docs = groupIntoDocs(exchange, date, optionRows);
  const bySeg = docs.reduce(
    (acc, d) => {
      acc[d.segment] = (acc[d.segment] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(`Docs to upsert: ${docs.length}`, bySeg);
  console.log("Upserting…");
  const saved = await upsertDocs(docs);
  console.log(`Saved ${saved}`);

  const db = getDbClient();
  const snap = await db.execute({
    sql: `
      SELECT exchange, segment, COUNT(*) AS files, COUNT(DISTINCT symbol) AS symbols
      FROM option_chains WHERE trade_date = ? AND exchange = ?
      GROUP BY exchange, segment ORDER BY 1, 2
    `,
    args: [date, exchange],
  });
  console.log("Snapshot:", snap.rows);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closeDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
