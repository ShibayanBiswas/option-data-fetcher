"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Database,
  FolderTree,
  CloudDownload,
  CalendarClock,
  Network,
  Search,
  Layers,
  Map,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeskFlow, type FlowNode } from "@/components/desk-flow";
import { HScrollCard, HScrollSection } from "@/components/h-scroll";
import { SexyCard, SexyKpi } from "@/components/sexy-card";

type Status = {
  ok: boolean;
  totalDocuments?: number;
  latestTradeDate?: string | null;
  earliestTradeDate?: string | null;
  tradingDays?: number;
  symbolCount?: number;
  segments?: { INDEX: number; STOCK: number; OTHER: number };
};

const features = [
  {
    icon: FolderTree,
    kicker: "01 · Structure",
    title: "Desk-grade",
    accent: "hierarchy",
    body: "NSE & BSE → Index, Stocks, or Other → symbol → CALL / PUT → trade date → expiry strike ladders.",
    href: "/schema",
  },
  {
    icon: CloudDownload,
    kicker: "02 · Export",
    title: "Zip at every",
    accent: "folder",
    body: "CSV or Excel zips from any folder. Leaf expiry files download as plain CSV or Excel.",
    href: "/browse",
  },
  {
    icon: Database,
    kicker: "03 · Storage",
    title: "SQLite archive",
    accent: "sync",
    body: "Local SQLite in development · Turso (libSQL) on Vercel — same SQL, sync-ready.",
    href: "/schema",
  },
  {
    icon: CalendarClock,
    kicker: "04 · Schedule",
    title: "Weekday",
    accent: "auto-refresh",
    body: "Cron pulls the latest bhavcopy after market close. No separate backend host required.",
    href: "/#pipeline",
  },
  {
    icon: Network,
    kicker: "05 · Maps",
    title: "Schema on",
    accent: "the desk",
    body: "Interactive maps for hierarchy, FinInstrmTp segregation, and the ingest pipeline.",
    href: "/schema",
  },
  {
    icon: Search,
    kicker: "06 · Jump",
    title: "Smart",
    accent: "search",
    body: "Press ⌘K to jump exchanges & segments — scroll stops at BSE · Other Securities.",
    href: "/browse",
  },
];

const PIPELINE_STEPS = [
  {
    n: "01",
    kicker: "Ingest",
    title: "Fetch",
    accent: "bhavcopy",
    body: "Pull the latest UDiFF F&O session files from NSE zip and BSE CSV after settlement.",
  },
  {
    n: "02",
    kicker: "Classify",
    title: "Segregate",
    accent: "the book",
    body: "FinInstrmTp → Index · Stock · Other. Split CE/PE, group by underlying & expiry, sort strikes.",
  },
  {
    n: "03",
    kicker: "Serve",
    title: "Persist",
    accent: "& expose",
    body: "Lean chains in SQLite / Turso, full CSVs locally, then browse and download APIs.",
  },
];

const QUICK_JUMPS = [
  {
    href: "/browse",
    icon: Layers,
    title: "Open Archive",
    body: "File tree · NSE & BSE",
  },
  {
    href: "/schema",
    icon: Map,
    title: "Schema map",
    body: "Hierarchy · sectors · pipeline",
  },
  {
    href: "/browse/NSE/INDEX",
    icon: FolderTree,
    title: "NSE Index",
    body: "NIFTY & index options",
  },
  {
    href: "/browse/BSE/INDEX",
    icon: Database,
    title: "BSE Index",
    body: "SENSEX & index options",
  },
];

const NAV_FLOW: FlowNode[] = [
  {
    id: "desk",
    label: "Option Chain Archive",
    meta: "Start here",
    tone: "root",
    href: "/",
    children: [
      {
        id: "browse",
        label: "Browse",
        meta: "Explorer",
        tone: "accent",
        href: "/browse",
        children: [
          { id: "nse", label: "NSE", tone: "leaf", href: "/browse/NSE" },
          { id: "bse", label: "BSE", tone: "leaf", href: "/browse/BSE" },
        ],
      },
      {
        id: "schema",
        label: "Schema map",
        meta: "Maps",
        tone: "accent",
        href: "/schema",
        children: [
          { id: "levels", label: "Folder levels", tone: "leaf", href: "/schema" },
          { id: "sectors", label: "Stock sectors", tone: "leaf", href: "/schema#sectors" },
        ],
      },
      {
        id: "sync",
        label: "Sync Today",
        meta: "Header action",
        tone: "leaf",
        children: [
          {
            id: "coverage",
            label: "Archive coverage",
            tone: "leaf",
            href: "/#coverage",
          },
          {
            id: "pipeline-jump",
            label: "Ingest pipeline",
            tone: "leaf",
            href: "/#pipeline",
          },
        ],
      },
    ],
  },
];

