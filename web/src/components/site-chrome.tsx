"use client";

import Link from "next/link";
import { Moon, Sun, Database, RefreshCw, Search } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { useTheme } from "./theme-provider";

export function SiteHeader({
  onSync,
  syncing,
  onSearch,
  latestTradeDate,
}: {
  onSync?: () => void;
  syncing?: boolean;
  onSearch?: () => void;
  latestTradeDate?: string | null;
}) {
  const { theme, toggle } = useTheme();

  return (
    <header className="brand-header sticky top-0 z-50 font-ui">
      <div className="desk-gold-rail" />
      <div className="brand-header-inner brand-header-glow">
        <Link href="/" className="brand-lockup no-underline">
          <BrandLogo />
          <span className="brand-lockup-divider" aria-hidden />
          <span className="brand-title-block">
            <span className="brand-title-eyebrow">Derivatives desk</span>
            <span className="brand-title">
              Option Chain <span className="shine-text">Archive</span>
            </span>
          </span>
        </Link>

        <nav className="brand-nav">
          <Link href="/browse" className="brand-nav-link">
            Browse
          </Link>
          <Link href="/schema" className="brand-nav-link brand-nav-link--md">
            Schema
          </Link>
          {onSearch && (
            <button type="button" className="brand-nav-action" onClick={onSearch}>
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="brand-kbd">⌘K</kbd>
            </button>
          )}
          {onSync && (
            <button
              type="button"
              className="btn-maroon inline-flex items-center gap-1.5 !px-3.5 !py-2 text-xs"
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
            className="brand-nav-icon"
            onClick={toggle}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </nav>
      </div>
      <div className="brand-subheader">
        <Database className="h-3.5 w-3.5 text-[var(--ar-gold)]" />
        <span>
          NSE · BSE · weekday sync
          {latestTradeDate ? (
            <>
              {" "}
              · through <strong className="font-semibold text-[var(--ar-ink)]">{latestTradeDate}</strong>
            </>
          ) : null}
        </span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="desk-footer shrink-0 border-t border-[var(--ar-border)] py-1">
      <div className="mx-auto flex max-w-full items-center justify-center px-3 font-ui text-[11px] text-[var(--ar-subtle)] lg:px-4">
        <span>Option Chain Archive · live End Date from local SQLite</span>
      </div>
    </footer>
  );
}
