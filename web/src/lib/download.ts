import { createRequire } from "module";
import { PassThrough, Readable } from "stream";
import type { Archiver } from "archiver";
import { countChains, findChains, isRemoteLibsql } from "./db";
import { rowsToCsv } from "./storage";
import type { BrowsePath, OptionChainDoc, OptionRow } from "./types";

/** Max chain files per zip on Turso — larger bundles burn rows-read hard. */
export const MAX_REMOTE_BUNDLE_DOCS = 400;

const require = createRequire(import.meta.url);
type ZipArchiveCtor = new (options?: { store?: boolean; zlib?: { level: number } }) => Archiver;
const archiverMod = require("archiver") as {
  ZipArchive?: ZipArchiveCtor;
  default?: { ZipArchive?: ZipArchiveCtor };
};
const ZipArchiveMaybe =
  archiverMod.ZipArchive ?? archiverMod.default?.ZipArchive;
if (!ZipArchiveMaybe) {
  throw new Error("archiver ZipArchive export missing — check archiver version");
}
const ZipArchive: ZipArchiveCtor = ZipArchiveMaybe;

const PAGE_SIZE = 40;

function filterFromPath(path: BrowsePath) {
  const filter: {
    exchange?: string;
    segment?: string;
    symbol?: string;
    side?: string;
    tradeDate?: string;
    expiryDate?: string;
  } = {};
  if (path.exchange) filter.exchange = path.exchange;
  if (path.segment) filter.segment = path.segment;
  if (path.symbol) filter.symbol = path.symbol;
  if (path.side) filter.side = path.side;
  if (path.tradeDate) filter.tradeDate = path.tradeDate;
  if (path.expiryDate) filter.expiryDate = path.expiryDate;
  return filter;
}

function bundleName(path: BrowsePath, ext: string): string {
  const parts = [
    path.exchange,
    path.segment,
    path.symbol,
    path.side,
    path.tradeDate,
    path.expiryDate ? `expiry_${path.expiryDate}` : undefined,
  ].filter(Boolean);
  return `${parts.join("_") || "option_chain"}.${ext}`;
}

function entryPath(doc: OptionChainDoc): string {
  return [
    doc.exchange,
    doc.segment,
    doc.symbol,
    doc.side,
    doc.tradeDate,
    `expiry_date_${doc.expiryDate}.csv`,
  ].join("/");
}

export async function loadDocs(path: BrowsePath): Promise<OptionChainDoc[]> {
  const isLeaf = Boolean(path.expiryDate);
  return findChains(filterFromPath(path), {
    sortTradeDateDesc: !isLeaf,
    limit: isLeaf ? 1 : undefined,
  });
}

async function* iterateDocs(
  path: BrowsePath,
  pageSize = PAGE_SIZE
): AsyncGenerator<OptionChainDoc> {
  const filter = filterFromPath(path);
  let offset = 0;
  for (;;) {
    const batch = await findChains(filter, {
      sortTradeDateDesc: false,
      limit: pageSize,
      offset,
    });
    if (batch.length === 0) break;
    for (const doc of batch) yield doc;
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
}

/**
 * Stream a CSV zip without holding the full archive in memory.
 * Pages DB reads so large INDEX / CALL history downloads stay stable.
 */
export function streamCsvZip(path: BrowsePath): {
  stream: ReadableStream<Uint8Array>;
  filename: string;
} {
  const filename = bundleName(path, "zip");
  const passthrough = new PassThrough();
  const archive = new ZipArchive({ store: true });

  archive.on("error", (err: Error) => {
    passthrough.destroy(err);
  });
  archive.pipe(passthrough);

  void (async () => {
    try {
      let count = 0;
      for await (const doc of iterateDocs(path)) {
        archive.append(rowsToCsv(doc.rows), { name: entryPath(doc) });
        count += 1;
        if (count % PAGE_SIZE === 0) {
          await new Promise((r) => setImmediate(r));
        }
      }
      if (count === 0) {
        archive.append("No option chain files matched this selection.\n", {
          name: "README.txt",
        });
      }
      await archive.finalize();
    } catch (err) {
      archive.abort();
      passthrough.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  const webStream = Readable.toWeb(passthrough) as ReadableStream<Uint8Array>;
  return { stream: webStream, filename };
}

export async function buildLeafCsv(path: BrowsePath): Promise<{
  buffer: Buffer;
  filename: string;
  rows: OptionRow[];
}> {
  const docs = await loadDocs(path);
  const rows = docs[0]?.rows ?? [];
  const csv = rowsToCsv(rows);
  return {
    buffer: Buffer.from(csv, "utf8"),
    filename: bundleName(path, "csv"),
    rows,
  };
}

export async function estimateBundleSize(path: BrowsePath): Promise<number> {
  return countChains(filterFromPath(path));
}

/** Throw if a remote zip would scan too many docs (Turso quota guard). */
export async function assertRemoteBundleAllowed(path: BrowsePath): Promise<number> {
  if (!isRemoteLibsql()) return -1;
  if (path.expiryDate) return 1;
  // Path-shape guards first — no COUNT on huge folders.
  if (!path.symbol) {
    throw new Error(
      "On Turso, download a symbol (or narrower) folder — exchange/segment zips exceed the free rows-read budget."
    );
  }
  if (!path.side) {
    throw new Error(
      "On Turso, pick CALL or PUT before downloading — a full symbol zip is too large for the rows-read budget."
    );
  }
  const n = await estimateBundleSize(path);
  if (n > MAX_REMOTE_BUNDLE_DOCS) {
    throw new Error(
      `This folder has ${n.toLocaleString()} files (limit ${MAX_REMOTE_BUNDLE_DOCS} on Turso). ` +
        `Narrow to a trade date, or a single expiry.`
    );
  }
  return n;
}
