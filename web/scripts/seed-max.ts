/**
 * Drop + rebuild SQLite archive.
 * INDEX: full calendar history | STOCK: last N sessions (default 30)
 */
import {
  fetchTradingDates,
  latestWeekday,
  syncTradeDate,
} from "../src/lib/pipeline";
import {
  closeDb,
  dropAllChains,
  ensureSchema,
  getArchiveStatus,
} from "../src/lib/db";
import type { Segment } from "../src/lib/types";

async function main() {
  const stockDays = Number(
    process.argv.find((a) => a.startsWith("--stock-days="))?.split("=")[1] ?? 30
  );

  console.log("—— Clearing SQLite option_chains ——");
  await ensureSchema();
  await dropAllChains();
  console.log("Cleared.");

  const dates = await fetchTradingDates();
  const cutoff = latestWeekday();
  const ready = dates.filter((d) => d <= cutoff);
  console.log(`Sessions to cover: ${ready.length} (${ready[0]} → ${ready.at(-1)})`);

  console.log("\n—— INDEX full history ——");
  let idxOk = 0;
  let idxFail = 0;
  for (let i = 0; i < ready.length; i++) {
    const date = ready[i];
    process.stdout.write(`[INDEX ${i + 1}/${ready.length}] ${date} … `);
    const result = await syncTradeDate(date, ["NSE", "BSE"], {
      force: true,
      segments: ["INDEX"] as Segment[],
    });
    console.log(result.message);
    if (result.status === "failed") idxFail += 1;
    else idxOk += 1;
  }

  const stockSlice = ready.slice(-Math.max(1, stockDays));
  console.log(`\n—— STOCK last ${stockSlice.length} days ——`);
  let stOk = 0;
  let stFail = 0;
  for (let i = 0; i < stockSlice.length; i++) {
    const date = stockSlice[i];
    process.stdout.write(`[STOCK ${i + 1}/${stockSlice.length}] ${date} … `);
    const result = await syncTradeDate(date, ["NSE", "BSE"], {
      force: true,
      segments: ["STOCK"] as Segment[],
    });
    console.log(result.message);
    if (result.status === "failed") stFail += 1;
    else stOk += 1;
  }

  const status = await getArchiveStatus();
  console.log("\n—— Archive ready ——");
  console.log(`INDEX ok=${idxOk} fail=${idxFail} | STOCK ok=${stOk} fail=${stFail}`);
  console.log(`docs=${status.totalDocuments.toLocaleString()} days=${status.tradingDays}`);
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
