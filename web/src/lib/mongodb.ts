import { MongoClient, Db, Collection } from "mongodb";
import type { OptionChainDoc } from "./types";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "option_chain";

if (!uri) {
  console.warn("MONGODB_URI is not set — MongoDB features will fail until configured.");
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClient(): MongoClient {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }
  return new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 12_000,
  });
}

export function getMongoClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createClient().connect();
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(dbName);
}

export async function getChainsCollection(): Promise<Collection<OptionChainDoc>> {
  const db = await getDb();
  return db.collection<OptionChainDoc>("option_chains");
}

export async function ensureIndexes(): Promise<void> {
  const col = await getChainsCollection();
  await col.createIndex(
    { exchange: 1, segment: 1, symbol: 1, side: 1, tradeDate: 1, expiryDate: 1 },
    { unique: true, name: "chain_unique" }
  );
  await col.createIndex({ tradeDate: -1 }, { name: "trade_date_desc" });
  await col.createIndex({ exchange: 1, segment: 1, symbol: 1 }, { name: "symbol_nav" });
}
