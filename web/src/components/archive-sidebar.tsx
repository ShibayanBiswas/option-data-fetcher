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
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import type { TreeNode } from "@/lib/tree";

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
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
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
            if (node.hasChildren) {
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

      {open && node.hasChildren && (
        <div className="ml-3 border-l border-[var(--ar-border)] pl-1">
          {loading && (
            <div
              className="font-ui py-1.5 text-[11px] text-[var(--ar-subtle)]"
              style={{ paddingLeft: 22 }}
            >
              Loading…
            </div>
          )}
          {children?.map((child) => (
            <TreeBranch
              key={nodeKey(child)}
              node={child}
              depth={depth + 1}
              openMap={openMap}
              setOpenMap={setOpenMap}
              cache={cache}
              ensureChildren={ensureChildren}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArchiveSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
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
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [roots, setRoots] = useState<TreeNode[] | null>(null);

  const ensureChildren = useCallback(
    async (treePath: string, sectorFilter?: string | null) => {
      const key = cacheKey(treePath, sectorFilter);
      if (cacheRef.current[key]) return;

      const qs = new URLSearchParams();
      if (treePath) qs.set("path", treePath);
      if (sectorFilter) qs.set("sector", sectorFilter);
      const res = await fetch(`/api/tree?${qs.toString()}`);
      const json = await res.json();
      const children = (json.children ?? []) as TreeNode[];
      cacheRef.current = { ...cacheRef.current, [key]: children };
      setCache(cacheRef.current);
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
        setCache(cacheRef.current);
      })
      .catch(() => {
        if (!cancelled) setRoots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-expand ancestors for the active browse path
  useEffect(() => {
    let cancelled = false;
    async function expandPath() {
      const parts = currentTreePath.split("/").filter(Boolean);
      const nextOpen: Record<string, boolean> = {};

      await ensureChildren("");

      // Walk path and expand each level
      for (let i = 0; i < parts.length; i++) {
        const parentPath = parts.slice(0, i).join("/");
        await ensureChildren(parentPath);

        if (i === 0) nextOpen[parts[0]] = true;
        else if (i === 1) nextOpen[`${parts[0]}-${parts[1]}`] = true;
        else if (i === 2) {
          // If STOCK and we have a sector, the symbol sits under a sector folder
          if (parts[1] === "STOCK" && sector) {
            nextOpen[`${parts[0]}-STOCK`] = true;
            nextOpen[`${parts[0]}/STOCK::sector::${sector}`] = true;
            await ensureChildren(`${parts[0]}/STOCK`);
            await ensureChildren(`${parts[0]}/STOCK`, sector);
          }
          nextOpen[`${parts[0]}-${parts[1]}-${parts[2]}`] = true;
        } else if (i === 3) {
          nextOpen[`${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`] = true;
        } else if (i === 4) {
          nextOpen[
            `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`
          ] = true;
        }
      }

      // Sector browse page (no symbol yet)
      if (sector && parts.length === 2 && parts[1] === "STOCK") {
        nextOpen[parts[0]] = true;
        nextOpen[`${parts[0]}-STOCK`] = true;
        nextOpen[`${parts[0]}/STOCK::sector::${sector}`] = true;
        await ensureChildren(`${parts[0]}/STOCK`);
        await ensureChildren(`${parts[0]}/STOCK`, sector);
      }

      if (!cancelled) {
        setOpenMap((s) => ({ ...s, ...nextOpen }));
      }
    }
    void expandPath();
    return () => {
      cancelled = true;
    };
  }, [currentTreePath, sector, ensureChildren]);

  return (
    <aside
      className={`archive-sidebar ${collapsed ? "archive-sidebar-collapsed" : ""} ${
        mobileOpen ? "archive-sidebar-open" : ""
      }`}
    >
      <div className="archive-sidebar-toolbar">
        {!collapsed && (
          <div className="min-w-0">
            <div className="label-chip">Archive</div>
            <div className="font-serif text-base text-[var(--ar-ink)]">File tree</div>
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            className="dashboard-icon-btn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <div className="archive-sidebar-scroll scrollbar-thin">
        {!collapsed && (
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
        )}

        {roots === null && !collapsed && (
          <p className="font-ui px-3 py-2 text-xs text-[var(--ar-subtle)]">
            Loading tree…
          </p>
        )}

        {!collapsed &&
          roots?.map((node) => (
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

        {collapsed && (
          <div className="flex flex-col items-center gap-2 pt-2">
            {(roots ?? []).map((n) => (
              <Link
                key={n.id}
                href={n.href}
                title={n.label}
                className="dashboard-icon-btn"
                onClick={onNavigate}
              >
                <Folder className="h-4 w-4" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
