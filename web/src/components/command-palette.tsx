"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Building2, LineChart, Layers } from "lucide-react";

export type SearchHit = {
  id: string;
  label: string;
  href: string;
  meta: string;
  kind: "exchange" | "segment" | "symbol" | "sector" | "page";
};

export function CommandPalette({
  open,
  onClose,
  hits,
}: {
  open: boolean;
  onClose: () => void;
  hits: SearchHit[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hits;
    return hits
      .filter(
        (h) =>
          h.label.toLowerCase().includes(q) ||
          h.meta.toLowerCase().includes(q) ||
          h.id.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [hits, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && filtered[active]) {
        e.preventDefault();
        router.push(filtered[active].href);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, onClose, router]);

  const iconFor = (kind: SearchHit["kind"]) => {
    if (kind === "exchange") return Building2;
    if (kind === "segment" || kind === "sector") return Layers;
    return LineChart;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-[color-mix(in_srgb,var(--ar-ink)_40%,transparent)] p-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="dropdown-panel w-full max-w-xl overflow-hidden"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--ar-border)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--ar-gold)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search NSE, BSE, NIFTY, RELIANCE, Banks, Schema…"
                className="font-ui w-full bg-transparent text-sm text-[var(--ar-ink)] outline-none placeholder:text-[var(--ar-subtle)]"
              />
              <kbd className="font-ui hidden rounded border border-[var(--ar-border)] px-1.5 py-0.5 text-[10px] text-[var(--ar-subtle)] sm:inline">
                ESC
              </kbd>
            </div>
            <div className="max-h-[50vh] overflow-auto py-2">
              {filtered.length === 0 && (
                <p className="font-ui px-4 py-6 text-center text-sm text-[var(--ar-muted)]">
                  No matches in the archive.
                </p>
              )}
              {filtered.map((hit, i) => {
                const Icon = iconFor(hit.kind);
                return (
                  <button
                    key={hit.id + hit.href}
                    type="button"
                    className={`font-ui flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                      i === active
                        ? "bg-[color-mix(in_srgb,var(--ar-gold)_14%,transparent)]"
                        : "hover:bg-[var(--ar-panel)]"
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      router.push(hit.href);
                      onClose();
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--ar-maroon)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--ar-ink)]">
                        {hit.label}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--ar-subtle)]">
                        {hit.meta}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
