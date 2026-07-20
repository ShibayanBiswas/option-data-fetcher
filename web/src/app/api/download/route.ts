import { NextRequest, NextResponse } from "next/server";
import { pathFromSegments } from "@/lib/storage";
import {
  buildCsvZip,
  buildExcelZip,
  buildLeafCsv,
  buildLeafExcel,
} from "@/lib/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pathParam = sp.get("path") ?? "";
    const format = (sp.get("format") ?? "csv").toLowerCase();
    const mode = (sp.get("mode") ?? "bundle").toLowerCase();

    const segments = pathParam
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const browsePath = pathFromSegments(segments);
    const isLeaf = Boolean(browsePath.expiryDate);

    if (mode === "leaf" || isLeaf) {
      if (format === "xlsx" || format === "excel") {
        const { buffer, filename } = await buildLeafExcel(browsePath);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
      const { buffer, filename } = await buildLeafCsv(browsePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(buffer.length),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const { buffer, filename } = await buildExcelZip(browsePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(buffer.length),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const { buffer, filename } = await buildCsvZip(browsePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
