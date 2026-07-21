/**
 * MongoDB stubs — the archive uses local SQLite via src/lib/db.ts.
 */
export async function getDb(): Promise<never> {
  throw new Error(
    "MongoDB was removed. Use src/lib/db.ts (local SQLite file)."
  );
}

export async function getChainsCollection(): Promise<never> {
  throw new Error(
    "MongoDB was removed. Use src/lib/db.ts (local SQLite file)."
  );
}

export async function ensureIndexes(): Promise<never> {
  throw new Error(
    "MongoDB was removed. Use src/lib/db.ts (local SQLite file)."
  );
}
