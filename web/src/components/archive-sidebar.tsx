"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ChevronRight,
  FileSpreadsheet,
  Folder,
  FolderOpen,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { TreeNode } from "@/lib/tree";
import { sectorForSymbol } from "@/lib/sectors";

type Cache = Record<string, TreeNode[]>;

function cacheKey(treePath: string, sector?: string | null) {
  return sector ? `${treePath}::${sector}` : treePath || "__root__";
}

function nodeKey(node: TreeNode) {
  return node.sector ? `${node.treePath}::sector::${node.sector}` : node.id;
}

function isActiveHref(pathname: string, search: string, href: string) {
  try {
    const url = new URL(href, "http://local");
    if (url.pathname !== pathname) return false;
    const want = url.searchParams.get("sector");
    const have = new URLSearchParams(search).get("sector");
    return (want || null) === (have || null);
  } catch {
    return pathname === href;
  }
}

function TreeBranch({
  node,
  depth,
  openMap,
  setOpenMap,
  cache,
  ensureChildren,
  onNavigate,
}: {
  node: TreeNode;
  depth: number;
  openMap: Record<string, boolean>;
  setOpenMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  cache: Cache;
  ensureChildren: (treePath: string, sector?: string | null) => Promise<void>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const key = nodeKey(node);
  const open = openMap[key] ?? false;
  const active = isActiveHref(pathname, search, node.href);
  const childCacheKey = cacheKey(
    node.treePath,
    node.kind === "sector" ? node.sector : null
  );
  const children = cache[childCacheKey];
  const loading = open && node.hasChildren && children === undefined;

  useEffect(() => {
    if (open && node.hasChildren && children === undefined) {
      void ensureChildren(
        node.treePath,
        node.kind === "sector" ? node.sector : null
      );
    }
  }, [open, node, children, ensureChildren]);

  const toggle = () => {
    setOpenMap((s) => ({ ...s, [key]: !open }));
  };

  return (
    <div className="my-0.5">
      <div
        className={`archive-tree-row group flex w-full items-center gap-0.5 rounded-lg ${
          active ? "archive-tree-row-active" : ""
        }`}
        style={{ paddingLeft: Math.min(depth, 10) * 10 + 4 }}
      >
        {node.hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            className="archive-tree-chevron"
            onClick={toggle}
          >
            <motion.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="inline-flex"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.span>
          </button>
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center opacity-45">
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </span>
        )}

        <Link
          href={node.href}
          title={node.label}
          className="archive-tree-link"
          onClick={() => {
            onNavigate?.();
            // Auto-open folders only — never auto-open trade-date folders (file leaves inside)
            if (node.hasChildren && node.kind !== "tradeDate" && node.kind !== "expiry") {
              setOpenMap((s) => ({ ...s, [key]: true }));
            }
          }}
        >
          {node.hasChildren ? (
            open ? (
              <FolderOpen className="archive-tree-icon" />
            ) : (
              <Folder className="archive-tree-icon" />
            )
          ) : null}
          <span className="truncate">{node.label}</span>
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {open && node.hasChildren && (
          <motion.div
            className="ml-3 border-l border-[var(--ar-border)] pl-1"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {loading && (
              <div
                className="font-ui py-1.5 text-[11px] text-[var(--ar-subtle)]"
                style={{ paddingLeft: 22 }}
              >
                <motion.span
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                >
                  Loading…
                </motion.span>
              </div>
            )}
            {children?.map((child, i) => (
              <motion.div
                key={nodeKey(child)}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
              >
                <TreeBranch
                  node={child}
                  depth={depth + 1}
                  openMap={openMap}
                  setOpenMap={setOpenMap}
                  cache={cache}
                  ensureChildren={ensureChildren}
                  onNavigate={onNavigate}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ArchiveSidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sector = searchParams.get("sector");
  const currentTreePath = useMemo(
    () => pathname.replace(/^\/browse\/?/, "").replace(/\/$/, ""),
    [pathname]
  );

  const [cache, setCache] = useState<Cache>({});
  const cacheRef = useRef<Cache>({});
  const inflightRef = useRef<Record<string, Promise<void>>>({});
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [roots, setRoots] = useState<TreeNode[] | null>(null);

  const ensureChildren = useCallback(
    async (treePath: string, sectorFilter?: string | null) => {
      const key = cacheKey(treePath, sectorFilter);
      if (cacheRef.current[key]) return;
      const existing = inflightRef.current[key];
      if (existing) {
        await existing;
        return;
      }

      const run = (async () => {
        const qs = new URLSearchParams();
        if (treePath) qs.set("path", treePath);
        if (sectorFilter) qs.set("sector", sectorFilter);
        const res = await fetch(`/api/tree?${qs.toString()}`);
        const json = await res.json();
        const children = (json.children ?? []) as TreeNode[];
        cacheRef.current = { ...cacheRef.current, [key]: children };
        setCache({ ...cacheRef.current });
      })().finally(() => {
        delete inflightRef.current[key];
      });

      inflightRef.current[key] = run;
      await run;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tree")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const children = (j.children ?? []) as TreeNode[];
        setRoots(children);
        const key = cacheKey("");
        cacheRef.current = { ...cacheRef.current, [key]: children };
        setCache({ ...cacheRef.current });
      })
      .catch(() => {
        if (!cancelled) setRoots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Default: open NSE/BSE → Index/Stock. Never open CALL/PUT (no date flood).
  useEffect(() => {
    let cancelled = false;
    async function expandPath() {
      const parts = currentTreePath.split("/").filter(Boolean);
      const nextOpen: Record<string, boolean> = {};

      await ensureChildren("");
      const rootKids = cacheRef.current[cacheKey("")] ?? [];

      // Parallel: open both exchanges + load their segments
      await Promise.all(
        rootKids
          .filter((ex) => ex.kind === "exchange")
          .map(async (ex) => {
            nextOpen[nodeKey(ex)] = true;
            await ensureChildren(ex.treePath);
            const segs = cacheRef.current[cacheKey(ex.treePath)] ?? [];
            await Promise.all(
              segs
                .filter((seg) => seg.kind === "segment")
                .map(async (seg) => {
                  nextOpen[nodeKey(seg)] = true;
                  // Prefetch segment children (symbols / sectors) in parallel
                  await ensureChildren(seg.treePath);
                })
            );
          })
      );

      // Deep path: open through symbol (+ sector) only — never side/tradeDate
      const folderDepth = Math.min(parts.length, 3);
      for (let i = 1; i < folderDepth; i++) {
        const parentPath = parts.slice(0, i).join("/");
        await ensureChildren(parentPath);

        if (i === 1) {
          nextOpen[`${parts[0]}-${parts[1]}`] = true;
        } else if (i === 2) {
          if (parts[1] === "STOCK") {
            const symSector = sector ?? sectorForSymbol(parts[2]);
            nextOpen[`${parts[0]}-STOCK`] = true;
            nextOpen[`${parts[0]}/STOCK::sector::${symSector}`] = true;
            await Promise.all([
              ensureChildren(`${parts[0]}/STOCK`),
              ensureChildren(`${parts[0]}/STOCK`, symSector),
            ]);
          }
          nextOpen[`${parts[0]}-${parts[1]}-${parts[2]}`] = true;
          // Prefetch CALL/PUT labels under the symbol (tiny payload)
          await ensureChildren(
            `${parts[0]}/${parts[1]}/${parts[2]}`
          );
        }
      }

      if (sector && parts.length === 2 && parts[1] === "STOCK") {
        nextOpen[parts[0]] = true;
        nextOpen[`${parts[0]}-STOCK`] = true;
        nextOpen[`${parts[0]}/STOCK::sector::${sector}`] = true;
        await Promise.all([
          ensureChildren(`${parts[0]}/STOCK`),
          ensureChildren(`${parts[0]}/STOCK`, sector),
        ]);
      }

      if (!cancelled) setOpenMap(nextOpen);
    }
    void expandPath();
    return () => {
      cancelled = true;
    };
  }, [currentTreePath, sector, ensureChildren]);

  return (
    <aside className="archive-sidebar">
      <div className="archive-sidebar-toolbar">
        <div className="min-w-0">
          <div className="label-chip">Archive</div>
          <div className="font-serif text-base text-[var(--ar-ink)]">File tree</div>
        </div>
      </div>

      <div className="archive-sidebar-scroll scrollbar-thin">
        <Link
          href="/browse"
          className={`archive-tree-row mb-2 flex items-center gap-2 rounded-lg px-3 py-2 no-underline ${
            pathname === "/browse" ? "archive-tree-row-active" : ""
          }`}
          onClick={onNavigate}
        >
          <Folder className="archive-tree-icon" />
          <span className="sidebar-label truncate text-[13px] font-medium text-[var(--ar-ink)]">
            Root
          </span>
        </Link>

        {roots === null && (
          <p className="font-ui px-3 py-2 text-xs text-[var(--ar-subtle)]">
            Loading tree…
          </p>
        )}

        {roots?.map((node) => (
          <TreeBranch
            key={nodeKey(node)}
            node={node}
            depth={0}
            openMap={openMap}
            setOpenMap={setOpenMap}
            cache={cache}
            ensureChildren={ensureChildren}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </aside>
  );
}
