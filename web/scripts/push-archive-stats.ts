/**
 * Refresh the one-row `archive_stats` KPI cache.
 *
 * - Local / VPS: writes into the same file DB (LIBSQL_URL=file:… or default).
 * - Turso: compute from local file, write 1 row remotely (saves rows-read).
 *
 *   npm run push:stats
 */
import { createClient } from "@libsql/client";
import path from "path";
import {
  closeDb,
  ensureSchema,
  refreshArchiveStats,
  writeArchiveStats,
  type ArchiveStatus,
} from "../src/lib/db";

const LOCAL = path.join(process.cwd(), "data", "option_chain.db");

function isRemote(url: string | undefined): boolean {
  return Boolean(url?.startsWith("libsql://") || url?.startsWith("https://"));
}

async function computeFromFile(filePath: string): Promise<ArchiveStatus> {
  const local = createClient({ url: `file:${filePath}` });
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
  const url = process.env.LIBSQL_URL?.trim();
  console.log("Target:", url || `file:${LOCAL}`);

  if (isRemote(url)) {
    console.log("Computing stats from local file, writing 1 row to Turso…");
    const stats = await computeFromFile(LOCAL);
    console.log(stats);
    await ensureSchema();
    await writeArchiveStats(stats);
  } else {
    console.log("Refreshing archive_stats on local / VPS SQLite…");
    // Point default client at the file DB
    if (!url) {
      process.env.LIBSQL_URL = `file:${LOCAL}`;
    }
    const stats = await refreshArchiveStats();
    console.log(stats);
  }

  console.log("Done.");
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
