/**
 * Seed SQLite from NSE/BSE UDiFF bhavcopy (also writes local CSV store).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed.ts 30
 *   npx tsx --env-file=.env.local scripts/seed.ts all
 *   npx tsx --env-file=.env.local scripts/seed.ts all --force
 */
import {
  fetchTradingDates,
  latestWeekday,
  syncTradeDate,
} from "../src/lib/pipeline";
import { closeDb, getArchiveStatus } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const target = args.find((a) => a !== "--force") ?? "30";
  const wantAll = target === "all" || target === "--all";

  console.log("Fetching trading calendar…");
  const dates = await fetchTradingDates(2);
  const cutoff = latestWeekday();
  const ready = dates.filter((d) => d <= cutoff);

  const slice = wantAll
    ? ready
    : ready.slice(-Math.max(1, Math.min(Number(target) || 30, ready.length)));

  console.log(
    `Seeding ${slice.length} trading day(s) into SQLite` +
      `${force ? " (force rewrite)" : ""}…`
  );
  console.log(`Range: ${slice[0]} → ${slice[slice.length - 1]}`);

  let synced = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (let i = 0; i < slice.length; i++) {
    const date = slice[i];
    process.stdout.write(`[${i + 1}/${slice.length}] ${date} … `);
    const result = await syncTradeDate(date, ["NSE", "BSE"], { force });
    console.log(result.message);
    if (result.status === "already_synced") skipped += 1;
    else if (result.status === "missing") missing += 1;
    else if (result.status === "failed") failed += 1;
    else synced += 1;
    if (result.errors.length) {
      for (const e of result.errors) console.error("   ", e);
    }
  }

  const status = await getArchiveStatus();

  console.log("\n—— Summary ——");
  console.log(
    `synced=${synced} skipped=${skipped} missing=${missing} failed=${failed}`
  );
  console.log(
    `SQLite docs=${status.totalDocuments.toLocaleString()} tradingDays=${status.tradingDays}`
  );
  console.log(
    `Archive span: ${status.earliestTradeDate ?? "—"} → ${status.latestTradeDate ?? "—"}`
  );
  console.log("Done.");

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await closeDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
