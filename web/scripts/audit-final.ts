/**
 * Final post-repair verification report (local SQLite).
 */
import { closeDb, ensureSchema, getArchiveStatus, getDbClient } from "../src/lib/db";

const LO = "2024-01-01";
const HI = "2026-07-20";
const BSE_STO = "2024-06-27";

async function main() {
  await ensureSchema();
  const db = getDbClient();
  const url = process.env.LIBSQL_URL?.trim() || "(local)";
  console.log("═══════════════════════════════════════════════════");
  console.log(" FINAL ARCHIVE AUDIT REPORT");
  console.log("═══════════════════════════════════════════════════");
  console.log("Target:", url.startsWith("libsql") ? url : url);
  console.log("Span check:", `${LO} → ${HI}`);

  const status = await getArchiveStatus();
  console.log("\n—— Status ——");
  console.log({
    docs: status.totalDocuments,
    days: status.tradingDays,
    span: `${status.earliestTradeDate} → ${status.latestTradeDate}`,
    symbols: status.symbolCount,
    INDEX: status.segments.INDEX,
    STOCK: status.segments.STOCK,
  });

  const bySeg = await db.execute(`
    SELECT exchange, segment,
           MIN(trade_date) AS lo, MAX(trade_date) AS hi,
           COUNT(DISTINCT trade_date) AS days,
           COUNT(DISTINCT symbol) AS symbols,
           COUNT(*) AS files,
           SUM(CASE WHEN side='CALL' THEN 1 ELSE 0 END) AS call_files,
           SUM(CASE WHEN side='PUT' THEN 1 ELSE 0 END) AS put_files
    FROM option_chains
    WHERE segment IN ('INDEX','STOCK')
    GROUP BY exchange, segment ORDER BY 1,2
  `);
  console.log("\n—— By exchange / segment ——");
  for (const r of bySeg.rows) console.log(r);

  const empty = await db.execute(`
    SELECT COUNT(*) AS c FROM option_chains
    WHERE row_count <= 0 OR rows_json IS NULL OR rows_json = '' OR rows_json = '[]'
  `);
  console.log("\nEmpty docs:", empty.rows[0]?.c);

  const caseDup = await db.execute(`
    SELECT COUNT(*) AS c FROM (
      SELECT 1 FROM option_chains
      GROUP BY exchange, segment, UPPER(symbol)
      HAVING COUNT(DISTINCT symbol) > 1
      LIMIT 5
    )
  `);
  console.log("Case-variant symbol groups:", caseDup.rows[0]?.c);

  // Day counts
  const days = await db.execute({
    sql: `
      SELECT
        COUNT(DISTINCT trade_date) AS union_days,
        COUNT(DISTINCT CASE WHEN exchange='NSE' THEN trade_date END) AS nse_days,
        COUNT(DISTINCT CASE WHEN exchange='BSE' THEN trade_date END) AS bse_days
      FROM option_chains
      WHERE segment IN ('INDEX','STOCK') AND trade_date BETWEEN ? AND ?
    `,
    args: [LO, HI],
  });
  console.log("\n—— Calendar ——", days.rows[0]);

  // NSE INDEX missing majors
  const missMajor = await db.execute({
    sql: `
      SELECT trade_date FROM (
        SELECT trade_date,
          MAX(CASE WHEN symbol='NIFTY' THEN 1 ELSE 0 END) AS nifty,
          MAX(CASE WHEN symbol='BANKNIFTY' THEN 1 ELSE 0 END) AS bn
        FROM option_chains
        WHERE exchange='NSE' AND segment='INDEX' AND trade_date BETWEEN ? AND ?
        GROUP BY trade_date
      ) WHERE nifty=0 OR bn=0 ORDER BY 1
    `,
    args: [LO, HI],
  });
  console.log("NSE INDEX days missing NIFTY/BANKNIFTY:", missMajor.rows.length || 0);

  // Majors
  console.log("\n—— Majors ——");
  for (const sym of ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"]) {
    const rs = await db.execute({
      sql: `SELECT exchange, MIN(trade_date) lo, MAX(trade_date) hi,
            COUNT(DISTINCT trade_date) days,
            COUNT(DISTINCT CASE WHEN side='CALL' THEN trade_date END) cd,
            COUNT(DISTINCT CASE WHEN side='PUT' THEN trade_date END) pd
            FROM option_chains WHERE symbol=? AND segment='INDEX' GROUP BY exchange`,
      args: [sym],
    });
    console.log(sym, rs.rows);
  }

  // BSE STOCK epoch note
  const bseSto = await db.execute({
    sql: `SELECT MIN(trade_date) lo, MAX(trade_date) hi, COUNT(DISTINCT trade_date) days
          FROM option_chains WHERE exchange='BSE' AND segment='STOCK'`,
  });
  console.log("\nBSE STOCK epoch (expected ≥", BSE_STO + "):", bseSto.rows[0]);

  // CALL/PUT day skew count for INDEX only (critical)
  const idxSkew = await db.execute(`
    SELECT COUNT(*) AS c FROM (
      SELECT exchange, symbol,
        COUNT(DISTINCT CASE WHEN side='CALL' THEN trade_date END) AS cd,
        COUNT(DISTINCT CASE WHEN side='PUT' THEN trade_date END) AS pd
      FROM option_chains WHERE segment='INDEX'
      GROUP BY exchange, symbol
      HAVING cd != pd
    )
  `);
  console.log("INDEX underlyings with CALL/PUT day skew:", idxSkew.rows[0]?.c);

  const stockSkew = await db.execute(`
    SELECT COUNT(*) AS c FROM (
      SELECT exchange, symbol,
        COUNT(DISTINCT CASE WHEN side='CALL' THEN trade_date END) AS cd,
        COUNT(DISTINCT CASE WHEN side='PUT' THEN trade_date END) AS pd
      FROM option_chains WHERE segment='STOCK'
      GROUP BY exchange, symbol
      HAVING cd != pd
    )
  `);
  console.log("STOCK underlyings with CALL/PUT day skew:", stockSkew.rows[0]?.c);

  // Verdict
  const issues: string[] = [];
  if (String(status.earliestTradeDate) > LO) issues.push(`starts late: ${status.earliestTradeDate}`);
  if (String(status.latestTradeDate) < HI) issues.push(`ends early: ${status.latestTradeDate}`);
  if (Number(empty.rows[0]?.c) > 0) issues.push(`empty docs: ${empty.rows[0]?.c}`);
  if (missMajor.rows.length) issues.push(`NSE INDEX major gaps: ${missMajor.rows.length}`);
  if (Number(idxSkew.rows[0]?.c) > 0) issues.push(`INDEX CALL/PUT day skew: ${idxSkew.rows[0]?.c}`);

  console.log("\n═══════════════════════════════════════════════════");
  if (issues.length === 0) {
    console.log("VERDICT: PASS — archive integrity OK for", `${LO}→${HI}`);
  } else {
    console.log("VERDICT: ISSUES");
    for (const i of issues) console.log(" ·", i);
  }
  await closeDb();
  process.exit(issues.length ? 1 : 0);
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
