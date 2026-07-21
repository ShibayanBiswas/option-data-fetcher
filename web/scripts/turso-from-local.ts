/**
 * FAST Turso load: wipe remote, then parallel multi-worker copy from local SQLite.
 *
 *   npm run seed:turso:fast
 *
 * Env knobs (quota-safe defaults for new Turso accounts):
 *   TURSO_WORKERS=2     concurrent writers (default 2 — avoid rate limits)
 *   TURSO_BATCH=40      rows per remote batch (default 40)
 */
import fs from "fs";
import path from "path";
import { createClient, type Client, type InArgs } from "@libsql/client";
import {
  closeDb,
  dropAllChains,
  ensureSchema,
  getDbClient,
  writeArchiveStats,
  type ArchiveStatus,
} from "../src/lib/db";
import {
  fetchTradingDates,
  latestWeekday,
  syncTradeDate,
} from "../src/lib/pipeline";
import { ARCHIVE_EPOCH } from "../src/lib/constants";

const LOCAL_DB = path.join(process.cwd(), "data", "option_chain.db");
const WORKERS = Math.max(1, Number(process.env.TURSO_WORKERS ?? 2));
const BATCH = Math.max(10, Number(process.env.TURSO_BATCH ?? 40));
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
      const msg = err instanceof Error ? err.message : String(err);
      const quota =
        /429|rate limit|quota|rows read|too many requests|401/i.test(msg);
      const wait = quota
        ? Math.min(120_000, 5_000 * 2 ** (attempt - 1) + Math.random() * 1000)
        : Math.min(45_000, 400 * 2 ** attempt + Math.random() * 400);
      console.warn(
        `\n  [${label}] retry ${attempt}/${MAX_RETRIES} in ${(wait / 1000).toFixed(1)}s — ${msg.slice(0, 160)}`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

async function computeStatsFromLocal(local: Client): Promise<ArchiveStatus> {
  const totalRs = await local.execute(`SELECT COUNT(*) AS n FROM option_chains`);
  const spanRs = await local.execute(
    `SELECT MIN(trade_date) AS lo, MAX(trade_date) AS hi, COUNT(DISTINCT trade_date) AS days FROM option_chains`
  );
  const symRs = await local.execute(
    `SELECT COUNT(DISTINCT symbol) AS n FROM option_chains`
  );
  const exRs = await local.execute(
    `SELECT DISTINCT exchange AS v FROM option_chains ORDER BY v`
  );
  const segRs = await local.execute(
    `SELECT segment AS s, COUNT(*) AS n FROM option_chains GROUP BY segment`
  );
  const segMap: Record<string, number> = { INDEX: 0, STOCK: 0, OTHER: 0 };
  for (const r of segRs.rows) {
    segMap[String(r.s)] = Number(r.n);
  }
  return {
    totalDocuments: Number(totalRs.rows[0]?.n ?? 0),
    earliestTradeDate: (spanRs.rows[0]?.lo as string) ?? null,
    latestTradeDate: (spanRs.rows[0]?.hi as string) ?? null,
    tradingDays: Number(spanRs.rows[0]?.days ?? 0),
    exchanges: exRs.rows.map((r) => String(r.v)).filter(Boolean),
    symbolCount: Number(symRs.rows[0]?.n ?? 0),
    segments: {
      INDEX: segMap.INDEX ?? 0,
      STOCK: segMap.STOCK ?? 0,
      OTHER: segMap.OTHER ?? 0,
    },
  };
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
  const ready = dates.filter((d) => d <= cutoff && d >= ARCHIVE_EPOCH);
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
  console.log("\nWriting archive_stats (computed from local — 1 Turso write)…");
  const local = createClient({ url: `file:${LOCAL_DB}` });
  const status = await computeStatsFromLocal(local);
  local.close();
  await writeArchiveStats(status);
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
