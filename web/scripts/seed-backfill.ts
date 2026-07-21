/**
 * Backfill every UDiFF session from 2024-01-01 through the latest ready
 * weekday — INDEX + STOCK + OTHER for NSE and BSE.
 *
 * Skips dates already fully present (both exchanges). Force-resyncs dates
 * that have only one exchange so BSE/NSE stay aligned with bhavcopy.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-backfill.ts
 *   npx tsx --env-file=.env.local scripts/seed-backfill.ts --force-all
 */
import {
  fetchTradingDates,
  latestWeekday,
  syncTradeDate,
} from "../src/lib/pipeline";
import {
  closeDb,
  countChains,
  distinctValues,
  getArchiveStatus,
  getDbClient,
} from "../src/lib/db";
import { ARCHIVE_EPOCH } from "../src/lib/constants";

async function exchangeDays(exchange: "NSE" | "BSE"): Promise<Set<string>> {
  const days = await distinctValues("tradeDate", { exchange });
  return new Set(days);
}

async function main() {
  const forceAll = process.argv.includes("--force-all");

  console.log(`UDiFF epoch: ${ARCHIVE_EPOCH}`);
  console.log("Fetching trading calendar (epoch → today)…");
  const dates = await fetchTradingDates();
  const cutoff = latestWeekday();
  const ready = dates.filter((d) => d <= cutoff && d >= ARCHIVE_EPOCH);
  console.log(`Ready sessions: ${ready.length} (${ready[0]} → ${ready.at(-1)})`);
  console.log(`Latest published cutoff (IST ~18:30): ${cutoff}`);

  const nseDays = await exchangeDays("NSE");
  const bseDays = await exchangeDays("BSE");

  // Sessions where NSE lacks INDEX majors (partial ingest) — force heal.
  const db = getDbClient();
  const thinNse = await db.execute({
    sql: `
    SELECT trade_date FROM (
      SELECT trade_date,
        MAX(CASE WHEN symbol='NIFTY' THEN 1 ELSE 0 END) AS nifty,
        MAX(CASE WHEN symbol='BANKNIFTY' THEN 1 ELSE 0 END) AS banknifty
      FROM option_chains
      WHERE exchange='NSE' AND segment='INDEX'
        AND trade_date >= ?
      GROUP BY trade_date
    )
    WHERE nifty=0 OR banknifty=0
  `,
    args: [ARCHIVE_EPOCH],
  });
  const thinNseDays = new Set(
    thinNse.rows.map((r) => String((r as { trade_date: unknown }).trade_date))
  );
  // Also: NSE STOCK day with zero INDEX docs
  const nseStockNoIdx = await db.execute({
    sql: `
    SELECT s.trade_date FROM (
      SELECT DISTINCT trade_date FROM option_chains
      WHERE exchange='NSE' AND segment='STOCK' AND trade_date >= ?
    ) s
    LEFT JOIN (
      SELECT DISTINCT trade_date AS d FROM option_chains
      WHERE exchange='NSE' AND segment='INDEX'
    ) i ON i.d = s.trade_date
    WHERE i.d IS NULL
  `,
    args: [ARCHIVE_EPOCH],
  });
  for (const r of nseStockNoIdx.rows) {
    thinNseDays.add(String((r as { trade_date: unknown }).trade_date));
  }

  const todo: { date: string; force: boolean; reason: string }[] = [];
  for (const date of ready) {
    const hasNse = nseDays.has(date);
    const hasBse = bseDays.has(date);
    if (forceAll) {
      todo.push({ date, force: true, reason: "force-all" });
      continue;
    }
    if (thinNseDays.has(date)) {
      todo.push({ date, force: true, reason: "thin/partial NSE INDEX" });
      continue;
    }
    if (!hasNse && !hasBse) {
      todo.push({ date, force: false, reason: "missing" });
    } else if (hasNse !== hasBse) {
      todo.push({
        date,
        force: true,
        reason: hasNse ? "NSE-only → add BSE" : "BSE-only → add NSE",
      });
    }
  }

  console.log(
    `\nTo sync: ${todo.length} session(s) ` +
      `(skip ${ready.length - todo.length} already complete)\n`
  );

  let synced = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;
  let partial = 0;

  for (let i = 0; i < todo.length; i++) {
    const { date, force, reason } = todo[i];
    process.stdout.write(
      `[${i + 1}/${todo.length}] ${date} (${reason}) … `
    );
    const result = await syncTradeDate(date, ["NSE", "BSE"], { force });
    console.log(result.status, (result.message || "").slice(0, 120));
    if (result.status === "synced") synced += 1;
    else if (result.status === "already_synced") skipped += 1;
    else if (result.status === "missing") missing += 1;
    else if (result.status === "partial") partial += 1;
    else if (result.status === "failed") failed += 1;
    else synced += 1;
    if (result.errors.length) {
      for (const e of result.errors) console.error("   ", e);
    }
  }

  // Final coverage report vs calendar
  const status = await getArchiveStatus();
  const nseAfter = await exchangeDays("NSE");
  const bseAfter = await exchangeDays("BSE");
  const stillMissing = ready.filter((d) => !nseAfter.has(d) && !bseAfter.has(d));
  const nseOnly = ready.filter((d) => nseAfter.has(d) && !bseAfter.has(d));
  const bseOnly = ready.filter((d) => bseAfter.has(d) && !nseAfter.has(d));

  console.log("\n—— Backfill summary ——");
  console.log({ synced, skipped, missing, partial, failed });
  console.log(
    `span=${status.earliestTradeDate ?? "—"} → ${status.latestTradeDate ?? "—"}`
  );
  console.log(
    `docs=${status.totalDocuments.toLocaleString()} days=${status.tradingDays}`
  );
  console.log(
    `INDEX:${status.segments.INDEX} STOCK:${status.segments.STOCK} OTHER:${status.segments.OTHER}`
  );
  console.log(`NSE days=${nseAfter.size} BSE days=${bseAfter.size}`);
  console.log(
    `Calendar gaps (neither exchange): ${stillMissing.length}` +
      (stillMissing.length ? ` e.g. ${stillMissing.slice(0, 8).join(", ")}` : "")
  );
  console.log(
    `NSE-only: ${nseOnly.length}` +
      (nseOnly.length ? ` (${nseOnly.join(", ")})` : "")
  );
  console.log(
    `BSE-only: ${bseOnly.length}` +
      (bseOnly.length ? ` (${bseOnly.join(", ")})` : "")
  );

  // Spot-check: every present day should have STOCK and/or INDEX rows
  const sample = ready.filter((d) => nseAfter.has(d)).slice(-5);
  for (const d of sample) {
    const n = await countChains({ tradeDate: d, exchange: "NSE" });
    const b = await countChains({ tradeDate: d, exchange: "BSE" });
    console.log(`  check ${d}: NSE=${n} BSE=${b}`);
  }

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
