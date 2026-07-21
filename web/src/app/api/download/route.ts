import { NextRequest, NextResponse } from "next/server";
import { pathFromSegments } from "@/lib/storage";
import {
  buildLeafCsv,
  estimateBundleSize,
  streamCsvZip,
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
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pathParam = sp.get("path") ?? "";
    const format = (sp.get("format") ?? "csv").toLowerCase();
    const mode = (sp.get("mode") ?? "bundle").toLowerCase();

    if (format === "xlsx" || format === "excel") {
      return NextResponse.json(
        { error: "Excel downloads are disabled. Use CSV or CSV Zip." },
        { status: 400 }
      );
    }

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

    if (segments.length === 1 && mode !== "leaf" && !isLeaf) {
      return NextResponse.json(
        {
          error:
            "Pick Index Options, Stock Options, or a symbol folder — a whole exchange zip is too large.",
        },
        { status: 400 }
      );
    }

    if (sp.get("probe") === "1") {
      if (segments.length <= 1 && !isLeaf) {
        return NextResponse.json(
          { ok: false, error: "Pick a narrower folder to download." },
          { status: 400 }
        );
      }
      const files = await estimateBundleSize(browsePath);
      return NextResponse.json({
        ok: true,
        files,
        format: "csv",
        path: pathParam,
      });
    }

    if (mode === "leaf" || isLeaf) {
      const { buffer, filename } = await buildLeafCsv(browsePath);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          ...attachmentHeaders(filename, "text/csv; charset=utf-8", "private, max-age=3600"),
          "Content-Length": String(buffer.length),
        },
      });
    }

    const fileCount = await estimateBundleSize(browsePath);
    const { stream, filename } = streamCsvZip(browsePath);
    return new NextResponse(stream, {
      headers: {
        ...attachmentHeaders(filename, "application/zip", "private, no-store"),
        "X-Archive-File-Count": String(fileCount),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 }
    );
  }
}
