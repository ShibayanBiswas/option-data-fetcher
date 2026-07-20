/**
 * @deprecated MongoDB Atlas has been replaced by SQLite / libSQL (`src/lib/db.ts`).
 * Kept only so old imports fail loudly with a clear migration message.
 */
export function getMongoClientPromise(): never {
  throw new Error(
    "MongoDB was removed. Use src/lib/db.ts (SQLite locally, Turso/libSQL on Vercel)."
  );
}

export async function getDb(): Promise<never> {
  throw new Error(
    "MongoDB was removed. Use src/lib/db.ts (SQLite locally, Turso/libSQL on Vercel)."
  );
}

export async function getChainsCollection(): Promise<never> {
  throw new Error(
    "MongoDB was removed. Use src/lib/db.ts (SQLite locally, Turso/libSQL on Vercel)."
  );
}

export async function ensureIndexes(): Promise<never> {
  throw new Error(
    "MongoDB was removed. Use ensureSchema() from src/lib/db.ts."
  );
}
