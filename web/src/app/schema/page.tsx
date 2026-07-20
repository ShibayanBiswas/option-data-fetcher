"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { PREFERRED_COLUMNS, SEGMENT_LABELS } from "@/lib/constants";
import { SECTORS } from "@/lib/sectors";

const TREE = [
  {
    label: "Exchange",
    items: ["NSE", "BSE"],
  },
  {
    label: "Segment",
    items: [
      `${SEGMENT_LABELS.INDEX} (FinInstrmTp = IDO)`,
      `${SEGMENT_LABELS.STOCK} (FinInstrmTp = STO)`,
      `${SEGMENT_LABELS.OTHER} (any other option type)`,
    ],
  },
  {
    label: "Underlying",
    items: ["Index tickers (NIFTY, SENSEX, …)", "Equity tickers (RELIANCE, …)", "Sector tags on stocks"],
  },
  {
    label: "Option side",
    items: ["CALL (CE)", "PUT (PE)"],
  },
  {
    label: "Trade date folder",
    items: ["YYYY-MM-DD session date from bhavcopy"],
  },
  {
    label: "Expiry file",
    items: ["expiry_date_YYYY-MM-DD.csv — rows sorted by StrkPric"],
  },
];

export default function SchemaPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="glass rounded-3xl p-6 sm:p-10">
          <p className="label-chip">Schema structure</p>
          <h1 className="mt-1 font-serif text-4xl text-[var(--ar-ink)] sm:text-5xl">
            Archive hierarchy and field map
          </h1>
          <p className="mt-3 max-w-3xl font-ui text-sm leading-relaxed text-[var(--ar-muted)]">
            Every option chain file follows the same desk taxonomy — exchange,
            segment, symbol, side, trade date, expiry — so downloads and browse
            paths stay consistent from MongoDB to the UI.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/browse" className="btn-gold no-underline">
              Open Archive
            </Link>
            <Link href="/browse/NSE/STOCK" className="btn-ghost no-underline">
              Explore stock sectors
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {TREE.map((node, i) => (
            <motion.article
              key={node.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-5"
            >
              <div className="label-chip">Level {i + 1}</div>
              <h2 className="mt-1 font-serif text-2xl text-[var(--ar-ink)]">{node.label}</h2>
              <ul className="mt-3 space-y-2 font-ui text-sm text-[var(--ar-muted)]">
                {node.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-[var(--ar-border)] bg-[var(--ar-panel)] px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </section>

        <section className="glass rounded-3xl p-6 sm:p-8">
          <p className="label-chip">Path pattern</p>
          <h2 className="mt-1 font-serif text-2xl text-[var(--ar-ink)]">Canonical file path</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-panel)] p-4 font-ui text-xs leading-relaxed text-[var(--ar-ink)] sm:text-sm">
{`{Exchange}
  └── {INDEX | STOCK | OTHER}
        └── {Symbol}
              └── {CALL | PUT}
                    └── {TradeDate YYYY-MM-DD}
                          └── expiry_date_{ExpiryDate}.csv`}
          </pre>
          <p className="mt-3 font-ui text-sm text-[var(--ar-muted)]">
            Example: NSE → INDEX → NIFTY → CALL → 2026-07-17 → expiry_date_2026-07-21.csv
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="glass rounded-3xl p-6">
            <p className="label-chip">Preferred table columns</p>
            <h2 className="mt-1 font-serif text-2xl text-[var(--ar-ink)]">Strike ladder fields</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {PREFERRED_COLUMNS.map((col) => (
                <span key={col} className="desk-chip">
                  {col}
                </span>
              ))}
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <p className="label-chip">Equity taxonomy</p>
            <h2 className="mt-1 font-serif text-2xl text-[var(--ar-ink)]">Stock sectors</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {SECTORS.map((sector) => (
                <Link
                  key={sector}
                  href={`/browse/NSE/STOCK?sector=${encodeURIComponent(sector)}`}
                  className="btn-pill no-underline"
                >
                  {sector}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
