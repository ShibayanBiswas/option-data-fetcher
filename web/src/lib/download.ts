import ExcelJS from "exceljs";
import JSZip from "jszip";
import { findChains } from "./db";
import { rowsToCsv } from "./storage";
import type { BrowsePath, OptionChainDoc, OptionRow } from "./types";

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
  return findChains(filterFromPath(path), { sortTradeDateDesc: true });
}

export async function buildCsvZip(path: BrowsePath): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const docs = await loadDocs(path);
  const zip = new JSZip();
  for (const doc of docs) {
    zip.file(entryPath(doc), rowsToCsv(doc.rows));
  }
  if (docs.length === 0) {
    zip.file("README.txt", "No option chain files matched this selection.");
  }
  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return { buffer, filename: bundleName(path, "zip") };
}

export async function buildExcelZip(path: BrowsePath): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const docs = await loadDocs(path);
  const zip = new JSZip();

  for (const doc of docs) {
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
    const name = entryPath(doc).replace(/\.csv$/i, ".xlsx");
    zip.file(name, Buffer.from(xlsx));
  }

  if (docs.length === 0) {
    zip.file("README.txt", "No option chain files matched this selection.");
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return { buffer, filename: bundleName(path, "zip").replace(".zip", "_excel.zip") };
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
