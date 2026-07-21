/**
 * Refresh the one-row `archive_stats` KPI cache + compact `archive_catalog`.
 *
 * - Local / VPS: writes into the same file DB.
 * - Turso: compute from local file, write stats (1 row) + catalog (~hundreds of
 *   symbol rows) — avoids DISTINCT scans on Turso during browse.
 *
 *   npm run push:stats
 */
import { createClient } from "@libsql/client";
import path from "path";
import {
  closeDb,
  ensureSchema,
  refreshArchiveStats,
  replaceArchiveCatalog,
  writeArchiveStats,
  type ArchiveStatus,
} from "../src/lib/db";

const LOCAL = path.join(process.cwd(), "data", "option_chain.db");

function isRemote(url: string | undefined): boolean {
  return Boolean(url?.startsWith("libsql://") || url?.startsWith("https://"));
}

async function computeFromFile(filePath: string): Promise<{
  stats: ArchiveStatus;
  catalog: { exchange: string; segment: string; symbol: string }[];
}> {
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
  const catRs = await local.execute(
    `SELECT DISTINCT exchange, segment, symbol FROM option_chains ORDER BY exchange, segment, symbol`
  );
  local.close();

  const segMap: Record<string, number> = { INDEX: 0, STOCK: 0, OTHER: 0 };
  for (const r of segRs.rows) {
    segMap[String(r.s)] = Number(r.n);
  }
  return {
    stats: {
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
    },
    catalog: catRs.rows.map((r) => ({
      exchange: String(r.exchange),
      segment: String(r.segment),
      symbol: String(r.symbol),
    })),
  };
}

async function main() {
  const url = process.env.LIBSQL_URL?.trim();
  console.log("Target:", url || `file:${LOCAL}`);

  if (isRemote(url)) {
    console.log("Computing stats + catalog from local file → Turso…");
    const { stats, catalog } = await computeFromFile(LOCAL);
    console.log(stats);
    console.log("catalog symbols:", catalog.length);
    await ensureSchema();
    await writeArchiveStats(stats);
    await replaceArchiveCatalog(catalog);
  } else {
    console.log("Refreshing archive_stats + catalog on local / VPS SQLite…");
    if (!url) {
      process.env.LIBSQL_URL = `file:${LOCAL}`;
    }
    const stats = await refreshArchiveStats();
    console.log(stats);
    const { catalog } = await computeFromFile(
      url?.startsWith("file:") ? url.slice(5) : LOCAL
    );
    await replaceArchiveCatalog(catalog);
    console.log("catalog symbols:", catalog.length);
  }

  await closeDb();
  console.log("Done.");
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
