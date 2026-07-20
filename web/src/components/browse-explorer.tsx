"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Layers,
  Building2,
  LineChart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BrowseResponse } from "@/lib/types";
import { DownloadButtons } from "./download-buttons";

function iconForLevel(level: BrowseResponse["level"]) {
  switch (level) {
    case "root":
      return Building2;
    case "exchange":
      return Layers;
    case "segment":
    case "symbol":
      return LineChart;
    default:
      return Folder;
  }
}

export function BrowseExplorer({ initialPath = "" }: { initialPath?: string }) {
  const searchParams = useSearchParams();
  const sectorParam = searchParams.get("sector");
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiPath = useMemo(() => initialPath.replace(/^\/+|\/+$/g, ""), [initialPath]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ path: apiPath });
    if (sectorParam) qs.set("sector", sectorParam);
    fetch(`/api/browse?${qs.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to browse");
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Browse failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, sectorParam]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-12 text-center font-ui text-[var(--ar-muted)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[var(--ar-gold)] border-t-transparent"
        />
        Loading archive…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="font-serif text-xl text-[var(--ar-maroon)]">Unable to load</p>
        <p className="mt-2 font-ui text-sm text-[var(--ar-muted)]">{error}</p>
        <p className="mt-4 font-ui text-xs text-[var(--ar-subtle)]">
          If this is a fresh deploy, use Sync Today to pull the latest bhavcopy into MongoDB.
        </p>
      </div>
    );
  }

  const Icon = iconForLevel(data.level);
  const downloadPath = apiPath;
  const stockBase = data.path.exchange
    ? `/browse/${data.path.exchange}/STOCK`
    : "/browse";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1 font-ui text-xs text-[var(--ar-subtle)]">
        {data.breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <Link
              href={crumb.href}
              className="text-[var(--ar-muted)] no-underline hover:text-[var(--ar-gold)]"
            >
              {crumb.label}
            </Link>
          </span>
        ))}
      </div>

      <div className="glass flex flex-col gap-4 rounded-2xl p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="label-chip mb-2 inline-flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" />
            {data.level}
          </div>
          <h1 className="font-serif text-3xl text-[var(--ar-ink)] sm:text-4xl">{data.title}</h1>
          <p className="mt-2 max-w-3xl font-ui text-sm text-[var(--ar-muted)]">{data.subtitle}</p>
        </div>
        <div className="shrink-0">
          {(data.canDownloadBundle || data.canDownloadLeaf) && (
            <DownloadButtons path={downloadPath} leaf={data.canDownloadLeaf} />
          )}
        </div>
      </div>

      {data.sectorGroups && data.sectorGroups.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="label-chip">Sectors</p>
            {data.activeSector && (
              <Link href={stockBase} className="font-ui text-xs text-[var(--ar-gold)] no-underline">
                Clear filter
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.sectorGroups.map((g) => (
              <Link
                key={g.sector}
                href={`${stockBase}?sector=${encodeURIComponent(g.sector)}`}
                className={`btn-pill no-underline ${
                  data.activeSector === g.sector ? "btn-pill-active" : ""
                }`}
              >
                {g.sector}
                <span className="ml-1 opacity-70">{g.symbols.length}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.sectorGroups && !data.activeSector ? (
        <div className="space-y-6">
          {data.sectorGroups.map((group, gi) => (
            <section key={group.sector} className="glass rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl text-[var(--ar-ink)]">{group.sector}</h2>
                <Link
                  href={`${stockBase}?sector=${encodeURIComponent(group.sector)}`}
                  className="font-ui text-xs text-[var(--ar-gold)] no-underline"
                >
                  View sector
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {group.symbols.map((child, index) => (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min((gi * 0.02 + index * 0.015), 0.35) }}
                  >
                    <Link
                      href={child.href}
                      className="folder-card glass flex items-start gap-3 rounded-xl p-3 no-underline"
                    >
                      <div className="rounded-lg bg-gradient-to-br from-[var(--ar-maroon)] to-[var(--ar-gold)] p-1.5 text-white">
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-serif text-base text-[var(--ar-ink)]">
                          {child.label}
                        </div>
                        <div className="font-ui text-[11px] text-[var(--ar-subtle)]">
                          {child.meta}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : data.children.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {data.children.map((child, index) => (
              <motion.div
                key={child.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.35), duration: 0.3 }}
              >
                <Link
                  href={child.href}
                  className="folder-card glass flex items-start gap-3 rounded-2xl p-4 no-underline"
                >
                  <div className="rounded-xl bg-gradient-to-br from-[var(--ar-maroon)] to-[var(--ar-gold)] p-2 text-white">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg text-[var(--ar-ink)]">{child.label}</div>
                    {child.meta && (
                      <div className="mt-0.5 font-ui text-xs text-[var(--ar-subtle)]">
                        {child.meta}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ar-gold)]" />
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      {data.table && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass overflow-hidden rounded-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ar-border)] px-4 py-3">
            <div className="font-ui text-sm text-[var(--ar-muted)]">
              Strike ladder · {data.table.rows.length} rows
            </div>
            <DownloadButtons path={downloadPath} leaf />
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {data.table.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.table.rows.map((row, i) => (
                  <tr key={i}>
                    {data.table!.columns.map((col) => (
                      <td key={col}>{row[col] == null ? "" : String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {data.children.length === 0 && !data.table && !data.sectorGroups && (
        <div className="glass rounded-2xl p-8 text-center font-ui text-sm text-[var(--ar-muted)]">
          <Folder className="mx-auto mb-3 h-8 w-8 text-[var(--ar-gold)]" />
          No files at this level yet. Sync bhavcopy data to populate the archive.
        </div>
      )}
    </div>
  );
}
