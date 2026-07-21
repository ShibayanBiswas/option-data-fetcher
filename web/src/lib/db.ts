/**
 * SQLite / libSQL archive store.
 *
 * Local:  file:./data/option_chain.db  (or SQLITE_URL / LIBSQL_URL)
 * Vercel: set LIBSQL_URL (+ LIBSQL_AUTH_TOKEN) to a Turso database —
 *         plain SQLite files cannot persist on serverless.
 *
 * Rate-limit / free-tier safety:
 * - KPIs come from one-row `archive_stats` (never full-table COUNT on page load)
 * - Distinct lists + status are cached in-memory (longer TTL on Turso)
 * - Missing `archive_stats` on remote returns zeros — run `npm run push:stats`
 */
import { createClient, type Client } from "@libsql/client";
import path from "path";
import fs from "fs";
import type { OptionChainDoc, OptionRow } from "./types";

export type ChainFilter = {
  exchange?: string;
  segment?: string;
  symbol?: string;
  side?: string;
  tradeDate?: string;
  expiryDate?: string;
};

declare global {
  var _libsqlClient: Client | undefined;
  var _libsqlSchemaReady: boolean | undefined;
  var _archiveStatusCache:
    | { at: number; value: ArchiveStatus }
    | undefined;
}

export type ArchiveStatus = {
  totalDocuments: number;
  earliestTradeDate: string | null;
  latestTradeDate: string | null;
  tradingDays: number;
  exchanges: string[];
  symbolCount: number;
  segments: { INDEX: number; STOCK: number; OTHER: number };
};

/** Human-readable Turso / libSQL errors (quota, auth, etc.). */
export function formatDbError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("quota") ||
    lower.includes("rows read") ||
    lower.includes("rows-read") ||
    lower.includes("rate limit") ||
    lower.includes("ratelimit") ||
    lower.includes("too many requests") ||
    lower.includes("blocked") ||
    lower.includes("429")
  ) {
    return (
      "Turso usage limit reached (rows read/written). " +
        "Normal browsing uses cached KPIs; wait for monthly reset or upgrade the Turso plan. " +
        "Do not re-run full-table audits against Turso."
    );
  }
  if (lower.includes("401") || lower.includes("unauthorized")) {
    return (
      "Turso auth failed. Check LIBSQL_URL and LIBSQL_AUTH_TOKEN on Vercel " +
        "(Production + Preview), then redeploy."
    );
  }
  if (lower.includes("fetch failed") || lower.includes("timeout")) {
    return "Database connection timed out. Retry in a moment.";
  }
  return raw || "Database error";
}

export function isQuotaOrAuthError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    raw.includes("quota") ||
    raw.includes("rows read") ||
    raw.includes("rows-read") ||
    raw.includes("rate limit") ||
    raw.includes("ratelimit") ||
    raw.includes("too many requests") ||
    raw.includes("blocked") ||
    raw.includes("429") ||
    raw.includes("401") ||
    raw.includes("unauthorized")
  );
}

/** True only for usage/quota blocks (not auth). */
export function isQuotaError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    raw.includes("quota") ||
    raw.includes("rows read") ||
    raw.includes("rows-read") ||
    raw.includes("rate limit") ||
    raw.includes("ratelimit") ||
    raw.includes("too many requests") ||
    raw.includes("blocked") ||
    raw.includes("429")
  );
}

export function isRemoteLibsql(): boolean {
  const url =
    process.env.LIBSQL_URL?.trim() ||
    process.env.TURSO_DATABASE_URL?.trim() ||
    process.env.SQLITE_URL?.trim() ||
    "";
  return url.startsWith("libsql://") || url.startsWith("https://");
}

