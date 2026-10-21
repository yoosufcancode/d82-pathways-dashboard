# District 82 Pathways Performance Dashboard

A read-only dashboard tracking Pathways level completions across Toastmasters District 82, built from the Club Performance CSV export.

**Live dashboard:** https://yoosufcancode.github.io/d82-pathways-dashboard/

The site is static (HTML/CSS/JS on GitHub Pages). Anyone with the link can view it. Only someone with push access to this repo can change the data.

## Contents

- [Updating the dashboard](#updating-the-dashboard)
- [Backfilling missed months](#backfilling-missed-months)
- [Applying code changes](#applying-code-changes)
- [Pathways Quality Award](#pathways-quality-award)
- [How levels are counted](#how-levels-are-counted)
- [Setup on a new computer](#setup-on-a-new-computer)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Updating the dashboard

Do this each Friday, or whenever there is a new export.

1. Export **Club Performance** (not District Performance) as CSV from the Toastmasters district dashboard.
2. Save it in `data/`, named like the others with no spaces, for example `Club_Performance_20th_October_2026.csv`.
3. In **Git Bash** (not PowerShell):

```bash
cd "/d/This PC/Documents/Toastmasters/District 82 Pathways Chair 26-27/Pathways Momentum Award/Dashboard/d82-pathways-dashboard/tm-dashboard"
git pull
ls data/
./scripts/update_dashboard.sh data/Club_Performance_20th_October_2026.csv
git add .
git commit -m "Update dashboard: 2026-10-20"
git push
```

The script copies the CSV to `data/latest_snapshot.csv`, rebuilds `docs/data.json`, adds the snapshot to `data/history.json`, and regenerates every PDF and Excel report in `docs/exports/`.

A successful run ends with a line like:

```
Generated district(1) + division(9) + area(36) + club(160) reports.
```

4. Wait 5 to 7 minutes, open the live dashboard, hard refresh with **Ctrl+Shift+R**, and check that the **Snapshot as of** date matches the CSV.

## Backfilling missed months

If weekly updates were skipped, feed the missed exports in **oldest first**, then build the reports once at the end. The last file fed in becomes the data shown on the dashboard.

```bash
python3 scripts/parse_data.py data/Club_Performance_31st_July_2026.csv
python3 scripts/parse_data.py data/Club_Performance_31st_August_2026.csv
python3 scripts/parse_data.py data/Club_Performance_30th_September_2026.csv
./scripts/update_dashboard.sh data/Club_Performance_20th_October_2026.csv
git add .
git commit -m "Backfill Jul to Oct 2026"
git push
```

Each run prints `Snapshot date: ...`. Check these are in date order before pushing.

Backfilling matters for the Award: qualifying dates are taken from the snapshots in `history.json`, so a gap of several months makes every club in that gap look like it qualified on the date of the next file.

## Applying code changes

When given updated code files (design changes, fixes, new features):

**Copy only:**
- `docs/app.js`, `docs/index.html`, `docs/style.css`
- `docs/assets/`, `docs/vendor/`
- anything in `scripts/`

**Never copy these, even if included:**
- `docs/data.json`
- `docs/exports/`
- `data/history.json`

Those hold your real district data. Copying someone else's version silently replaces your numbers.

After copying, always rebuild from your latest real CSV, then push:

```bash
./scripts/update_dashboard.sh data/YOUR_LATEST_FILE.csv
git add .
git commit -m "Apply dashboard update"
git push
```

## Pathways Quality Award

### Rules (2026-27)

| Tier | Level 1 | Level 3 |
|---|---|---|
| Star | 3 or more | 2 or more |
| Excellence | 4 or more | 3 or more |

- Completions must be approved in Base Camp by **31 December 2026**.
- A club that reaches Excellence is listed only under Excellence, not also Star.
- Only clubs with Club Status = Active are included.
- The first 20 Excellence clubs are recognized at Ovation 2027. The official tiebreaker is the timestamp of the Base Camp confirmation email to the VP Education, which the dashboard does not have.

### Qualifying dates

The CSV does not record when each level was completed. The dashboard instead records the first snapshot in which a club's counts met its tier, using `data/history.json`. This date is used internally for ordering and is not shown on the dashboard or in reports.

Only snapshots from the **same program year** (1 July to 30 June) are compared. Level counts reset each July, and `history.json` keeps older years, so this stops a club from inheriting a qualifying date from a previous year.

### Provisional vs locked

Until it is locked, the Award tab is **provisional** and recalculates on every update, with a banner saying so.

Once the final 31 December 2026 export is available, lock it:

```bash
python3 scripts/build_award_snapshot.py data/YOUR_DEC31_FILE.csv
git add docs/award_data.json data/history.json
git commit -m "Lock official Pathways Quality Award result"
git push
```

This writes `docs/award_data.json`. While that file exists, the Award tab uses it and stops changing, even as regular updates continue into 2027.

- To re-lock with corrected data, run the command again with the corrected CSV.
- To return to provisional mode, delete `docs/award_data.json`, commit and push.

### Clubs close to Star

The Award tab lists the 30 active clubs nearest to Star, ranked by how few Level 1 and Level 3 completions they still need. Change the number with `CLOSE_TO_STAR_LIMIT` in `scripts/parse_data.py`.

## How levels are counted

| Dashboard label | CSV columns used |
|---|---|
| Level 1 | `Level 1s` |
| Level 2 / Online Meeting Mastery | `Level 2s` + `Add. Level 2s` (named `Level 2s or EOM` and `Add. Level 2s or EOM` from 2026-27) |
| Level 3 | `Level 3s` |
| Level 4+ / Path / DTM | `Level 4s, Path Completions, or DTM Awards` + `Add. Level 4s, Path Completions, or DTM award` |
| Total Levels | Sum of the four above |

**Level 2 / OMM:** from 2026-27, Toastmasters counts completions of the Online Meeting Mastery exploration (launched 4 August 2026) toward the same DCP goals as Level 2, and reports both as one number. The dashboard cannot separate them, so the label and a note on the dashboard and in every report say so. This does not affect the Award, which uses only Level 1 and Level 3.

**Column names:** Toastmasters sometimes renames columns between program years. Accepted names for each level are listed in `COLUMN_NAMES` at the top of `scripts/parse_data.py`. If a CSV is missing one, the script stops with an error naming the column, before changing anything. To fix it, compare headers:

```bash
head -1 data/NEW_FILE.csv
head -1 data/Club_Performance_30th_June_2026.csv
```

Then add the new name to `COLUMN_NAMES`.

### Leaderboard ranking

Rankings use **dense ranking** (1, 2, 2, 3): tied clubs share a position and the next position is not skipped.

- **Total Levels:** total levels, then levels per member, then Level 1 + Level 3.
- **Levels per Member:** levels per member, then Level 1 + Level 3.

## Setup on a new computer

Needs Git for Windows (Git Bash) and Python with `pandas`, `openpyxl` and `reportlab`.

**1. Make `python3` work in Git Bash.** On Windows, `python3` usually opens a Microsoft Store placeholder instead of Python. Point it at the Python launcher, once:

```bash
echo 'python3() { py "$@"; }; export -f python3' >> ~/.bashrc
```

Close and reopen Git Bash, then check:

```bash
python3 --version
python3 -c "import pandas, openpyxl, reportlab; print('libraries OK')"
```

**2. Install the libraries** if that check fails:

```bash
python3 -m pip install -r scripts/requirements.txt
```

**3. Get the repo:**

```bash
git clone https://github.com/yoosufcancode/d82-pathways-dashboard.git
```

GitHub Pages is already set up: **Settings > Pages**, deploy from branch `main`, folder `/docs`.

## Project structure

```
data/
  Club_Performance_*.csv    raw exports, kept for records and backfilling
  latest_snapshot.csv       copy of the most recent export
  history.json              every snapshot fed in; drives Award qualifying dates
scripts/
  update_dashboard.sh       the regular update: parse + build reports
  parse_data.py             CSV to docs/data.json, updates history.json
  generate_exports.py       builds all PDF/Excel reports (wipes and rebuilds docs/exports/)
  build_award_snapshot.py   locks the Award tab from the final cutoff CSV
  report_builder.py         shared PDF/Excel layout
  branding.py               brand colours and level labels for reports
  requirements.txt
docs/                       published by GitHub Pages
  index.html, app.js, style.css
  data.json                 generated; do not edit by hand
  award_data.json           only exists once the Award is locked
  .nojekyll                 must stay; skips slow Jekyll processing
  assets/                   Pathways logo files
  vendor/                   Chart.js and SheetJS, self-hosted
  exports/
    district/ division/ area/ club/   one PDF and one Excel per unit
    manifest.json           lets the Downloads tab find each file
```

## Troubleshooting

**`Python was not found; run without arguments to install from the Microsoft Store`**
`python3` is not set up in this window. See [Setup on a new computer](#setup-on-a-new-computer), step 1.

**`ModuleNotFoundError: No module named 'reportlab'`**
`python3` is pointing at a Python without the libraries (for example Anaconda). Run `python3 --version` and compare with the Python that passed the libraries check. Then run `python3 scripts/generate_exports.py` again, commit and push. The website itself updates even when this step fails, but the downloadable reports do not.

**`STOPPED: ... is missing expected column(s)`**
Toastmasters renamed a column. See [How levels are counted](#how-levels-are-counted).

**`Could not find 'As of MM/DD/YYYY' snapshot date`**
The CSV footer format changed, or the file is not a Club Performance export. The last line should read like `Month of Jun, As of 06/30/2026`.

**A level shows 0 for the whole district**
Almost always a renamed column in an older version of `parse_data.py`. Compare CSV headers as above.

**Dashboard still shows old data after pushing**
GitHub Pages usually takes 5 to 7 minutes. Hard refresh with Ctrl+Shift+R. If the Actions log says "Deployment failed, try again later", that is a GitHub-side issue; retry with:

```bash
git commit --allow-empty -m "Retry deploy"
git push
```

**`! [rejected] ... (fetch first)` on push**
Run `git pull`, then `git push` again.

**Every PDF shows as changed in `git status`**
Expected. Each PDF stores the time it was created, so rebuilt files always differ even when the data is the same.

**404 on the dashboard link**
Check **Settings > Pages**: branch `main`, folder `/docs`, and that `docs/index.html` exists.
