/**
 * Nuclear refresh: wipe SQLite + local CSV store, then download every
 * trading session (INDEX + STOCK + OTHER) into both stores.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fresh-seed-all.ts
 */
import fs from "fs/promises";
import path from "path";
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
import { LOCAL_DATA_ROOT } from "../src/lib/storage";

async function rmrf(target: string) {
  try {
    await fs.rm(target, { recursive: true, force: true });
    console.log(`Cleared ${target}`);
  } catch (err) {
    console.warn(`Skip clear ${target}:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log("—— 1/3 Clear caches & stores ——");
  await closeDb();
  await rmrf(path.join(process.cwd(), "data", "option_chain.db"));
  await rmrf(path.join(process.cwd(), "data", "option_chain.db-wal"));
  await rmrf(path.join(process.cwd(), "data", "option_chain.db-shm"));
  await rmrf(LOCAL_DATA_ROOT);
  await rmrf(path.join(process.cwd(), ".next", "cache"));

  // Recreate empty schema
  await ensureSchema();
  await dropAllChains();
  console.log("SQLite schema ready (empty).");

  console.log("\n—— 2/3 Fetch trading calendar ——");
  const dates = await fetchTradingDates();
  const cutoff = latestWeekday();
  const ready = dates.filter((d) => d <= cutoff);
  console.log(`Sessions: ${ready.length} (${ready[0]} → ${ready.at(-1)})`);

  console.log("\n—— 3/3 Download ALL segments for every session ——");
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
  console.log("\n—— Fresh archive ready ——");
  console.log({ synced, missing, partial, failed });
  console.log(
    `docs=${status.totalDocuments.toLocaleString()} days=${status.tradingDays}`
  );
  console.log(
    `span=${status.earliestTradeDate ?? "—"} → ${status.latestTradeDate ?? "—"}`
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
