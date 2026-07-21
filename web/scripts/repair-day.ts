/**
 * Repair a single trade date from NSE/BSE bhavcopy (force upsert).
 * Usage: npx tsx --env-file=.env.local scripts/repair-day.ts 2025-12-12
 */
import { closeDb, ensureSchema, getDbClient } from "../src/lib/db";
import { syncTradeDate } from "../src/lib/pipeline";

async function snapshot(date: string) {
  const db = getDbClient();
  const rs = await db.execute({
    sql: `
      SELECT exchange, segment, COUNT(*) AS files, COUNT(DISTINCT symbol) AS symbols
      FROM option_chains WHERE trade_date = ?
      GROUP BY exchange, segment ORDER BY 1, 2
    `,
    args: [date],
  });
  return rs.rows;
}

async function main() {
  const date = process.argv[2];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
    console.error("Usage: repair-day.ts YYYY-MM-DD");
    process.exit(2);
  }
  await ensureSchema();
  console.log("Before:", await snapshot(date));
  console.log(`Force sync ${date}…`);
  const result = await syncTradeDate(date, ["NSE", "BSE"], { force: true });
  console.log(result);
  console.log("After:", await snapshot(date));
  await closeDb();
  process.exit(result.ok ? 0 : 1);
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
