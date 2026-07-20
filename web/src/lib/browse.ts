import { distinctValues, findChains } from "./db";
import { hrefForPath, readLocalChain } from "./storage";
import { PREFERRED_COLUMNS, SEGMENT_LABELS, SEGMENT_ORDER } from "./constants";
import { groupSymbolsBySector, SECTORS, sectorForSymbol } from "./sectors";
import type {
  BrowseChild,
  BrowsePath,
  BrowseResponse,
  BrowseSectorGroup,
  BreadcrumbLevel,
  OptionRow,
  Segment,
} from "./types";

function levelOf(path: BrowsePath): BreadcrumbLevel {
  if (path.expiryDate) return "expiry";
  if (path.tradeDate) return "tradeDate";
  if (path.side) return "side";
  if (path.symbol) return "symbol";
  if (path.segment) return "segment";
  if (path.exchange) return "exchange";
  return "root";
}

function breadcrumbsFor(
  path: BrowsePath,
  activeSector?: string | null
): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [
    { label: "Exchanges", href: "/browse" },
  ];
  if (path.exchange) {
    crumbs.push({ label: path.exchange, href: hrefForPath({ exchange: path.exchange }) });
  }
  if (path.exchange && path.segment) {
    crumbs.push({
      label: SEGMENT_LABELS[path.segment],
      href: hrefForPath({ exchange: path.exchange, segment: path.segment }),
    });
  }
  // Sector crumb: from symbol ancestry, or from ?sector= on the STOCK segment page
  if (path.exchange && path.segment === "STOCK") {
    const sector =
      (path.symbol ? sectorForSymbol(path.symbol) : null) ||
      activeSector?.trim() ||
      null;
    if (sector) {
      crumbs.push({
        label: sector,
        href: `/browse/${path.exchange}/STOCK?sector=${encodeURIComponent(sector)}`,
      });
    }
  }
  if (path.exchange && path.segment && path.symbol) {
    crumbs.push({
      label: path.symbol,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
      }),
    });
  }
  if (path.exchange && path.segment && path.symbol && path.side) {
    crumbs.push({
      label: path.side,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
      }),
    });
  }
  if (
    path.exchange &&
    path.segment &&
    path.symbol &&
    path.side &&
    path.tradeDate
  ) {
    crumbs.push({
      label: path.tradeDate,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate: path.tradeDate,
      }),
    });
  }
  if (path.expiryDate) {
    crumbs.push({
      label: `Expiry ${path.expiryDate}`,
      href: hrefForPath(path),
    });
  }
  return crumbs;
}

function pickColumns(rows: OptionRow[]): string[] {
  if (rows.length === 0) return [];
  const available = Object.keys(rows[0]);
  const preferred = PREFERRED_COLUMNS.filter((c) => available.includes(c));
  const rest = available.filter((c) => !preferred.includes(c));
  return [...preferred, ...rest];
}

