"""
Builds a LOCKED Pathways Quality Award snapshot (docs/award_data.json) from a
specific CSV export -- run this once you have the final Dec 31 cutoff data (or
whenever you want to "freeze" the Award tab so it stops changing as you keep
updating the regular monthly dashboard).

Why this exists: the main dashboard (docs/data.json) is meant to be refreshed
every month, including in Jan/Feb/etc. after the Dec 31, 2026 award cutoff --
but Pathways Quality Award completions after Dec 31 must NOT count toward the
award. Once you run this script, the Award tab on the live site switches to
using this locked file instead of recalculating from whatever CSV you feed the
regular dashboard next. Re-run this script (with the same or a corrected
cutoff CSV) any time you want to update the official/locked result -- e.g.
after District Pathways Chair / District Awards Chair review.

Usage:
    python scripts/build_award_snapshot.py data/cutoff_snapshot.csv
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse_data import (
    parse_csv, load_history, update_history, save_history,
    compute_award_qualifying_dates, build_award_payload,
)

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
AWARD_JSON_PATH = DOCS_DIR / "award_data.json"


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/build_award_snapshot.py <path-to-cutoff-csv>")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    clubs, snapshot_date = parse_csv(csv_path)
    print(f"Parsed {len(clubs)} clubs. Cutoff snapshot date: {snapshot_date}")

    # Uses the same accumulated history the regular dashboard writes to, so
    # qualifying-date ordering stays accurate -- but writes its OWN output
    # file that future monthly dashboard updates will never overwrite.
    history = load_history()
    history = update_history(history, clubs, snapshot_date)
    save_history(history)

    award_info = compute_award_qualifying_dates(history)
    active_clubs = [c for c in clubs if c["status"] == "Active"]
    payload = build_award_payload(clubs, active_clubs, award_info)
    payload["locked"] = True
    payload["locked_at"] = datetime.now().isoformat(timespec="seconds")
    payload["cutoff_snapshot_date"] = snapshot_date.isoformat()

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    AWARD_JSON_PATH.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote LOCKED award file: {AWARD_JSON_PATH}")
    print("The Pathways Quality Award tab will now show this locked result instead of")
    print("recalculating from future monthly dashboard updates. Commit + push docs/award_data.json")
    print("to publish it. To unlock and go back to live/running data, delete docs/award_data.json.")


if __name__ == "__main__":
    main()
