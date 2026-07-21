"use client";

import { useRef, type ReactNode, type WheelEvent } from "react";

/** Wider KPI tiles on a stable horizontal rail (desk coverage band). */
export function KpiBandRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = railRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    const next = el.scrollLeft + e.deltaY;
    const max = el.scrollWidth - el.clientWidth;
    const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
    const atEnd = el.scrollLeft >= max - 1 && e.deltaY > 0;
    if (atStart || atEnd) return;

    el.scrollLeft = Math.max(0, Math.min(max, next));
    e.preventDefault();
  };

  return (
    <div
      ref={railRef}
      className="kpi-band-rail scrollbar-thin"
      onWheel={onWheel}
    >
      {children}
    </div>
  );
}
