"""
Parses a Toastmasters 'Club Performance' CSV export into the JSON structure
consumed by the dashboard (docs/data.json), and maintains a running history
file (data/history.json) used to determine Pathways Quality Award qualifying
dates.

Usage:
    python scripts/parse_data.py data/latest_snapshot.csv
"""
import csv
import json
import re
import sys
from datetime import datetime, date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"
HISTORY_PATH = DATA_DIR / "history.json"
DATA_JSON_PATH = DOCS_DIR / "data.json"

STAR_L1, STAR_L3 = 3, 2
EXCELLENCE_L1, EXCELLENCE_L3 = 4, 3


def parse_csv(path):
    """Returns (clubs: list[dict], snapshot_date: date)"""
    with open(path, newline="", encoding="utf-8-sig") as f:
        raw = f.read()

    # Snapshot date lives in a trailing footer line like:
    # "Month of Jun, As of 06/30/2026"
    m = re.search(r"As of (\d{2})/(\d{2})/(\d{4})", raw)
    if not m:
        raise ValueError("Could not find 'As of MM/DD/YYYY' snapshot date in CSV footer")
    mm, dd, yyyy = m.groups()
    snapshot_date = date(int(yyyy), int(mm), int(dd))

    lines = raw.splitlines()
    # Drop footer line(s) that don't start with a quoted field structure
    data_lines = [ln for ln in lines if ln.strip().startswith('"')]
    reader = csv.DictReader(data_lines)

    clubs = []
    for row in reader:
        if not row.get("Club Number"):
            continue
        div = (row.get("Division") or "").strip()
        if not div or div.startswith("As of"):
            continue

        def num(key):
            v = (row.get(key) or "").strip()
            try:
                return int(v)
            except ValueError:
                return 0

        level1 = num("Level 1s")
        level2 = num("Level 2s") + num("Add. Level 2s")
        level3 = num("Level 3s")
        level4 = num("Level 4s, Path Completions, or DTM Awards") + num(
            "Add. Level 4s, Path Completions, or DTM award"
        )
        total = level1 + level2 + level3 + level4

        clubs.append({
            "district": row.get("District", "").strip(),
            "division": div,
            "area": (row.get("Area") or "").strip(),
            "club_number": row.get("Club Number", "").strip(),
            "club_name": row.get("Club Name", "").strip(),
            "status": row.get("Club Status", "").strip(),
            "active_members": num("Active Members"),
            "goals_met": num("Goals Met"),
            "level1": level1,
            "level2": level2,
            "level3": level3,
            "level4": level4,
            "total_levels": total,
            "distinguished_status": row.get("Club Distinguished Status", "").strip(),
        })
    return clubs, snapshot_date


def load_history():
    if HISTORY_PATH.exists():
        return json.loads(HISTORY_PATH.read_text())
    return {"snapshots": []}


def save_history(history):
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_PATH.write_text(json.dumps(history, indent=2, sort_keys=True))


def update_history(history, clubs, snapshot_date):
    date_str = snapshot_date.isoformat()
    snap = {
        "date": date_str,
        "clubs": {
            c["club_number"]: {
                "level1": c["level1"],
                "level3": c["level3"],
                "club_name": c["club_name"],
                "division": c["division"],
                "area": c["area"],
                "status": c["status"],
            }
            for c in clubs
        },
    }
    history["snapshots"] = [s for s in history["snapshots"] if s["date"] != date_str]
    history["snapshots"].append(snap)
    history["snapshots"].sort(key=lambda s: s["date"])
    return history


def tier_for(level1, level3):
    if level1 >= EXCELLENCE_L1 and level3 >= EXCELLENCE_L3:
        return "excellence"
    if level1 >= STAR_L1 and level3 >= STAR_L3:
        return "star"
    return None


