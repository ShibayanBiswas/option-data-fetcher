import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createRequire } from "module";
import { PassThrough, Readable } from "stream";
import type { Archiver } from "archiver";
import { countChains, findChains } from "./db";
import { rowsToCsv } from "./storage";
import type { BrowsePath, OptionChainDoc, OptionRow } from "./types";

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
/** Soft cap for Excel zips — each workbook is heavy; use CSV Zip for larger sets. */
const MAX_EXCEL_DOCS = 250;

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

async function docToExcelBuffer(doc: OptionChainDoc): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Chain");
  if (doc.rows.length > 0) {
    const columns = Object.keys(doc.rows[0]);
    sheet.columns = columns.map((key) => ({ header: key, key, width: 14 }));
    for (const row of doc.rows) {
      sheet.addRow(row);
    }
    sheet.getRow(1).font = { bold: true, color: { argb: "FF7A1E2C" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F0E6" },
    };
  }
  const xlsx = await workbook.xlsx.writeBuffer();
  return Buffer.from(xlsx);
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
  // STORE = no deflate CPU — faster & lower peak memory for CSV
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
        // Yield to event loop every page so the process stays responsive
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

export async function buildExcelZip(path: BrowsePath): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const filter = filterFromPath(path);
  const total = await countChains(filter);
  if (total > MAX_EXCEL_DOCS) {
    throw new Error(
      `Too many files for Excel Zip (${total.toLocaleString()}). Use CSV Zip, or narrow to a symbol / trade date (max ${MAX_EXCEL_DOCS}).`
    );
  }

  const docs = await findChains(filter, { sortTradeDateDesc: false });
  const zip = new JSZip();

  for (let i = 0; i < docs.length; i += 6) {
    const batch = docs.slice(i, i + 6);
    const buffers = await Promise.all(batch.map((doc) => docToExcelBuffer(doc)));
    batch.forEach((doc, idx) => {
      const name = entryPath(doc).replace(/\.csv$/i, ".xlsx");
      zip.file(name, buffers[idx]);
    });
    await new Promise((r) => setImmediate(r));
  }

  if (docs.length === 0) {
    zip.file("README.txt", "No option chain files matched this selection.");
  }

  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "STORE",
    })
  );
  return {
    buffer,
    filename: bundleName(path, "zip").replace(".zip", "_excel.zip"),
  };
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

export async function buildLeafExcel(path: BrowsePath): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const docs = await loadDocs(path);
  const rows = docs[0]?.rows ?? [];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Strikes");
  if (rows.length > 0) {
    const columns = Object.keys(rows[0]);
    sheet.columns = columns.map((key) => ({ header: key, key, width: 14 }));
    for (const row of rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true, color: { argb: "FF7A1E2C" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF5F0E6" },
    };
  }
  const xlsx = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(xlsx),
    filename: bundleName(path, "xlsx"),
  };
}

export async function estimateBundleSize(path: BrowsePath): Promise<number> {
  return countChains(filterFromPath(path));
}
