import { NextRequest, NextResponse } from "next/server";
import { pathFromSegments } from "@/lib/storage";
import { browse } from "@/lib/browse";

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
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Browse failed",
      },
      { status: 500 }
    );
  }
}
