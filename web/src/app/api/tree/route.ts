import { NextRequest, NextResponse } from "next/server";
import { getTreeChildren } from "@/lib/tree";
import { formatDbError, isQuotaOrAuthError } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path") ?? "";
    const sector = request.nextUrl.searchParams.get("sector");
    const children = await getTreeChildren(path, sector);
    return NextResponse.json(
      { path, sector, children },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    const quota = isQuotaOrAuthError(err);
    return NextResponse.json(
      {
        error: formatDbError(err),
        quota,
        children: [],
      },
      { status: quota ? 503 : 500 }
    );
  }
}