def compute_award_qualifying_dates(history, current_date=None):
    """
    For each club, determine its current tier (based on the snapshot for
    current_date -- i.e. the CSV that was just processed, NOT necessarily
    whichever snapshot happens to have the latest calendar date in history,
    since users may legitimately backfill or re-process an older-dated file)
    and the earliest snapshot date at which that tier's thresholds were first
    met (this becomes the qualifying date used for ranking/recognition).
    Returns dict: club_number -> {"tier": ..., "qualifying_date": ...}
    """
    snapshots = sorted(history["snapshots"], key=lambda s: s["date"])
    if not snapshots:
        return {}

    if current_date is not None:
        latest = next((s for s in snapshots if s["date"] == current_date), snapshots[-1])
    else:
        latest = snapshots[-1]
    result = {}
    for club_number, latest_info in latest["clubs"].items():
        current_tier = tier_for(latest_info["level1"], latest_info["level3"])
        if current_tier is None:
            continue
        if latest_info.get("status") != "Active":
            continue
        qualifying_date = latest["date"]
        for snap in snapshots:
            if snap["date"] > latest["date"]:
                continue  # never use a snapshot dated after the one being processed
            info = snap["clubs"].get(club_number)
            if not info:
                continue
            if tier_for(info["level1"], info["level3"]) == current_tier:
                qualifying_date = snap["date"]
                break
        result[club_number] = {
            "tier": current_tier,
            "qualifying_date": qualifying_date,
            "level1": latest_info["level1"],
            "level3": latest_info["level3"],
        }
    return result


RANK_METRICS = ["level1", "level2", "level3", "level4", "total"]


def rank_dict(rows, id_fn, value_fn, tie_fn):
    """Returns {id: rank} where rank 1 = highest value_fn, ties broken by tie_fn."""
    ordered = sorted(rows, key=lambda r: (-value_fn(r), tie_fn(r)))
    return {id_fn(r): i + 1 for i, r in enumerate(ordered)}


def rank_fields(rank_maps, key):
    return {
        "rank_l1": rank_maps["level1"][key],
        "rank_l2": rank_maps["level2"][key],
        "rank_l3": rank_maps["level3"][key],
        "rank_l4": rank_maps["level4"][key],
        "rank_total": rank_maps["total"][key],
    }


CLOSE_TO_STAR_LIMIT = 30


def compute_close_to_star(clubs, award_info, limit=CLOSE_TO_STAR_LIMIT):
    """Active clubs that have NOT yet qualified for Star/Excellence, ranked by
    how few additional Level 1 / Level 3 completions they'd need to reach Star."""
    close = []
    for c in clubs:
        if c["club_number"] in award_info:
            continue  # already Star or Excellence
        need1 = max(0, STAR_L1 - c["level1"])
        need3 = max(0, STAR_L3 - c["level3"])
        if need1 == 0 and need3 == 0:
            continue
        close.append({
            "club_number": c["club_number"],
            "club_name": c["club_name"],
            "division": c["division"],
            "area": c["area"],
            "level1": c["level1"],
            "level3": c["level3"],
            "need_l1": need1,
            "need_l3": need3,
            "gap": need1 + need3,
        })
    close.sort(key=lambda x: (x["gap"], x["club_name"]))
    top = close[:limit]
    for i, c in enumerate(top, start=1):
        c["rank"] = i
    return top


def build_award_payload(clubs, active_clubs, award_info):
    """clubs = full club list (for name/division lookup), active_clubs = Active-status only."""
    club_lookup = {c["club_number"]: c for c in clubs}
    excellence, star = [], []
    for club_number, info in award_info.items():
        c = club_lookup.get(club_number)
        if not c:
            continue
        entry = {
            "club_number": club_number,
            "club_name": c["club_name"],
            "division": c["division"],
            "area": c["area"],
            "level1": info["level1"],
            "level3": info["level3"],
            "qualifying_date": info["qualifying_date"],
        }
        (excellence if info["tier"] == "excellence" else star).append(entry)

    excellence.sort(key=lambda e: (e["qualifying_date"], e["club_name"]))
    star.sort(key=lambda e: (e["qualifying_date"], e["club_name"]))
    for i, e in enumerate(excellence, start=1):
        e["rank"] = i
        e["ovation_recognized"] = i <= 20
    for i, e in enumerate(star, start=1):
        e["rank"] = i

    return {
        "excellence": excellence,
        "star": star,
        "close_to_star": compute_close_to_star(active_clubs, award_info),
        "criteria": {
            "star": {"level1": STAR_L1, "level3": STAR_L3},
            "excellence": {"level1": EXCELLENCE_L1, "level3": EXCELLENCE_L3},
        },
    }


