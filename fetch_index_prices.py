"""
Fetch daily close prices for Nifty 50 and Sensex (last 2 years).
Output CSV is used as strike-price levels for options backtesting.
"""

from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

INDEX_SYMBOLS = {
    "NIFTY50": "^NSEI",
    "SENSEX": "^BSESN",
}

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
OUTPUT_FILE = Path(__file__).parent / "data" / "index_daily_closes.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


def _fetch_yahoo_closes(symbol: str, start: date, end: date) -> pd.Series:
    period1 = int(pd.Timestamp(start).timestamp())
    period2 = int(pd.Timestamp(end + timedelta(days=1)).timestamp())

    response = requests.get(
        YAHOO_CHART_URL.format(symbol=requests.utils.quote(symbol, safe="")),
        params={"interval": "1d", "period1": period1, "period2": period2},
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()

    payload = response.json()
    result = payload["chart"]["result"]
    if not result:
        raise RuntimeError(f"No chart data for {symbol}")

    chart = result[0]
    timestamps = chart.get("timestamp") or []
    closes = chart["indicators"]["quote"][0].get("close") or []
    if not timestamps:
        raise RuntimeError(f"Empty price history for {symbol}")

    dates = pd.to_datetime(timestamps, unit="s").normalize()
    series = pd.Series(closes, index=dates, dtype="float64")
    return series.dropna()


def fetch_index_closes(years: int = 2) -> pd.DataFrame:
    end = date.today()
    start = end - timedelta(days=years * 365)

    frames = []
    for name, symbol in INDEX_SYMBOLS.items():
        closes = _fetch_yahoo_closes(symbol, start, end)
        closes.name = name
        frames.append(closes)

    df = pd.concat(frames, axis=1)
    df.index.name = "date"
    df = df.sort_index().dropna(how="any")
    return df


def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df = fetch_index_closes(years=2)
    df.to_csv(OUTPUT_FILE, float_format="%.2f")
    print(f"Saved {len(df)} trading days to {OUTPUT_FILE}")
    print(f"Date range: {df.index.min().date()} to {df.index.max().date()}")
    print(df.tail())


if __name__ == "__main__":
    main()
