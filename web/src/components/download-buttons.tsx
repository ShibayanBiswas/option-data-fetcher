"use client";

import { Check, Download, FileText, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

function downloadUrl(path: string, leaf: boolean) {
  const params = new URLSearchParams({
    path,
    format: "csv",
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

async function saveBlobResponse(res: Response, fallbackName: string) {
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function startNativeDownload(url: string) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  }, 120_000);
}

export function DownloadButtons({
  path,
  leaf = false,
}: {
  path: string;
  leaf?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trigger = useCallback(async () => {
    abortRef.current?.abort();
    setBusy(true);
    setDone(false);
    setError(null);
    setHint(null);
    const url = downloadUrl(path, leaf);
    const fallback = leaf ? "chain.csv" : "chain.zip";

    try {
      if (!leaf) {
        const probe = await fetch(`${url}&probe=1`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const probeJson = (await probe.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          files?: number;
        };
        if (!probe.ok || !probeJson.ok) {
          throw new Error(probeJson.error ?? "Download not available for this folder");
        }
        const n = probeJson.files ?? 0;
        setHint(
          n > 0
            ? `Download started — streaming ${n.toLocaleString()} CSV files. Keep this tab open until the zip finishes.`
            : "Download started — keep this tab open until the zip finishes."
        );
        startNativeDownload(url);
        setDone(true);
        window.setTimeout(() => {
          setDone(false);
          setHint(null);
        }, 5000);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const ct = res.headers.get("Content-Type") ?? "";
      if (!res.ok) {
        if (ct.includes("application/json")) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "Download failed");
        }
        throw new Error(`Download failed (${res.status})`);
      }
      await saveBlobResponse(res, fallback);
      setDone(true);
      window.setTimeout(() => setDone(false), 2200);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Download failed");
      window.setTimeout(() => setError(null), 6000);
    } finally {
      setBusy(false);
    }
  }, [leaf, path]);

  return (
    <div className="download-actions font-ui flex flex-col items-end gap-1">
      <button
        type="button"
        className={`btn-gold inline-flex items-center gap-1.5 text-xs ${
          done ? "download-btn-success" : ""
        }`}
        onClick={() => void trigger()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : done ? (
          <Check className="h-3.5 w-3.5 download-check-icon" />
        ) : leaf ? (
          <FileText className="h-3.5 w-3.5" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {leaf ? "Download CSV" : "Download CSV Zip"}
      </button>
      {busy ? (
        <p className="download-hint text-[10px] text-[var(--ar-subtle)]">
          {leaf ? "Preparing CSV…" : "Building CSV zip — please wait…"}
        </p>
      ) : null}
      {hint && !busy ? (
        <p className="download-hint text-[10px] text-[var(--ar-subtle)]">{hint}</p>
      ) : null}
      {error ? (
        <p className="download-hint text-[10px] text-[var(--ar-maroon)]">{error}</p>
      ) : null}
    </div>
  );
}
