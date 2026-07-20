/**
 * Wipe Turso, then bulk-copy from local SQLite (web/data/option_chain.db).
 * Much faster than re-downloading every bhavcopy.
 *
 *   npx tsx --env-file=.env.local scripts/turso-from-local.ts
 */
import fs from "fs";
import path from "path";
import { createClient, type Client } from "@libsql/client";
import {
  closeDb,
  dropAllChains,
  ensureSchema,
  getArchiveStatus,
  getDbClient,
} from "../src/lib/db";
import {
  fetchTradingDates,
  latestWeekday,
  syncTradeDate,
} from "../src/lib/pipeline";
import { UDIFF_EPOCH } from "../src/lib/constants";

const LOCAL_DB = path.join(process.cwd(), "data", "option_chain.db");
const PAGE = 400;

async function copyAll(local: Client, remote: Client) {
  let offset = 0;
  let total = 0;
  const countRs = await local.execute(`SELECT COUNT(*) AS n FROM option_chains`);
  const expected = Number(countRs.rows[0]?.n ?? 0);
  console.log(`Local rows to copy: ${expected.toLocaleString()}`);

  while (true) {
    const rs = await local.execute({
      sql: `
        SELECT exchange, segment, symbol, side, trade_date, expiry_date,
               row_count, rows_json, updated_at
        FROM option_chains
        ORDER BY trade_date, exchange, segment, symbol, side, expiry_date
        LIMIT ? OFFSET ?
      `,
      args: [PAGE, offset],
    });
    if (rs.rows.length === 0) break;

    const statements = rs.rows.map((row) => ({
      sql: `
        INSERT INTO option_chains (
          exchange, segment, symbol, side, trade_date, expiry_date,
          row_count, rows_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(exchange, segment, symbol, side, trade_date, expiry_date)
        DO UPDATE SET
          row_count = excluded.row_count,
          rows_json = excluded.rows_json,
          updated_at = excluded.updated_at
      `,
      args: [
        row.exchange,
        row.segment,
        row.symbol,
        row.side,
        row.trade_date,
        row.expiry_date,
        row.row_count,
        row.rows_json,
        row.updated_at,
      ],
    }));

    await remote.batch(statements, "write");
    total += rs.rows.length;
    offset += rs.rows.length;
    if (total % 2000 === 0 || rs.rows.length < PAGE) {
      process.stdout.write(
        `\rCopied ${total.toLocaleString()} / ${expected.toLocaleString()}…`
      );
    }
  }
  console.log(`\nCopy done: ${total.toLocaleString()} rows`);
  return total;
}

async function backfillTail() {
  process.env.SKIP_LOCAL_STORE = "1";
  const dates = await fetchTradingDates();
  const cutoff = latestWeekday();
  const ready = dates.filter((d) => d <= cutoff && d >= UDIFF_EPOCH);
  const remote = getDbClient();
  const haveRs = await remote.execute(
    `SELECT DISTINCT trade_date AS d FROM option_chains ORDER BY d`
  );
  const have = new Set(haveRs.rows.map((r) => String(r.d)));
  const missing = ready.filter((d) => !have.has(d));
  console.log(`\nTail backfill: ${missing.length} session(s) missing`);
  for (let i = 0; i < missing.length; i++) {
    const date = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${date} … `);
    const result = await syncTradeDate(date, ["NSE", "BSE"], { force: true });
    console.log(result.status);
  }
}

async function main() {
  if (!process.env.LIBSQL_URL?.startsWith("libsql://")) {
    throw new Error("LIBSQL_URL must point at Turso for this script");
  }
  if (!fs.existsSync(LOCAL_DB)) {
    throw new Error(`Local DB not found: ${LOCAL_DB}`);
  }

  console.log("Local:", LOCAL_DB);
  console.log("Turso:", process.env.LIBSQL_URL);

  const local = createClient({ url: `file:${LOCAL_DB}` });
  await ensureSchema();
  const remote = getDbClient();

  console.log("\n—— 1/3 Wipe Turso ——");
  await dropAllChains();
  console.log("Cleared.");

  console.log("\n—— 2/3 Bulk copy local → Turso ——");
  await copyAll(local, remote);

  console.log("\n—— 3/3 Backfill any newer sessions from bhavcopy ——");
  await backfillTail();

  const status = await getArchiveStatus();
  console.log("\n—— Turso ready ——");
  console.log({
    docs: status.totalDocuments,
    days: status.tradingDays,
    span: `${status.earliestTradeDate} → ${status.latestTradeDate}`,
    INDEX: status.segments.INDEX,
    STOCK: status.segments.STOCK,
  });

  local.close();
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
