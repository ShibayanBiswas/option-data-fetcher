"use client";

import type { ReactNode } from "react";

type SexyCardProps = {
  children: ReactNode;
  className?: string;
  /** Kept for API compat — all cards share one desk surface colour. */
  accent?: "gold" | "maroon" | "mixed";
  href?: string;
  onClick?: () => void;
  delay?: number;
  /** Optional bottom hairline (used by coverage KPIs). */
  bottomRail?: boolean;
};

export function SexyCard({
  children,
  className = "",
  href,
  onClick,
  bottomRail = false,
}: SexyCardProps) {
  const inner = (
    <div className={`sexy-card water-surface ${className}`} onClick={onClick}>
      <div className="sexy-card-rail sexy-card-rail--top" aria-hidden />
      {bottomRail ? (
        <div className="sexy-card-rail sexy-card-rail--bottom" aria-hidden />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline text-inherit">
        {inner}
      </a>
    );
  }
  return inner;
}

export function SexyKpi({
  label,
  value,
}: {
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <SexyCard className="kpi-band-card !py-3.5 !px-3.5" bottomRail>
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value" title={value}>
        {value}
      </div>
    </SexyCard>
  );
}
