import { NextRequest, NextResponse } from "next/server";
import { getTreeChildren } from "@/lib/tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path") ?? "";
    const sector = request.nextUrl.searchParams.get("sector");
    const children = await getTreeChildren(path, sector);
    return NextResponse.json({ path, sector, children });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tree failed", children: [] },
      { status: 500 }
    );
  }
}
