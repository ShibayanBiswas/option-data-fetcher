"use client";

import { Suspense } from "react";
import { ArchiveSidebar } from "@/components/archive-sidebar";
import { PageTransition } from "@/components/motion-primitives";

function SidebarFallback() {
  return (
    <aside className="archive-sidebar" aria-hidden>
      <div className="p-3 font-ui text-xs text-[var(--ar-subtle)]">Loading tree…</div>
    </aside>
  );
}

export function BrowseShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="archive-shell h-full min-h-0">
      <Suspense fallback={<SidebarFallback />}>
        <ArchiveSidebar />
      </Suspense>
      <div className="archive-main">
        <div className="archive-main-scroll scrollbar-thin">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
