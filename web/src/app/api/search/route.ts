import { NextResponse } from "next/server";
import { getChainsCollection } from "@/lib/mongodb";
import { groupSymbolsBySector, SECTORS } from "@/lib/sectors";
import { SEGMENT_LABELS } from "@/lib/constants";
import type { Segment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const col = await getChainsCollection();
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
      for (const segment of ["INDEX", "STOCK", "OTHER"] as Segment[]) {
        hits.push({
          id: `${exchange}-${segment}`,
          label: `${exchange} · ${SEGMENT_LABELS[segment]}`,
          href: `/browse/${exchange}/${segment}`,
          meta: segment,
          kind: "segment",
        });
      }
    }

    const nseStocks = (
      await col.distinct("symbol", { exchange: "NSE", segment: "STOCK" })
    ) as string[];
    const bseStocks = (
      await col.distinct("symbol", { exchange: "BSE", segment: "STOCK" })
    ) as string[];
    const nseIndex = (
      await col.distinct("symbol", { exchange: "NSE", segment: "INDEX" })
    ) as string[];
    const bseIndex = (
      await col.distinct("symbol", { exchange: "BSE", segment: "INDEX" })
    ) as string[];

    for (const symbol of [...nseIndex].sort()) {
      hits.push({
        id: `NSE-INDEX-${symbol}`,
        label: symbol,
        href: `/browse/NSE/INDEX/${symbol}`,
        meta: "NSE Index",
        kind: "symbol",
      });
    }
    for (const symbol of [...bseIndex].sort()) {
      hits.push({
        id: `BSE-INDEX-${symbol}`,
        label: symbol,
        href: `/browse/BSE/INDEX/${symbol}`,
        meta: "BSE Index",
        kind: "symbol",
      });
    }
    for (const symbol of [...nseStocks].sort()) {
      hits.push({
        id: `NSE-STOCK-${symbol}`,
        label: symbol,
        href: `/browse/NSE/STOCK/${symbol}`,
        meta: "NSE Stock",
        kind: "symbol",
      });
    }
    for (const symbol of [...bseStocks].sort()) {
      hits.push({
        id: `BSE-STOCK-${symbol}`,
        label: symbol,
        href: `/browse/BSE/STOCK/${symbol}`,
        meta: "BSE Stock",
        kind: "symbol",
      });
    }

    const grouped = groupSymbolsBySector(nseStocks);
    for (const sector of SECTORS) {
      if (!grouped[sector].length) continue;
      hits.push({
        id: `sector-${sector}`,
        label: sector,
        href: `/browse/NSE/STOCK?sector=${encodeURIComponent(sector)}`,
        meta: `${grouped[sector].length} NSE stocks`,
        kind: "sector",
      });
    }

    return NextResponse.json({ hits });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search index failed", hits: [] },
      { status: 500 }
    );
  }
}
