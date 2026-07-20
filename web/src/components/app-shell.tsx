"use client";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DeskDialog, type DeskAlertVariant } from "@/components/desk-dialog";
import { CommandPalette, type SearchHit } from "@/components/command-palette";
import { useCallback, useEffect, useState } from "react";

function variantForStatus(status?: string): DeskAlertVariant {
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
    default:
      return "info";
  }
}

function titleForStatus(status?: string): string {
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
    default:
      return "Sync status";
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
      if (!res.ok && res.status !== 207 && json.status !== "missing" && json.status !== "partial") {
        throw new Error(json.error || json.message || "Sync failed");
      }
      const status = json.status as string | undefined;
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

  return (
    <div className="relative flex min-h-screen flex-col bg-mesh font-serif">
      <div className="desk-ambient-orbs" aria-hidden>
        <div className="desk-ambient-orb desk-ambient-orb--gold" />
        <div className="desk-ambient-orb desk-ambient-orb--maroon" />
      </div>
      <SiteHeader
        onSync={onSync}
        syncing={syncing}
        onSearch={() => setSearchOpen(true)}
      />
      <main className="relative z-10 mx-auto w-full max-w-full flex-1 px-4 py-5 lg:px-6">
        {children}
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
        onClose={() => {
          const reload = dialog.reload;
          setDialog((d) => ({ ...d, open: false }));
          if (reload) window.location.reload();
        }}
        onPrimary={() => {
          if (dialog.reload) window.location.reload();
        }}
      />
    </div>
  );
}
