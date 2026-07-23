import { NextRequest, NextResponse } from "next/server";
import { syncLatestAvailable } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  // Local / preview without secrets: allow for desk testing.
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  // Fail closed in production — never leave cron publicly triggerable.
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  // Prefer Bearer / header — avoid ?secret= in access logs.
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await syncLatestAvailable({ force });
    return NextResponse.json(result, {
      status: result.status === "failed" ? 500 : result.ok ? 200 : 207,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron sync failed" },
      { status: 500 }
    );
  }
}
