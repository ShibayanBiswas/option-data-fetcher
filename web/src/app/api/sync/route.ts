import { NextRequest, NextResponse } from "next/server";
import {
  fetchTradingDates,
  syncLatestAvailable,
  syncTradeDate,
} from "@/lib/pipeline";
import { ensureSchema, getArchiveStatus } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
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

export async function GET() {
  try {
    await ensureSchema();
    const status = await getArchiveStatus();
    return NextResponse.json({
      ok: true,
      ...status,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Status failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      date?: string;
      days?: number;
      seed?: boolean;
      force?: boolean;
    };

    if (body.seed) {
      const dates = await fetchTradingDates(2);
      const limit = Math.min(body.days ?? 5, 60);
      const slice = dates.slice(-limit);
      const results = [];
      for (const date of slice) {
        results.push(await syncTradeDate(date, ["NSE", "BSE"], { force: body.force }));
      }
      return NextResponse.json({
        ok: true,
        mode: "seed",
        dates: slice,
        results,
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
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
