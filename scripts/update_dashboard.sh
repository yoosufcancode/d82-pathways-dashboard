#!/usr/bin/env bash
# Convenience wrapper: parse a new snapshot CSV and regenerate all exports.
# Usage: ./scripts/update_dashboard.sh path/to/new_export.csv
set -euo pipefail
if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-club-performance-csv>"
  exit 1
fi

SRC="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cp "$SRC" "$ROOT_DIR/data/latest_snapshot.csv"
python3 "$SCRIPT_DIR/parse_data.py" "$ROOT_DIR/data/latest_snapshot.csv"
python3 "$SCRIPT_DIR/generate_exports.py"

echo ""
echo "Done. Now review docs/ then run:"
echo "  git add ."
echo "  git commit -m \"Update dashboard: $(date +%Y-%m-%d)\""
echo "  git push"
