"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Layers,
  LineChart,
  FolderTree,
  FileSpreadsheet,
  CalendarDays,
  Shuffle,
  CloudDownload,
  Database,
  LayoutGrid,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeskFlow, type FlowNode } from "@/components/desk-flow";
import { HScrollCard, HScrollSection } from "@/components/h-scroll";
import { PREFERRED_COLUMNS, SEGMENT_LABELS, SEGMENT_ORDER } from "@/lib/constants";
import { SECTORS } from "@/lib/sectors";

const LEVELS = [
  {
    icon: Building2,
    title: "Exchange",
    body: "NSE or BSE — top of the archive tree.",
    href: "/browse",
    size: "sm" as const,
  },
  {
    icon: Layers,
    title: "Segment",
    body: `${SEGMENT_LABELS.INDEX} · ${SEGMENT_LABELS.STOCK} · ${SEGMENT_LABELS.OTHER}`,
    href: "/browse/NSE",
    size: "md" as const,
  },
  {
    icon: LineChart,
    title: "Underlying",
    body: "Index tickers, equity symbols, sector folders on stocks.",
    href: "/browse/NSE/INDEX",
    size: "md" as const,
  },
  {
    icon: FolderTree,
    title: "Option side",
    body: "CALL (CE) or PUT (PE) contract book.",
    href: "/browse/NSE/INDEX",
    size: "sm" as const,
  },
  {
    icon: CalendarDays,
    title: "Trade date",
    body: "YYYY-MM-DD session folder from bhavcopy.",
    href: "/browse",
    size: "sm" as const,
  },
  {
    icon: FileSpreadsheet,
    title: "Expiry file",
    body: "expiry_date_*.csv — strike-sorted ladder.",
    href: "/browse",
    size: "md" as const,
  },
];

const SEG_CARDS = [
  {
    code: "IDO",
    title: SEGMENT_LABELS.INDEX,
    body: "Index options (NIFTY, SENSEX, …)",
    href: "/browse/NSE/INDEX",
    size: "md" as const,
  },
  {
    code: "STO",
    title: SEGMENT_LABELS.STOCK,
    body: "Equity options with sector tags",
    href: "/browse/NSE/STOCK",
    size: "md" as const,
  },
  {
    code: "ELSE",
    title: SEGMENT_LABELS.OTHER,
    body: "Residual option instrument types",
    href: "/browse/NSE/OTHER",
    size: "sm" as const,
  },
];

const PIPE_CARDS = [
  {
    n: "01",
    title: "Fetch",
    body: "NSE zip · BSE CSV bhavcopy",
    icon: CloudDownload,
    size: "sm" as const,
  },
  {
    n: "02",
    title: "Segregate",
    body: "Index · Stock · Other · CALL/PUT",
    icon: Shuffle,
    size: "md" as const,
  },
  {
    n: "03",
    title: "Persist",
    body: "Local CSV + SQLite / Turso",
    icon: Database,
    size: "sm" as const,
  },
  {
    n: "04",
    title: "Serve",
    body: "Browse · download · Sync Today",
    icon: LayoutGrid,
    href: "/browse",
    size: "md" as const,
  },
];

const EXCHANGE_MAP: FlowNode[] = [
  {
    id: "root",
    label: "Archive",
    meta: "Start",
    tone: "root",
    href: "/browse",
    children: [
      {
        id: "nse",
        label: "NSE",
        tone: "accent",
        href: "/browse/NSE",
        children: SEGMENT_ORDER.map((seg) => ({
          id: `nse-${seg}`,
          label: SEGMENT_LABELS[seg],
          tone: "leaf" as const,
          href: `/browse/NSE/${seg}`,
        })),
      },
      {
        id: "bse",
        label: "BSE",
        tone: "accent",
        href: "/browse/BSE",
        children: SEGMENT_ORDER.map((seg) => ({
          id: `bse-${seg}`,
          label: SEGMENT_LABELS[seg],
          tone: "leaf" as const,
          href: `/browse/BSE/${seg}`,
        })),
      },
    ],
  },
];

