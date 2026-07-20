"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

function downloadUrl(path: string, format: "csv" | "xlsx", leaf: boolean) {
  const params = new URLSearchParams({
    path,
    format,
    mode: leaf ? "leaf" : "bundle",
  });
  return `/api/download?${params.toString()}`;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  if (plain?.[1]) return plain[1];
  const unquoted = /filename=([^;\s]+)/i.exec(header);
  if (unquoted?.[1]) return unquoted[1].replace(/"/g, "");
  return fallback;
}

async function saveResponse(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const filename = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    fallbackName
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchDownload(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  const ct = res.headers.get("Content-Type") ?? "";
  if (!res.ok) {
    if (ct.includes("application/json")) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "Download failed");
    }
    throw new Error(`Download failed (${res.status})`);
  }
  await saveResponse(res, fallbackName);
}

export function DownloadButtons({
  path,
  leaf = false,
}: {
  path: string;
  leaf?: boolean;
}) {
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);
  const [done, setDone] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(
    async (format: "csv" | "xlsx") => {
      setBusy(format);
      setDone(null);
      setError(null);
      const url = downloadUrl(path, format, leaf);
      const fallback =
        format === "csv"
          ? leaf
            ? "chain.csv"
            : "chain.zip"
          : leaf
            ? "chain.xlsx"
            : "chain_excel.zip";

      try {
        await fetchDownload(url, fallback);
        setDone(format);
        window.setTimeout(() => setDone(null), 2200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Download failed");
        window.setTimeout(() => setError(null), 5000);
      } finally {
        setBusy(null);
      }
    },
    [leaf, path]
  );

  const iconFor = (format: "csv" | "xlsx", isLeaf: boolean) => {
    if (busy === format) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (done === format) return <Check className="h-3.5 w-3.5 download-check-icon" />;
    if (format === "csv") {
      return isLeaf ? (
        <FileText className="h-3.5 w-3.5" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      );
    }
    return <FileSpreadsheet className="h-3.5 w-3.5" />;
  };

  return (
    <div className="download-actions font-ui flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          type="button"
          className={`btn-gold inline-flex items-center gap-1.5 text-xs ${
            done === "csv" ? "download-btn-success" : ""
          }`}
          onClick={() => trigger("csv")}
          disabled={busy !== null}
          whileHover={busy ? undefined : { scale: 1.02 }}
          whileTap={busy ? undefined : { scale: 0.98 }}
        >
          {iconFor("csv", leaf)}
          {leaf ? "CSV" : "CSV Zip"}
        </motion.button>
        <motion.button
          type="button"
          className={`btn-maroon inline-flex items-center gap-1.5 text-xs ${
            done === "xlsx" ? "download-btn-success" : ""
          }`}
          onClick={() => trigger("xlsx")}
          disabled={busy !== null}
          whileHover={busy ? undefined : { scale: 1.02 }}
          whileTap={busy ? undefined : { scale: 0.98 }}
        >
          {iconFor("xlsx", leaf)}
          {leaf ? "Excel" : "Excel Zip"}
        </motion.button>
      </div>
      <AnimatePresence>
        {busy && (
          <motion.p
            key="busy"
            className="download-hint text-[10px] text-[var(--ar-subtle)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {leaf ? "Preparing file…" : "Building zip — please wait…"}
          </motion.p>
        )}
        {error && (
          <motion.p
            key="error"
            className="download-hint text-[10px] text-[var(--ar-maroon)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
