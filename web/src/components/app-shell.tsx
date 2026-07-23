"use client";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DeskDialog, type DeskAlertVariant } from "@/components/desk-dialog";
import { CommandPalette, type SearchHit } from "@/components/command-palette";
import { BrowseShell } from "@/components/browse-shell";
import { useCallback, useEffect, useState } from "react";
import {
  ARCHIVE_UPDATED_EVENT,
  emitArchiveUpdated,
  fetchArchiveStatus,
  statusFingerprint,
  type ArchiveStatusPayload,
} from "@/lib/archive-events";

type SyncStatus =
  | "synced"
  | "already_synced"
  | "missing"
  | "partial"
  | "failed"
  | undefined;

function variantForStatus(status: SyncStatus): DeskAlertVariant {
  switch (status) {
    case "synced":
      return "success";
    case "already_synced":
      return "info";
    case "missing":
    case "partial":
      return "warning";
    case "failed":
      return "error";
    case undefined:
      return "info";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function titleForStatus(status: SyncStatus): string {
  switch (status) {
    case "synced":
      return "Sync complete";
    case "already_synced":
      return "Already in archive";
    case "missing":
      return "Bhavcopy not ready";
    case "partial":
      return "Partial sync";
    case "failed":
      return "Sync failed";
    case undefined:
      return "Sync status";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function istDayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function refreshAndBroadcast(synced = false) {
  const status = await fetchArchiveStatus();
  if (status) emitArchiveUpdated({ ...status, synced });
  return status;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [latestTradeDate, setLatestTradeDate] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: DeskAlertVariant;
    reload?: boolean;
  }>({ open: false, title: "", message: "", variant: "info" });

  useEffect(() => {
    fetch("/api/search")
      .then((r) => r.json())
      .then((j) => setHits(j.hits ?? []))
      .catch(() => setHits([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live status: load once; refresh on archive-updated events.
  useEffect(() => {
    let cancelled = false;
    let lastFp = "";

    const apply = (status: ArchiveStatusPayload | null, broadcast = false) => {
      if (cancelled || !status) return;
      const fp = statusFingerprint(status);
      if (fp === lastFp) return;
      lastFp = fp;
      if (status.latestTradeDate) setLatestTradeDate(status.latestTradeDate);
      if (broadcast) emitArchiveUpdated(status);
    };

    void fetchArchiveStatus().then((status) => apply(status, true));

    const onUpdated = (e: Event) => {
      apply((e as CustomEvent<ArchiveStatusPayload>).detail, false);
    };
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onUpdated);
    };
  }, []);

  // Quiet catch-up: only POST when archive is behind the latest ready weekday.
  // Cron remains the primary daily writer — this is a light desk fallback.
  useEffect(() => {
    const key = "oca:auto-sync-day";
    const day = istDayKey();
    try {
      if (sessionStorage.getItem(key) === day) return;
    } catch {
      /* private mode */
    }

    let cancelled = false;
    void (async () => {
      try {
        const statusRes = await fetch("/api/sync", { credentials: "same-origin" });
        const statusJson = (await statusRes.json().catch(() => ({}))) as {
          latestTradeDate?: string | null;
          readyThrough?: string | null;
          totalDocuments?: number;
          quota?: boolean;
        };
        if (cancelled || statusRes.status === 503 || statusJson.quota) {
          try {
            sessionStorage.setItem(key, day);
          } catch {
            /* ignore */
          }
          return;
        }

        const latest = statusJson.latestTradeDate;
        const ready = statusJson.readyThrough || day;
        // No stats / empty archive — do not hammer writes; wait for cron / Sync Today.
        if (!latest || !statusJson.totalDocuments) {
          try {
            sessionStorage.setItem(key, day);
          } catch {
            /* ignore */
          }
          return;
        }
        // Already at or past the latest publishable session.
        if (latest >= ready) {
          try {
            sessionStorage.setItem(key, day);
          } catch {
            /* ignore */
          }
          return;
        }

        const res = await fetch("/api/sync", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = (await res.json().catch(() => ({}))) as {
          status?: SyncStatus;
          message?: string;
          quota?: boolean;
          error?: string;
        };
        if (cancelled) return;
        try {
          sessionStorage.setItem(key, day);
        } catch {
          /* ignore */
        }
        if (res.status === 503 || json.quota) return;
        const wrote =
          json.status === "synced" || json.status === "partial";
        await refreshAndBroadcast(wrote);
      } catch {
        /* quiet — cron / Sync Today still cover failures */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (
        !res.ok &&
        res.status !== 207 &&
        json.status !== "missing" &&
        json.status !== "partial"
      ) {
        throw new Error(json.error || json.message || "Sync failed");
      }
      const status = json.status as SyncStatus;
      const wrote = status === "synced" || status === "partial";
      await refreshAndBroadcast(wrote);
      setDialog({
        open: true,
        title: titleForStatus(status),
        message: json.message || "Sync finished.",
        variant: variantForStatus(status),
        reload: wrote,
      });
    } catch (err) {
      setDialog({
        open: true,
        title: "Sync failed",
        message: err instanceof Error ? err.message : "Sync failed",
        variant: "error",
      });
    } finally {
      setSyncing(false);
    }
  }, []);

  const closeDialog = useCallback(() => {
    setDialog((d) => {
      if (d.reload) {
        void refreshAndBroadcast(true);
      }
      return { ...d, open: false };
    });
  }, []);

  return (
    <div className="desk-app relative flex h-dvh flex-col overflow-hidden bg-mesh font-serif">
      <div className="desk-ambient-orbs" aria-hidden>
        <div className="desk-ambient-orb desk-ambient-orb--gold" />
        <div className="desk-ambient-orb desk-ambient-orb--maroon" />
      </div>
      <SiteHeader
        onSync={onSync}
        syncing={syncing}
        onSearch={() => setSearchOpen(true)}
        latestTradeDate={latestTradeDate}
      />
      <main className="relative z-10 flex min-h-0 w-full flex-1 flex-col px-2 pb-0 pt-2 sm:px-3 lg:px-4">
        <BrowseShell>{children}</BrowseShell>
      </main>
      <SiteFooter />
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        hits={hits}
      />
      <DeskDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        variant={dialog.variant}
        primaryLabel={dialog.reload ? "Update view" : "OK"}
        onClose={closeDialog}
      />
    </div>
  );
}
