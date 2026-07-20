"use client";

import { ArchiveSidebar } from "@/components/archive-sidebar";
import { PageTransition } from "@/components/motion-primitives";

export function BrowseShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="archive-shell h-full min-h-0">
      <ArchiveSidebar />
      <div className="archive-main">
        <div className="archive-main-scroll">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
