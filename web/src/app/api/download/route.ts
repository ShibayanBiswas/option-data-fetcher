import { NextRequest, NextResponse } from "next/server";
import { pathFromSegments } from "@/lib/storage";
import {
  buildCsvZip,
  buildExcelZip,
  buildLeafCsv,
  buildLeafExcel,
} from "@/lib/download";

function attachmentHeaders(filename: string, contentType: string, cache: string) {
  const encoded = encodeURIComponent(filename);
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`,
    "Cache-Control": cache,
  };
}
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

    if (segments.length === 0 && mode !== "leaf" && !isLeaf) {
      return NextResponse.json(
        {
          error:
            "Pick an exchange or folder to download — the full archive is too large for one zip.",
        },
        { status: 400 }
      );
    }

    if (mode === "leaf" || isLeaf) {
      if (format === "xlsx" || format === "excel") {
        const { buffer, filename } = await buildLeafExcel(browsePath);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            ...attachmentHeaders(
              filename,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "private, max-age=3600"
            ),
            "Content-Length": String(buffer.length),
          },
        });
      }
      const { buffer, filename } = await buildLeafCsv(browsePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          ...attachmentHeaders(filename, "text/csv; charset=utf-8", "private, max-age=3600"),
          "Content-Length": String(buffer.length),
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const { buffer, filename } = await buildExcelZip(browsePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          ...attachmentHeaders(filename, "application/zip", "private, no-store"),
          "Content-Length": String(buffer.length),
        },
      });
    }

    const { buffer, filename } = await buildCsvZip(browsePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...attachmentHeaders(filename, "application/zip", "private, no-store"),
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