function HomeBody() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/sync")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl glass px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="min-w-0"
          >
            <h1 className="font-serif text-4xl leading-tight text-[var(--ar-ink)] sm:text-5xl xl:text-6xl">
              Option Chain <span className="shine-text">Archive</span>
            </h1>
            <p className="mt-4 max-w-xl font-ui text-base text-[var(--ar-muted)] sm:text-lg">
              Historical Indian option chains from NSE and BSE bhavcopy — cleaned,
              CALL and PUT segregated, strike-sorted, sector-tagged, and ready for
              backtesting downloads.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/browse" className="btn-gold inline-flex items-center gap-2 no-underline">
                Open Archive <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/schema" className="btn-ghost inline-flex items-center gap-2 no-underline">
                Schema map
              </Link>
              <a href="#coverage" className="btn-maroon inline-flex items-center gap-2 no-underline">
                Archive coverage
              </a>
            </div>
          </motion.div>

          <motion.div
            className="hero-quick-grid"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}
          >
            {QUICK_JUMPS.map((q, i) => (
              <Link
                key={q.href}
                href={q.href}
                className="hero-quick-card no-underline"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="hero-quick-icon" aria-hidden>
                  <q.icon className="h-4 w-4" />
                </span>
                <span className="hero-quick-title">{q.title}</span>
                <span className="hero-quick-body">{q.body}</span>
              </Link>
            ))}
          </motion.div>
        </div>

        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(212,178,76,0.25),transparent_70%)]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(122,30,44,0.18),transparent_70%)]"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </section>

      <section className="mt-5">
        <DeskFlow
          title="Desk navigation map"
          subtitle="Full-width jump map — every node opens Browse, Schema, or a section below. Sidebar mirrors the archive tree."
          roots={NAV_FLOW}
          layout="map"
        />
      </section>

      <section id="coverage" className="mt-5 scroll-mt-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="label-chip">Live archive</p>
            <h2 className="font-serif text-2xl text-[var(--ar-ink)] sm:text-3xl">
              Coverage and depth
            </h2>
          </div>
          <Link href="/browse" className="font-ui text-sm text-[var(--ar-gold)] no-underline">
            Browse data
          </Link>
        </div>
        <div className="kpi-band-grid">
          <SexyKpi label="Start Date" value={status?.earliestTradeDate ?? "—"} delay={0.02} />
          <SexyKpi label="End Date" value={status?.latestTradeDate ?? "—"} delay={0.05} />
          <SexyKpi
            label="Trading days"
            value={String(status?.tradingDays ?? "—")}
            delay={0.08}
          />
          <SexyKpi
            label="Chain files"
            value={(status?.totalDocuments ?? 0).toLocaleString()}
            delay={0.11}
          />
          <SexyKpi
            label="Underlyings"
            value={String(status?.symbolCount ?? "—")}
            delay={0.14}
          />
          <SexyKpi
            label="Index files"
            value={(status?.segments?.INDEX ?? 0).toLocaleString()}
            delay={0.17}
          />
          <SexyKpi
            label="Stock files"
            value={(status?.segments?.STOCK ?? 0).toLocaleString()}
            delay={0.2}
          />
        </div>
        <p className="mt-3 font-ui text-xs text-[var(--ar-subtle)]">
          UDiFF F&amp;O bhavcopy is archived from 2024-01-01 (NSE &amp; BSE format
          start) through the latest settled session. Use Sync Today after ~18:30 IST,
          or run <code className="text-[var(--ar-ink)]">npm run seed:backfill</code>{" "}
          to fill any calendar gaps.
        </p>
      </section>

      <div className="mt-5">
        <HScrollSection
          eyebrow="Capabilities"
          title="What the desk does"
          subtitle="Swipe sideways — uniform cards in this row."
          cardSize="lg"
        >
          {features.map((f, i) => (
            <HScrollCard key={f.kicker} size="lg" href={f.href} delay={i * 0.04}>
              <div className="desk-card-top">
                <span className="desk-card-kicker">{f.kicker}</span>
                <span className="desk-card-icon" aria-hidden>
                  <f.icon className="h-4 w-4" />
                </span>
              </div>
              <h2 className="desk-card-title">
                {f.title}{" "}
                <span className="desk-card-accent">{f.accent}</span>
              </h2>
              <p className="desk-card-body">{f.body}</p>
            </HScrollCard>
          ))}
        </HScrollSection>
      </div>

      <section id="pipeline" className="mt-4 scroll-mt-4">
        <HScrollSection
          eyebrow="Pipeline"
          title="How the desk builds the book"
          subtitle="Daily F&O UDiFF bhavcopy → segregate → SQLite / Turso → browse & download."
          cardSize="lg"
        >
          {PIPELINE_STEPS.map((step, i) => (
            <HScrollCard key={step.n} size="lg" delay={0.05 + i * 0.06}>
              <div className="desk-card-top">
                <span className="desk-card-kicker">{step.kicker}</span>
                <span className="desk-card-step">{step.n}</span>
              </div>
              <h3 className="desk-card-title">
                {step.title}{" "}
                <span className="desk-card-accent">{step.accent}</span>
              </h3>
              <p className="desk-card-body">{step.body}</p>
            </HScrollCard>
          ))}
        </HScrollSection>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/browse" className="btn-maroon inline-flex items-center gap-2 no-underline">
            Browse NSE and BSE <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/schema" className="btn-ghost inline-flex items-center gap-2 no-underline">
            Open schema map
          </Link>
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <HomeBody />
      </Suspense>
    </AppShell>
  );
}
