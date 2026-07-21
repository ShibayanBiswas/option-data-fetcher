import { closeDb, ensureSchema, getArchiveStatus, getDbClient } from "../src/lib/db";

async function main() {
  await ensureSchema();
  const db = getDbClient();
  const status = await getArchiveStatus();
  console.log("STATUS", {
    docs: status.totalDocuments,
    days: status.tradingDays,
    span: `${status.earliestTradeDate}→${status.latestTradeDate}`,
    INDEX: status.segments.INDEX,
    STOCK: status.segments.STOCK,
  });

  const empty = await db.execute(`
    SELECT COUNT(*) AS c FROM option_chains
    WHERE row_count <= 0 OR rows_json IS NULL OR rows_json = '' OR rows_json = '[]'
  `);
  console.log("empty_docs", empty.rows[0]);

  for (const sym of ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"]) {
    const rs = await db.execute({
      sql: `
        SELECT exchange, MIN(trade_date) AS lo, MAX(trade_date) AS hi,
          COUNT(DISTINCT trade_date) AS days,
          COUNT(DISTINCT CASE WHEN side = 'CALL' THEN trade_date END) AS cd,
          COUNT(DISTINCT CASE WHEN side = 'PUT' THEN trade_date END) AS pd
        FROM option_chains
        WHERE symbol = ? AND segment = 'INDEX'
        GROUP BY exchange
      `,
      args: [sym],
    });
    console.log(sym, rs.rows);
  }

  const counts = await db.execute(`
    SELECT
      (SELECT COUNT(DISTINCT trade_date) FROM option_chains
        WHERE exchange='NSE' AND segment='INDEX'
          AND trade_date BETWEEN '2024-01-01' AND '2026-07-20') AS nse_idx,
      (SELECT COUNT(DISTINCT trade_date) FROM option_chains
        WHERE exchange='NSE' AND segment='STOCK'
          AND trade_date BETWEEN '2024-01-01' AND '2026-07-20') AS nse_sto,
      (SELECT COUNT(DISTINCT trade_date) FROM option_chains
        WHERE exchange='BSE' AND segment='INDEX'
          AND trade_date BETWEEN '2024-01-01' AND '2026-07-20') AS bse_idx,
      (SELECT COUNT(DISTINCT trade_date) FROM option_chains
        WHERE exchange='BSE' AND segment='STOCK'
          AND trade_date BETWEEN '2024-06-27' AND '2026-07-20') AS bse_sto
  `);
  console.log("day_counts", counts.rows[0]);

  const sensex50 = await db.execute(`
    SELECT
      COUNT(DISTINCT CASE WHEN side='CALL' THEN trade_date END) AS cd,
      COUNT(DISTINCT CASE WHEN side='PUT' THEN trade_date END) AS pd,
      MIN(trade_date) AS lo, MAX(trade_date) AS hi
    FROM option_chains
    WHERE exchange='BSE' AND segment='INDEX' AND symbol='SENSEX50'
  `);
  console.log("SENSEX50", sensex50.rows[0]);

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
