"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

export function HScrollSection({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="h-scroll-section">
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
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ar-subtle)]">
          Scroll →
        </span>
      </header>
      <div className="h-scroll-rail scrollbar-thin">{children}</div>
    </section>
  );
}

export function HScrollCard({
  children,
  size = "md",
  accent = "mixed",
  href,
  delay = 0,
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  accent?: "gold" | "maroon" | "mixed";
  href?: string;
  delay?: number;
}) {
  const inner = (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-16px" }}
      transition={{ delay, type: "spring", stiffness: 150, damping: 18 }}
      whileHover={{ y: -3, scale: 1.015 }}
      className={`h-scroll-card h-scroll-card--${size} h-scroll-card--${accent}`}
    >
      <div className="h-scroll-card-rail" aria-hidden />
      <div className="relative z-[1]">{children}</div>
    </motion.article>
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
