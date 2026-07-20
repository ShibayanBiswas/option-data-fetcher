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

async function saveBlob(res: Response, fallbackExt: string) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? `download.${fallbackExt}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

      try {
        if (leaf) {
          const res = await fetch(url);
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(
              typeof json.error === "string" ? json.error : "Download failed"
            );
          }
          await saveBlob(res, format === "csv" ? "csv" : "xlsx");
        } else {
          // Native browser download — streams from server without loading full zip in JS
          const a = document.createElement("a");
          a.href = url;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setDone(format);
        window.setTimeout(() => setDone(null), 2200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Download failed");
        window.setTimeout(() => setError(null), 4000);
      } finally {
        setBusy(null);
      }
    },
    [leaf, path]
  );

  const iconFor = (format: "csv" | "xlsx", isLeaf: boolean) => {
    if (busy === format) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (done === format) return <Check className="h-3.5 w-3.5 text-emerald-600" />;
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
          whileHover={busy ? undefined : { scale: 1.03, y: -1 }}
          whileTap={busy ? undefined : { scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
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
          whileHover={busy ? undefined : { scale: 1.03, y: -1 }}
          whileTap={busy ? undefined : { scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
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
            {leaf ? "Preparing file…" : "Starting download — large zips stream in your browser"}
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
