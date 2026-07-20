import { NextResponse } from "next/server";
import { SEGMENT_LABELS, SEGMENT_ORDER } from "@/lib/constants";
import type { Segment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Search nav stops at BSE · Other Securities (no symbol flood in the scroll).
 * Order: pages → NSE (+ segments) → BSE (+ segments INDEX → STOCK → OTHER).
 */
export async function GET() {
  try {
    const hits: {
      id: string;
      label: string;
      href: string;
      meta: string;
      kind: "exchange" | "segment" | "symbol" | "sector" | "page";
    }[] = [
      {
        id: "home",
        label: "Home",
        href: "/",
        meta: "Desk overview",
        kind: "page",
      },
      {
        id: "browse",
        label: "Browse Archive",
        href: "/browse",
        meta: "Exchange explorer",
        kind: "page",
      },
      {
        id: "schema",
        label: "Schema Structure",
        href: "/schema",
        meta: "Hierarchy and field map",
        kind: "page",
      },
    ];

    for (const exchange of ["NSE", "BSE"] as const) {
      hits.push({
        id: exchange,
        label: exchange,
        href: `/browse/${exchange}`,
        meta: "Exchange",
        kind: "exchange",
      });
      for (const segment of SEGMENT_ORDER as Segment[]) {
        hits.push({
          id: `${exchange}-${segment}`,
          label: `${exchange} · ${SEGMENT_LABELS[segment]}`,
          href: `/browse/${exchange}/${segment}`,
          meta: segment,
          kind: "segment",
        });
      }
    }

    // Last entry is intentional: BSE · Other Securities
    return NextResponse.json({ hits });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search index failed", hits: [] },
      { status: 500 }
    );
  }
}
