import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { BrowseShell } from "@/components/browse-shell";
import { BrowseExplorer } from "@/components/browse-explorer";

export default async function BrowsePage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const resolved = await params;
  const initialPath = (resolved.path ?? []).join("/");

  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="glass rounded-2xl p-10 text-center font-ui text-[var(--ar-muted)]">
            Loading archive…
          </div>
        }
      >
        <BrowseShell>
          <BrowseExplorer initialPath={initialPath} />
        </BrowseShell>
      </Suspense>
    </AppShell>
  );
}
