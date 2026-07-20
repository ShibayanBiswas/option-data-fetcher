"use client";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DeskDialog, type DeskAlertVariant } from "@/components/desk-dialog";
import { CommandPalette, type SearchHit } from "@/components/command-palette";
import { BrowseShell } from "@/components/browse-shell";
import { useCallback, useEffect, useState } from "react";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
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

  const onSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
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
      setDialog({
        open: true,
        title: titleForStatus(status),
        message: json.message || "Sync finished.",
        variant: variantForStatus(status),
        reload: status === "synced" || status === "partial",
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
      const reload = d.reload;
      if (reload) {
        // Defer reload so the dialog can close first.
        queueMicrotask(() => window.location.reload());
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
        primaryLabel={dialog.reload ? "Refresh view" : "OK"}
        onClose={closeDialog}
      />
    </div>
  );
}
