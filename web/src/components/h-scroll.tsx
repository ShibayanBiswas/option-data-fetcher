"use client";

import { type ReactNode, useRef, type WheelEvent } from "react";
import { AnimatedScrollCue } from "./exchange-pair-links";

export type HScrollCardSize = "xs" | "sm" | "md" | "lg" | "xl";

export function HScrollSection({
  eyebrow,
  title,
  subtitle,
  cardSize = "md",
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cardSize?: HScrollCardSize;
  id?: string;
  children: ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = railRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  return (
    <section id={id} className="h-scroll-section scroll-mt-4">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <p className="label-chip">{eyebrow}</p>
          <h2 className="mt-0.5 font-serif text-2xl text-[var(--ar-ink)] sm:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl font-ui text-sm text-[var(--ar-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <AnimatedScrollCue />
      </header>
      <div
        ref={railRef}
        className="h-scroll-rail h-scroll-rail--uniform scrollbar-thin"
        data-size={cardSize}
        onWheel={onWheel}
      >
        {children}
      </div>
    </section>
  );
}

export function HScrollCard({
  children,
  size = "md",
  accent = "mixed",
  href,
  footer,
}: {
  children: ReactNode;
  size?: HScrollCardSize;
  accent?: "gold" | "maroon" | "mixed";
  href?: string;
  delay?: number;
  footer?: ReactNode;
}) {
  const inner = (
    <article className={`h-scroll-card h-scroll-card--${size} h-scroll-card--${accent}`}>
      <div className="h-scroll-card-rail" aria-hidden />
      <div className="relative z-[1] h-scroll-card-body">
        <div className="h-scroll-card-main">{children}</div>
        {footer ? <div className="h-scroll-card-footer">{footer}</div> : null}
      </div>
    </article>
  );

  if (href) {
    return (
      <a href={href} className="h-scroll-card-link no-underline text-inherit">
        {inner}
      </a>
    );
  }
  return inner;
}
