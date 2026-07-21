/**
 * Refresh the one-row `archive_stats` KPI cache on the local SQLite file.
 *
 *   npm run push:stats
 */
import {
  closeDb,
  refreshArchiveStats,
} from "../src/lib/db";

async function main() {
  if (!process.env.SQLITE_URL && !process.env.LIBSQL_URL) {
    process.env.SQLITE_URL = "file:./data/option_chain.db";
  }
  console.log("Target:", process.env.SQLITE_URL || process.env.LIBSQL_URL);
  const stats = await refreshArchiveStats();
  console.log(stats);
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
