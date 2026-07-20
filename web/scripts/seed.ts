import { fetchTradingDates, syncTradeDate } from "../src/lib/pipeline";
import { getMongoClientPromise } from "../src/lib/mongodb";

async function main() {
  const days = Number(process.argv[2] ?? "3");
  console.log(`Seeding last ${days} trading days into MongoDB + local store…`);
  const dates = await fetchTradingDates(2);
  const slice = dates.slice(-Math.max(1, Math.min(days, 30)));
  console.log(`Dates: ${slice.join(", ")}`);

  for (const date of slice) {
    process.stdout.write(`→ ${date} … `);
    const result = await syncTradeDate(date);
    console.log(result.message);
    if (result.errors.length) {
      for (const e of result.errors) console.error("  ", e);
    }
  }
  console.log("Done.");
  const client = await getMongoClientPromise();
  await client.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    const client = await getMongoClientPromise();
    await client.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
