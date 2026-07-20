"use client";

import { CalendarRange, RotateCcw } from "lucide-react";

export function DateRangeFilter({
  from,
  to,
  min,
  max,
  onChange,
  onReset,
}: {
  from: string;
  to: string;
  min: string;
  max: string;
  onChange: (next: { from: string; to: string }) => void;
  onReset: () => void;
}) {
  const isFull = from === min && to === max;

  return (
    <div className="date-range-bar">
      <div className="date-range-label">
        <CalendarRange className="h-3.5 w-3.5" />
        <span>Trade dates</span>
        <span className="date-range-hint">newest → oldest</span>
      </div>
      <div className="date-range-controls">
        <label className="date-range-field">
          <span>From</span>
          <input
            type="date"
            value={from}
            min={min}
            max={to || max}
            onChange={(e) => onChange({ from: e.target.value, to })}
          />
        </label>
        <label className="date-range-field">
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || min}
            max={max}
            onChange={(e) => onChange({ from, to: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn-ghost !px-2.5 !py-1.5 text-xs inline-flex items-center gap-1"
          onClick={onReset}
          disabled={isFull}
          title="Show complete date range"
        >
          <RotateCcw className="h-3 w-3" />
          All dates
        </button>
      </div>
    </div>
  );
}
