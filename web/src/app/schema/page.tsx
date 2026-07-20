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
import { ExchangePairLinks } from "@/components/exchange-pair-links";
import { HScrollCard, HScrollSection } from "@/components/h-scroll";
import { PREFERRED_COLUMNS, SEGMENT_LABELS, SEGMENT_ORDER } from "@/lib/constants";
import { SECTORS } from "@/lib/sectors";

const LEVELS = [
  {
    icon: Building2,
    title: "Exchange",
    body: "NSE or BSE — top of the archive tree.",
    href: "/browse",
  },
  {
    icon: Layers,
    title: "Segment",
    body: `${SEGMENT_LABELS.INDEX} · ${SEGMENT_LABELS.STOCK} · ${SEGMENT_LABELS.OTHER}`,
    href: "/browse",
  },
  {
    icon: LineChart,
    title: "Underlying",
    body: "Index tickers, equity symbols, sector folders on stocks.",
    href: "#exchange-map",
  },
  {
    icon: FolderTree,
    title: "Option side",
    body: "CALL (CE) or PUT (PE) contract book.",
    href: "/browse",
  },
  {
    icon: CalendarDays,
    title: "Trade date",
    body: "YYYY-MM-DD session folder from bhavcopy.",
    href: "/browse",
  },
  {
    icon: FileSpreadsheet,
    title: "Expiry file",
    body: "expiry_date_*.csv — strike-sorted ladder.",
    href: "/browse",
  },
];

const SEG_CARDS = [
  {
    code: "IDO",
    title: SEGMENT_LABELS.INDEX,
    body: "Index options (NIFTY, SENSEX, …)",
    pathSuffix: "INDEX",
  },
  {
    code: "STO",
    title: SEGMENT_LABELS.STOCK,
    body: "Equity options with sector tags",
    pathSuffix: "STOCK",
  },
  {
    code: "ELSE",
    title: SEGMENT_LABELS.OTHER,
    body: "Residual types — shown only when present in the archive.",
    // OTHER is often empty — send users to pick an exchange first
    href: "/browse",
  },
];

