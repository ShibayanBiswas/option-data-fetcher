import type { Exchange, Segment } from "./types";

/** Fallback index tickers when FinInstrmTp is missing from a row. */
export const NSE_INDEX_SYMBOLS = new Set([
  "NIFTY",
  "BANKNIFTY",
  "FINNIFTY",
  "MIDCPNIFTY",
  "NIFTYNXT50",
]);

export const BSE_INDEX_SYMBOLS = new Set([
  "SENSEX",
  "BANKEX",
  "SENSEX50",
  "FOCIT", // BSE index options (FinInstrmTp=IDO)
]);

/** UDiFF FinInstrmTp codes for index derivative options. */
export const INDEX_INSTRUMENT_TYPES = new Set([
  "IDO",
  "OPTIDX",
  "ID",
]);

/** UDiFF FinInstrmTp codes for stock / equity options. */
export const STOCK_INSTRUMENT_TYPES = new Set([
  "STO",
  "OPTSTK",
  "ST",
]);

export const SEGMENT_ORDER: Segment[] = ["INDEX", "STOCK", "OTHER"];

export const SEGMENT_LABELS: Record<Segment, string> = {
  INDEX: "Index Options",
  STOCK: "Stock Options",
  OTHER: "Other Securities",
};

export const NSE_FO_URL =
  "https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_{yyyymmdd}_F_0000.csv.zip";

export const BSE_FO_URL =
  "https://www.bseindia.com/download/BhavCopy/Derivative/BhavCopy_BSE_FO_0_0_0_{yyyymmdd}_F_0000.CSV";

export const HTTP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export const BSE_HEADERS = {
  ...HTTP_HEADERS,
  Referer: "https://www.bseindia.com/markets/MarketInfo/BhavCopy.aspx",
};

export const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}";

export const INDEX_YAHOO_SYMBOLS: Record<string, string> = {
  NIFTY50: "^NSEI",
  SENSEX: "^BSESN",
};

/** Prefer these display columns when present in a leaf table. */
export const PREFERRED_COLUMNS = [
  "StrkPric",
  "XpryDt",
  "OptnTp",
  "FinInstrmTp",
  "OpnPric",
  "HghPric",
  "LwPric",
  "ClsPric",
  "LastPric",
  "SttlmPric",
  "TtlTradgVol",
  "TtlTrfVal",
  "OpenIntrst",
  "ChngInOpnIntrst",
  "UndrlygPric",
  "TckrSymb",
  "FinInstrmNm",
];

/**
 * Classify an option underlying using UDiFF FinInstrmTp first,
 * then fall back to known index ticker lists.
 */
export function classifySegment(
  exchange: Exchange,
  symbol: string,
  finInstrmTp?: string | null
): Segment {
  const tp = String(finInstrmTp ?? "")
    .trim()
    .toUpperCase();
  const upper = symbol.toUpperCase();

  if (tp) {
    if (INDEX_INSTRUMENT_TYPES.has(tp) || tp.includes("IDX")) return "INDEX";
    if (STOCK_INSTRUMENT_TYPES.has(tp) || tp.includes("STK")) return "STOCK";
    // Known option row with an unrecognized instrument type → OTHER
    return "OTHER";
  }

  // Fallback when FinInstrmTp is absent
  if (exchange === "NSE") {
    return NSE_INDEX_SYMBOLS.has(upper) ? "INDEX" : "STOCK";
  }
  return BSE_INDEX_SYMBOLS.has(upper) ? "INDEX" : "STOCK";
}

export function sideFromOptnTp(optnTp: string): "CALL" | "PUT" | null {
  if (optnTp === "CE") return "CALL";
  if (optnTp === "PE") return "PUT";
  return null;
}

export function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function isSegment(value: string): value is Segment {
  return value === "INDEX" || value === "STOCK" || value === "OTHER";
}
