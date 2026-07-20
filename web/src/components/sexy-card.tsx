"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";

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
  delay = 0,
}: SexyCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });

  // Single soft gold hover wash — never maroon/pink card fills
  const glow = useMotionTemplate`radial-gradient(520px circle at ${mx}% ${my}%, rgba(212,178,76,0.16), transparent 55%)`;

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    mx.set(px * 100);
    my.set(py * 100);
    ry.set((px - 0.5) * 8);
    rx.set((0.5 - py) * 6);
  };

  const onLeave = () => {
    mx.set(50);
    my.set(50);
    rx.set(0);
    ry.set(0);
  };

  const inner = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, type: "spring", stiffness: 120, damping: 16 }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={`sexy-card ${className}`}
    >
      <motion.div className="sexy-card-glow" style={{ background: glow }} aria-hidden />
      <div className="sexy-card-shine" aria-hidden />
      <div className="sexy-card-rail" aria-hidden />
      <div className="relative z-[1]">{children}</div>
    </motion.div>
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
  delay = 0,
}: {
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <SexyCard delay={delay} className="!p-4">
      <div className="kpi-card-label">{label}</div>
      <motion.div
        className="kpi-card-value"
        key={value}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {value}
      </motion.div>
    </SexyCard>
  );
}
