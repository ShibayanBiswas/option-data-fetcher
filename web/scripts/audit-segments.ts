import { getChainsCollection, getMongoClientPromise } from "../src/lib/mongodb";
import { NSE_INDEX_SYMBOLS, BSE_INDEX_SYMBOLS } from "../src/lib/constants";
import JSZip from "jszip";

const NSE_FO_URL =
  "https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_{yyyymmdd}_F_0000.csv.zip";
const BSE_FO_URL =
  "https://www.bseindia.com/download/BhavCopy/Derivative/BhavCopy_BSE_FO_0_0_0_{yyyymmdd}_F_0000.CSV";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function summarize(label: string, rows: Record<string, string>[]) {
  const options = rows.filter((r) => r.OptnTp === "CE" || r.OptnTp === "PE");
  const futures = rows.filter((r) => !r.OptnTp || r.OptnTp === "");
  const byTp = new Map<string, Set<string>>();
  const bySymTp = new Map<string, string>();

  for (const r of options) {
    const tp = r.FinInstrmTp || "(blank)";
    const sym = (r.TckrSymb || "").toUpperCase();
    if (!byTp.has(tp)) byTp.set(tp, new Set());
    byTp.get(tp)!.add(sym);
    bySymTp.set(sym, tp);
  }

  console.log(`\n======== ${label} ========`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Option rows (CE/PE): ${options.length}`);
  console.log(`Non-option / futures-like rows: ${futures.length}`);
  console.log("\nFinInstrmTp → unique option symbols:");
  for (const [tp, syms] of [...byTp.entries()].sort()) {
    const list = [...syms].sort();
    console.log(`  ${tp}: ${list.length} symbols → ${list.slice(0, 20).join(", ")}${list.length > 20 ? " …" : ""}`);
  }

  // Known index lists vs FinInstrmTp
  const indexSet = label.startsWith("NSE") ? NSE_INDEX_SYMBOLS : BSE_INDEX_SYMBOLS;
  const classifiedAsIndex: string[] = [];
  const classifiedAsStockButMaybeIndex: string[] = [];
  const otherTypes: Record<string, string[]> = {};

  for (const [sym, tp] of bySymTp) {
    const isIndexList = indexSet.has(sym);
    // NSE: IDO = Index Derivative Option, STO = Stock Option
    // Also possible: OPTIDX, OPTSTK legacy; currency/commodity may differ
    if (tp === "IDO" || tp.includes("IDX") || isIndexList) {
      classifiedAsIndex.push(`${sym}(${tp})`);
    } else if (tp === "STO" || tp.includes("STK")) {
      // stock
    } else {
      (otherTypes[tp] ??= []).push(sym);
    }
    if (!isIndexList && (tp === "IDO" || /IDX/i.test(tp))) {
      classifiedAsStockButMaybeIndex.push(`${sym}(${tp})`);
    }
  }

  console.log("\nIndex-list symbols present:", [...indexSet].filter((s) => bySymTp.has(s)));
  console.log(
    "Symbols with INDEX-like FinInstrmTp NOT in hardcoded index list:",
    classifiedAsStockButMaybeIndex.length
      ? classifiedAsStockButMaybeIndex.sort().join(", ")
      : "(none)"
  );
  console.log("Other FinInstrmTp buckets (non IDO/STO):");
  if (Object.keys(otherTypes).length === 0) console.log("  (none)");
  for (const [tp, syms] of Object.entries(otherTypes)) {
    console.log(`  ${tp}: ${[...new Set(syms)].sort().join(", ")}`);
  }

  return { bySymTp, byTp, options };
}

async function main() {
  const date = process.argv[2] || "2026-07-17";
  const yyyymmdd = date.replace(/-/g, "");

  console.log(`Auditing bhavcopy for ${date}…`);

  // NSE
  const nseUrl = NSE_FO_URL.replace("{yyyymmdd}", yyyymmdd);
  const nseRes = await fetch(nseUrl, { headers: HEADERS });
  console.log(`NSE HTTP ${nseRes.status}`);
  let nseRows: Record<string, string>[] = [];
  if (nseRes.ok) {
    const buf = Buffer.from(await nseRes.arrayBuffer());
    const zip = await JSZip.loadAsync(buf);
    const csvName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".csv"))!;
    nseRows = parseCsv(await zip.files[csvName].async("string"));
  }
  summarize("NSE FO", nseRows);

  // BSE
  const bseUrl = BSE_FO_URL.replace("{yyyymmdd}", yyyymmdd);
  const bseRes = await fetch(bseUrl, {
    headers: {
      ...HEADERS,
      Referer: "https://www.bseindia.com/markets/MarketInfo/BhavCopy.aspx",
    },
  });
  console.log(`\nBSE HTTP ${bseRes.status}`);
  let bseRows: Record<string, string>[] = [];
  if (bseRes.ok) {
    bseRows = parseCsv(await bseRes.text());
  }
  summarize("BSE FO", bseRows);

  // Compare with MongoDB
  const col = await getChainsCollection();
  const dbSeg = await col
    .aggregate([
      {
        $group: {
          _id: { exchange: "$exchange", segment: "$segment" },
          symbols: { $addToSet: "$symbol" },
          docs: { $sum: 1 },
        },
      },
      { $sort: { "_id.exchange": 1, "_id.segment": 1 } },
    ])
    .toArray();

  console.log("\n======== MONGODB CURRENT SEGREGATION ========");
  for (const row of dbSeg) {
    const syms = (row.symbols as string[]).sort();
    console.log(
      `${row._id.exchange}/${row._id.segment}: ${syms.length} symbols, ${row.docs} docs`
    );
    if (row._id.segment === "INDEX") console.log("  ", syms.join(", "));
  }

  // Misclassified: FinInstrmTp IDO stored as STOCK
  const stockDocs = await col
    .find({ segment: "STOCK" }, { projection: { exchange: 1, symbol: 1, rows: { $slice: 1 } } })
    .toArray();

  const suspicious: string[] = [];
  for (const d of stockDocs) {
    const tp = String(d.rows?.[0]?.FinInstrmTp ?? "");
    if (tp === "IDO" || /IDX/i.test(tp)) {
      suspicious.push(`${d.exchange}:${d.symbol}:${tp}`);
    }
  }
  console.log(
    "\nSuspicious STOCK docs with index-like FinInstrmTp:",
    suspicious.length ? [...new Set(suspicious)].sort().join(", ") : "(none)"
  );

  await (await getMongoClientPromise()).close();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await (await getMongoClientPromise()).close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
