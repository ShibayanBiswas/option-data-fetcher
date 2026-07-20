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
    title: "Desk-grade hierarchy",
    body: "NSE and BSE, then Index, Stocks, or Other, then symbol, CALL or PUT, trade date, and expiry strike ladders.",
    href: "/schema",
  },
  {
    icon: CloudDownload,
    title: "Zip at every folder",
    body: "Download CSV or Excel zips for any level. Leaf expiry files download as plain CSV or Excel.",
    href: "/browse",
  },
  {
    icon: Database,
    title: "SQLite archive sync",
    body: "Chains persist as local SQLite in development and Turso (libSQL) on Vercel — same SQL, sync-ready.",
    href: "/schema",
  },
  {
    icon: CalendarClock,
    title: "Weekday auto-refresh",
    body: "Scheduled job pulls the latest bhavcopy after market close. No separate backend host required.",
    href: "/#pipeline",
  },
  {
    icon: Network,
    title: "Schema on the desk",
    body: "Interactive maps for hierarchy, FinInstrmTp segregation, and the ingest pipeline.",
    href: "/schema",
  },
  {
    icon: Search,
    title: "Smart search",
    body: "Press ⌘K to jump through exchanges and segments — scroll stops at BSE · Other Securities.",
    href: "/browse",
  },
];

const PIPELINE_STEPS = [
  {
    n: "1",
    title: "Fetch NSE zip and BSE CSV bhavcopy",
    body: "Pull the latest UDiFF F&O session files from both exchanges after market settlement.",
  },
  {
    n: "2",
    title: "Segregate Index, Stock, Other · CALL, PUT · expiry",
    body: "Classify by FinInstrmTp, split CE/PE, group by underlying and expiry, sort strikes.",
  },
  {
    n: "3",
    title: "Upsert SQLite and expose browse plus download APIs",
    body: "Write lean chains to SQLite (Turso on Vercel), mirror full CSVs locally, serve the desk UI.",
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
      },
      {
        id: "sync",
        label: "Sync Today",
        meta: "Header action",
        tone: "leaf",
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
      <section className="relative overflow-hidden rounded-3xl glass px-6 py-12 sm:px-10 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-4xl"
        >
          <h1 className="font-serif text-4xl leading-tight text-[var(--ar-ink)] sm:text-6xl">
            Option Chain <span className="shine-text">Archive</span>
          </h1>
          <p className="mt-5 max-w-2xl font-ui text-base text-[var(--ar-muted)] sm:text-lg">
            Historical Indian option chains from NSE and BSE bhavcopy — cleaned,
            CALL and PUT segregated, strike-sorted, sector-tagged, and ready for
            backtesting downloads.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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

      <section className="mt-6">
        <DeskFlow
          title="Desk navigation map"
          subtitle="Click a node to jump — sidebar on every page mirrors this tree."
          roots={NAV_FLOW}
        />
      </section>

      <section id="coverage" className="mt-6">
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
          UDiFF bhavcopy history is available from mid-2024 onward. Use Sync Today
          for the latest session, or seed more trading days from the desk scripts
          to deepen the archive.
        </p>
      </section>

      <div className="mt-6">
        <HScrollSection
          eyebrow="Capabilities"
          title="What the desk does"
          subtitle="Swipe sideways — each card is sized to its content."
        >
          {features.map((f, i) => (
            <HScrollCard key={f.title} size="lg" href={f.href} delay={i * 0.04}>
              <div className="mb-2 inline-flex rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel)] p-1.5 text-[var(--ar-ink)]">
                <f.icon className="h-4 w-4" />
              </div>
              <h2 className="font-serif text-lg text-[var(--ar-ink)]">{f.title}</h2>
              <p className="mt-1.5 max-w-[16rem] font-ui text-sm leading-snug text-[var(--ar-muted)]">
                {f.body}
              </p>
            </HScrollCard>
          ))}
        </HScrollSection>
      </div>

      <section id="pipeline" className="mt-6">
        <HScrollSection
          eyebrow="Pipeline"
          title="How the desk builds the book"
          subtitle="Daily F&O UDiFF bhavcopy → segregate → SQLite / Turso → browse & download."
        >
          {PIPELINE_STEPS.map((step, i) => (
            <HScrollCard key={step.n} size="lg" delay={0.05 + i * 0.06}>
              <div className="pipeline-step-index">{step.n}</div>
              <h3 className="mt-2 font-serif text-base leading-snug text-[var(--ar-ink)]">
                {step.title}
              </h3>
              <p className="mt-1.5 max-w-[15rem] font-ui text-sm leading-snug text-[var(--ar-muted)]">
                {step.body}
              </p>
            </HScrollCard>
          ))}
        </HScrollSection>
        <div className="mt-4 flex flex-wrap gap-3">
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
