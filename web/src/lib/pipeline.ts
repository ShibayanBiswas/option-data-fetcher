import JSZip from "jszip";
import {
  BSE_FO_URL,
  BSE_HEADERS,
  HTTP_HEADERS,
  NSE_FO_URL,
  PREFERRED_COLUMNS,
  UDIFF_EPOCH,
  classifySegment,
  sideFromOptnTp,
} from "./constants";
import {
  dropEmptyColumns,
  parseCsv,
  sortRowsByStrike,
  writeLocalChain,
} from "./storage";
import {
  countChains,
  ensureSchema,
  upsertChainDocs,
} from "./db";
import type { Exchange, OptionChainDoc, OptionRow, Segment, SyncResult } from "./types";

function leanRows(rows: OptionRow[]): OptionRow[] {
  return rows.map((row) => {
    const next: OptionRow = {};
    for (const key of PREFERRED_COLUMNS) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]) !== "") {
        next[key] = row[key];
      }
    }
    // Always keep strike if present under alternate keys
    if (next.StrkPric == null && row.StrikePrice != null) next.StrkPric = row.StrikePrice;
    return next;
  });
}

async function fetchWithRetries(
  url: string,
  headers: Record<string, string>,
  retries = 5
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        cache: "no-store",
      });
      if (response.status === 404) return response;
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 800));
      }
    }
  }
  throw lastError ?? new Error("Request failed");
}

function parseCsvText(text: string): OptionRow[] {
  return parseCsv(text);
}

async function downloadNseRows(tradeDate: string): Promise<OptionRow[] | "missing"> {
  const yyyymmdd = tradeDate.replace(/-/g, "");
  const url = NSE_FO_URL.replace("{yyyymmdd}", yyyymmdd);
  const response = await fetchWithRetries(url, HTTP_HEADERS);
  if (response.status === 404) return "missing";

  const buffer = Buffer.from(await response.arrayBuffer());
  // Holidays / unpublished sessions sometimes return HTML or empty bodies.
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return "missing";
  }

  const zip = await JSZip.loadAsync(buffer);
  const csvName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!csvName) return "missing";
  const raw = await zip.files[csvName].async("string");
  return parseCsvText(raw);
}

async function downloadBseRows(tradeDate: string): Promise<OptionRow[] | "missing"> {
  const yyyymmdd = tradeDate.replace(/-/g, "");
  const url = BSE_FO_URL.replace("{yyyymmdd}", yyyymmdd);
  const response = await fetchWithRetries(url, BSE_HEADERS);
  if (response.status === 404) return "missing";
  const text = await response.text();
  // BSE often returns an HTML shell on holidays instead of HTTP 404.
  if (!text.includes("TradDt") && !text.includes("TckrSymb")) {
    return "missing";
  }
  return parseCsvText(text);
}

