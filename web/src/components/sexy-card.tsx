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
};

export function SexyCard({
  children,
  className = "",
  href,
  onClick,
}: SexyCardProps) {
  const inner = (
    <div className={`sexy-card water-surface ${className}`} onClick={onClick}>
      <div className="sexy-card-rail" aria-hidden />
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
    <SexyCard className="kpi-band-card !p-3.5">
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value" title={value}>
        {value}
      </div>
    </SexyCard>
  );
}
