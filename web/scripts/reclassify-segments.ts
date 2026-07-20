/**
 * Reclassify existing MongoDB docs using FinInstrmTp from stored rows,
 * then remove stale documents left at the old segment path.
 */
import { classifySegment } from "../src/lib/constants";
import { getChainsCollection, getMongoClientPromise } from "../src/lib/mongodb";
import type { Exchange, Segment } from "../src/lib/types";

async function main() {
  const col = await getChainsCollection();
  const docs = await col.find({}).toArray();
  console.log(`Scanning ${docs.length} documents…`);

  let updated = 0;
  let unchanged = 0;
  let removedStale = 0;
  const moves: string[] = [];

  for (const doc of docs) {
    const tp = String(doc.rows?.[0]?.FinInstrmTp ?? "");
    const correct = classifySegment(
      doc.exchange as Exchange,
      doc.symbol,
      tp
    );
    if (correct === doc.segment) {
      unchanged += 1;
      continue;
    }

    const filter = {
      exchange: doc.exchange,
      segment: correct as Segment,
      symbol: doc.symbol,
      side: doc.side,
      tradeDate: doc.tradeDate,
      expiryDate: doc.expiryDate,
    };

    await col.updateOne(
      filter,
      {
        $set: {
          exchange: doc.exchange,
          segment: correct,
          symbol: doc.symbol,
          side: doc.side,
          tradeDate: doc.tradeDate,
          expiryDate: doc.expiryDate,
          rows: doc.rows,
          rowCount: doc.rowCount,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Remove the mis-segmented original
    await col.deleteOne({ _id: doc._id });
    updated += 1;
    moves.push(`${doc.exchange}:${doc.symbol} ${doc.segment} → ${correct} (${tp || "no-tp"})`);
  }

  // Deduplicate if upsert created duplicates somehow — unique index should prevent
  const summary = await col
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

  console.log(`\nUpdated: ${updated}, unchanged: ${unchanged}, stale removals: ${removedStale}`);
  if (moves.length) {
    console.log("Moves:");
    for (const m of [...new Set(moves)].sort()) console.log(" ", m);
  }
  console.log("\nFinal segregation:");
  for (const row of summary) {
    const syms = (row.symbols as string[]).sort();
    console.log(
      `  ${row._id.exchange}/${row._id.segment}: ${syms.length} symbols, ${row.docs} docs`
    );
    if (row._id.segment === "INDEX" || row._id.segment === "OTHER") {
      console.log("   ", syms.join(", "));
    }
  }

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
