"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Folder,
  Layers,
  Building2,
  LineChart,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowseChild, BrowseResponse } from "@/lib/types";
import { DateRangeFilter } from "./date-range-filter";
import { DownloadButtons } from "./download-buttons";
import { ArchiveRootHero, ExchangePickerGrid } from "./exchange-picker";
import { SexyCard } from "./sexy-card";
import { ARCHIVE_UPDATED_EVENT, type ArchiveStatusPayload } from "@/lib/archive-events";

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
  const prevMaxRef = useRef<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const apiPath = useMemo(() => initialPath.replace(/^\/+|\/+$/g, ""), [initialPath]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<ArchiveStatusPayload>).detail;
      if (detail?.synced) setRefreshTick((n) => n + 1);
    };
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(ARCHIVE_UPDATED_EVENT, onUpdated);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const soft = refreshTick > 0;
    if (!soft) {
      setLoading(true);
      setDateFrom(null);
      setDateTo(null);
    }
    setError(null);
    const qs = new URLSearchParams({ path: apiPath });
    if (sectorParam) qs.set("sector", sectorParam);
    fetch(`/api/browse?${qs.toString()}`, { credentials: "same-origin" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          const msg = json.error || "Failed to browse";
          throw new Error(json.quota ? `QUOTA:${msg}` : msg);
        }
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
  }, [apiPath, sectorParam, refreshTick]);

  const tradeDates = useMemo(() => {
    if (!data || data.level !== "side") return [] as BrowseChild[];
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
    setDateTo((prev) => {
      if (prev == null) return dateBounds.max;
      // Keep calendar pinned to latest when user was already on the prior max.
      if (prevMaxRef.current && prev === prevMaxRef.current) return dateBounds.max;
      return prev > dateBounds.max ? dateBounds.max : prev;
    });
    prevMaxRef.current = dateBounds.max;
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
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--ar-gold)] border-t-transparent" />
        Loading archive…
      </div>
    );
  }

  if (error || !data) {
    const quota = Boolean(error?.startsWith("QUOTA:"));
    const message = quota ? error!.slice(6) : error;
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="font-serif text-xl text-[var(--ar-maroon)]">
          {quota ? "Database quota exhausted" : "Unable to load"}
        </p>
        <p className="mt-2 font-ui text-sm text-[var(--ar-muted)]">{message}</p>
        <p className="mt-4 font-ui text-xs text-[var(--ar-subtle)]">
          {quota
            ? "The archive database could not be opened. Confirm data/option_chain.db exists and the Cloudflare Tunnel services are running (oca-local)."
            : "If this is a fresh deploy, use Sync Today to pull the latest bhavcopy into the archive."}
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
  const isRoot = data.level === "root";
  const isDateListLevel = data.level === "side" || data.level === "tradeDate";

  return (
    <div
      className={
        isDateListLevel ? "browse-pane browse-pane--dates" : "browse-pane space-y-4"
      }
    >
      <nav aria-label="Breadcrumb" className="path-crumbs">
        {data.breadcrumbs.map((crumb, i) => {
          const last = i === data.breadcrumbs.length - 1;
          return (
            <span
              key={`${crumb.href}-${i}`}
              className="path-crumb-item"
            >
              {i > 0 ? <ChevronRight className="path-crumb-sep" aria-hidden /> : null}
              {last ? (
                <span className="path-crumb-current">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="path-crumb-link">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {isRoot ? (
        <>
          <ArchiveRootHero title={data.title} subtitle={data.subtitle} />
          {visibleChildren.length > 0 ? (
            <ExchangePickerGrid items={visibleChildren} />
          ) : null}
        </>
      ) : (
        <>
      <SexyCard className="!p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
        </div>
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
                    accent="mixed"
                    className="desk-tile"
                  >
                    <div className="desk-tile-row">
                      <div className="desk-tile-body">
                        <div className="desk-tile-title truncate">{child.label}</div>
                        {child.meta ? (
                          <div className="desk-tile-meta truncate">{child.meta}</div>
                        ) : null}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ar-gold)] opacity-70" />
                    </div>
                  </SexyCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : visibleChildren.length > 0 &&
        (data.level === "side" || data.level === "tradeDate") ? (
        <div className="date-list glass overflow-hidden rounded-2xl">
          <div className="date-list-header font-ui text-xs text-[var(--ar-muted)]">
            {data.level === "side"
              ? `${visibleChildren.length.toLocaleString()} sessions · oldest → newest`
              : `${visibleChildren.length.toLocaleString()} expiry files · strike ladders`}
          </div>
          <div className="date-list-scroll scrollbar-thin">
            {visibleChildren.map((child) => (
              <Link
                key={child.id}
                href={child.href}
                className="date-list-row no-underline"
              >
                <span className="date-list-label">
                  {data.level === "tradeDate" ? (
                    <>
                      <span className="date-list-kicker">Expiry</span> {child.label}
                    </>
                  ) : (
                    child.label
                  )}
                </span>
                <span className="date-list-meta">{child.meta}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ar-gold)] opacity-70" />
              </Link>
            ))}
          </div>
        </div>
      ) : visibleChildren.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleChildren.map((child) => (
                <SexyCard
                  key={child.id}
                  href={child.href}
                  accent="mixed"
                  className="desk-tile"
                >
                  <div className="desk-tile-row">
                    <div className="desk-tile-body">
                      <div className="desk-tile-title">{child.label}</div>
                      {child.meta ? (
                        <div
                          className={`desk-tile-meta ${
                            child.meta.toLowerCase().includes("live") ||
                            child.meta.toLowerCase().includes("archived")
                              ? "desk-tile-meta--ok"
                              : ""
                          }`}
                        >
                          {child.meta}
                        </div>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ar-gold)] opacity-75" />
                  </div>
                </SexyCard>
            ))}
        </div>
      ) : data.level === "side" ? (
        <div className="glass rounded-2xl p-6 text-center font-ui text-sm text-[var(--ar-muted)]">
          No trade dates in this range. Widen the calendar filter or tap All dates.
        </div>
      ) : data.level === "tradeDate" ? (
        <div className="glass rounded-2xl p-6 text-center font-ui text-sm text-[var(--ar-muted)]">
          No expiry files for this trade date yet.
        </div>
      ) : null}
        </>
      )}

      {!isRoot && data.table && (
        <div className="glass overflow-hidden rounded-2xl">
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
                  <tr key={i}>
                    {data.table!.columns.map((col) => (
                      <td key={col}>{row[col] == null ? "" : String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {visibleChildren.length === 0 &&
        !data.table &&
        !data.sectorGroups &&
        data.level !== "side" &&
        data.level !== "root" && (
          <div className="glass rounded-2xl p-8 text-center font-ui text-sm text-[var(--ar-muted)]">
            <Folder className="mx-auto mb-3 h-8 w-8 text-[var(--ar-gold)]" />
            No files at this level yet. Sync bhavcopy data to populate the archive.
          </div>
        )}
    </div>
  );
}
