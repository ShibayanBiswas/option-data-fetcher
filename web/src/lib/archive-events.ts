/** Browser-wide archive status / sync notifications */

export const ARCHIVE_UPDATED_EVENT = "oca:archive-updated";

export type ArchiveStatusPayload = {
  ok?: boolean;
  totalDocuments?: number;
  latestTradeDate?: string | null;
  earliestTradeDate?: string | null;
  tradingDays?: number;
  symbolCount?: number;
  segments?: { INDEX: number; STOCK: number; OTHER: number };
  /** True when a sync just wrote new rows */
  synced?: boolean;
};

export function emitArchiveUpdated(detail: ArchiveStatusPayload = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ArchiveStatusPayload>(ARCHIVE_UPDATED_EVENT, { detail })
  );
}

export async function fetchArchiveStatus(): Promise<ArchiveStatusPayload | null> {
  try {
    const res = await fetch("/api/sync", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ArchiveStatusPayload;
  } catch {
    return null;
  }
}
