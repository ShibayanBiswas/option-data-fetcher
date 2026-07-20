"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";

export type FlowNode = {
  id: string;
  label: string;
  meta?: string;
  href?: string;
  tone?: "root" | "branch" | "leaf" | "accent";
  children?: FlowNode[];
};

type DeskFlowProps = {
  title?: string;
  subtitle?: string;
  roots: FlowNode[];
  layout?: "tree" | "pipeline";
  className?: string;
};

function toneClass(tone: FlowNode["tone"]): string {
  switch (tone) {
    case "root":
      return "flow-node flow-node--root";
    case "leaf":
      return "flow-node flow-node--leaf";
    case "accent":
      return "flow-node flow-node--accent";
    case "branch":
    case undefined:
      return "flow-node flow-node--branch";
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function FlowNodeCard({
  node,
  depth,
  index,
  expanded,
  onToggle,
}: {
  node: FlowNode;
  depth: number;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasKids = Boolean(node.children?.length);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: depth * 0.04 + index * 0.03,
        type: "spring",
        stiffness: 170,
        damping: 18,
      }}
      className={`${toneClass(node.tone)} flow-node-shell`}
    >
      {hasKids ? (
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flow-node-chevron-btn"
          onClick={onToggle}
        >
          <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </button>
      ) : (
        <span className="flow-node-dot" aria-hidden />
      )}

      {node.href ? (
        <Link href={node.href} className="flow-node-main no-underline">
          <span className="flow-node-label">{node.label}</span>
          {node.meta ? <span className="flow-node-meta">{node.meta}</span> : null}
          <ExternalLink className="flow-node-link-hint h-3 w-3" aria-hidden />
        </Link>
      ) : (
        <button
          type="button"
          className="flow-node-main"
          onClick={hasKids ? onToggle : undefined}
        >
          <span className="flow-node-label">{node.label}</span>
          {node.meta ? <span className="flow-node-meta">{node.meta}</span> : null}
        </button>
      )}
    </motion.div>
  );
}

function FlowBranch({
  node,
  depth,
  index,
}: {
  node: FlowNode;
  depth: number;
  index: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const kids = node.children ?? [];

  return (
    <li className="flow-branch">
      <FlowNodeCard
        node={node}
        depth={depth}
        index={index}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
      />
      <AnimatePresence initial={false}>
        {open && kids.length > 0 ? (
          <motion.ul
            key="kids"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="flow-children"
          >
            {kids.map((child, i) => (
              <FlowBranch key={child.id} node={child} depth={depth + 1} index={i} />
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function PipelineStep({
  node,
  index,
  total,
}: {
  node: FlowNode;
  index: number;
  total: number;
}) {
  return (
    <div className="flow-pipe-step">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.08 }}
        className="flow-pipe-card"
      >
        <span className="flow-pipe-index">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-lg text-[var(--ar-ink)]">{node.label}</div>
          {node.meta ? (
            <p className="mt-1 font-ui text-xs text-[var(--ar-muted)]">{node.meta}</p>
          ) : null}
        </div>
        {node.href ? (
          <Link href={node.href} className="btn-ghost !px-3 !py-1.5 text-xs no-underline">
            Open
          </Link>
        ) : null}
      </motion.div>
      {index < total - 1 ? (
        <motion.div
          className="flow-pipe-arrow"
          aria-hidden
          animate={{ x: [0, 6, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.15 }}
        >
          →
        </motion.div>
      ) : null}
    </div>
  );
}

export function DeskFlow({
  title,
  subtitle,
  roots,
  layout = "tree",
  className = "",
}: DeskFlowProps) {
  const flatPipeline = useMemo(() => {
    if (layout !== "pipeline") return [];
    return roots;
  }, [layout, roots]);

  return (
    <section className={`flow-stage ${className}`}>
      {(title || subtitle) && (
        <header className="mb-4">
          {title ? (
            <h2 className="font-serif text-2xl text-[var(--ar-ink)] sm:text-3xl">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="mt-1 max-w-3xl font-ui text-sm text-[var(--ar-muted)]">{subtitle}</p>
          ) : null}
        </header>
      )}

      {layout === "pipeline" ? (
        <div className="flow-pipeline">
          {flatPipeline.map((node, i) => (
            <PipelineStep key={node.id} node={node} index={i} total={flatPipeline.length} />
          ))}
        </div>
      ) : (
        <ul className="flow-forest">
          {roots.map((root, i) => (
            <FlowBranch key={root.id} node={root} depth={0} index={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function FlowLegend({ items }: { items: { label: string; hint: string }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((it) => (
        <span key={it.label} className="desk-chip" title={it.hint}>
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function FlowTip({ children }: { children: ReactNode }) {
  return <p className="mt-3 font-ui text-xs text-[var(--ar-subtle)]">{children}</p>;
}