function resolveDbUrl(): { url: string; authToken?: string } {
  const remote =
    process.env.LIBSQL_URL?.trim() ||
    process.env.TURSO_DATABASE_URL?.trim() ||
    process.env.SQLITE_URL?.trim();
  if (remote && (remote.startsWith("libsql://") || remote.startsWith("https://"))) {
    return {
      url: remote,
      authToken:
        process.env.LIBSQL_AUTH_TOKEN?.trim() ||
        process.env.TURSO_AUTH_TOKEN?.trim(),
    };
  }
  if (remote?.startsWith("file:")) {
    return { url: remote };
  }
  // Absolute or relative filesystem paths (without file: prefix)
  if (remote && (remote.startsWith("/") || remote.startsWith("./") || remote.startsWith("../"))) {
    const abs = path.isAbsolute(remote) ? remote : path.join(process.cwd(), remote);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return { url: `file:${abs}` };
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const filePath = path.join(dataDir, "option_chain.db");
  return { url: `file:${filePath}` };
}

export function getDbClient(): Client {
  if (!global._libsqlClient) {
    const { url, authToken } = resolveDbUrl();
    if (
      (url.startsWith("libsql://") || url.startsWith("https://")) &&
      !authToken
    ) {
      throw new Error(
        "Remote libSQL/Turso URL is set but LIBSQL_AUTH_TOKEN (or TURSO_AUTH_TOKEN) is missing."
      );
    }
    global._libsqlClient = createClient({ url, authToken });
  }
  return global._libsqlClient;
}

export async function ensureSchema(): Promise<void> {
  if (global._libsqlSchemaReady) return;
  const db = getDbClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS option_chains (
      exchange TEXT NOT NULL,
      segment TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      rows_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (exchange, segment, symbol, side, trade_date, expiry_date)
    )
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_chains_trade_date ON option_chains(trade_date)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_chains_symbol ON option_chains(exchange, segment, symbol)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_chains_segment ON option_chains(exchange, segment)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_chains_side_dates ON option_chains(exchange, segment, symbol, side, trade_date)`
  );
  // One-row KPI cache — avoids COUNT(*) / DISTINCT scans on every page load (Turso rows-read).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS archive_stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_documents INTEGER NOT NULL DEFAULT 0,
      earliest_trade_date TEXT,
      latest_trade_date TEXT,
      trading_days INTEGER NOT NULL DEFAULT 0,
      symbol_count INTEGER NOT NULL DEFAULT 0,
      index_files INTEGER NOT NULL DEFAULT 0,
      stock_files INTEGER NOT NULL DEFAULT 0,
      other_files INTEGER NOT NULL DEFAULT 0,
      exchanges_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    )
  `);
  global._libsqlSchemaReady = true;
}

/** @deprecated alias — schema replaces Mongo indexes */
export async function ensureIndexes(): Promise<void> {
  await ensureSchema();
}

function rowToDoc(row: Record<string, unknown>): OptionChainDoc {
  let rows: OptionRow[] = [];
  try {
    rows = JSON.parse(String(row.rows_json ?? "[]")) as OptionRow[];
  } catch {
    rows = [];
  }
  return {
    exchange: row.exchange as OptionChainDoc["exchange"],
    segment: row.segment as OptionChainDoc["segment"],
    symbol: String(row.symbol),
    side: row.side as OptionChainDoc["side"],
    tradeDate: String(row.trade_date),
    expiryDate: String(row.expiry_date),
    rows,
    rowCount: Number(row.row_count ?? rows.length),
    updatedAt: new Date(String(row.updated_at ?? Date.now())),
  };
}

function whereClause(filter: ChainFilter): {
  sql: string;
  args: (string | number)[];
} {
  const parts: string[] = [];
  const args: (string | number)[] = [];
  const map: [keyof ChainFilter, string][] = [
    ["exchange", "exchange"],
    ["segment", "segment"],
    ["symbol", "symbol"],
    ["side", "side"],
    ["tradeDate", "trade_date"],
    ["expiryDate", "expiry_date"],
  ];
  for (const [key, col] of map) {
    const v = filter[key];
    if (v != null && v !== "") {
      parts.push(`${col} = ?`);
      args.push(v);
    }
  }
  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    args,
  };
}

