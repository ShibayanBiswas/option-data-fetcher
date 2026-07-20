"""
Download and clean daily F&O bhavcopy files for NIFTY (NSE) and SENSEX (BSE).

Reads trading dates from data/index_daily_closes.csv and saves filtered option
chain CSVs under:

    Option Chain Data/
        NIFTY/YYYY-MM-DD.csv
        SENSEX/YYYY-MM-DD.csv

Sources:
  NSE F&O UDiFF bhavcopy (fo.zip equivalent):
    https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_YYYYMMDD_F_0000.csv.zip
  BSE F&O UDiFF bhavcopy:
    https://www.bseindia.com/download/BhavCopy/Derivative/BhavCopy_BSE_FO_0_0_0_YYYYMMDD_F_0000.CSV
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import time
import zipfile
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).parent
DATE_FILE = ROOT / "data" / "index_daily_closes.csv"
OUTPUT_ROOT = ROOT / "Option Chain Data"
NIFTY_DIR = OUTPUT_ROOT / "NIFTY"
SENSEX_DIR = OUTPUT_ROOT / "SENSEX"

NSE_FO_URL = (
    "https://nsearchives.nseindia.com/content/fo/"
    "BhavCopy_NSE_FO_0_0_0_{yyyymmdd}_F_0000.csv.zip"
)
BSE_FO_URL = (
    "https://www.bseindia.com/download/BhavCopy/Derivative/"
    "BhavCopy_BSE_FO_0_0_0_{yyyymmdd}_F_0000.CSV"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}
BSE_HEADERS = {
    **HEADERS,
    "Referer": "https://www.bseindia.com/markets/MarketInfo/BhavCopy.aspx",
}

OPTION_TYPES = frozenset({"CE", "PE"})


def load_trading_dates(
    date_file: Path = DATE_FILE,
    start: date | None = None,
    end: date | None = None,
) -> list[date]:
    if not date_file.exists():
        raise FileNotFoundError(
            f"Date file not found: {date_file}. Run fetch_index_prices.py first."
        )

    df = pd.read_csv(date_file, parse_dates=["date"])
    dates = [d.date() for d in df["date"].dt.normalize()]

    if start:
        dates = [d for d in dates if d >= start]
    if end:
        dates = [d for d in dates if d <= end]

    if not dates:
        raise ValueError("No trading dates found for the requested range.")

    return sorted(dates)


def _output_path(folder: Path, trade_date: date) -> Path:
    return folder / f"{trade_date.isoformat()}.csv"


def _filter_option_rows(rows: list[dict[str, str]], symbol: str) -> list[dict[str, str]]:
    return [
        row
        for row in rows
        if row.get("TckrSymb") == symbol and row.get("OptnTp") in OPTION_TYPES
    ]


def _write_filtered_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        raise ValueError("No option rows found after filtering.")

    fieldnames = list(rows[0].keys())
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _request_with_retries(
    session: requests.Session,
    url: str,
    *,
    headers: dict[str, str],
    retries: int = 3,
    timeout: int = 60,
) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, headers=headers, timeout=timeout)
            if response.status_code == 404:
                return response
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(attempt)
    assert last_error is not None
    raise last_error


def download_nifty_day(
    session: requests.Session,
    trade_date: date,
    *,
    force: bool = False,
    retries: int = 3,
) -> str:
    output_path = _output_path(NIFTY_DIR, trade_date)
    if output_path.exists() and not force:
        return "skipped"

    yyyymmdd = trade_date.strftime("%Y%m%d")
    url = NSE_FO_URL.format(yyyymmdd=yyyymmdd)
    response = _request_with_retries(
        session, url, headers=HEADERS, retries=retries
    )
    if response.status_code == 404:
        return "missing"

    if response.content[:2] != b"PK":
        raise ValueError(f"NSE response for {trade_date} is not a zip archive.")

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise ValueError(f"No CSV found in NSE archive for {trade_date}.")
        raw_csv = archive.read(csv_names[0]).decode("utf-8", errors="replace")

    rows = list(csv.DictReader(io.StringIO(raw_csv)))
    nifty_rows = _filter_option_rows(rows, "NIFTY")
    _write_filtered_csv(nifty_rows, output_path)
    return "saved"


def download_sensex_day(
    session: requests.Session,
    trade_date: date,
    *,
    force: bool = False,
    retries: int = 3,
) -> str:
    output_path = _output_path(SENSEX_DIR, trade_date)
    if output_path.exists() and not force:
        return "skipped"

    yyyymmdd = trade_date.strftime("%Y%m%d")
    url = BSE_FO_URL.format(yyyymmdd=yyyymmdd)
    response = _request_with_retries(
        session, url, headers=BSE_HEADERS, retries=retries
    )
    if response.status_code == 404:
        return "missing"

    if b"TradDt" not in response.content[:500]:
        raise ValueError(f"BSE response for {trade_date} is not a bhavcopy CSV.")

    rows = list(csv.DictReader(io.StringIO(response.text)))
    sensex_rows = _filter_option_rows(rows, "SENSEX")
    _write_filtered_csv(sensex_rows, output_path)
    return "saved"


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def run(
    *,
    exchanges: set[str],
    start: date | None,
    end: date | None,
    force: bool,
    delay: float,
    retries: int,
) -> int:
    dates = load_trading_dates(start=start, end=end)
    session = requests.Session()

    stats = {
        "saved": 0,
        "skipped": 0,
        "missing": 0,
        "failed": 0,
    }

    print(f"Trading dates: {dates[0]} to {dates[-1]} ({len(dates)} days)")
    print(f"Output: {OUTPUT_ROOT}")

    for index, trade_date in enumerate(dates, start=1):
        day_label = trade_date.isoformat()
        print(f"[{index}/{len(dates)}] {day_label}", end="", flush=True)

        try:
            if "nifty" in exchanges:
                result = download_nifty_day(
                    session, trade_date, force=force, retries=retries
                )
                print(f" | NIFTY: {result}", end="", flush=True)
                stats[result] += 1

            if "sensex" in exchanges:
                result = download_sensex_day(
                    session, trade_date, force=force, retries=retries
                )
                print(f" | SENSEX: {result}", end="", flush=True)
                stats[result] += 1

            print()
        except Exception as exc:
            stats["failed"] += 1
            print(f" | ERROR: {exc}")

        if delay > 0 and index < len(dates):
            time.sleep(delay)

    print(
        "\nDone. "
        f"saved={stats['saved']} skipped={stats['skipped']} "
        f"missing={stats['missing']} failed={stats['failed']}"
    )
    return 1 if stats["failed"] else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Download daily NIFTY and SENSEX option chain bhavcopy data."
    )
    parser.add_argument(
        "--exchange",
        choices=("nifty", "sensex", "both"),
        default="both",
        help="Which exchange data to download (default: both).",
    )
    parser.add_argument(
        "--start",
        type=_parse_date,
        help="Start date YYYY-MM-DD (default: from index_daily_closes.csv).",
    )
    parser.add_argument(
        "--end",
        type=_parse_date,
        help="End date YYYY-MM-DD (default: from index_daily_closes.csv).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if the output file already exists.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.3,
        help="Seconds to wait between dates (default: 0.3).",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Retry count for transient network errors (default: 3).",
    )
    args = parser.parse_args(argv)

    exchanges = {"nifty", "sensex"} if args.exchange == "both" else {args.exchange}
    return run(
        exchanges=exchanges,
        start=args.start,
        end=args.end,
        force=args.force,
        delay=args.delay,
        retries=args.retries,
    )


if __name__ == "__main__":
    sys.exit(main())
