/**
 * Wipe Turso/SQLite option_chains, then seed full UDiFF history.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/turso-fresh-seed.ts
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
import { UDIFF_EPOCH } from "../src/lib/constants";

async function main() {
  console.log("—— 1/3 Wipe all option_chains (Turso/local) ——");
  await ensureSchema();
  await dropAllChains();
  console.log("Cleared.");

  console.log("\n—— 2/3 Trading calendar ——");
  const dates = await fetchTradingDates();
  const cutoff = latestWeekday();
  const ready = dates.filter((d) => d <= cutoff && d >= UDIFF_EPOCH);
  console.log(`Sessions: ${ready.length} (${ready[0]} → ${ready.at(-1)})`);

  console.log("\n—— 3/3 Download ALL segments every session ——");
  let synced = 0;
  let missing = 0;
  let failed = 0;
  let partial = 0;

  for (let i = 0; i < ready.length; i++) {
    const date = ready[i];
    process.stdout.write(`[${i + 1}/${ready.length}] ${date} … `);
    const result = await syncTradeDate(date, ["NSE", "BSE"], { force: true });
    console.log(result.status, (result.message || "").slice(0, 100));
    if (result.status === "synced") synced += 1;
    else if (result.status === "missing") missing += 1;
    else if (result.status === "partial") partial += 1;
    else if (result.status === "failed") failed += 1;
    else synced += 1;
  }

  const status = await getArchiveStatus();
  console.log("\n—— Fresh Turso archive ready ——");
  console.log({ synced, missing, partial, failed });
  console.log(
    `span=${status.earliestTradeDate ?? "—"} → ${status.latestTradeDate ?? "—"}`
  );
  console.log(
    `docs=${status.totalDocuments.toLocaleString()} days=${status.tradingDays}`
  );
  console.log(
    `INDEX:${status.segments.INDEX} STOCK:${status.segments.STOCK} OTHER:${status.segments.OTHER}`
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
