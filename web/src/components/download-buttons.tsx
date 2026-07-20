"use client";

import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

function downloadUrl(path: string, format: "csv" | "xlsx", leaf: boolean) {
  const params = new URLSearchParams({
    path,
    format,
    mode: leaf ? "leaf" : "bundle",
  });
  return `/api/download?${params.toString()}`;
}

export function DownloadButtons({
  path,
  leaf = false,
}: {
  path: string;
  leaf?: boolean;
}) {
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);

  const trigger = async (format: "csv" | "xlsx") => {
    setBusy(format);
    try {
      const res = await fetch(downloadUrl(path, format, leaf));
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `download.${format === "csv" && leaf ? "csv" : "zip"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="font-ui flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-gold inline-flex items-center gap-1.5 text-xs"
        onClick={() => trigger("csv")}
        disabled={busy !== null}
      >
        {busy === "csv" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : leaf ? (
          <FileText className="h-3.5 w-3.5" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {leaf ? "CSV" : "CSV Zip"}
      </button>
      <button
        type="button"
        className="btn-maroon inline-flex items-center gap-1.5 text-xs"
        onClick={() => trigger("xlsx")}
        disabled={busy !== null}
      >
        {busy === "xlsx" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5" />
        )}
        {leaf ? "Excel" : "Excel Zip"}
      </button>
    </div>
  );
}
