"use client";

import Link from "next/link";
import { ArrowRight, Building2, Landmark } from "lucide-react";
import type { BrowseChild } from "@/lib/types";

const EXCHANGE_META: Record<string, { icon: typeof Building2; tagline: string }> = {
  NSE: {
    icon: Building2,
    tagline: "National Stock Exchange · Index & equity options",
  },
  BSE: {
    icon: Landmark,
    tagline: "Bombay Stock Exchange · Index & equity options",
  },
};

export function ArchiveRootHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <section className="archive-root-hero glass rounded-2xl px-5 py-6 sm:px-7 sm:py-7">
      <p className="label-chip mb-2">Archive</p>
      <h1 className="font-serif text-3xl text-[var(--ar-ink)] sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl font-ui text-sm text-[var(--ar-muted)] sm:text-base">
        {subtitle}
      </p>
    </section>
  );
}

export function ExchangePickerGrid({ items }: { items: BrowseChild[] }) {
  return (
    <div className="exchange-picker-grid">
      {items.map((child) => {
        const meta = EXCHANGE_META[child.label] ?? {
          icon: Building2,
          tagline: child.meta ?? "Option chain archive",
        };
        const Icon = meta.icon;
        const live = child.meta?.toLowerCase().includes("live");

        return (
          <Link
            key={child.id}
            href={child.href}
            className="exchange-picker-tile no-underline"
          >
            <span className="exchange-picker-icon" aria-hidden>
              <Icon className="h-6 w-6" />
            </span>
            <span className="exchange-picker-body">
              <span className="exchange-picker-label">{child.label}</span>
              <span className="exchange-picker-tagline">{meta.tagline}</span>
              <span className={`exchange-picker-badge ${live ? "is-live" : ""}`}>
                {child.meta}
              </span>
            </span>
            <ArrowRight className="exchange-picker-arrow h-5 w-5 shrink-0" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}
