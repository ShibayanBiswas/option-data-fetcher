import { NextRequest, NextResponse } from "next/server";
import { pathFromSegments } from "@/lib/storage";
import { browse } from "@/lib/browse";
import { formatDbError, isQuotaOrAuthError } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pathParam = request.nextUrl.searchParams.get("path") ?? "";
    const segments = pathParam
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const browsePath = pathFromSegments(segments);
    const sector = request.nextUrl.searchParams.get("sector");
    const data = await browse(browsePath, { sector });
    const isLeaf = Boolean(browsePath.expiryDate);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isLeaf
          ? "private, max-age=120, stale-while-revalidate=300"
          : "private, max-age=60, stale-while-revalidate=180",
      },
    });
  } catch (err) {
    const quota = isQuotaOrAuthError(err);
    return NextResponse.json(
      {
        error: formatDbError(err),
        quota,
      },
      { status: quota ? 503 : 500 }
    );
  }
}