async function withWriteRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = 6
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        /fetch failed|timeout|TEMP|busy|429|503|502|500|UND_ERR/i.test(msg) ||
        (err as { cause?: { code?: string } })?.cause?.code?.includes("TIMEOUT");
      if (!retryable || attempt === retries) break;
      const wait = Math.min(30_000, 400 * 2 ** (attempt - 1));
      console.warn(
        `  [${label}] retry ${attempt}/${retries} in ${(wait / 1000).toFixed(1)}s — ${msg.slice(0, 120)}`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export async function upsertChainDocs(docs: OptionChainDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  await ensureSchema();
  const db = getDbClient();
  const remote =
    process.env.LIBSQL_URL?.startsWith("libsql://") ||
    process.env.LIBSQL_URL?.startsWith("https://");

  const chunkSize = remote
    ? Math.max(20, Number(process.env.TURSO_BATCH ?? 60))
    : 40;
  const totalChunks = Math.ceil(docs.length / chunkSize);
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const chunkNo = Math.floor(i / chunkSize) + 1;
    const statements = chunk.map((doc) => ({
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
        doc.exchange,
        doc.segment,
        doc.symbol,
        doc.side,
        doc.tradeDate,
        doc.expiryDate,
        doc.rowCount,
        JSON.stringify(doc.rows),
        (doc.updatedAt instanceof Date
          ? doc.updatedAt
          : new Date(doc.updatedAt)
        ).toISOString(),
      ],
    }));
    await withWriteRetry(`upsert ${chunkNo}/${totalChunks}`, () =>
      db.batch(statements, "write")
    );
  }
  invalidateDistinctCache();
  return docs.length;
}

