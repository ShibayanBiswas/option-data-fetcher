"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  /** tree = classic nested list · map = full-width columns · pipeline = horizontal steps */
  layout?: "tree" | "pipeline" | "map";
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
  expanded,
  onToggle,
  stretch = false,
}: {
  node: FlowNode;
  depth?: number;
  index?: number;
  expanded: boolean;
  onToggle: () => void;
  stretch?: boolean;
}) {
  const hasKids = Boolean(node.children?.length);

  return (
    <div
      className={`${toneClass(node.tone)} flow-node-shell ${stretch ? "flow-node-shell--stretch" : ""}`}
    >
      {hasKids ? (
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flow-node-chevron-btn"
          onClick={onToggle}
        >
          <span
            className={`inline-flex transition-transform duration-150 ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
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
    </div>
  );
}

function FlowBranch({
  node,
  depth,
}: {
  node: FlowNode;
  depth: number;
  index?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const kids = node.children ?? [];

  return (
    <li className="flow-branch">
      <FlowNodeCard
        node={node}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && kids.length > 0 ? (
        <ul className="flow-children">
          {kids.map((child) => (
            <FlowBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MapColumn({ node }: { node: FlowNode; index?: number }) {
  const [open, setOpen] = useState(true);
  const kids = node.children ?? [];

  return (
    <div className="flow-map-col">
      <FlowNodeCard
        node={node}
        expanded={open}
        onToggle={() => setOpen((v) => !v)}
        stretch
      />
      {open && kids.length > 0 ? (
        <ul className="flow-map-kids">
          {kids.map((child) => (
            <li key={child.id} className="flow-map-kid">
              <FlowNodeCard
                node={child}
                expanded={false}
                onToggle={() => undefined}
                stretch
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FlowMap({ roots }: { roots: FlowNode[] }) {
  const root = roots[0];
  if (!root) return null;
  const cols = root.children ?? [];

  return (
    <div className="flow-map">
      <FlowNodeCard
        node={root}
        expanded
        onToggle={() => undefined}
        stretch
      />
      {cols.length > 0 ? (
        <div
          className="flow-map-columns"
          style={{
            gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {cols.map((col) => (
            <MapColumn key={col.id} node={col} />
          ))}
        </div>
      ) : null}
    </div>
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
      <div className="flow-pipe-card">
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
      </div>
      {index < total - 1 ? (
        <div className="flow-pipe-arrow" aria-hidden>
          →
        </div>
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
      ) : layout === "map" ? (
        <FlowMap roots={roots} />
      ) : (
        <ul className="flow-forest">
          {roots.map((root) => (
            <FlowBranch key={root.id} node={root} depth={0} />
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