export default function SchemaPage() {
  return (
    <AppShell>
      <div className="space-y-5 pb-2">
        <section className="relative overflow-hidden rounded-2xl glass px-5 py-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-w-3xl"
          >
            <p className="label-chip">Schema</p>
            <h1 className="mt-1 font-serif text-3xl text-[var(--ar-ink)] sm:text-4xl">
              Desk <span className="shine-text">taxonomy</span>
            </h1>
            <p className="mt-2 font-ui text-sm text-[var(--ar-muted)]">
              How chains are segregated, stored, and browsed — scroll each row of cards.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/browse" className="btn-gold inline-flex items-center gap-2 no-underline">
                Open Archive <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/browse/NSE/STOCK" className="btn-ghost no-underline">
                Stock sectors
              </Link>
            </div>
          </motion.div>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(212,178,76,0.26),transparent_70%)]"
            animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 7, repeat: Infinity }}
          />
        </section>

        <HScrollSection
          eyebrow="01 · Hierarchy"
          title="Folder levels"
          subtitle="Exchange → segment → symbol → side → trade date → expiry file"
        >
          {LEVELS.map((lvl, i) => (
            <HScrollCard
              key={lvl.title}
              size={lvl.size}
              accent="mixed"
              href={lvl.href}
              delay={i * 0.03}
            >
              <div className="mb-1.5 inline-flex rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel)] p-1.5 text-[var(--ar-ink)]">
                <lvl.icon className="h-3.5 w-3.5" />
              </div>
              <div className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ar-gold-dark)]">
                Level {i + 1}
              </div>
              <h3 className="mt-0.5 font-serif text-lg text-[var(--ar-ink)]">{lvl.title}</h3>
              <p className="mt-1 max-w-[14rem] font-ui text-sm leading-snug text-[var(--ar-muted)]">
                {lvl.body}
              </p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <HScrollSection
          eyebrow="02 · Segregation"
          title="FinInstrmTp rules"
          subtitle="UDiFF instrument type → INDEX / STOCK / OTHER"
        >
          {SEG_CARDS.map((c, i) => (
            <HScrollCard
              key={c.code}
              size={c.size}
              accent="mixed"
              href={c.href}
              delay={i * 0.04}
            >
              <span className="desk-chip !text-[11px]">{c.code}</span>
              <h3 className="mt-2 font-serif text-xl text-[var(--ar-ink)]">{c.title}</h3>
              <p className="mt-1 max-w-[13rem] font-ui text-sm leading-snug text-[var(--ar-muted)]">
                {c.body}
              </p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <HScrollSection
          eyebrow="03 · Pipeline"
          title="Ingest path"
          subtitle="Same path as Sync Today and the weekday Vercel cron"
        >
          {PIPE_CARDS.map((c, i) => (
            <HScrollCard
              key={c.n}
              size={c.size}
              accent="mixed"
              href={c.href}
              delay={i * 0.04}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-ui text-xs font-extrabold text-[var(--ar-gold-dark)]">
                  {c.n}
                </span>
                <c.icon className="h-4 w-4 text-[var(--ar-ink)]" />
              </div>
              <h3 className="mt-2 font-serif text-lg text-[var(--ar-ink)]">{c.title}</h3>
              <p className="mt-1 max-w-[12rem] font-ui text-sm leading-snug text-[var(--ar-muted)]">
                {c.body}
              </p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <DeskFlow
          title="04 · Exchange map"
          subtitle="Expand an exchange — every node link opens the matching browse folder."
          roots={EXCHANGE_MAP}
        />

        <HScrollSection
          eyebrow="05 · Columns"
          title="Strike ladder fields"
          subtitle="Preferred UDiFF columns stored in lean SQLite rows"
        >
          {PREFERRED_COLUMNS.map((col, i) => (
            <HScrollCard
              key={col}
              size="sm"
              accent="mixed"
              delay={Math.min(i * 0.015, 0.35)}
            >
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ar-subtle)]">
                Field
              </p>
              <p className="mt-1 break-all font-ui text-sm font-semibold text-[var(--ar-ink)]">
                {col}
              </p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <HScrollSection
          eyebrow="06 · Sectors"
          title="Stock sectors"
          subtitle="NSE STOCK underlyings grouped for the desk"
        >
          {SECTORS.map((sector, i) => (
            <HScrollCard
              key={sector}
              size={sector.length > 16 ? "md" : "sm"}
              accent="mixed"
              href={`/browse/NSE/STOCK?sector=${encodeURIComponent(sector)}`}
              delay={Math.min(i * 0.02, 0.35)}
            >
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ar-gold-dark)]">
                Sector
              </p>
              <h3 className="mt-1 font-serif text-base leading-snug text-[var(--ar-ink)]">
                {sector}
              </h3>
            </HScrollCard>
          ))}
        </HScrollSection>
      </div>
    </AppShell>
  );
}