def dense_rank(sorted_rows, key_fn):
    """Dense ranking (1,2,2,3,4,4,5): rows must already be sorted best-to-worst
    by key_fn. Equal keys share the same rank; the next distinct key is only
    one more than the previous rank (no gap left by ties)."""
    ranks = []
    prev_key = None
    current_rank = 0
    for row in sorted_rows:
        k = key_fn(row)
        if k != prev_key:
            current_rank += 1
        ranks.append(current_rank)
        prev_key = k
    return ranks


def build_per_member_leaderboard(active_clubs):
    """Ranks clubs by levels completed per active member (dense ranking, 1,2,2,3).
    Ties broken by Level 1 + Level 3 completions combined; clubs tied on both
    share the same rank. Expects active_clubs to already have 'levels_per_member'
    and 'l1_l3_sum' set (see build_dashboard_json)."""
    rows = sorted(
        active_clubs,
        key=lambda r: (-r["levels_per_member"], -r["l1_l3_sum"], r["club_name"]),
    )
    ranks = dense_rank(rows, lambda r: (r["levels_per_member"], r["l1_l3_sum"]))

    out = []
    for r, rank in zip(rows, ranks):
        out.append({
            "rank": rank,
            "club_number": r["club_number"],
            "club_name": r["club_name"],
            "division": r["division"],
            "area": r["area"],
            "level1": r["level1"],
            "level2": r["level2"],
            "level3": r["level3"],
            "level4": r["level4"],
            "total": r["total_levels"],
            "active_members": r["active_members"],
            "distinguished_status": r["distinguished_status"],
            "levels_per_member": r["levels_per_member"],
            "l1_l3_sum": r["l1_l3_sum"],
        })
    return out


