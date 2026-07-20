/**
 * Load existing local CSVs (web/data/store) into SQLite / libSQL.
 * INDEX: all dates on disk | STOCK: last N trade dates (override with --stock-days=all)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/ingest-local.ts
 *   npx tsx --env-file=.env.local scripts/ingest-local.ts --stock-days=30
 *   npx tsx --env-file=.env.local scripts/ingest-local.ts --stock-days=all
 */
import fs from "fs/promises";
import path from "path";
import { PREFERRED_COLUMNS } from "../src/lib/constants";
import {
  closeDb,
  distinctValues,
  ensureSchema,
  getArchiveStatus,
  upsertChainDocs,
} from "../src/lib/db";
import { LOCAL_DATA_ROOT, parseCsv } from "../src/lib/storage";
import type {
  Exchange,
  OptionChainDoc,
  OptionRow,
  OptionSide,
  Segment,
} from "../src/lib/types";

function leanRows(rows: OptionRow[]): OptionRow[] {
  return rows.map((row) => {
    const next: OptionRow = {};
    for (const key of PREFERRED_COLUMNS) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]) !== "") {
        next[key] = row[key];
      }
    }
    if (next.StrkPric == null && row.StrikePrice != null) {
      next.StrkPric = row.StrikePrice;
    }
    return next;
  });
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function collectTradeDates(segment: Segment): Promise<string[]> {
  const dates = new Set<string>();
  for (const exchange of ["NSE", "BSE"] as Exchange[]) {
    const segRoot = path.join(LOCAL_DATA_ROOT, exchange, segment);
    const symbols = await listDirs(segRoot);
    for (const symbol of symbols) {
      for (const side of ["CALL", "PUT"] as OptionSide[]) {
        const sideDir = path.join(segRoot, symbol, side);
        for (const d of await listDirs(sideDir)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dates.add(d);
        }
      }
    }
  }
  return [...dates].sort();
}

async function ingestSegment(
  segment: Segment,
  allowedDates: Set<string> | null
): Promise<{ files: number; docs: number }> {
  let files = 0;
  let docs = 0;
  const batch: OptionChainDoc[] = [];
  const updatedAt = new Date();

  async function flush() {
    if (batch.length === 0) return;
    const chunk = batch.splice(0, batch.length);
    await upsertChainDocs(chunk);
    docs += chunk.length;
  }

  for (const exchange of ["NSE", "BSE"] as Exchange[]) {
    const segRoot = path.join(LOCAL_DATA_ROOT, exchange, segment);
    const symbols = await listDirs(segRoot);
    for (const symbol of symbols) {
      for (const side of ["CALL", "PUT"] as OptionSide[]) {
        const sideDir = path.join(segRoot, symbol, side);
        const tradeDates = await listDirs(sideDir);
        for (const tradeDate of tradeDates) {
          if (allowedDates && !allowedDates.has(tradeDate)) continue;
          const dayDir = path.join(sideDir, tradeDate);
          let entries: string[] = [];
          try {
            entries = (await fs.readdir(dayDir)).filter(
              (f) => f.startsWith("expiry_date_") && f.endsWith(".csv")
            );
          } catch {
            continue;
          }
          for (const file of entries) {
            files += 1;
            const expiryDate = file
              .replace(/^expiry_date_/, "")
              .replace(/\.csv$/i, "");
            const text = await fs.readFile(path.join(dayDir, file), "utf8");
            const rows = leanRows(parseCsv(text));
            batch.push({
              exchange,
              segment,
              symbol,
              side,
              tradeDate,
              expiryDate,
              rows,
              rowCount: rows.length,
              updatedAt,
            });
            if (batch.length >= 80) await flush();
          }
        }
      }
      if (files > 0 && files % 2000 < 80) {
        process.stdout.write(
          `\r  ${segment} ${exchange}/${symbol}… files=${files} docs=${docs}   `
        );
      }
    }
  }
  await flush();
  process.stdout.write("\n");
  return { files, docs };
}

async function main() {
  const stockArg =
    process.argv.find((a) => a.startsWith("--stock-days="))?.split("=")[1] ??
    "all";
  const stockAll = stockArg === "all";
  const stockDays = stockAll ? Infinity : Number(stockArg);

  console.log(`Local root: ${LOCAL_DATA_ROOT}`);
  console.log("Ensuring SQLite schema…");
  await ensureSchema();

  const indexDates = await collectTradeDates("INDEX");
  console.log(
    `INDEX dates on disk: ${indexDates.length} (${indexDates[0] ?? "—"} → ${indexDates.at(-1) ?? "—"})`
  );

  console.log("\n—— Ingest INDEX (all) ——");
  const idx = await ingestSegment("INDEX", null);
  console.log(`INDEX files=${idx.files} upserted≈${idx.docs}`);

  const stockDatesAll = await collectTradeDates("STOCK");
  const stockSlice = stockAll
    ? stockDatesAll
    : stockDatesAll.slice(-Math.max(1, stockDays));
  console.log(
    `\n—— Ingest STOCK ${stockAll ? "all" : `last ${stockSlice.length}`} days (${stockSlice[0] ?? "—"} → ${stockSlice.at(-1) ?? "—"}) ——`
  );
  const st = await ingestSegment("STOCK", new Set(stockSlice));
  console.log(`STOCK files=${st.files} upserted≈${st.docs}`);

  // OTHER if present on disk
  const otherDates = await collectTradeDates("OTHER");
  if (otherDates.length) {
    console.log(`\n—— Ingest OTHER (${otherDates.length} dates) ——`);
    const ot = await ingestSegment("OTHER", null);
    console.log(`OTHER files=${ot.files} upserted≈${ot.docs}`);
  }

  const status = await getArchiveStatus();
  const days = await distinctValues("tradeDate");
  console.log("\n—— SQLite ready ——");
  console.log(
    `docs=${status.totalDocuments.toLocaleString()} days=${days.length}`
  );
  console.log(
    `span=${status.earliestTradeDate ?? "—"} → ${status.latestTradeDate ?? "—"}`
  );
  console.log(
    `INDEX:${status.segments.INDEX}, STOCK:${status.segments.STOCK}, OTHER:${status.segments.OTHER}`
  );

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
