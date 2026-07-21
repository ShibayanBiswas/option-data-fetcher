/**
 * Push archive KPI stats to Turso without scanning remote option_chains.
 *
 * Computes from local SQLite (cheap), writes one `archive_stats` row to Turso.
 * Use when Turso rows-read quota is exhausted but you need the deploy KPIs /
 * status endpoint to work again after quota resets — or immediately if writes
 * are still allowed.
 *
 *   npm run push:stats
 */
import { createClient } from "@libsql/client";
import path from "path";
import {
  closeDb,
  ensureSchema,
  writeArchiveStats,
  type ArchiveStatus,
} from "../src/lib/db";

const LOCAL = path.join(process.cwd(), "data", "option_chain.db");

async function computeLocal(): Promise<ArchiveStatus> {
  const local = createClient({ url: `file:${LOCAL}` });
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
  local.close();

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

async function main() {
  if (!process.env.LIBSQL_URL?.startsWith("libsql://")) {
    throw new Error("LIBSQL_URL must point at Turso (.env.local)");
  }
  console.log("Computing stats from local…");
  const stats = await computeLocal();
  console.log(stats);

  console.log("Writing archive_stats to Turso (1 row)…");
  await ensureSchema();
  await writeArchiveStats(stats);
  console.log("Done. Status endpoint will read this row instead of scanning chains.");
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
