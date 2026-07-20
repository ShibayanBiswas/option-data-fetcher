/**
 * SQLite / libSQL archive store.
 *
 * Local:  file:./data/option_chain.db  (or SQLITE_URL / LIBSQL_URL)
 * Vercel: set LIBSQL_URL (+ LIBSQL_AUTH_TOKEN) to a Turso database —
 *         plain SQLite files cannot persist on serverless.
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
  // eslint-disable-next-line no-var
  var _libsqlClient: Client | undefined;
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
    global._libsqlClient = createClient({ url, authToken });
  }
  return global._libsqlClient;
}

export async function ensureSchema(): Promise<void> {
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

export async function upsertChainDocs(docs: OptionChainDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  await ensureSchema();
  const db = getDbClient();

  const chunkSize = 40;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
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
    await db.batch(statements, "write");
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
const DISTINCT_TTL_MS = 45_000;

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
  if (hit && Date.now() - hit.at < DISTINCT_TTL_MS) {
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

/** Clear distinct cache after writes (sync / seed). */
export function invalidateDistinctCache(): void {
  distinctCache.clear();
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

export async function getArchiveStatus(): Promise<{
  totalDocuments: number;
  earliestTradeDate: string | null;
  latestTradeDate: string | null;
  tradingDays: number;
  exchanges: string[];
  symbolCount: number;
  segments: { INDEX: number; STOCK: number; OTHER: number };
}> {
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
  return {
    totalDocuments: Number(totalRs.rows[0]?.n ?? 0),
    earliestTradeDate: (spanRs.rows[0]?.lo as string) ?? null,
    latestTradeDate: (spanRs.rows[0]?.hi as string) ?? null,
    tradingDays: Number(spanRs.rows[0]?.days ?? 0),
    exchanges: exRs.rows.map((r) => String(r.v)),
    symbolCount: Number(symRs.rows[0]?.n ?? 0),
    segments: {
      INDEX: segMap.INDEX ?? 0,
      STOCK: segMap.STOCK ?? 0,
      OTHER: segMap.OTHER ?? 0,
    },
  };
}

export async function dropAllChains(): Promise<void> {
  await ensureSchema();
  const db = getDbClient();
  await db.execute(`DELETE FROM option_chains`);
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
}