function groupIntoDocs(
  exchange: Exchange,
  tradeDate: string,
  rows: OptionRow[],
  options: { segments?: Segment[] } = {}
): OptionChainDoc[] {
  const allow = options.segments ? new Set(options.segments) : null;
  const buckets = new Map<string, OptionRow[]>();

  for (const row of rows) {
    const symbol = String(row.TckrSymb ?? "").toUpperCase();
    const side = sideFromOptnTp(String(row.OptnTp ?? ""));
    const expiryDate = String(row.XpryDt ?? "").slice(0, 10);
    if (!symbol || !side || !expiryDate) continue;

    const segment = classifySegment(
      exchange,
      symbol,
      String(row.FinInstrmTp ?? "")
    );
    if (allow && !allow.has(segment)) continue;

    const key = `${segment}|${symbol}|${side}|${expiryDate}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const now = new Date();
  const docs: OptionChainDoc[] = [];

  for (const [key, bucketRows] of buckets) {
    const [segment, symbol, side, expiryDate] = key.split("|");
    const cleaned = sortRowsByStrike(dropEmptyColumns(bucketRows));
    docs.push({
      exchange,
      segment: segment as OptionChainDoc["segment"],
      symbol,
      side: side as OptionChainDoc["side"],
      tradeDate,
      expiryDate,
      rows: cleaned,
      rowCount: cleaned.length,
      updatedAt: now,
    });
  }

  return docs;
}

export async function upsertDocs(docs: OptionChainDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  await ensureSchema();

  // Local CSV store is for laptop browsing only. Skip on Turso/remote seeds —
  // writing hundreds of thousands of files per day makes cloud seeding unusable.
  const remote =
    process.env.LIBSQL_URL?.startsWith("libsql://") ||
    process.env.LIBSQL_URL?.startsWith("https://") ||
    process.env.SKIP_LOCAL_STORE === "1";

  if (!remote) {
    await Promise.all(
      docs.map(async (doc) => {
        try {
          await writeLocalChain(doc);
        } catch {
          /* ephemeral hosts may not allow local writes */
        }
      })
    );
  }

  const leanDocs = docs.map((doc) => ({
    ...doc,
    rows: leanRows(doc.rows),
  }));

  await upsertChainDocs(leanDocs);
  return docs.length;
}

export async function syncTradeDate(
  tradeDate: string,
  exchanges: Exchange[] = ["NSE", "BSE"],
  options: { force?: boolean; segments?: Segment[] } = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    ok: true,
    tradeDate,
    saved: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    errors: [],
    message: "",
  };

  await ensureSchema();

  const segmentFilter =
    options.segments?.length === 1
      ? { segment: options.segments[0] }
      : undefined;

  // Per-exchange completeness: NSE-only / BSE-only days must still heal.
  const toFetch: Exchange[] = [];
  let existingCount = 0;
  for (const exchange of exchanges) {
    let n = 0;
    if (options.segments && options.segments.length > 1) {
      for (const segment of options.segments) {
        n += await countChains({ tradeDate, exchange, segment });
      }
    } else {
      n = await countChains({
        tradeDate,
        exchange,
        ...segmentFilter,
      });
    }
    existingCount += n;
    if (options.force || n === 0) {
      toFetch.push(exchange);
    } else {
      result.skipped += n;
    }
  }
  result.alreadyHad = existingCount > 0;

  if (toFetch.length === 0) {
    result.status = "already_synced";
    result.ok = true;
    result.message = `Archive already has ${tradeDate} on ${exchanges.join(" + ")} (${existingCount.toLocaleString()} chain files). No changes needed.`;
    return result;
  }

  // Fetch NSE + BSE in parallel, then upsert sequentially per exchange result.
  const settled = await Promise.all(
    toFetch.map(async (exchange) => {
      try {
        const rows =
          exchange === "NSE"
            ? await downloadNseRows(tradeDate)
            : await downloadBseRows(tradeDate);
        return { exchange, rows, error: null as string | null };
      } catch (err) {
        return {
          exchange,
          rows: null as OptionRow[] | "missing" | null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  for (const item of settled) {
    if (item.error) {
      result.failed += 1;
      result.errors.push(`${item.exchange} ${tradeDate}: ${item.error}`);
      continue;
    }
    if (item.rows === "missing" || item.rows == null) {
      result.missing += 1;
      continue;
    }

    const optionRows = item.rows.filter((r) => {
      const tp = String(r.OptnTp ?? "");
      return tp === "CE" || tp === "PE";
    });

    const docs = groupIntoDocs(item.exchange, tradeDate, optionRows, {
      segments: options.segments,
    });
    if (docs.length === 0) {
      result.missing += 1;
      continue;
    }

    try {
      const saved = await upsertDocs(docs);
      result.saved += saved;
    } catch (err) {
      result.failed += 1;
      result.errors.push(
        `${item.exchange} ${tradeDate}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  result.ok = result.failed === 0;

  if (result.failed > 0 && result.saved === 0 && result.skipped === 0) {
    result.status = "failed";
    result.message = `Sync failed for ${tradeDate}. ${result.errors[0] ?? ""}`.trim();
  } else if (result.missing > 0 && result.saved === 0 && result.skipped === 0) {
    result.status = "missing";
    result.message = `Bhavcopy not published yet for ${tradeDate}. Try again after market settlement.`;
  } else if (result.skipped > 0 && result.saved === 0 && result.failed === 0 && result.missing === 0) {
    result.status = "already_synced";
    result.message = `Archive already has ${tradeDate} (${existingCount.toLocaleString()} chain files). No changes needed.`;
  } else if (
    result.failed > 0 ||
    (result.missing > 0 && (result.saved > 0 || result.skipped > 0))
  ) {
    result.status = "partial";
    result.message = `Partial sync for ${tradeDate}: saved ${result.saved}, missing ${result.missing}, failed ${result.failed}${
      toFetch.length < exchanges.length ? ` (healed ${toFetch.join(", ")})` : ""
    }.`;
  } else {
    result.status = "synced";
    result.message = `Synced ${tradeDate}: ${result.saved.toLocaleString()} chain files stored in SQLite.`;
  }

  return result;
}

/** Weekday ISO dates (Mon–Fri) as a calendar fallback when Yahoo is unreachable. */
function weekdayFallback(fromIso = UDIFF_EPOCH): string[] {
  const out: string[] = [];
  const d = new Date(`${fromIso}T12:00:00Z`);
  const endUtc = new Date();
  endUtc.setUTCHours(12, 0, 0, 0);
  while (d <= endUtc) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      out.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Trading sessions from UDiFF epoch (2024-01-01) through today.
 * Prefer Yahoo ^NSEI; fall back to weekdays.
 * Optional `years` is ignored for start bound — history always begins at UDIFF_EPOCH
 * (kept for call-site compatibility).
 */
export async function fetchTradingDates(): Promise<string[]> {
  const start = new Date(`${UDIFF_EPOCH}T12:00:00Z`);
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&period1=${period1}&period2=${period2}`;

  try {
    const response = await fetch(url, {
      headers: HTTP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch trading calendar: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const timestamps: number[] = payload?.chart?.result?.[0]?.timestamp ?? [];
    const dates = timestamps
      .map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))
      .filter((iso) => iso >= UDIFF_EPOCH)
      .sort();
    if (dates.length > 0) return dates;
  } catch (err) {
    console.warn(
      "Trading calendar fetch failed — using weekday fallback:",
      err instanceof Error ? err.message : err
    );
  }
  return weekdayFallback(UDIFF_EPOCH);
}

export function latestWeekday(from = new Date()): string {
  const d = new Date(from);
  // Approximate IST (UTC+5:30). Before ~18:30 IST, today's bhavcopy is rarely ready.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffsetMs);
  const istMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (istMinutes < 18 * 60 + 30) {
    ist.setUTCDate(ist.getUTCDate() - 1);
  }
  while (ist.getUTCDay() === 0 || ist.getUTCDay() === 6) {
    ist.setUTCDate(ist.getUTCDate() - 1);
  }
  return ist.toISOString().slice(0, 10);
}

export function previousWeekdays(fromDate: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${fromDate}T12:00:00Z`);
  for (let i = 0; i < count; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Sync Today: prefer latest ready session; walk back if bhavcopy not published. */
export async function syncLatestAvailable(
  options: { force?: boolean; lookback?: number } = {}
): Promise<SyncResult> {
  const lookback = options.lookback ?? 5;
  const start = latestWeekday();
  const candidates = [start, ...previousWeekdays(start, lookback)];

  let lastMissing: SyncResult | null = null;
  let lastEmptyFailure: SyncResult | null = null;

  for (const date of candidates) {
    const result = await syncTradeDate(date, ["NSE", "BSE"], {
      force: options.force,
    });
    if (result.status === "missing") {
      lastMissing = result;
      continue;
    }
    // Transient exchange outage with nothing saved — try an older session.
    if (
      (result.status === "failed" || result.status === "partial") &&
      result.saved === 0
    ) {
      lastEmptyFailure = result;
      continue;
    }
    return result;
  }

  return (
    lastMissing ??
    lastEmptyFailure ?? {
      ok: false,
      tradeDate: start,
      saved: 0,
      skipped: 0,
      missing: 1,
      failed: 0,
      errors: [],
      status: "missing",
      message: `No bhavcopy found for the last ${lookback + 1} sessions.`,
    }
  );
}
