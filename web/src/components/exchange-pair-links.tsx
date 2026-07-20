"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/** Dual NSE / BSE jump links — avoids hard-coding a single exchange. */
export function ExchangePairLinks({
  pathSuffix,
  query,
  size = "sm",
}: {
  /** Path after /browse/{EXCHANGE}/ — e.g. "STOCK" or "INDEX" or "STOCK?sector=Banks" handled via query */
  pathSuffix: string;
  query?: string;
  size?: "sm" | "md";
}) {
  const qs = query ? `?${query}` : "";
  const nse = `/browse/NSE/${pathSuffix}${qs}`;
  const bse = `/browse/BSE/${pathSuffix}${qs}`;

  return (
    <div className={`ex-pair ex-pair--${size}`} onClick={(e) => e.stopPropagation()}>
      <Link href={nse} className="ex-pair-btn ex-pair-btn--nse no-underline">
        NSE
      </Link>
      <Link href={bse} className="ex-pair-btn ex-pair-btn--bse no-underline">
        BSE
      </Link>
    </div>
  );
}

export function AnimatedScrollCue() {
  return (
    <motion.span
      className="h-scroll-cue"
      animate={{ x: [0, 6, 0], opacity: [0.45, 1, 0.45] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    >
      Scroll →
    </motion.span>
  );
}
