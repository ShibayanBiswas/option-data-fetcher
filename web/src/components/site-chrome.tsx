"use client";

import Image from "next/image";
import Link from "next/link";
import { Moon, Sun, Database, RefreshCw, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "./theme-provider";

export function SiteHeader({
  onSync,
  syncing,
  onSearch,
}: {
  onSync?: () => void;
  syncing?: boolean;
  onSearch?: () => void;
}) {
  const { theme, toggle } = useTheme();

  return (
    <header className="brand-header sticky top-0 z-50 font-ui">
      <div className="desk-gold-rail" />
      <div className="brand-header-glow mx-auto flex max-w-full items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <Image
            src={theme === "dark" ? "/brand/arwl-logo-white.png" : "/brand/arwl-logo.png"}
            alt="Anand Rathi — Private Wealth. uncomplicated."
            width={148}
            height={40}
            className="h-9 w-auto"
            priority
          />
          <div className="hidden sm:block">
            <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--ar-subtle)]">
              Anand Rathi Wealth · Options Desk
            </div>
            <div className="font-serif text-lg leading-tight text-[var(--ar-ink)]">
              Option Chain <span className="shine-text">Archive</span>
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/browse"
            className="rounded-full border border-[var(--ar-border)] px-3 py-1.5 text-[var(--ar-ink)] no-underline transition hover:border-[var(--ar-gold)]"
          >
            Browse
          </Link>
          <Link
            href="/schema"
            className="hidden rounded-full border border-[var(--ar-border)] px-3 py-1.5 text-[var(--ar-ink)] no-underline transition hover:border-[var(--ar-gold)] md:inline-flex"
          >
            Schema
          </Link>
          {onSearch && (
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
              onClick={onSearch}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-1 hidden rounded border border-[var(--ar-border)] px-1 text-[10px] lg:inline">
                ⌘K
              </kbd>
            </button>
          )}
          {onSync && (
            <button
              type="button"
              className="btn-maroon inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs"
              onClick={onSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Today"}
            </button>
          )}
          <button
            type="button"
            aria-label="Toggle theme"
            className="btn-ghost !px-2.5 !py-1.5"
            onClick={toggle}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </nav>
      </div>
      <motion.div
        className="mx-auto flex max-w-full items-center gap-2 px-4 pb-2 text-[0.7rem] text-[var(--ar-subtle)] lg:px-6"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Database className="h-3.5 w-3.5 text-[var(--ar-gold)]" />
        NSE and BSE bhavcopy · MongoDB Atlas Mumbai · weekday auto-refresh after market close
      </motion.div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-[var(--ar-border)] py-8">
      <div className="mx-auto flex max-w-full flex-col items-center justify-between gap-2 px-4 font-ui text-sm text-[var(--ar-subtle)] sm:flex-row lg:px-6">
        <span>
          <span className="text-[var(--ar-gold)]">Anand Rathi Wealth</span> · Option Chain Desk
        </span>
        <span>Private Wealth. uncomplicated.</span>
      </div>
    </footer>
  );
}
