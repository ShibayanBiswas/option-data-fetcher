/**
 * Compare local SQLite vs Turso doc counts / day spans.
 */
import { createClient } from "@libsql/client";
import path from "path";

const LOCAL = path.join(process.cwd(), "data", "option_chain.db");

async function summarize(c: ReturnType<typeof createClient>, label: string) {
  const g = await c.execute(`
    SELECT COUNT(*) AS docs, MIN(trade_date) AS lo, MAX(trade_date) AS hi,
           COUNT(DISTINCT trade_date) AS days, COUNT(DISTINCT symbol) AS symbols
    FROM option_chains
  `);
  const by = await c.execute(`
    SELECT exchange, segment, MIN(trade_date) AS lo, MAX(trade_date) AS hi,
           COUNT(DISTINCT trade_date) AS days, COUNT(DISTINCT symbol) AS symbols,
           COUNT(*) AS files
    FROM option_chains
    WHERE segment IN ('INDEX', 'STOCK')
    GROUP BY exchange, segment
    ORDER BY 1, 2
  `);
  console.log(`\n=== ${label} ===`);
  console.log(g.rows[0]);
  for (const r of by.rows) console.log(r);
  return {
    docs: Number(g.rows[0]?.docs ?? 0),
    lo: String(g.rows[0]?.lo ?? ""),
    hi: String(g.rows[0]?.hi ?? ""),
    days: Number(g.rows[0]?.days ?? 0),
  };
}

async function daySet(c: ReturnType<typeof createClient>) {
  const rs = await c.execute(
    `SELECT DISTINCT trade_date AS d FROM option_chains ORDER BY 1`
  );
  return new Set(rs.rows.map((r) => String(r.d)));
}

async function dayCount(c: ReturnType<typeof createClient>, d: string) {
  const rs = await c.execute({
    sql: `SELECT COUNT(*) AS n FROM option_chains WHERE trade_date = ?`,
    args: [d],
  });
  return Number(rs.rows[0]?.n ?? 0);
}

async function main() {
  const local = createClient({ url: `file:${LOCAL}` });
  const remote = createClient({
    url: process.env.LIBSQL_URL!,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });

  const L = await summarize(local, "LOCAL");
  const R = await summarize(remote, "TURSO");

  const lDays = await daySet(local);
  const rDays = await daySet(remote);
  const onlyL = [...lDays].filter((d) => !rDays.has(d));
  const onlyR = [...rDays].filter((d) => !lDays.has(d));
  console.log("\nDays only LOCAL:", onlyL.length ? onlyL : "(none)");
  console.log("Days only TURSO:", onlyR.length ? onlyR : "(none)");

  const shared = [...lDays].filter((d) => rDays.has(d)).sort();
  const diffs: string[] = [];
  for (const d of shared) {
    const a = await dayCount(local, d);
    const b = await dayCount(remote, d);
    if (a !== b) diffs.push(`${d}: local=${a} turso=${b}`);
  }
  console.log(`\nShared days with file-count DIFF: ${diffs.length}`);
  for (const line of diffs.slice(0, 25)) console.log(" ", line);
  if (diffs.length > 25) console.log(`  … +${diffs.length - 25} more`);

  console.log("\n—— Verdict ——");
  if (
    L.docs === R.docs &&
    L.lo === R.lo &&
    L.hi === R.hi &&
    L.days === R.days &&
    onlyL.length === 0 &&
    onlyR.length === 0 &&
    diffs.length === 0
  ) {
    console.log("MATCH — local and Turso are toe-to-toe");
  } else {
    console.log("MISMATCH — need sync");
    console.log({ local: L, turso: R, dayDiffs: diffs.length });
  }

  local.close();
  remote.close();
  process.exit(
    L.docs === R.docs && diffs.length === 0 && onlyL.length === 0 && onlyR.length === 0
      ? 0
      : 1
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
