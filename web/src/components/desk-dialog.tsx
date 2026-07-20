"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type DeskAlertVariant = "info" | "success" | "warning" | "error";

export function DeskDialog({
  open,
  title,
  message,
  variant = "info",
  onClose,
  primaryLabel = "OK",
  onPrimary,
}: {
  open: boolean;
  title: string;
  message: string;
  variant?: DeskAlertVariant;
  onClose: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  const Icon =
    variant === "success"
      ? CheckCircle2
      : variant === "warning"
        ? AlertTriangle
        : variant === "error"
          ? XCircle
          : Info;

  const glow =
    variant === "success"
      ? "border-[color-mix(in_srgb,var(--ar-gold)_45%,var(--ar-border))]"
      : variant === "error"
        ? "border-[color-mix(in_srgb,var(--ar-maroon)_55%,var(--ar-border))]"
        : "border-[color-mix(in_srgb,var(--ar-gold)_35%,var(--ar-border))]";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[color-mix(in_srgb,var(--ar-ink)_45%,transparent)] p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`glass relative w-full max-w-lg rounded-2xl border p-6 shadow-[var(--ar-shadow)] ${glow}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--ar-subtle)] hover:bg-[var(--ar-panel)]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-gradient-to-br from-[var(--ar-maroon)] to-[var(--ar-gold)] p-2 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <h2 className="font-serif text-2xl text-[var(--ar-ink)]">{title}</h2>
                <p className="mt-2 font-ui text-sm leading-relaxed text-[var(--ar-muted)]">
                  {message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn-gold text-xs"
                onClick={() => {
                  onPrimary?.();
                  onClose();
                }}
              >
                {primaryLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
