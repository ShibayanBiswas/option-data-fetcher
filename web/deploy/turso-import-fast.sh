#!/usr/bin/env bash
# Fast Turso load: upload the whole SQLite file in one shot (no row-by-row writes).
# Avoids burning Turso rows-written / rate limits that HTTP batch inserts cause.
#
# Prerequisites:
#   1) Paid-enough Turso plan for ~8.3 GB storage + browsing rows-read
#   2) turso auth login   (browser once)
#
# Usage:
#   bash deploy/turso-import-fast.sh
#   DB_NAME=option-chain-archive bash deploy/turso-import-fast.sh
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
DB_SRC="$WEB/data/option_chain.db"
DB_NAME="${DB_NAME:-option-chain-archive}"
export PATH="$HOME/.turso:$PATH"

if [[ ! -f "$DB_SRC" ]]; then
  echo "Missing local DB: $DB_SRC"
  exit 1
fi

if ! command -v turso >/dev/null 2>&1; then
  echo "Turso CLI missing. Install: curl -sSfL https://get.tur.so/install.sh | bash"
  exit 1
fi

if ! turso auth whoami >/dev/null 2>&1; then
  echo "==> Login to Turso (browser)…"
  turso auth login
fi

echo "==> Ensuring WAL mode (required by turso db import)"
sqlite3 "$DB_SRC" "PRAGMA journal_mode=WAL; PRAGMA wal_checkpoint(TRUNCATE);"
echo "    journal_mode=$(sqlite3 "$DB_SRC" 'PRAGMA journal_mode;')"

# Import creates a NEW database named after the file by default; we copy to a
# temp name so the cloud DB gets a clean name.
WORK="$(mktemp -d /tmp/oca-turso-XXXXXX)"
IMPORT_COPY="$WORK/${DB_NAME}.db"
echo "==> Preparing import copy (~8.3 GB — needs free disk)…"
# Use hardlink if same filesystem (instant), else copy.
if ln "$DB_SRC" "$IMPORT_COPY" 2>/dev/null; then
  echo "    hardlinked (instant)"
  # hardlink shares WAL settings with source — fine
else
  cp -f "$DB_SRC" "$IMPORT_COPY"
  # Also need -wal/-shm if present for consistency; checkpoint already truncated.
fi

echo "==> Uploading to Turso (one-shot file import — do NOT use seed:turso:fast)…"
echo "    This can take a while for 8.3 GB. Keep the PC awake."
# Prefer import (Upload API). Falls back to create --from-file.
if turso db import --help >/dev/null 2>&1; then
  # If DB already exists with this name, rename import file or destroy first.
  if turso db show "$DB_NAME" >/dev/null 2>&1; then
    echo "Database '$DB_NAME' already exists."
    echo "Destroy it first if you want a clean import:"
    echo "  turso db destroy $DB_NAME --yes"
    exit 1
  fi
  # import names DB from filename stem
  turso db import "$IMPORT_COPY"
else
  turso db create "$DB_NAME" --from-file "$IMPORT_COPY" -w
fi

echo "==> Creating auth token…"
URL="$(turso db show "$DB_NAME" --url)"
TOKEN="$(turso db tokens create "$DB_NAME")"

ENV_FILE="$WEB/.env.local"
echo "==> Writing Turso credentials into .env.local (keeps local SQLITE_URL)…"
touch "$ENV_FILE"
# Strip old Turso lines, append fresh
grep -vE '^(LIBSQL_URL|LIBSQL_AUTH_TOKEN|TURSO_DATABASE_URL|TURSO_AUTH_TOKEN)=' "$ENV_FILE" >"$ENV_FILE.tmp" || true
mv "$ENV_FILE.tmp" "$ENV_FILE"
{
  echo ""
  echo "# Turso (written by deploy/turso-import-fast.sh $(date -Is))"
  echo "LIBSQL_URL=$URL"
  echo "LIBSQL_AUTH_TOKEN=$TOKEN"
} >>"$ENV_FILE"

# Ensure local file path remains for desk work
if ! grep -q '^SQLITE_URL=' "$ENV_FILE"; then
  echo "SQLITE_URL=file:./data/option_chain.db" >>"$ENV_FILE"
fi

echo "==> Pushing one-row archive_stats (computed from local file)…"
cd "$WEB"
# push:stats uses LIBSQL_URL from env-file
npx tsx --env-file=.env.local scripts/push-archive-stats.ts

echo "==> Verify…"
npx tsx --env-file=.env.local scripts/check-turso.ts || true

rm -rf "$WORK"

echo ""
echo "—— Done ——"
echo "DB:    $DB_NAME"
echo "URL:   $URL"
echo "Token: saved in $ENV_FILE"
echo ""
echo "Next: deploy Vercel with the same LIBSQL_URL + LIBSQL_AUTH_TOKEN"
echo "      (see web/DEPLOY.md)"
