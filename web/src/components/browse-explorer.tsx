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
import type { BrowseChild, BrowseResponse } from "@/lib/types";
import { DateRangeFilter } from "./date-range-filter";
import { DownloadButtons } from "./download-buttons";
import { StaggerItem } from "./motion-primitives";
import { SexyCard } from "./sexy-card";

function iconForLevel(level: BrowseResponse["level"]) {
  switch (level) {
    case "root":
      return Building2;
    case "exchange":
      return Layers;
    case "segment":
    case "symbol":
      return LineChart;
    case "side":
    case "tradeDate":
    case "expiry":
      return Folder;
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

function levelChip(data: BrowseResponse): string {
  switch (data.level) {
    case "expiry":
      return "Expiry file";
    case "tradeDate":
      return "Trade date";
    case "side":
      return "Option side";
    case "symbol":
      return "Underlying";
    case "segment":
      if (data.path.segment === "STOCK") return "Stock Options";
      if (data.path.segment === "INDEX") return "Index Options";
      return "Other Securities";
    case "exchange":
      return "Exchange";
    case "root":
      return "Archive";
    default: {
      const _exhaustive: never = data.level;
      return _exhaustive;
    }
  }
}

export function BrowseExplorer({ initialPath = "" }: { initialPath?: string }) {
  const searchParams = useSearchParams();
  const sectorParam = searchParams.get("sector");
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const apiPath = useMemo(() => initialPath.replace(/^\/+|\/+$/g, ""), [initialPath]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDateFrom(null);
    setDateTo(null);
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

  const tradeDates = useMemo(() => {
    if (!data || data.level !== "side") return [] as BrowseChild[];
    // API returns oldest → newest
    return data.children;
  }, [data]);

  const dateBounds = useMemo(() => {
    if (tradeDates.length === 0) return null;
    const sorted = [...tradeDates.map((c) => c.label)].sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [tradeDates]);

  useEffect(() => {
    if (!dateBounds) return;
    setDateFrom((prev) => prev ?? dateBounds.min);
    setDateTo((prev) => prev ?? dateBounds.max);
  }, [dateBounds]);

  const visibleChildren = useMemo(() => {
    if (!data) return [] as BrowseChild[];
    if (data.level !== "side" || !dateBounds || !dateFrom || !dateTo) {
      return data.children;
    }
    return tradeDates.filter((c) => c.label >= dateFrom && c.label <= dateTo);
  }, [data, tradeDates, dateBounds, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-10 text-center font-ui text-[var(--ar-muted)]">
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
          If this is a fresh deploy, use Sync Today to pull the latest bhavcopy into the archive.
        </p>
      </div>
    );
  }

  const Icon = iconForLevel(data.level);
  const downloadPath = apiPath;
  const stockBase = data.path.exchange
    ? `/browse/${data.path.exchange}/STOCK`
    : "/browse";
  const showHeaderDownload =
    (data.canDownloadBundle || data.canDownloadLeaf) && !data.table;

  return (
    <div className="browse-pane space-y-4">
      <nav aria-label="Breadcrumb" className="path-crumbs">
        {data.breadcrumbs.map((crumb, i) => {
          const last = i === data.breadcrumbs.length - 1;
          return (
            <motion.span
              key={`${crumb.href}-${i}`}
              className="path-crumb-item"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {i > 0 ? <ChevronRight className="path-crumb-sep" aria-hidden /> : null}
              {last ? (
                <span className="path-crumb-current">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="path-crumb-link">
                  {crumb.label}
                </Link>
              )}
            </motion.span>
          );
        })}
      </nav>

      <SexyCard className="!p-4">
        <motion.div
          className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="min-w-0 flex-1">
            <div className="label-chip mb-2 inline-flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {levelChip(data)}
            </div>
            <h1 className="font-serif text-3xl text-[var(--ar-ink)] sm:text-4xl">{data.title}</h1>
            <p className="mt-1.5 max-w-3xl font-ui text-sm text-[var(--ar-muted)]">{data.subtitle}</p>
          </div>
          {showHeaderDownload ? (
            <div className="shrink-0">
              <DownloadButtons path={downloadPath} leaf={data.canDownloadLeaf} />
            </div>
          ) : null}
          {data.table ? (
            <div className="shrink-0">
              <DownloadButtons path={downloadPath} leaf />
            </div>
          ) : null}
        </motion.div>
      </SexyCard>

      {data.level === "side" && dateBounds && dateFrom && dateTo ? (
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          min={dateBounds.min}
          max={dateBounds.max}
          onChange={({ from, to }) => {
            setDateFrom(from);
            setDateTo(to);
          }}
          onReset={() => {
            setDateFrom(dateBounds.min);
            setDateTo(dateBounds.max);
          }}
        />
      ) : null}

      {data.sectorGroups && data.sectorGroups.length > 0 && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
        <div className="space-y-4">
          {data.sectorGroups.map((group, gi) => (
            <section key={group.sector} className="glass rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl text-[var(--ar-ink)]">{group.sector}</h2>
                <Link
                  href={`${stockBase}?sector=${encodeURIComponent(group.sector)}`}
                  className="font-ui text-xs text-[var(--ar-gold)] no-underline"
                >
                  View sector
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {group.symbols.map((child, index) => (
                  <SexyCard
                    key={child.id}
                    href={child.href}
                    delay={Math.min(gi * 0.02 + index * 0.015, 0.35)}
                    accent="mixed"
                    className="!p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel)] p-1.5 text-[var(--ar-ink)]">
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
                    </div>
                  </SexyCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : visibleChildren.length > 0 && data.level === "side" ? (
        <div className="date-list glass overflow-hidden rounded-2xl">
          <div className="border-b border-[var(--ar-border)] px-3 py-2 font-ui text-xs text-[var(--ar-muted)]">
            {visibleChildren.length.toLocaleString()} sessions · oldest → newest
          </div>
          <div className="date-list-scroll">
            {visibleChildren.map((child, index) => (
              <StaggerItem key={child.id} index={index}>
                <Link href={child.href} className="date-list-row no-underline">
                  <span className="date-list-label">{child.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ar-gold)] opacity-70" />
                </Link>
              </StaggerItem>
            ))}
          </div>
        </div>
      ) : visibleChildren.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <AnimatePresence mode="popLayout">
            {visibleChildren.map((child, index) => (
              <motion.div key={child.id} layout>
                <SexyCard
                  href={child.href}
                  delay={Math.min(index * 0.015, 0.3)}
                  accent="mixed"
                  className="!p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-xl border border-[var(--ar-border)] bg-[var(--ar-panel)] p-2 text-[var(--ar-ink)]">
                      <FolderOpen className="h-4 w-4" />
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
                  </div>
                </SexyCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : data.level === "side" ? (
        <div className="glass rounded-2xl p-6 text-center font-ui text-sm text-[var(--ar-muted)]">
          No trade dates in this range. Widen the calendar filter or tap All dates.
        </div>
      ) : null}

      {data.table && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass overflow-hidden rounded-2xl"
        >
          <div className="border-b border-[var(--ar-border)] px-4 py-2.5 font-ui text-sm text-[var(--ar-muted)]">
            Strike ladder · {data.table.rows.length} rows
          </div>
          <div className="max-h-[min(70vh,calc(100dvh-16rem))] overflow-auto">
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
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.008, 0.35) }}
                  >
                    {data.table!.columns.map((col) => (
                      <td key={col}>{row[col] == null ? "" : String(row[col])}</td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {visibleChildren.length === 0 &&
        !data.table &&
        !data.sectorGroups &&
        data.level !== "side" && (
          <div className="glass rounded-2xl p-8 text-center font-ui text-sm text-[var(--ar-muted)]">
            <Folder className="mx-auto mb-3 h-8 w-8 text-[var(--ar-gold)]" />
            No files at this level yet. Sync bhavcopy data to populate the archive.
          </div>
        )}
    </div>
  );
}
