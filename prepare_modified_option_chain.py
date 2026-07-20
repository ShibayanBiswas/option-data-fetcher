"""
Build modified option chain datasets from raw downloads.

Reads from Option Chain Data/ (unchanged) and writes CALL/PUT splits with
empty/NaN columns removed to Modified Option Chain Data/.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent
SOURCE_ROOT = ROOT / "Option Chain Data"
OUTPUT_ROOT = ROOT / "Modified Option Chain Data"

INDEXES = ("NIFTY", "SENSEX")
OPTION_SIDES = {
    "CE": "CALL",
    "PE": "PUT",
}


def _drop_empty_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.replace(r"^\s*$", pd.NA, regex=True)
    keep = normalized.notna().any(axis=0)
    return df.loc[:, keep]


def _write_expiry_files(df: pd.DataFrame, output_dir: Path) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    written = 0

    for expiry_date, expiry_df in df.groupby("XpryDt", sort=True):
        output_path = output_dir / f"expiry_date_{expiry_date}.csv"
        expiry_df.to_csv(output_path, index=False)
        written += 1

    return written


def process_file(source_path: Path, index: str) -> tuple[int, int, int, int]:
    trade_date = source_path.stem
    df = pd.read_csv(source_path, dtype=str)
    df = _drop_empty_columns(df)

    calls = df[df["OptnTp"] == "CE"].copy()
    puts = df[df["OptnTp"] == "PE"].copy()

    call_dir = OUTPUT_ROOT / index / "CALL" / trade_date
    put_dir = OUTPUT_ROOT / index / "PUT" / trade_date

    call_files = _write_expiry_files(calls, call_dir)
    put_files = _write_expiry_files(puts, put_dir)
    return len(calls), len(puts), call_files, put_files


def run(*, force: bool = False) -> int:
    if not SOURCE_ROOT.exists():
        print(f"Source folder not found: {SOURCE_ROOT}", file=sys.stderr)
        return 1

    if force and OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)

    total_calls = 0
    total_puts = 0
    total_call_files = 0
    total_put_files = 0
    processed = 0

    for index in INDEXES:
        source_dir = SOURCE_ROOT / index
        if not source_dir.exists():
            print(f"Missing source directory: {source_dir}", file=sys.stderr)
            return 1

        for source_path in sorted(source_dir.glob("*.csv")):
            trade_date = source_path.stem
            call_dir = OUTPUT_ROOT / index / "CALL" / trade_date
            put_dir = OUTPUT_ROOT / index / "PUT" / trade_date

            if not force and call_dir.exists() and put_dir.exists():
                continue

            call_rows, put_rows, call_files, put_files = process_file(source_path, index)
            total_calls += call_rows
            total_puts += put_rows
            total_call_files += call_files
            total_put_files += put_files
            processed += 1

            if processed % 50 == 0:
                print(f"Processed {processed} days for {index}...")

    print(f"Output: {OUTPUT_ROOT}")
    print(f"Days processed: {processed}")
    print(f"CALL rows written: {total_calls}")
    print(f"PUT rows written: {total_puts}")
    print(f"CALL expiry files written: {total_call_files}")
    print(f"PUT expiry files written: {total_put_files}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Split option chain data into CALL/PUT and drop empty columns."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild files even if they already exist.",
    )
    args = parser.parse_args(argv)
    return run(force=args.force)


if __name__ == "__main__":
    sys.exit(main())
