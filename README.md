# District 82 Pathways Performance Dashboard

A self-hosted, read-only dashboard for the District Pathways Chair, built from the
monthly Club Performance CSV export. Live pages are static (HTML/CSS/JS) so anyone
with the link can view it, but nobody can edit the underlying data — only you can
update it, by running a script locally and pushing to GitHub.

## What's in this repo

```
data/
  latest_snapshot.csv     <- most recent raw CSV you fed in (kept for your records)
  history.json            <- accumulated snapshot history (powers Pathways Award dates)
scripts/
  parse_data.py           <- reads the CSV, writes docs/data.json, updates history.json
  generate_exports.py     <- builds every PDF/Excel breakdown into docs/exports/
  report_builder.py       <- shared PDF/Excel rendering helpers
  branding.py             <- shared brand colors
  update_dashboard.sh     <- convenience wrapper: run this each month
  requirements.txt
docs/                      <- THIS is the folder GitHub Pages publishes
  index.html, style.css, app.js
  data.json                <- generated dashboard data (do not hand-edit)
  vendor/chart.umd.js      <- self-hosted Chart.js (no external CDN dependency)
  exports/
    district/  Division-wide PDF+XLSX for the District Director
    division/  One PDF+XLSX per division, for each Division Director
    area/      One PDF+XLSX per area, for each Area Director
    club/      One PDF+XLSX per club, for each Club President
    manifest.json          <- lets the dashboard find the right file to download
```

## One-time setup

### 1. Install Python dependencies

```bash
pip install -r scripts/requirements.txt
```

(Python 3.9+ recommended. On some systems you may need `pip3` instead of `pip`.)

### 2. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Name it something like `d82-pathways-dashboard`. **Keep it Public** (required for
   free GitHub Pages, unless you have GitHub Pro/Team/Enterprise, in which case
   Private also works).
3. Don't initialize with a README (you already have one here).
4. Copy the commands GitHub shows you under "…or push an existing repository from
   the command line", or just run, from inside this project folder:

```bash
git init
git add .
git commit -m "Initial dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/d82-pathways-dashboard.git
git push -u origin main
```

### 3. Turn on GitHub Pages

1. In your repo on GitHub, go to **Settings → Pages**.
2. Under "Build and deployment" → **Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose `main` and folder **`/docs`**, then **Save**.
4. Wait ~1 minute. GitHub will show you the live URL, something like:
   `https://<your-username>.github.io/d82-pathways-dashboard/`
5. That's your permanent dashboard link — bookmark it, share it with your District
   Director, Division Directors, Area Directors, and Club Presidents.

**Nobody can edit the CSV or data through that URL.** GitHub Pages only serves
files — visitors get a read-only website. Only people with push access to your
GitHub repo (i.e. you, unless you add collaborators) can change anything.

## Updating the dashboard each month

1. Export the latest Club Performance report from the Toastmasters Dashboard as CSV
   (same format as your original upload).
2. From the project folder, run:

```bash
./scripts/update_dashboard.sh /path/to/new_export.csv
```

   This will:
   - Save a copy of the CSV into `data/latest_snapshot.csv`
   - Re-parse everything into `docs/data.json`
   - Append this snapshot to `data/history.json` (this is what lets the Pathways
     Quality Award show accurate qualifying dates over time — the more snapshots
     you feed in, the more precise the "first qualified on" dates become)
   - Regenerate all 400+ PDF/Excel breakdown files in `docs/exports/`

3. Review the changes if you like: `git status` / `git diff --stat`
4. Push the update live:

```bash
git add .
git commit -m "Update dashboard: $(date +%Y-%m-%d)"
git push
```

5. Within a minute, the live URL reflects the new data — no other action needed.

That's the entire monthly workflow: **run one script, then three git commands** (or
just re-run `update_dashboard.sh`, which prints those commands for you at the end).

## About the Pathways Quality Award dates

The Club Performance CSV is a snapshot — it doesn't include the exact date each
individual Level 1 / Level 3 was completed. To work around this without needing
Base Camp email timestamps, the dashboard tracks the date a club's Level 1 / Level 3
*counts* first crossed the Star or Excellence thresholds, based on your successive
CSV uploads (stored in `data/history.json`).

- The **first time** you run this (with your June 30 snapshot), any club already
  meeting the criteria is dated 2026-06-30 — the earliest date we actually know.
- From your **next upload onward**, dates become precise to whichever snapshot a
  club first crossed the line.
- **Keep `data/history.json` in your git repo** (it already is) — don't delete it,
  or you'll lose the accumulated qualifying-date history.
- If you want month-by-month precision from day one, you could backfill by running
  `parse_data.py` once for each past month's CSV export you may have saved, in
  chronological order, before your first live push.

This is an approximation of "date of final qualifying completion" per the award
rules — it's accurate to the month you update, which should be more than enough
precision for ranking and Ovation 2027 recognition purposes. If a tiebreaker ever
comes down to two clubs qualifying in the exact same reporting window, you'll want
to fall back to the official VP Education Base Camp confirmation email timestamps
as described in the award rules PDF.

## Definitions used in this dashboard

- **Level 1 / Level 3**: taken directly from the CSV's "Level 1s" / "Level 3s" columns.
- **Level 2** = "Level 2s" + "Add. Level 2s" columns combined.
- **Level 4+** = "Level 4s, Path Completions, or DTM Awards" + "Add. Level 4s..." combined.
- **Total Levels** = Level 1 + Level 2 + Level 3 + Level 4+ for that club/area/division/district.
- Leaderboards and the Pathways Award only include clubs with **Club Status = Active**
  in the CSV (Suspended/Ineligible clubs are excluded from rankings, but still appear
  in the raw CSV/history).

If you'd rather define "Total Levels" differently, edit the `totals()` / level
calculations in `scripts/parse_data.py` — everything downstream (dashboard, charts,
exports) recalculates from that one place.

## Customizing

- **Colors/fonts**: edit the CSS variables at the top of `docs/style.css`, and the
  `branding.py` file (used by the PDF/Excel exports) to match.
- **Award thresholds**: `STAR_L1`, `STAR_L3`, `EXCELLENCE_L1`, `EXCELLENCE_L3` at the
  top of `scripts/parse_data.py`.
- **Report content**: `scripts/generate_exports.py` builds the exact tables that go
  into each PDF/Excel — edit the `build_*_report()` functions.

## Troubleshooting

- **Dashboard shows old data after pushing**: GitHub Pages can take a minute or two
  to redeploy; also hard-refresh your browser (Ctrl/Cmd+Shift+R) since `data.json`
  is fetched fresh each load but browsers sometimes cache aggressively.
- **404 on the Pages URL**: double check Settings → Pages → Source is `main` branch,
  `/docs` folder, and that `docs/index.html` exists in the repo.
- **Script errors about "As of" date not found**: the CSV footer format changed —
  open the CSV and check the last line still reads like
  `Month of Jun, As of 06/30/2026`; adjust the regex in `parse_data.py` if the
  Toastmasters export format changes.