def build_dashboard_json(clubs, snapshot_date, award_info):
    active_clubs = [c for c in clubs if c["status"] == "Active"]

    def totals(rows):
        return {
            "level1": sum(r["level1"] for r in rows),
            "level2": sum(r["level2"] for r in rows),
            "level3": sum(r["level3"] for r in rows),
            "level4": sum(r["level4"] for r in rows),
            "total": sum(r["total_levels"] for r in rows),
        }

    district_totals = totals(active_clubs)
    district_number = clubs[0]["district"] if clubs else ""

    # Precompute per-member ratio and L1+L3 sum for every active club -- used
    # both for the "Levels per Member" leaderboard and as tiebreakers for the
    # "Total Levels" leaderboard/rank.
    for c in active_clubs:
        members = c["active_members"] or 0
        c["levels_per_member"] = round(c["total_levels"] / members, 3) if members > 0 else 0.0
        c["l1_l3_sum"] = c["level1"] + c["level3"]

    # District-wide per-level rank maps for clubs (used for "Rank in District" blocks)
    club_value_fn = {
        "level1": lambda r: r["level1"], "level2": lambda r: r["level2"],
        "level3": lambda r: r["level3"], "level4": lambda r: r["level4"],
    }
    club_rank_maps = {
        metric: rank_dict(active_clubs, lambda r: r["club_number"], fn, lambda r: r["club_name"])
        for metric, fn in club_value_fn.items()
    }

    # Total Levels ranking uses dense ranking (1,2,2,3) with tiebreakers:
    # (1) total levels completed, (2) levels per member, (3) Level 1 + Level 3 combined.
    total_sorted = sorted(
        active_clubs,
        key=lambda r: (-r["total_levels"], -r["levels_per_member"], -r["l1_l3_sum"], r["club_name"]),
    )
    total_dense_ranks = dense_rank(
        total_sorted, lambda r: (r["total_levels"], r["levels_per_member"], r["l1_l3_sum"])
    )
    club_rank_maps["total"] = {
        r["club_number"]: rank for r, rank in zip(total_sorted, total_dense_ranks)
    }

    # Division breakdown
    divisions = {}
    for c in active_clubs:
        divisions.setdefault(c["division"], []).append(c)

    division_list = []
    for div, rows in divisions.items():
        t = totals(rows)
        areas = {}
        for c in rows:
            areas.setdefault(c["area"], []).append(c)
        area_list = []
        for area, arows in areas.items():
            at = totals(arows)
            clubs_sorted = sorted(arows, key=lambda r: (-r["total_levels"], r["club_name"]))
            area_list.append({
                "area": area,
                **at,
                "clubs": [
                    {
                        "club_number": r["club_number"],
                        "club_name": r["club_name"],
                        "level1": r["level1"],
                        "level2": r["level2"],
                        "level3": r["level3"],
                        "level4": r["level4"],
                        "total": r["total_levels"],
                        "active_members": r["active_members"],
                        "distinguished_status": r["distinguished_status"],
                        **rank_fields(club_rank_maps, r["club_number"]),
                    }
                    for r in clubs_sorted
                ],
            })
        area_list.sort(key=lambda a: (-a["total"], a["area"]))
        for i, a in enumerate(area_list, start=1):
            a["rank_in_division"] = i

        division_list.append({
            "division": div,
            **t,
            "club_count": len(rows),
            "areas": area_list,
        })
    division_list.sort(key=lambda d: (-d["total"], d["division"]))
    for i, d in enumerate(division_list, start=1):
        d["rank"] = i

    # District-wide per-level ranks for areas (across all areas in the district)
    all_areas = [a for d in division_list for a in d["areas"]]
    area_value_fn = {
        "level1": lambda a: a["level1"], "level2": lambda a: a["level2"],
        "level3": lambda a: a["level3"], "level4": lambda a: a["level4"],
        "total": lambda a: a["total"],
    }
    area_rank_maps = {
        metric: rank_dict(all_areas, lambda a: id(a), fn, lambda a: a["area"])
        for metric, fn in area_value_fn.items()
    }
    for a in all_areas:
        a.update(rank_fields(area_rank_maps, id(a)))
        a["rank_in_district"] = area_rank_maps["total"][id(a)]

    # District-wide per-level ranks for divisions
    division_value_fn = {
        "level1": lambda d: d["level1"], "level2": lambda d: d["level2"],
        "level3": lambda d: d["level3"], "level4": lambda d: d["level4"],
        "total": lambda d: d["total"],
    }
    division_rank_maps = {
        metric: rank_dict(division_list, lambda d: d["division"], fn, lambda d: d["division"])
        for metric, fn in division_value_fn.items()
    }
    for d in division_list:
        d.update(rank_fields(division_rank_maps, d["division"]))
        d["rank"] = d["rank_total"]  # keep the single "rank" field consistent with rank_total everywhere

    # Club leaderboard (district-wide) — same sort/tiebreak as club_rank_maps["total"]
    # so "rank" and "rank_total" are always the same number for a given club
    club_leaderboard_out = []
    for r in total_sorted:
        ranks = rank_fields(club_rank_maps, r["club_number"])
        club_leaderboard_out.append({
            "rank": ranks["rank_total"],
            "club_number": r["club_number"],
            "club_name": r["club_name"],
            "division": r["division"],
            "area": r["area"],
            "level1": r["level1"],
            "level2": r["level2"],
            "level3": r["level3"],
            "level4": r["level4"],
            "total": r["total_levels"],
            "active_members": r["active_members"],
            "distinguished_status": r["distinguished_status"],
            "levels_per_member": r["levels_per_member"],
            "l1_l3_sum": r["l1_l3_sum"],
            **ranks,
        })

    return {
        "meta": {
            "district_number": district_number,
            "snapshot_date": snapshot_date.isoformat(),
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "total_active_clubs": len(active_clubs),
            "total_clubs": len(clubs),
        },
        "district_totals": district_totals,
        "divisions": division_list,
        "club_leaderboard": club_leaderboard_out,
        "club_leaderboard_per_member": build_per_member_leaderboard(active_clubs),
        "pathways_award": build_award_payload(clubs, active_clubs, award_info),
        "all_clubs": clubs,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/parse_data.py <path-to-csv>")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    clubs, snapshot_date = parse_csv(csv_path)
    print(f"Parsed {len(clubs)} clubs. Snapshot date: {snapshot_date}")

    history = load_history()
    history = update_history(history, clubs, snapshot_date)
    save_history(history)

    award_info = compute_award_qualifying_dates(history, current_date=snapshot_date.isoformat())
    dashboard = build_dashboard_json(clubs, snapshot_date, award_info)

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_JSON_PATH.write_text(json.dumps(dashboard, indent=2))
    print(f"Wrote {DATA_JSON_PATH}")
    print(f"Excellence tier clubs: {len(dashboard['pathways_award']['excellence'])}")
    print(f"Star tier clubs: {len(dashboard['pathways_award']['star'])}")

    return dashboard


if __name__ == "__main__":
    main()