export async function countChains(filter: ChainFilter = {}): Promise<number> {
  await ensureSchema();
  const db = getDbClient();
  const { sql, args } = whereClause(filter);
  const rs = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM option_chains ${sql}`,
    args,
  });
  return Number(rs.rows[0]?.n ?? 0);
}

const distinctCache = new Map<string, { at: number; values: string[] }>();

function distinctTtlMs(): number {
  // Longer TTL on Turso — DISTINCT over large tables burns rows-read quota.
  return isRemoteLibsql() ? 10 * 60_000 : 30_000;
}

export async function distinctValues(
  field: keyof ChainFilter | "tradeDate" | "expiryDate" | "exchange" | "segment" | "symbol" | "side",
  filter: ChainFilter = {}
): Promise<string[]> {
  await ensureSchema();
  const colMap: Record<string, string> = {
    exchange: "exchange",
    segment: "segment",
    symbol: "symbol",
    side: "side",
    tradeDate: "trade_date",
    expiryDate: "expiry_date",
  };
  const col = colMap[field];
  if (!col) return [];

  const cacheKey = `${field}:${JSON.stringify(filter)}`;
  const hit = distinctCache.get(cacheKey);
  if (hit && Date.now() - hit.at < distinctTtlMs()) {
    return hit.values;
  }

  const { sql, args } = whereClause(filter);
  const db = getDbClient();
  const rs = await db.execute({
    sql: `SELECT DISTINCT ${col} AS v FROM option_chains ${sql} ORDER BY v ASC`,
    args,
  });
  const values = rs.rows.map((r) => String(r.v)).filter(Boolean);
  distinctCache.set(cacheKey, { at: Date.now(), values });
  // Bound cache size
  if (distinctCache.size > 200) {
    const first = distinctCache.keys().next().value;
    if (first) distinctCache.delete(first);
  }
  return values;
}

/** Clear distinct + status caches after writes (sync / seed). */
export function invalidateDistinctCache(): void {
  distinctCache.clear();
  global._archiveStatusCache = undefined;
}

export async function findChains(
  filter: ChainFilter,
  options: { sortTradeDateDesc?: boolean; limit?: number; offset?: number } = {}
): Promise<OptionChainDoc[]> {
  await ensureSchema();
  const db = getDbClient();
  const { sql, args } = whereClause(filter);
  const order = options.sortTradeDateDesc
    ? "ORDER BY trade_date DESC, expiry_date ASC"
    : "ORDER BY trade_date ASC, expiry_date ASC";
  const limit =
    options.limit != null ? `LIMIT ${Math.max(1, options.limit)}` : "";
  const offset =
    options.offset != null && options.limit != null
      ? `OFFSET ${Math.max(0, options.offset)}`
      : "";
  const rs = await db.execute({
    sql: `SELECT * FROM option_chains ${sql} ${order} ${limit} ${offset}`,
    args,
  });
  return rs.rows.map((r) => rowToDoc(r as Record<string, unknown>));
}

export async function getArchiveStatus(): Promise<ArchiveStatus> {
  await ensureSchema();

  const memTtl = isRemoteLibsql() ? 5 * 60_000 : 30_000;
  const cached = global._archiveStatusCache;
  if (cached && Date.now() - cached.at < memTtl) {
    return cached.value;
  }

  const db = getDbClient();
  const rs = await db.execute(
    `SELECT * FROM archive_stats WHERE id = 1 LIMIT 1`
  );
  const row = rs.rows[0] as Record<string, unknown> | undefined;

  if (row) {
    let exchanges: string[] = ["NSE", "BSE"];
    try {
      const parsed = JSON.parse(String(row.exchanges_json ?? "[]"));
      if (Array.isArray(parsed) && parsed.length) exchanges = parsed.map(String);
    } catch {
      /* keep default */
    }
    const value: ArchiveStatus = {
      totalDocuments: Number(row.total_documents ?? 0),
      earliestTradeDate: (row.earliest_trade_date as string) ?? null,
      latestTradeDate: (row.latest_trade_date as string) ?? null,
      tradingDays: Number(row.trading_days ?? 0),
      exchanges,
      symbolCount: Number(row.symbol_count ?? 0),
      segments: {
        INDEX: Number(row.index_files ?? 0),
        STOCK: Number(row.stock_files ?? 0),
        OTHER: Number(row.other_files ?? 0),
      },
    };
    global._archiveStatusCache = { at: Date.now(), value };
    return value;
  }

  // Never full-table scan on Turso from a page request — burns free-tier quota.
  // Run `npm run push:stats` after seed to populate archive_stats.
  if (isRemoteLibsql()) {
    const empty: ArchiveStatus = {
      totalDocuments: 0,
      earliestTradeDate: null,
      latestTradeDate: null,
      tradingDays: 0,
      exchanges: ["NSE", "BSE"],
      symbolCount: 0,
      segments: { INDEX: 0, STOCK: 0, OTHER: 0 },
    };
    global._archiveStatusCache = { at: Date.now(), value: empty };
    return empty;
  }

  // Local file only: one expensive recompute on first boot.
  return refreshArchiveStats();
}

/**
 * Full-table recompute of archive_stats.
 * NEVER run on Turso from request/sync paths — burns millions of rows-read.
 * Use touchArchiveStatsAfterDay on remote, or `npm run push:stats` from laptop.
 */
export async function refreshArchiveStats(): Promise<ArchiveStatus> {
  if (isRemoteLibsql() && process.env.FORCE_STATS_REFRESH !== "1") {
    throw new Error(
      "refused: full archive_stats scan on Turso. " +
        "Use touchArchiveStatsAfterDay, or run npm run push:stats from local file."
    );
  }
  await ensureSchema();
  const db = getDbClient();
  const totalRs = await db.execute(`SELECT COUNT(*) AS n FROM option_chains`);
  const spanRs = await db.execute(
    `SELECT MIN(trade_date) AS lo, MAX(trade_date) AS hi, COUNT(DISTINCT trade_date) AS days FROM option_chains`
  );
  const symRs = await db.execute(
    `SELECT COUNT(DISTINCT symbol) AS n FROM option_chains`
  );
  const exRs = await db.execute(
    `SELECT DISTINCT exchange AS v FROM option_chains ORDER BY v`
  );
  const segRs = await db.execute(
    `SELECT segment AS s, COUNT(*) AS n FROM option_chains GROUP BY segment`
  );
  const segMap: Record<string, number> = { INDEX: 0, STOCK: 0, OTHER: 0 };
  for (const r of segRs.rows) {
    segMap[String(r.s)] = Number(r.n);
  }
  const exchanges = exRs.rows.map((r) => String(r.v)).filter(Boolean);
  const value: ArchiveStatus = {
    totalDocuments: Number(totalRs.rows[0]?.n ?? 0),
    earliestTradeDate: (spanRs.rows[0]?.lo as string) ?? null,
    latestTradeDate: (spanRs.rows[0]?.hi as string) ?? null,
    tradingDays: Number(spanRs.rows[0]?.days ?? 0),
    exchanges: exchanges.length ? exchanges : ["NSE", "BSE"],
    symbolCount: Number(symRs.rows[0]?.n ?? 0),
    segments: {
      INDEX: segMap.INDEX ?? 0,
      STOCK: segMap.STOCK ?? 0,
      OTHER: segMap.OTHER ?? 0,
    },
  };

  await writeArchiveStats(value);
  return value;
}

/**
 * Cheap KPI update after a single-day sync (Turso-safe).
 * Reads only that trade_date's rows + the one archive_stats row — not the full table.
 */
export async function touchArchiveStatsAfterDay(
  tradeDate: string,
  beforeDayCount: number,
  afterDayCount: number
): Promise<ArchiveStatus> {
  await ensureSchema();
  const prev = await getArchiveStatus();
  const delta = afterDayCount - beforeDayCount;
  const wasEmptyDay = beforeDayCount <= 0 && afterDayCount > 0;

  let tradingDays = prev.tradingDays;
  if (wasEmptyDay) tradingDays += 1;

  let earliest = prev.earliestTradeDate;
  let latest = prev.latestTradeDate;
  if (!earliest || tradeDate < earliest) earliest = tradeDate;
  if (!latest || tradeDate > latest) latest = tradeDate;

  // Segment split: approximate by counting this day only (small).
  const db = getDbClient();
  const segRs = await db.execute({
    sql: `SELECT segment AS s, COUNT(*) AS n FROM option_chains WHERE trade_date = ? GROUP BY segment`,
    args: [tradeDate],
  });
  // We only adjust totals by delta; keep prior segment totals adjusted loosely
  const value: ArchiveStatus = {
    totalDocuments: Math.max(0, prev.totalDocuments + delta),
    earliestTradeDate: earliest,
    latestTradeDate: latest,
    tradingDays,
    exchanges: prev.exchanges.length ? prev.exchanges : ["NSE", "BSE"],
    symbolCount: prev.symbolCount, // avoid DISTINCT symbol scan
    segments: { ...prev.segments },
  };
  // If brand-new day, add this day's segment counts; if heal, leave segments as-is
  // (exact segment KPIs: run push:stats from laptop periodically).
  if (wasEmptyDay) {
    for (const r of segRs.rows) {
      const s = String(r.s) as keyof typeof value.segments;
      if (s === "INDEX" || s === "STOCK" || s === "OTHER") {
        value.segments[s] += Number(r.n);
      }
    }
  }

  await writeArchiveStats(value);
  return value;
}

/**
 * Write precomputed KPI stats (e.g. from local SQLite) without scanning Turso chains.
 * Use when free-tier rows-read is exhausted but writes still work, or after a bulk copy.
 */
export async function writeArchiveStats(value: ArchiveStatus): Promise<void> {
  await ensureSchema();
  const db = getDbClient();
  await db.execute({
    sql: `
      INSERT INTO archive_stats (
        id, total_documents, earliest_trade_date, latest_trade_date,
        trading_days, symbol_count, index_files, stock_files, other_files,
        exchanges_json, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        total_documents = excluded.total_documents,
        earliest_trade_date = excluded.earliest_trade_date,
        latest_trade_date = excluded.latest_trade_date,
        trading_days = excluded.trading_days,
        symbol_count = excluded.symbol_count,
        index_files = excluded.index_files,
        stock_files = excluded.stock_files,
        other_files = excluded.other_files,
        exchanges_json = excluded.exchanges_json,
        updated_at = excluded.updated_at
    `,
    args: [
      value.totalDocuments,
      value.earliestTradeDate,
      value.latestTradeDate,
      value.tradingDays,
      value.symbolCount,
      value.segments.INDEX,
      value.segments.STOCK,
      value.segments.OTHER,
      JSON.stringify(value.exchanges.length ? value.exchanges : ["NSE", "BSE"]),
      new Date().toISOString(),
    ],
  });
  global._archiveStatusCache = { at: Date.now(), value };
}

export async function dropAllChains(): Promise<void> {
  await ensureSchema();
  const db = getDbClient();
  await db.execute(`DELETE FROM option_chains`);
  await db.execute(`DELETE FROM archive_stats`);
  invalidateDistinctCache();
}

/** Close is a no-op for remote; kept for script cleanup symmetry. */
export async function closeDb(): Promise<void> {
  try {
    global._libsqlClient?.close();
  } catch {
    /* ignore */
  }
  global._libsqlClient = undefined;
  global._libsqlSchemaReady = undefined;
  global._archiveStatusCache = undefined;
}