const PIPE_CARDS = [
  {
    n: "01",
    title: "Fetch",
    body: "NSE zip · BSE CSV bhavcopy",
    icon: CloudDownload,
  },
  {
    n: "02",
    title: "Segregate",
    body: "Index · Stock · Other · CALL/PUT",
    icon: Shuffle,
  },
  {
    n: "03",
    title: "Persist",
    body: "Local CSV + SQLite / Turso",
    icon: Database,
  },
  {
    n: "04",
    title: "Serve",
    body: "Browse · download · Sync Today",
    icon: LayoutGrid,
    href: "/browse",
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
        children: SEGMENT_ORDER.filter((s) => s !== "OTHER").map((seg) => ({
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
        children: SEGMENT_ORDER.filter((s) => s !== "OTHER").map((seg) => ({
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
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-2xl glass px-5 py-5 sm:px-8">
          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
              className="min-w-0"
            >
              <p className="label-chip">Schema</p>
              <h1 className="mt-1 font-serif text-3xl text-[var(--ar-ink)] sm:text-4xl">
                Desk <span className="shine-text">taxonomy</span>
              </h1>
              <p className="mt-2 font-ui text-sm text-[var(--ar-muted)]">
                How chains are segregated, stored, and browsed — scroll each row of cards.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/browse" className="btn-gold inline-flex items-center gap-2 no-underline">
                  Open Archive <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#sectors" className="btn-ghost no-underline">
                  Stock sectors
                </a>
                <a href="#exchange-map" className="btn-maroon no-underline">
                  Exchange map
                </a>
              </div>
            </motion.div>
            <motion.div
              className="hero-quick-grid hero-quick-grid--2"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Link href="/browse/NSE" className="hero-quick-card no-underline">
                <span className="hero-quick-icon" aria-hidden>
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="hero-quick-title">NSE</span>
                <span className="hero-quick-body">Index · Stock · Other</span>
              </Link>
              <Link href="/browse/BSE" className="hero-quick-card no-underline">
                <span className="hero-quick-icon" aria-hidden>
                  <Layers className="h-4 w-4" />
                </span>
                <span className="hero-quick-title">BSE</span>
                <span className="hero-quick-body">Index · Stock · Other</span>
              </Link>
            </motion.div>
          </div>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(212,178,76,0.26),transparent_70%)]"
            animate={{ scale: [1, 1.14, 1], opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 6.5, repeat: Infinity }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 left-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(122,30,44,0.16),transparent_70%)]"
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.65, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
        </section>

        <HScrollSection
          eyebrow="01 · Hierarchy"
          title="Folder levels"
          subtitle="Exchange → segment → symbol → side → trade date → expiry file"
          cardSize="md"
        >
          {LEVELS.map((lvl, i) => (
            <HScrollCard
              key={lvl.title}
              size="md"
              accent="mixed"
              href={lvl.href}
              delay={i * 0.03}
            >
              <div className="desk-card-top">
                <span className="desk-card-kicker">Level {i + 1}</span>
                <span className="desk-card-icon" aria-hidden>
                  <lvl.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <h3 className="desk-card-title desk-card-title--md">{lvl.title}</h3>
              <p className="desk-card-body desk-card-body--tight">{lvl.body}</p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <HScrollSection
          eyebrow="02 · Segregation"
          title="FinInstrmTp rules"
          subtitle="UDiFF instrument type → INDEX / STOCK / OTHER — pick an exchange to open"
          cardSize="md"
        >
          {SEG_CARDS.map((c, i) => (
            <HScrollCard
              key={c.code}
              size="md"
              accent="mixed"
              href={"href" in c ? c.href : undefined}
              delay={i * 0.04}
              footer={
                "pathSuffix" in c && c.pathSuffix ? (
                  <ExchangePairLinks pathSuffix={c.pathSuffix} />
                ) : undefined
              }
            >
              <div className="desk-card-top">
                <span className="desk-card-kicker">{c.code}</span>
              </div>
              <h3 className="desk-card-title desk-card-title--md">
                <span className="desk-card-accent">{c.title}</span>
              </h3>
              <p className="desk-card-body desk-card-body--tight">{c.body}</p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <HScrollSection
          eyebrow="03 · Pipeline"
          title="Ingest path"
          subtitle="Same path as Sync Today and the weekday Vercel cron"
          cardSize="md"
        >
          {PIPE_CARDS.map((c, i) => (
            <HScrollCard
              key={c.n}
              size="md"
              accent="mixed"
              href={c.href}
              delay={i * 0.04}
            >
              <div className="desk-card-top">
                <span className="desk-card-kicker">Stage {c.n}</span>
                <span className="desk-card-icon" aria-hidden>
                  <c.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <h3 className="desk-card-title desk-card-title--md">{c.title}</h3>
              <p className="desk-card-body desk-card-body--tight">{c.body}</p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <div id="exchange-map" className="scroll-mt-4">
          <DeskFlow
            title="04 · Exchange map"
            subtitle="Full-width map — every node opens the matching browse folder. Pick NSE or BSE first."
            roots={EXCHANGE_MAP}
            layout="map"
          />
        </div>

        <HScrollSection
          eyebrow="05 · Columns"
          title="Strike ladder fields"
          subtitle="Preferred UDiFF columns stored in lean SQLite rows"
          cardSize="sm"
        >
          {PREFERRED_COLUMNS.map((col, i) => (
            <HScrollCard
              key={col}
              size="sm"
              accent="mixed"
              delay={Math.min(i * 0.015, 0.35)}
            >
              <p className="desk-card-kicker">Field</p>
              <p className="desk-card-mono mt-2">{col}</p>
            </HScrollCard>
          ))}
        </HScrollSection>

        <HScrollSection
          id="sectors"
          eyebrow="06 · Sectors"
          title="Stock sectors"
          subtitle="Same sector map on NSE and BSE — choose an exchange on each card"
          cardSize="sm"
        >
          {SECTORS.map((sector, i) => (
            <HScrollCard
              key={sector}
              size="sm"
              accent="mixed"
              delay={Math.min(i * 0.02, 0.35)}
              footer={
                <ExchangePairLinks
                  pathSuffix="STOCK"
                  query={`sector=${encodeURIComponent(sector)}`}
                />
              }
            >
              <p className="desk-card-kicker">Sector</p>
              <h3 className="desk-card-title desk-card-title--sm mt-1.5 line-clamp-2">
                {sector}
              </h3>
            </HScrollCard>
          ))}
        </HScrollSection>
      </div>
    </AppShell>
  );
}
