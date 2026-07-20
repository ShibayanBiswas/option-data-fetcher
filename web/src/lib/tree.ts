import { distinctValues } from "./db";
import { hrefForPath, pathFromSegments } from "./storage";
import { SEGMENT_LABELS, SEGMENT_ORDER } from "./constants";
import { groupSymbolsBySector, SECTORS, sectorForSymbol } from "./sectors";
import type { Exchange, Segment } from "./types";

export type TreeNodeKind =
  | "root"
  | "exchange"
  | "segment"
  | "sector"
  | "symbol"
  | "side"
  | "tradeDate"
  | "expiry";

export interface TreeNode {
  id: string;
  label: string;
  href: string;
  /** Path used to fetch children via /api/tree */
  treePath: string;
  sector?: string;
  kind: TreeNodeKind;
  hasChildren: boolean;
}

export async function getTreeChildren(
  pathParam: string,
  sector?: string | null
): Promise<TreeNode[]> {
  const segments = pathParam
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const path = pathFromSegments(segments);

  if (!path.exchange) {
    return (["NSE", "BSE"] as Exchange[]).map((ex) => ({
      id: ex,
      label: ex,
      href: hrefForPath({ exchange: ex }),
      treePath: ex,
      kind: "exchange" as const,
      hasChildren: true,
    }));
  }

  if (!path.segment) {
    const present = new Set(
      (await distinctValues("segment", { exchange: path.exchange })) as Segment[]
    );
    return SEGMENT_ORDER.filter((seg) => seg !== "OTHER" || present.has(seg)).map(
      (seg) => ({
        id: `${path.exchange}-${seg}`,
        label: SEGMENT_LABELS[seg],
        href: hrefForPath({ exchange: path.exchange, segment: seg }),
        treePath: `${path.exchange}/${seg}`,
        kind: "segment" as const,
        hasChildren: present.has(seg),
      })
    );
  }

  if (!path.symbol) {
    const symbols = await distinctValues("symbol", {
      exchange: path.exchange,
      segment: path.segment,
    });

    if (path.segment === "STOCK" && !sector) {
      const grouped = groupSymbolsBySector(symbols);
      return SECTORS.filter((s) => grouped[s].length > 0).map((sec) => ({
        id: `${path.exchange}-STOCK-${sec}`,
        label: sec,
        href: `/browse/${path.exchange}/STOCK?sector=${encodeURIComponent(sec)}`,
        treePath: `${path.exchange}/STOCK`,
        sector: sec,
        kind: "sector" as const,
        hasChildren: true,
      }));
    }

    const visible =
      path.segment === "STOCK" && sector
        ? symbols.filter((s) => sectorForSymbol(s) === sector)
        : symbols;

    return visible.map((symbol) => ({
      id: `${path.exchange}-${path.segment}-${symbol}`,
      label: symbol,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol,
      }),
      treePath: `${path.exchange}/${path.segment}/${symbol}`,
      kind: "symbol" as const,
      hasChildren: true,
    }));
  }

  if (!path.side) {
    return (["CALL", "PUT"] as const).map((side) => ({
      id: `${path.exchange}-${path.segment}-${path.symbol}-${side}`,
      label: side,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side,
      }),
      treePath: `${path.exchange}/${path.segment}/${path.symbol}/${side}`,
      kind: "side" as const,
      hasChildren: true,
    }));
  }

  if (!path.tradeDate) {
    const dates = (
      await distinctValues("tradeDate", {
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
      })
    )
      .sort()
      .reverse();

    return dates.map((tradeDate) => ({
      id: `${path.exchange}-${path.segment}-${path.symbol}-${path.side}-${tradeDate}`,
      label: tradeDate,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate,
      }),
      treePath: `${path.exchange}/${path.segment}/${path.symbol}/${path.side}/${tradeDate}`,
      kind: "tradeDate" as const,
      hasChildren: true,
    }));
  }

  if (!path.expiryDate) {
    const expiries = (
      await distinctValues("expiryDate", {
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate: path.tradeDate,
      })
    ).sort();

    return expiries.map((expiryDate) => ({
      id: `${path.exchange}-${path.segment}-${path.symbol}-${path.side}-${path.tradeDate}-${expiryDate}`,
      label: `expiry_date_${expiryDate}`,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate: path.tradeDate,
        expiryDate,
      }),
      treePath: `${path.exchange}/${path.segment}/${path.symbol}/${path.side}/${path.tradeDate}/expiry_date_${expiryDate}`,
      kind: "expiry" as const,
      hasChildren: false,
    }));
  }

  return [];
}
