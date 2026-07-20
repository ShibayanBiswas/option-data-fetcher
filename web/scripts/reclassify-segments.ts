/**
 * Segment reclassify is no longer Mongo-based.
 * Re-run: npm run ingest:local  (rebuilds SQLite from CSVs with current classifySegment)
 * Or:     npm run seed:max
 */
console.log(
  "reclassify-segments: use `npm run ingest:local` to rebuild SQLite from local CSVs with current segment rules."
);
process.exit(0);