export async function browse(
  path: BrowsePath,
  options: { sector?: string | null } = {}
): Promise<BrowseResponse> {
  const level = levelOf(path);
  const crumbs = breadcrumbsFor(path, options.sector);

  if (level === "root") {
    const exchanges = await distinctValues("exchange");
    const children: BrowseChild[] = (["NSE", "BSE"] as const).map((ex) => ({
      id: ex,
      label: ex,
      href: hrefForPath({ exchange: ex }),
      meta: exchanges.includes(ex) ? "Live archive" : "Awaiting first sync",
      count: exchanges.includes(ex) ? 1 : 0,
    }));
    return {
      level,
      path,
      title: "Option Chain Archive",
      subtitle: "Choose an exchange to explore historical NSE & BSE option chains.",
      children,
      breadcrumbs: crumbs,
      canDownloadBundle: true,
      canDownloadLeaf: false,
    };
  }

  if (level === "exchange" && path.exchange) {
    const present = new Set(
      (await distinctValues("segment", { exchange: path.exchange })) as Segment[]
    );
    // Always surface INDEX + STOCK; include OTHER only when data exists.
    const segmentsToShow = SEGMENT_ORDER.filter(
      (seg) => seg !== "OTHER" || present.has(seg)
    );
    const children: BrowseChild[] = segmentsToShow.map((seg) => ({
      id: seg,
      label: SEGMENT_LABELS[seg],
      href: hrefForPath({ exchange: path.exchange, segment: seg }),
      meta: present.has(seg) ? "Archived" : "No data yet",
      count: present.has(seg) ? 1 : 0,
    }));
    return {
      level,
      path,
      title: path.exchange,
      subtitle: `${path.exchange} derivatives — Index Options and Stock Options.`,
      children,
      breadcrumbs: crumbs,
      canDownloadBundle: true,
      canDownloadLeaf: false,
    };
  }

  if (level === "segment" && path.exchange && path.segment) {
    const exchange = path.exchange;
    const segment = path.segment;
    const symbols = await distinctValues("symbol", {
      exchange,
      segment,
    });

    const activeSector = options.sector?.trim() || null;
    let visible = symbols;
    if (segment === "STOCK" && activeSector) {
      visible = symbols.filter((s) => sectorForSymbol(s) === activeSector);
    }

    const children: BrowseChild[] = visible.map((symbol) => ({
      id: symbol,
      label: symbol,
      href: hrefForPath({
        exchange,
        segment,
        symbol,
      }),
      meta:
        segment === "STOCK"
          ? sectorForSymbol(symbol)
          : SEGMENT_LABELS[segment],
      sector: segment === "STOCK" ? sectorForSymbol(symbol) : undefined,
    }));

    let sectorGroups: BrowseSectorGroup[] | undefined;
    if (segment === "STOCK" && !activeSector) {
      const grouped = groupSymbolsBySector(symbols);
      sectorGroups = SECTORS.filter((s) => grouped[s].length > 0).map(
        (sector) => ({
          sector,
          symbols: grouped[sector].map((symbol) => ({
            id: symbol,
            label: symbol,
            href: hrefForPath({
              exchange,
              segment,
              symbol,
            }),
            meta: sector,
            sector,
          })),
        })
      );
    }

    const segLabel = SEGMENT_LABELS[segment];
    return {
      level,
      path,
      title: activeSector
        ? `${exchange} · ${segLabel} · ${activeSector}`
        : `${exchange} · ${segLabel}`,
      subtitle:
        segment === "STOCK"
          ? `${symbols.length} equity underlyings${activeSector ? ` · filtered to ${activeSector}` : " · grouped by sector"}.`
          : `${symbols.length} underlyings with archived option chains.`,
      children,
      sectorGroups,
      activeSector,
      breadcrumbs: crumbs,
      canDownloadBundle: true,
      canDownloadLeaf: false,
    };
  }

  if (level === "symbol" && path.exchange && path.segment && path.symbol) {
    const children: BrowseChild[] = (["CALL", "PUT"] as const).map((side) => ({
      id: side,
      label: side,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side,
      }),
      meta: side === "CALL" ? "CE contracts" : "PE contracts",
    }));
    return {
      level,
      path,
      title: path.symbol,
      subtitle: `Browse CALL and PUT chains for ${path.symbol}.`,
      children,
      breadcrumbs: crumbs,
      canDownloadBundle: true,
      canDownloadLeaf: false,
    };
  }

  if (
    level === "side" &&
    path.exchange &&
    path.segment &&
    path.symbol &&
    path.side
  ) {
    const dates = await distinctValues("tradeDate", {
      exchange: path.exchange,
      segment: path.segment,
      symbol: path.symbol,
      side: path.side,
    });
    // Ascending: oldest → newest (SQL already ORDERS ASC)
    const children: BrowseChild[] = dates.map((tradeDate) => ({
      id: tradeDate,
      label: tradeDate,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate,
      }),
      meta: "Trade date",
    }));
    return {
      level,
      path,
      title: `${path.symbol} · ${path.side}`,
      subtitle: `${dates.length} trading days archived · oldest → newest.`,
      children,
      breadcrumbs: crumbs,
      canDownloadBundle: true,
      canDownloadLeaf: false,
    };
  }

  if (
    level === "tradeDate" &&
    path.exchange &&
    path.segment &&
    path.symbol &&
    path.side &&
    path.tradeDate
  ) {
    const expiries = (
      await distinctValues("expiryDate", {
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate: path.tradeDate,
      })
    ).sort();
    const children: BrowseChild[] = expiries.map((expiryDate) => ({
      id: expiryDate,
      label: `Expiry ${expiryDate}`,
      href: hrefForPath({
        exchange: path.exchange,
        segment: path.segment,
        symbol: path.symbol,
        side: path.side,
        tradeDate: path.tradeDate,
        expiryDate,
      }),
      meta: "Strike ladder CSV",
    }));
    return {
      level,
      path,
      title: `${path.symbol} · ${path.side} · ${path.tradeDate}`,
      subtitle: `${expiries.length} expiry files — each sorted by strike price.`,
      children,
      breadcrumbs: crumbs,
      canDownloadBundle: true,
      canDownloadLeaf: false,
    };
  }

  // Leaf: expiry table
  const filter = {
    exchange: path.exchange!,
    segment: path.segment!,
    symbol: path.symbol!,
    side: path.side!,
    tradeDate: path.tradeDate!,
    expiryDate: path.expiryDate!,
  };

  let rows: OptionRow[] = [];
  const docs = await findChains(filter, { limit: 1 });
  if (docs[0]?.rows?.length) {
    rows = docs[0].rows;
  } else {
    const local = await readLocalChain({
      exchange: path.exchange!,
      segment: path.segment!,
      symbol: path.symbol!,
      side: path.side!,
      tradeDate: path.tradeDate!,
      expiryDate: path.expiryDate!,
    });
    rows = local ?? [];
  }

  return {
    level: "expiry",
    path,
    title: `${path.symbol} ${path.side} · Expiry ${path.expiryDate}`,
    subtitle: `Trade date ${path.tradeDate} — ${rows.length} strikes.`,
    children: [],
    table: {
      columns: pickColumns(rows),
      rows,
    },
    breadcrumbs: crumbs,
    canDownloadBundle: false,
    canDownloadLeaf: true,
  };
}
