"use client";

import { type ReactNode, useRef, type MouseEvent, type WheelEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { AnimatedScrollCue } from "./exchange-pair-links";

export type HScrollCardSize = "sm" | "md" | "lg" | "xl";

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
    // Convert vertical wheel into horizontal scroll when the rail overflows
    if (el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  return (
    <section id={id} className="h-scroll-section scroll-mt-4">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2 px-0.5">
        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-24px" }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
        >
          <p className="label-chip">{eyebrow}</p>
          <h2 className="mt-0.5 font-serif text-2xl text-[var(--ar-ink)] sm:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl font-ui text-sm text-[var(--ar-muted)]">
              {subtitle}
            </p>
          ) : null}
        </motion.div>
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
  delay = 0,
  footer,
}: {
  children: ReactNode;
  size?: HScrollCardSize;
  accent?: "gold" | "maroon" | "mixed";
  href?: string;
  delay?: number;
  /** Optional footer (e.g. NSE | BSE) — always clickable even when card has href */
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const rx = useSpring(0, { stiffness: 200, damping: 20 });
  const ry = useSpring(0, { stiffness: 200, damping: 20 });
  const glow = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(212,178,76,0.18), transparent 55%)`;

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    mx.set(px * 100);
    my.set(py * 100);
    ry.set((px - 0.5) * 7);
    rx.set((0.5 - py) * 5);
  };

  const onLeave = () => {
    mx.set(50);
    my.set(50);
    rx.set(0);
    ry.set(0);
  };

  const inner = (
    <motion.article
      ref={ref as never}
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ delay, type: "spring", stiffness: 160, damping: 17 }}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={`h-scroll-card h-scroll-card--${size} h-scroll-card--${accent}`}
    >
      <motion.div className="h-scroll-card-glow" style={{ background: glow }} aria-hidden />
      <div className="h-scroll-card-shine" aria-hidden />
      <div className="h-scroll-card-rail" aria-hidden />
      <div className="relative z-[1] h-scroll-card-body">
        <div className="h-scroll-card-main">{children}</div>
        {footer ? <div className="h-scroll-card-footer">{footer}</div> : null}
      </div>
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
