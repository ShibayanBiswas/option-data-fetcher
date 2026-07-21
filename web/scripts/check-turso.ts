/**
 * Report Turso/local archive coverage.
 *   npx tsx --env-file=.env.local scripts/check-turso.ts
 */
import { createClient } from "@libsql/client";
import { closeDb, ensureSchema, getArchiveStatus } from "../src/lib/db";

async function main() {
  const url = process.env.LIBSQL_URL;
  const token = process.env.LIBSQL_AUTH_TOKEN;
  console.log("Target:", url || "(local SQLite)");
  console.log("Token set:", Boolean(token));

  if (url?.startsWith("libsql://") || url?.startsWith("https://")) {
    const c = createClient({ url, authToken: token });
    const ping = await c.execute("SELECT 1 AS ok");
    console.log("Ping OK:", ping.rows[0]);
  }

  await ensureSchema();
  const status = await getArchiveStatus();
  console.log("\n—— Archive status ——");
  console.log({
    docs: status.totalDocuments,
    days: status.tradingDays,
    span: `${status.earliestTradeDate ?? "—"} → ${status.latestTradeDate ?? "—"}`,
    symbols: status.symbolCount,
    INDEX: status.segments.INDEX,
    STOCK: status.segments.STOCK,
    OTHER: status.segments.OTHER,
  });

  const db = (await import("../src/lib/db")).getDbClient();
  const byEx = await db.execute(`
    SELECT exchange, segment,
           MIN(trade_date) AS lo, MAX(trade_date) AS hi,
           COUNT(DISTINCT trade_date) AS days,
           COUNT(DISTINCT symbol) AS symbols,
           COUNT(*) AS files
    FROM option_chains
    GROUP BY exchange, segment
    ORDER BY 1, 2
  `);
  console.log("\n—— By exchange / segment ——");
  for (const row of byEx.rows) {
    console.log(
      `${row.exchange}/${row.segment}: ${row.lo}→${row.hi} days=${row.days} symbols=${row.symbols} files=${row.files}`
    );
  }

  const nse = await db.execute(
    `SELECT COUNT(DISTINCT trade_date) AS n FROM option_chains WHERE exchange='NSE'`
  );
  const bse = await db.execute(
    `SELECT COUNT(DISTINCT trade_date) AS n FROM option_chains WHERE exchange='BSE'`
  );
  console.log("\nNSE days:", nse.rows[0]?.n, "BSE days:", bse.rows[0]?.n);

  await closeDb();
}

main().catch(async (e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  try {
    await closeDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
