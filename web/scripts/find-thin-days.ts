/**
 * Find sessions where INDEX/STOCK coverage looks partial vs peers.
 * Usage: npx tsx --env-file=.env.local scripts/find-thin-days.ts
 */
import { closeDb, ensureSchema, getDbClient } from "../src/lib/db";

async function main() {
  await ensureSchema();
  const db = getDbClient();
  console.log("Target:", process.env.LIBSQL_URL?.slice(0, 60));

  // Days with NSE STOCK but no NSE INDEX
  const noIdx = await db.execute(`
    SELECT s.trade_date, s.stock_files, s.stock_symbols
    FROM (
      SELECT trade_date,
             COUNT(*) AS stock_files,
             COUNT(DISTINCT symbol) AS stock_symbols
      FROM option_chains
      WHERE exchange='NSE' AND segment='STOCK'
        AND trade_date BETWEEN '2024-01-01' AND '2026-07-20'
      GROUP BY trade_date
    ) s
    LEFT JOIN (
      SELECT DISTINCT trade_date AS d FROM option_chains
      WHERE exchange='NSE' AND segment='INDEX'
    ) i ON i.d = s.trade_date
    WHERE i.d IS NULL
    ORDER BY s.trade_date
  `);
  console.log("\nNSE STOCK present but NSE INDEX missing:");
  console.log(noIdx.rows.length ? noIdx.rows : "(none)");

  // Days with BSE STOCK/INDEX peer but thin NSE STOCK (<50 symbols typical is 100+)
  const thinNse = await db.execute(`
    SELECT trade_date,
           SUM(CASE WHEN exchange='NSE' AND segment='STOCK' THEN 1 ELSE 0 END) AS nse_stock_files,
           COUNT(DISTINCT CASE WHEN exchange='NSE' AND segment='STOCK' THEN symbol END) AS nse_stock_syms,
           SUM(CASE WHEN exchange='NSE' AND segment='INDEX' THEN 1 ELSE 0 END) AS nse_idx_files,
           COUNT(DISTINCT CASE WHEN exchange='NSE' AND segment='INDEX' THEN symbol END) AS nse_idx_syms,
           SUM(CASE WHEN exchange='BSE' AND segment='INDEX' THEN 1 ELSE 0 END) AS bse_idx_files
    FROM option_chains
    WHERE trade_date BETWEEN '2024-01-01' AND '2026-07-20'
    GROUP BY trade_date
    HAVING nse_stock_syms > 0 AND nse_stock_syms < 80
    ORDER BY nse_stock_syms ASC, trade_date
    LIMIT 40
  `);
  console.log("\nThin NSE STOCK days (<80 symbols):");
  for (const r of thinNse.rows) console.log(r);

  // NSE INDEX days missing any of the 4 majors
  const missMajor = await db.execute(`
    SELECT trade_date,
      MAX(CASE WHEN symbol='NIFTY' THEN 1 ELSE 0 END) AS nifty,
      MAX(CASE WHEN symbol='BANKNIFTY' THEN 1 ELSE 0 END) AS banknifty,
      MAX(CASE WHEN symbol='FINNIFTY' THEN 1 ELSE 0 END) AS finnifty,
      MAX(CASE WHEN symbol='MIDCPNIFTY' THEN 1 ELSE 0 END) AS midcp
    FROM option_chains
    WHERE exchange='NSE' AND segment='INDEX'
      AND trade_date BETWEEN '2024-01-01' AND '2026-07-20'
    GROUP BY trade_date
    HAVING nifty=0 OR banknifty=0 OR finnifty=0 OR midcp=0
    ORDER BY trade_date
  `);
  console.log("\nNSE INDEX days missing a major underlying:");
  console.log(missMajor.rows.length ? missMajor.rows : "(none)");

  // BSE INDEX days missing SENSEX
  const missSensex = await db.execute(`
    SELECT trade_date,
      MAX(CASE WHEN symbol='SENSEX' THEN 1 ELSE 0 END) AS sensex,
      MAX(CASE WHEN symbol='BANKEX' THEN 1 ELSE 0 END) AS bankex
    FROM option_chains
    WHERE exchange='BSE' AND segment='INDEX'
      AND trade_date BETWEEN '2024-01-01' AND '2026-07-20'
    GROUP BY trade_date
    HAVING sensex=0 OR bankex=0
    ORDER BY trade_date
    LIMIT 30
  `);
  console.log("\nBSE INDEX days missing SENSEX or BANKEX:");
  console.log(missSensex.rows.length ? missSensex.rows : "(none)");

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
