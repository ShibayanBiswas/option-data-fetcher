/**
 * FAST Turso load: wipe remote, then parallel multi-worker copy from local SQLite.
 *
 *   npm run seed:turso:fast
 *
 * Env knobs:
 *   TURSO_WORKERS=8     concurrent writers (default 8)
 *   TURSO_BATCH=80      rows per remote batch (default 80)
 */
import fs from "fs";
import path from "path";
import { createClient, type Client, type InArgs } from "@libsql/client";
import {
  closeDb,
  dropAllChains,
  ensureSchema,
  getDbClient,
  refreshArchiveStats,
} from "../src/lib/db";
import {
  fetchTradingDates,
  latestWeekday,
  syncTradeDate,
} from "../src/lib/pipeline";
import { UDIFF_EPOCH } from "../src/lib/constants";

const LOCAL_DB = path.join(process.cwd(), "data", "option_chain.db");
const WORKERS = Math.max(1, Number(process.env.TURSO_WORKERS ?? 8));
const BATCH = Math.max(20, Number(process.env.TURSO_BATCH ?? 80));
const MAX_RETRIES = 10;

const INSERT_SQL = `
  INSERT INTO option_chains (
    exchange, segment, symbol, side, trade_date, expiry_date,
    row_count, rows_json, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(exchange, segment, symbol, side, trade_date, expiry_date)
  DO UPDATE SET
    row_count = excluded.row_count,
    rows_json = excluded.rows_json,
    updated_at = excluded.updated_at
`;

type ChainRow = {
  exchange: string | number | null;
  segment: string | number | null;
  symbol: string | number | null;
  side: string | number | null;
  trade_date: string | number | null;
  expiry_date: string | number | null;
  row_count: string | number | null;
  rows_json: string | number | null;
  updated_at: string | number | null;
};

function remoteClient(): Client {
  const url = process.env.LIBSQL_URL!;
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  return createClient({ url, authToken });
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const wait = Math.min(45_000, 400 * 2 ** attempt + Math.random() * 400);
      console.warn(
        `\n  [${label}] retry ${attempt}/${MAX_RETRIES} in ${(wait / 1000).toFixed(1)}s — ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function writeBatch(client: Client, rows: ChainRow[]): Promise<void> {
  if (rows.length === 0) return;
  const statements = rows.map((row) => ({
    sql: INSERT_SQL,
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
    ] as InArgs,
  }));
  await withRetry("batch", () => client.batch(statements, "write"));
}

async function workerCopy(
  workerId: number,
  lo: number,
  hi: number,
  progress: { done: number; total: number; t0: number }
): Promise<number> {
  const local = createClient({ url: `file:${LOCAL_DB}` });
  const remote = remoteClient();
  let written = 0;
  let cursor = lo;

  try {
    while (cursor <= hi) {
      const rs = await local.execute({
        sql: `
          SELECT exchange, segment, symbol, side, trade_date, expiry_date,
                 row_count, rows_json, updated_at, rowid AS rid
          FROM option_chains
          WHERE rowid >= ? AND rowid <= ?
          ORDER BY rowid
          LIMIT ?
        `,
        args: [cursor, hi, BATCH],
      });
      if (rs.rows.length === 0) break;

      const rows = rs.rows as unknown as (ChainRow & { rid: number })[];
      await writeBatch(remote, rows);
      written += rows.length;
      progress.done += rows.length;
      const lastRid = Number(rows[rows.length - 1].rid);
      cursor = lastRid + 1;

      if (progress.done % (BATCH * WORKERS) < BATCH) {
        const elapsed = (Date.now() - progress.t0) / 1000;
        const rate = progress.done / Math.max(1, elapsed);
        const eta = (progress.total - progress.done) / Math.max(1, rate);
        process.stdout.write(
          `\rW${workerId} ${progress.done.toLocaleString()}/${progress.total.toLocaleString()} ` +
            `(${((100 * progress.done) / progress.total).toFixed(1)}%) ` +
            `${rate.toFixed(0)} rows/s ETA ${Math.ceil(eta / 60)}m   `
        );
      }
    }
  } finally {
    local.close();
    remote.close();
  }
  return written;
}

async function parallelCopy(): Promise<number> {
  const local = createClient({ url: `file:${LOCAL_DB}` });
  const meta = await local.execute(
    `SELECT MIN(rowid) AS lo, MAX(rowid) AS hi, COUNT(*) AS n FROM option_chains`
  );
  local.close();

  const lo = Number(meta.rows[0]?.lo ?? 0);
  const hi = Number(meta.rows[0]?.hi ?? 0);
  const total = Number(meta.rows[0]?.n ?? 0);
  if (total === 0) return 0;

  console.log(
    `Local rows=${total.toLocaleString()} rowid=${lo}..${hi} · workers=${WORKERS} · batch=${BATCH}`
  );

  const span = hi - lo + 1;
  const chunk = Math.ceil(span / WORKERS);
  const progress = { done: 0, total, t0: Date.now() };

  const jobs: Promise<number>[] = [];
  for (let w = 0; w < WORKERS; w++) {
    const start = lo + w * chunk;
    const end = Math.min(hi, start + chunk - 1);
    if (start > hi) break;
    jobs.push(workerCopy(w + 1, start, end, progress));
  }

  const counts = await Promise.all(jobs);
  const sum = counts.reduce((a, b) => a + b, 0);
  const secs = (Date.now() - progress.t0) / 1000;
  console.log(
    `\nCopy done: ${sum.toLocaleString()} rows in ${(secs / 60).toFixed(1)} min ` +
      `(${(sum / secs).toFixed(0)} rows/s)`
  );
  return sum;
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
    throw new Error("LIBSQL_URL must point at Turso");
  }
  if (!process.env.LIBSQL_AUTH_TOKEN) {
    throw new Error("LIBSQL_AUTH_TOKEN is required");
  }
  if (!fs.existsSync(LOCAL_DB)) {
    throw new Error(`Local DB not found: ${LOCAL_DB}`);
  }

  console.log("Local:", LOCAL_DB);
  console.log("Turso:", process.env.LIBSQL_URL);

  await ensureSchema();

  console.log("\n—— 1/3 Wipe Turso ——");
  await dropAllChains();
  console.log("Cleared.");

  console.log("\n—— 2/3 Parallel copy local → Turso ——");
  process.env.SKIP_STATS_REFRESH = "1";
  await parallelCopy();

  console.log("\n—— 3/3 Backfill newer bhavcopy sessions ——");
  await backfillTail();

  process.env.SKIP_STATS_REFRESH = "0";
  console.log("\nRefreshing archive_stats…");
  const status = await refreshArchiveStats();
  console.log("\n—— Turso ready ——");
  console.log({
    docs: status.totalDocuments,
    days: status.tradingDays,
    span: `${status.earliestTradeDate} → ${status.latestTradeDate}`,
    INDEX: status.segments.INDEX,
    STOCK: status.segments.STOCK,
  });
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
