export type Exchange = "NSE" | "BSE";
/** INDEX = index options (IDO), STOCK = equity options (STO), OTHER = remaining option underlyings */
export type Segment = "INDEX" | "STOCK" | "OTHER";
export type OptionSide = "CALL" | "PUT";

export type BreadcrumbLevel =
  | "root"
  | "exchange"
  | "segment"
  | "symbol"
  | "side"
  | "tradeDate"
  | "expiry";

export interface BrowsePath {
  exchange?: Exchange;
  segment?: Segment;
  symbol?: string;
  side?: OptionSide;
  tradeDate?: string;
  expiryDate?: string;
}

export interface OptionRow {
  [key: string]: string | number | null;
}

export interface OptionChainDoc {
  exchange: Exchange;
  segment: Segment;
  symbol: string;
  side: OptionSide;
  tradeDate: string;
  expiryDate: string;
  rows: OptionRow[];
  rowCount: number;
  updatedAt: Date;
}

export interface BrowseChild {
  id: string;
  label: string;
  href: string;
  meta?: string;
  count?: number;
  sector?: string;
}

export interface BrowseSectorGroup {
  sector: string;
  symbols: BrowseChild[];
}

export interface BrowseResponse {
  level: BreadcrumbLevel;
  path: BrowsePath;
  title: string;
  subtitle: string;
  children: BrowseChild[];
  sectorGroups?: BrowseSectorGroup[];
  activeSector?: string | null;
  table?: {
    columns: string[];
    rows: OptionRow[];
  };
  breadcrumbs: { label: string; href: string }[];
  canDownloadBundle: boolean;
  canDownloadLeaf: boolean;
}

export interface SyncResult {
  ok: boolean;
  tradeDate?: string;
  saved: number;
  skipped: number;
  missing: number;
  failed: number;
  errors: string[];
  message: string;
  /** Desk sync outcome for themed UI popups */
  status?: "synced" | "already_synced" | "missing" | "partial" | "failed";
  alreadyHad?: boolean;
}
