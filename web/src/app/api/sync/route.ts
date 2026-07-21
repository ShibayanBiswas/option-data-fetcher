import { NextRequest, NextResponse } from "next/server";
import {
  fetchTradingDates,
  syncLatestAvailable,
  syncTradeDate,
} from "@/lib/pipeline";
import {
  ensureSchema,
  formatDbError,
  getArchiveStatus,
  isQuotaOrAuthError,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Privileged ops (seed / force / dated) still need a secret in production. */
function hasSyncSecret(request: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-sync-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return (
    auth === `Bearer ${secret}` ||
    headerSecret === secret ||
    querySecret === secret
  );
}

/** Sync Today from the desk UI — same-origin, no client-side secret. */
function isSameOriginBrowser(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function authorizeSync(
  request: NextRequest,
  privileged: boolean
): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (hasSyncSecret(request)) return true;
  // Desk "Sync Today" (latest session only) works without exposing secrets.
  if (!privileged && isSameOriginBrowser(request)) return true;
  return false;
}

export async function GET() {
  try {
    await ensureSchema();
    const status = await getArchiveStatus();
    return NextResponse.json(
      {
        ok: true,
        ...status,
      },
      {
        headers: {
          // KPI meta is one row — safe to cache briefly at the edge/browser.
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    const message = formatDbError(err);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        quota: isQuotaOrAuthError(err),
      },
      { status: isQuotaOrAuthError(err) ? 503 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      date?: string;
      days?: number;
      seed?: boolean;
      force?: boolean;
    };

    const privileged = Boolean(body.seed || body.force || body.date);
    if (!authorizeSync(request, privileged)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (body.seed) {
      // Keep API seed tiny — full history belongs on the laptop CLI.
      const dates = await fetchTradingDates();
      const limit = Math.min(Math.max(1, body.days ?? 1), 3);
      const slice = dates.slice(-limit);
      const results = [];
      for (const date of slice) {
        results.push(
          await syncTradeDate(date, ["NSE", "BSE"], { force: body.force })
        );
      }
      return NextResponse.json({
        ok: true,
        mode: "seed",
        dates: slice,
        results,
        note: "API seed is capped at 3 days. Use npm run seed:backfill for full history.",
      });
    }

    if (body.date) {
      const result = await syncTradeDate(body.date, ["NSE", "BSE"], {
        force: body.force,
      });
      return NextResponse.json(result, {
        status: result.status === "failed" ? 500 : result.ok ? 200 : 207,
      });
    }

    const result = await syncLatestAvailable({ force: body.force });
    return NextResponse.json(result, {
      status: result.status === "failed" ? 500 : result.ok ? 200 : 207,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: formatDbError(err),
        quota: isQuotaOrAuthError(err),
      },
      { status: isQuotaOrAuthError(err) ? 503 : 500 }
    );
  }
}
