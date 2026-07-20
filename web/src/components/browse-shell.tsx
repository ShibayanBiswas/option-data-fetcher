"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ArchiveSidebar } from "@/components/archive-sidebar";

export function BrowseShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className={`archive-shell h-full min-h-0 ${collapsed ? "archive-shell-collapsed" : ""}`}
    >
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close tree"
          className="archive-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <ArchiveSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="archive-main">
        <div className="archive-mobile-bar lg:hidden">
          <button
            type="button"
            className="dashboard-icon-btn"
            aria-label="Open file tree"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <span className="font-ui text-sm text-[var(--ar-muted)]">
            Archive folders
          </span>
        </div>
        <div className="archive-main-scroll">{children}</div>
      </div>
    </div>
  );
}
