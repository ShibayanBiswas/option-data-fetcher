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
  },
  {
    icon: CloudDownload,
    title: "Zip at every folder",
    body: "Download CSV or Excel zips for any level. Leaf expiry files download as plain CSV or Excel.",
  },
  {
    icon: Database,
    title: "MongoDB Atlas sync",
    body: "Segregated chains persist locally in development and in Atlas Mumbai for production.",
  },
  {
    icon: CalendarClock,
    title: "Weekday auto-refresh",
    body: "Scheduled job pulls the latest bhavcopy after market close. No separate backend host required.",
  },
  {
    icon: Network,
    title: "Schema on the desk",
    body: "See the full archive tree, FinInstrmTp segregation rules, and field map on the Schema page.",
  },
  {
    icon: Search,
    title: "Smart search",
    body: "Press ⌘K to jump to exchanges, sectors, indices, or any stock underlying in the archive.",
  },
];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value">{value}</div>
    </div>
  );
}

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
          <p className="font-ui mb-3 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--ar-gold)]">
            Anand Rathi Wealth · Options Desk
          </p>
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
              View Schema
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
          <Kpi
            label="Chain files"
            value={(status?.totalDocuments ?? 0).toLocaleString()}
          />
          <Kpi label="Underlyings" value={String(status?.symbolCount ?? "—")} />
          <Kpi label="Trading days" value={String(status?.tradingDays ?? "—")} />
          <Kpi
            label="Date span"
            value={
              status?.earliestTradeDate && status?.latestTradeDate
                ? `${status.earliestTradeDate} → ${status.latestTradeDate}`
                : "—"
            }
          />
          <Kpi
            label="Index files"
            value={(status?.segments?.INDEX ?? 0).toLocaleString()}
          />
          <Kpi
            label="Stock files"
            value={(status?.segments?.STOCK ?? 0).toLocaleString()}
          />
        </div>
        <p className="mt-3 font-ui text-xs text-[var(--ar-subtle)]">
          UDiFF bhavcopy history is available from mid-2024 onward. Use Sync Today
          for the latest session, or seed more trading days from the desk scripts
          to deepen the archive.
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {features.map((f, i) => (
          <motion.article
            key={f.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="folder-card glass rounded-2xl p-5"
          >
            <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-[var(--ar-maroon)] to-[var(--ar-gold)] p-2 text-white">
              <f.icon className="h-4 w-4" />
            </div>
            <h2 className="font-serif text-xl text-[var(--ar-ink)]">{f.title}</h2>
            <p className="mt-2 font-ui text-sm leading-relaxed text-[var(--ar-muted)]">
              {f.body}
            </p>
          </motion.article>
        ))}
      </section>

      <section id="pipeline" className="mt-10 glass rounded-3xl p-6 sm:p-10">
        <p className="label-chip">Pipeline</p>
        <h2 className="mt-1 font-serif text-3xl text-[var(--ar-ink)]">How the desk builds the book</h2>
        <p className="mt-2 max-w-3xl font-ui text-sm text-[var(--ar-muted)]">
          Daily F&amp;O UDiFF bhavcopy is fetched for NSE and BSE, filtered to options,
          split into CALL and PUT, classified by FinInstrmTp into Index, Stock, or
          Other, grouped by expiry, sorted by strike, written to local storage in
          development, and upserted into MongoDB for the web archive.
        </p>
        <ol className="mt-6 grid gap-3 font-ui text-sm md:grid-cols-3">
          {[
            "1 · Fetch NSE zip and BSE CSV bhavcopy",
            "2 · Segregate Index, Stock, Other · CALL, PUT · expiry",
            "3 · Upsert MongoDB and expose browse plus download APIs",
          ].map((step, i) => (
            <motion.li
              key={step}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-panel)] px-4 py-4"
            >
              {step}
            </motion.li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
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
