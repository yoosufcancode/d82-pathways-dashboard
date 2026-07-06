const LEVEL_COLORS = {
  level1: '#004165',
  level2: '#A9B2B1',
  level3: '#772432',
  level4: '#C9A227',
};

const DIVISION_COLORS = {
  A: '#004165', B: '#772432', C: '#C9A227', D: '#12776F',
  E: '#8E44AD', F: '#D9622B', G: '#2E7D32', H: '#C2185B', I: '#42586B',
};
function divColor(div) { return DIVISION_COLORS[div] || '#004165'; }

const DCP_STATUS_LABELS = {
  D: 'Distinguished',
  S: 'Select Distinguished',
  P: "President's Distinguished",
  M: 'Smedley Distinguished',
};
function dcpBadgeHTML(status) {
  const code = (status || '').trim().toUpperCase();
  if (!code || !DCP_STATUS_LABELS[code]) return '';
  return `<span class="dcp-badge dcp-${code}" title="${DCP_STATUS_LABELS[code]}">${code}</span>`;
}

function rankBadgeClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'plain';
}

/* ---------------- ANIMATION HELPERS ---------------- */
function animateNumber(el, target, duration = 850) {
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    el.textContent = Math.round(target * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(tick);
}

function positionTabIndicator(activeBtn) {
  const indicator = document.getElementById('tab-indicator');
  if (!indicator || !activeBtn) return;
  const tabsRect = activeBtn.parentElement.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  indicator.style.width = btnRect.width + 'px';
  indicator.style.left = (btnRect.left - tabsRect.left + activeBtn.parentElement.scrollLeft) + 'px';
}

let DATA = null;
let MANIFEST = null;
let AWARD_DATA = null;   // locked award_data.json, if present
let AWARD_IS_LOCKED = false;

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

async function loadData() {
  const [dataRes, manifestRes] = await Promise.all([
    fetch('data.json', { cache: 'no-store' }),
    fetch('exports/manifest.json', { cache: 'no-store' }),
  ]);
  DATA = await dataRes.json();
  MANIFEST = await manifestRes.json();

  try {
    const awardRes = await fetch('award_data.json', { cache: 'no-store' });
    if (awardRes.ok) {
      AWARD_DATA = await awardRes.json();
      AWARD_IS_LOCKED = true;
    }
  } catch (e) {
    AWARD_DATA = null;
    AWARD_IS_LOCKED = false;
  }
}

function currentAward() {
  return AWARD_IS_LOCKED ? AWARD_DATA : DATA.pathways_award;
}

function stackBarHTML(obj, heightClass) {
  const total = obj.total || 1;
  const segs = ['level1', 'level2', 'level3', 'level4'].map(k => {
    const pct = (obj[k] / total) * 100;
    return `<span style="width:${pct}%;background:${LEVEL_COLORS[k]}" title="${k}: ${obj[k]}"></span>`;
  }).join('');
  return `<div class="${heightClass}">${segs}</div>`;
}

/* ---------------- OVERVIEW ---------------- */
function renderOverview() {
  const dt = DATA.district_totals;
  const meta = DATA.meta;

  const note = document.getElementById('district-summary-note');
  note.textContent = `As of ${fmtDate(meta.snapshot_date)}, District ${meta.district_number}'s ` +
    `${meta.total_active_clubs.toLocaleString()} active clubs (of ${meta.total_clubs.toLocaleString()} chartered) ` +
    `across ${DATA.divisions.length} divisions have completed ${dt.total.toLocaleString()} Pathways levels.`;

  const statsRow = document.getElementById('district-summary-stats');
  statsRow.innerHTML = `
    <div class="mini-stat"><div class="mini-stat-label">Active Clubs</div><div class="mini-stat-value">${meta.total_active_clubs.toLocaleString()}</div></div>
    <div class="mini-stat"><div class="mini-stat-label">Chartered Clubs</div><div class="mini-stat-value">${meta.total_clubs.toLocaleString()}</div></div>
    <div class="mini-stat"><div class="mini-stat-label">Divisions</div><div class="mini-stat-value">${DATA.divisions.length}</div></div>
    <div class="mini-stat"><div class="mini-stat-label">Snapshot Date</div><div class="mini-stat-value">${fmtDate(meta.snapshot_date)}</div></div>
  `;

  const kpiRow = document.getElementById('kpi-row');
  kpiRow.innerHTML = `
    <div class="kpi l1"><div class="kpi-label">Level 1</div><div class="kpi-value" data-target="${dt.level1}">0</div></div>
    <div class="kpi l2"><div class="kpi-label">Level 2</div><div class="kpi-value" data-target="${dt.level2}">0</div></div>
    <div class="kpi l3"><div class="kpi-label">Level 3</div><div class="kpi-value" data-target="${dt.level3}">0</div></div>
    <div class="kpi l4"><div class="kpi-label">Level 4+ / Path / DTM</div><div class="kpi-value" data-target="${dt.level4}">0</div></div>
    <div class="kpi total"><div class="kpi-label">Total Levels</div><div class="kpi-value" data-target="${dt.total}">0</div></div>
  `;
  kpiRow.querySelectorAll('.kpi-value').forEach((el, i) => {
    setTimeout(() => animateNumber(el, parseInt(el.dataset.target, 10)), i * 60);
  });

  new Chart(document.getElementById('chart-district-levels'), {
    type: 'doughnut',
    data: {
      labels: ['Level 1', 'Level 2', 'Level 3', 'Level 4+/Path/DTM'],
      datasets: [{
        data: [dt.level1, dt.level2, dt.level3, dt.level4],
        backgroundColor: [LEVEL_COLORS.level1, LEVEL_COLORS.level2, LEVEL_COLORS.level3, LEVEL_COLORS.level4],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Source Sans 3' } } } },
    },
  });

  const divs = DATA.divisions;
  new Chart(document.getElementById('chart-division-leaderboard'), {
    type: 'bar',
    data: {
      labels: divs.map(d => 'Div ' + d.division),
      datasets: [
        { label: 'Level 1', data: divs.map(d => d.level1), backgroundColor: LEVEL_COLORS.level1, stack: 's' },
        { label: 'Level 2', data: divs.map(d => d.level2), backgroundColor: LEVEL_COLORS.level2, stack: 's' },
        { label: 'Level 3', data: divs.map(d => d.level3), backgroundColor: LEVEL_COLORS.level3, stack: 's' },
        { label: 'Level 4+', data: divs.map(d => d.level4), backgroundColor: LEVEL_COLORS.level4, stack: 's' },
      ],
    },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      scales: { x: { stacked: true }, y: { stacked: true } },
      plugins: { legend: { display: false } },
    },
  });
}

/* ---------------- DIVISIONS ---------------- */
function renderDivisions() {
  const container = document.getElementById('division-accordion');
  container.innerHTML = DATA.divisions.map(d => `
    <div class="div-row" data-div="${d.division}">
      <div class="div-row-head">
        <div class="div-rank">${d.rank}</div>
        <div class="div-name">Division ${d.division} <span class="club-sub">(${d.club_count} clubs)</span></div>
        <div class="div-metric">L1 <b>${d.level1}</b></div>
        <div class="div-metric">L2 <b>${d.level2}</b></div>
        <div class="div-metric">L3 <b>${d.level3}</b></div>
        <div class="div-metric">L4+ <b>${d.level4}</b></div>
        <div class="div-metric">Total <b>${d.total}</b></div>
      </div>
      <div class="div-row-body">
        <div class="div-row-body-inner">
        ${d.areas.map(a => `
          <div style="margin-bottom:14px;">
            <strong style="font-family:'Montserrat',sans-serif;font-size:13px;color:var(--tm-blue)">
              #${a.rank_in_division} Area ${a.area}
            </strong>
            <span class="club-sub">Total ${a.total} &middot; L1 ${a.level1} &middot; L2 ${a.level2} &middot; L3 ${a.level3} &middot; L4+ ${a.level4}</span>
            ${stackBarHTML(a, 'stackbar')}
            <div class="table-scroll">
            <table class="rank-table" style="margin-top:6px;">
              <tbody>
              ${a.clubs.map((c, i) => `
                <tr>
                  <td class="rank-num">${i + 1}</td>
                  <td>${c.club_name}</td>
                  <td>${c.level1}</td><td>${c.level2}</td><td>${c.level3}</td><td>${c.level4}</td>
                  <td><b>${c.total}</b></td>
                </tr>
              `).join('')}
              </tbody>
            </table>
            </div>
          </div>
        `).join('')}
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.div-row-head').forEach(head => {
    head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
  });
}

/* ---------------- AREAS ---------------- */
function renderAreas() {
  const filter = document.getElementById('area-division-filter');
  filter.innerHTML = '<option value="__all__">All Divisions</option>' +
    DATA.divisions.map(d => `<option value="${d.division}">Division ${d.division}</option>`).join('');
  filter.onchange = () => paintAreas(filter.value);
  paintAreas('__all__');
  const content = document.getElementById('areas-content');
  content.addEventListener('click', (e) => {
    const row = e.target.closest('.area-row-toggle');
    if (!row) return;
    row.classList.toggle('open');
  });
}

function clubDetailRowsHTML(clubs) {
  return clubs.map(c => `
    <tr>
      <td class="rank-num">${c.rank_total}</td>
      <td>
        ${c.club_name}
        ${dcpBadgeHTML(c.distinguished_status)}
        <span class="club-sub">${c.active_members} active members</span>
      </td>
      <td>${c.level1}</td><td>${c.level2}</td><td>${c.level3}</td><td>${c.level4}</td>
      <td><b>${c.total}</b></td>
    </tr>
  `).join('');
}

function paintAreas(divFilter) {
  const content = document.getElementById('areas-content');
  const divs = divFilter === '__all__' ? DATA.divisions : DATA.divisions.filter(d => d.division === divFilter);
  content.innerHTML = divs.map(d => `
    <div class="area-group-title">Division ${d.division}</div>
    <div class="table-scroll">
    <table class="rank-table area-rank-table">
      <thead>
        <tr>
          <th></th><th>Position</th><th>Area</th><th>Level 1</th><th>Level 2</th><th>Level 3</th><th>Level 4+</th>
          <th>Total</th><th class="col-hide-mobile">Composition</th><th class="col-hide-mobile">Clubs</th>
        </tr>
      </thead>
      <tbody>
        ${d.areas.map(a => `
          <tr class="area-row-toggle" data-area="${d.division}-${a.area}">
            <td><span class="chevron-icon">&#9656;</span></td>
            <td class="rank-num">${a.rank_in_division}</td>
            <td><b>Area ${a.area}</b> <span class="club-sub">district position #${a.rank_in_district}</span></td>
            <td>${a.level1}</td><td>${a.level2}</td><td>${a.level3}</td><td>${a.level4}</td>
            <td><b>${a.total}</b></td>
            <td class="col-hide-mobile">${stackBarHTML(a, 'stackbar')}</td>
            <td class="col-hide-mobile">${a.clubs.length}</td>
          </tr>
          <tr class="area-detail-row">
            <td colspan="10">
              <div class="area-detail-inner">
                <div class="area-detail-inner-content">
                  <div class="table-scroll">
                  <table class="rank-table area-club-table">
                    <thead>
                      <tr><th>Position</th><th>Club</th><th>Level 1</th><th>Level 2</th><th>Level 3</th><th>Level 4+</th><th>Total</th></tr>
                    </thead>
                    <tbody>${clubDetailRowsHTML(a.clubs)}</tbody>
                  </table>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `).join('');
}

/* ---------------- CLUBS ---------------- */
let clubLeaderboardMode = 'total';

function renderClubs() {
  paintClubs('');
  document.getElementById('club-search').oninput = (e) => paintClubs(e.target.value.toLowerCase());
  const container = document.getElementById('club-leaderboard');
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('.club-name-toggle');
    if (!toggle) return;
    toggle.closest('.club-row').classList.toggle('expanded');
  });

  const subtitle = document.getElementById('club-lb-subtitle');
  document.querySelectorAll('.club-lb-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.club-lb-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      clubLeaderboardMode = btn.dataset.mode;
      subtitle.textContent = clubLeaderboardMode === 'total'
        ? "District-wide performance, measured by total levels completed · click a club name for its full breakdown"
        : "District-wide performance, measured by levels completed per active member · click a club name for its full breakdown";
      paintClubs(document.getElementById('club-search').value.toLowerCase());
    });
  });
}

function paintClubs(query) {
  const container = document.getElementById('club-leaderboard');
  const source = clubLeaderboardMode === 'total' ? DATA.club_leaderboard : DATA.club_leaderboard_per_member;
  const rows = source.filter(c => c.club_name.toLowerCase().includes(query));

  if (clubLeaderboardMode === 'total') {
    const maxTotal = DATA.club_leaderboard[0]?.total || 1;
    container.innerHTML = rows.map(c => {
      const widthPct = Math.max((c.total / maxTotal) * 100, 6);
      const dcpLabel = DCP_STATUS_LABELS[(c.distinguished_status || '').trim().toUpperCase()] || 'Not yet Distinguished';
      return `
      <div class="club-row" data-club="${c.club_number}">
        <div class="rank-badge ${rankBadgeClass(c.rank)}">${c.rank}</div>
        <div>
          <div class="club-name-line">
            <span class="club-name club-name-toggle">${c.club_name}</span>
            ${dcpBadgeHTML(c.distinguished_status)}
          </div>
          <div class="club-sub">
            <span class="div-chip" style="background:${divColor(c.division)}">Div ${c.division}</span>
            Area ${c.area} &middot; ${c.active_members} active members
          </div>
          <div class="club-detail">
            <div class="club-detail-inner">
              <span><i style="background:${LEVEL_COLORS.level1}"></i>Level 1 <b>${c.level1}</b> <em>(district position #${c.rank_l1})</em></span>
              <span><i style="background:${LEVEL_COLORS.level2}"></i>Level 2 <b>${c.level2}</b> <em>(district position #${c.rank_l2})</em></span>
              <span><i style="background:${LEVEL_COLORS.level3}"></i>Level 3 <b>${c.level3}</b> <em>(district position #${c.rank_l3})</em></span>
              <span><i style="background:${LEVEL_COLORS.level4}"></i>Level 4+/Path/DTM <b>${c.level4}</b> <em>(district position #${c.rank_l4})</em></span>
              <span class="club-detail-dcp">DCP status: <b>${dcpLabel}</b></span>
              <span class="club-detail-tiebreak">Tiebreakers &mdash; levels per member: <b>${c.levels_per_member}</b>, L1+L3 combined: <b>${c.l1_l3_sum}</b></span>
            </div>
          </div>
        </div>
        <div class="club-total">${c.total}</div>
        <div class="club-bar-wrap" style="width:${widthPct}%;min-width:70px;">
          ${['level1', 'level2', 'level3', 'level4'].map(k =>
            `<span style="width:${(c[k] / (c.total || 1)) * 100}%;background:${LEVEL_COLORS[k]}" title="${k}: ${c[k]}"></span>`
          ).join('')}
        </div>
      </div>`;
    }).join('') || '<p class="dl-empty">No clubs match your search.</p>';
    return;
  }

  // Levels per Member mode
  const maxRatio = DATA.club_leaderboard_per_member[0]?.levels_per_member || 1;
  container.innerHTML = rows.map(c => {
    const widthPct = Math.max((c.levels_per_member / (maxRatio || 1)) * 100, 6);
    const dcpLabel = DCP_STATUS_LABELS[(c.distinguished_status || '').trim().toUpperCase()] || 'Not yet Distinguished';
    return `
    <div class="club-row" data-club="${c.club_number}">
      <div class="rank-badge ${rankBadgeClass(c.rank)}">${c.rank}</div>
      <div>
        <div class="club-name-line">
          <span class="club-name club-name-toggle">${c.club_name}</span>
          ${dcpBadgeHTML(c.distinguished_status)}
        </div>
        <div class="club-sub">
          <span class="div-chip" style="background:${divColor(c.division)}">Div ${c.division}</span>
          Area ${c.area} &middot; ${c.active_members} active members
        </div>
        <div class="club-detail">
          <div class="club-detail-inner">
            <span><b>${c.levels_per_member}</b> levels per member &mdash; ${c.total} total levels &divide; ${c.active_members} active members</span>
            <span>Tiebreaker &mdash; Level 1 + Level 3 combined: <b>${c.l1_l3_sum}</b> (L1 ${c.level1} + L3 ${c.level3})</span>
            <span><i style="background:${LEVEL_COLORS.level1}"></i>Level 1 <b>${c.level1}</b></span>
            <span><i style="background:${LEVEL_COLORS.level2}"></i>Level 2 <b>${c.level2}</b></span>
            <span><i style="background:${LEVEL_COLORS.level3}"></i>Level 3 <b>${c.level3}</b></span>
            <span><i style="background:${LEVEL_COLORS.level4}"></i>Level 4+/Path/DTM <b>${c.level4}</b></span>
            <span class="club-detail-dcp">DCP status: <b>${dcpLabel}</b></span>
          </div>
        </div>
      </div>
      <div class="club-total">${c.levels_per_member}</div>
      <div class="club-bar-wrap" style="width:${widthPct}%;min-width:70px;">
        <span style="width:100%;background:${LEVEL_COLORS.level1}"></span>
      </div>
    </div>`;
  }).join('') || '<p class="dl-empty">No clubs match your search.</p>';
}

/* ---------------- PATHWAYS AWARD ---------------- */
function renderAward() {
  const award = currentAward();
  const exc = award.excellence;
  const star = award.star;
  const close = award.close_to_star || [];

  document.getElementById('excellence-count').textContent = `${exc.length} club${exc.length !== 1 ? 's' : ''}`;
  document.getElementById('star-count').textContent = `${star.length} club${star.length !== 1 ? 's' : ''}`;

  // Disclaimer banner — differs depending on whether results are locked/official
  const banner = document.getElementById('award-disclaimer');
  if (AWARD_IS_LOCKED) {
    banner.className = 'award-banner award-banner-locked';
    banner.innerHTML = `
      <strong>Official result — locked as of ${fmtDate(AWARD_DATA.cutoff_snapshot_date)}.</strong>
      This reflects completions recorded through the Dec 31, 2026 award cutoff, reviewed by the
      District Pathways Chair and District Awards Chair. Ovation 2027 recognition is announced
      separately by the District.
    `;
  } else {
    banner.className = 'award-banner award-banner-provisional';
    banner.innerHTML = `
      <strong>Provisional — for planning purposes only.</strong>
      This tab currently shows clubs that qualify based on completions recorded as of
      <b>${fmtDate(DATA.meta.snapshot_date)}</b>, not the official Dec&nbsp;31, 2026 award cutoff.
      It's meant to help clubs gauge their potential standing, not to confirm results.
      This tab does <b>not</b> show which clubs will be recognized at Ovation 2027 &mdash; that will be
      published on this same tab after formal review by the District Pathways Chair and District
      Awards Chair, on or after <b>January 15, 2027</b>.
    `;
  }

  const renderList = (list, tier) => list.map(e => `
    <div class="award-row">
      <div class="award-badge ${tier}">${e.rank}</div>
      <div>
        <div class="club-name">${e.club_name}</div>
        <div class="club-sub">
          <span class="div-chip" style="background:${divColor(e.division)}">Div ${e.division}</span>
          Area ${e.area} &middot; L1 ${e.level1} / L3 ${e.level3}
        </div>
      </div>
    </div>
  `).join('') || '<p class="dl-empty">No clubs have qualified yet.</p>';

  document.getElementById('award-excellence').innerHTML = renderList(exc, 'excellence');
  document.getElementById('award-star').innerHTML = renderList(star, 'star');

  const closeSection = document.getElementById('award-close-section');
  if (close.length === 0) {
    closeSection.innerHTML = '';
  } else {
    closeSection.innerHTML = `
      <div class="card">
        <h2>Clubs Close to Star <span class="card-sub">${close.length} clubs nearest to qualifying — a head start list, not a guarantee</span></h2>
        <div class="table-scroll">
        <table class="rank-table">
          <thead><tr><th>Position</th><th>Club</th><th>Div-Area</th><th>Level 1</th><th>Level 3</th><th>Still Needs</th></tr></thead>
          <tbody>
            ${close.map(c => `
              <tr>
                <td class="rank-num">${c.rank}</td>
                <td>${c.club_name}</td>
                <td><span class="div-chip" style="background:${divColor(c.division)}">Div ${c.division}</span> Area ${c.area}</td>
                <td>${c.level1}</td>
                <td>${c.level3}</td>
                <td>${[c.need_l1 ? `${c.need_l1} more L1` : null, c.need_l3 ? `${c.need_l3} more L3` : null].filter(Boolean).join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }
}

/* ---------------- DOWNLOADS ---------------- */
let currentRole = 'district';

function renderDownloads() {
  document.querySelectorAll('.role-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.dataset.role;
      closePreview();
      paintDownloadPicker();
    });
  });

  const links = document.getElementById('download-links');
  links.addEventListener('click', (e) => {
    const btn = e.target.closest('.preview-btn');
    if (!btn) return;
    showPreview(btn.dataset.previewType, btn.dataset.previewPath);
  });

  document.getElementById('preview-pane').addEventListener('click', (e) => {
    if (e.target.closest('#preview-close')) closePreview();
  });

  paintDownloadPicker();
}

function downloadButtons(baseName, folder) {
  const pdfPath = `exports/${folder}/${baseName}.pdf`;
  const xlsxPath = `exports/${folder}/${baseName}.xlsx`;
  return `
    <a class="dl-btn pdf" href="${pdfPath}" download>&#8681; Download PDF</a>
    <button class="dl-btn preview-btn" data-preview-type="pdf" data-preview-path="${pdfPath}">&#128065; Preview PDF</button>
    <a class="dl-btn xlsx" href="${xlsxPath}" download>&#8681; Download Excel</a>
    <button class="dl-btn preview-btn" data-preview-type="xlsx" data-preview-path="${xlsxPath}">&#128065; Preview Excel</button>
  `;
}

async function showPreview(type, path) {
  const pane = document.getElementById('preview-pane');
  pane.classList.add('open');

  if (type === 'pdf') {
    pane.innerHTML = `
      <div class="preview-pane-head">
        <span>Preview &mdash; ${path.split('/').pop()}</span>
        <button class="preview-close" id="preview-close">&times; Close preview</button>
      </div>
      <iframe class="preview-frame" src="${path}"></iframe>
    `;
  } else {
    pane.innerHTML = `
      <div class="preview-pane-head">
        <span>Preview &mdash; ${path.split('/').pop()}</span>
        <button class="preview-close" id="preview-close">&times; Close preview</button>
      </div>
      <div class="preview-loading">Loading spreadsheet preview&hellip;</div>
    `;
    try {
      const res = await fetch(path);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetTabs = wb.SheetNames.map((name, i) =>
        `<button class="preview-sheet-tab ${i === 0 ? 'active' : ''}" data-sheet="${name}">${name}</button>`
      ).join('');
      const firstSheetHTML = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]], { id: 'preview-xlsx-table' });
      pane.innerHTML = `
        <div class="preview-pane-head">
          <span>Preview &mdash; ${path.split('/').pop()}</span>
          <button class="preview-close" id="preview-close">&times; Close preview</button>
        </div>
        ${wb.SheetNames.length > 1 ? `<div class="preview-sheet-tabs">${sheetTabs}</div>` : ''}
        <div class="preview-xlsx-wrap">${firstSheetHTML}</div>
      `;
      pane.querySelectorAll('.preview-sheet-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          pane.querySelectorAll('.preview-sheet-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const html = XLSX.utils.sheet_to_html(wb.Sheets[tab.dataset.sheet], { id: 'preview-xlsx-table' });
          pane.querySelector('.preview-xlsx-wrap').innerHTML = html;
        });
      });
    } catch (err) {
      pane.querySelector('.preview-loading')?.replaceWith(
        Object.assign(document.createElement('p'), { className: 'dl-empty', textContent: 'Could not load preview for this file.' })
      );
    }
  }

  pane.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closePreview() {
  const pane = document.getElementById('preview-pane');
  pane.classList.remove('open');
  pane.innerHTML = '';
}

function paintDownloadPicker() {
  const picker = document.getElementById('download-picker');
  const links = document.getElementById('download-links');

  if (currentRole === 'district') {
    picker.innerHTML = `<p class="dl-empty">One district-wide report covering all divisions, areas, and clubs.</p>`;
    links.innerHTML = downloadButtons(MANIFEST.district[0], 'district');
    return;
  }

  if (currentRole === 'division') {
    picker.innerHTML = `<select id="pick-division" class="select">
      ${DATA.divisions.map(d => `<option value="${d.division}">Division ${d.division}</option>`).join('')}
    </select>`;
    const sel = document.getElementById('pick-division');
    const update = () => {
      closePreview();
      links.innerHTML = downloadButtons(MANIFEST.divisions[sel.value], 'division');
    };
    sel.onchange = update;
    update();
    return;
  }

  if (currentRole === 'area') {
    picker.innerHTML = `
      <select id="pick-area-division" class="select">
        ${DATA.divisions.map(d => `<option value="${d.division}">Division ${d.division}</option>`).join('')}
      </select>
      <select id="pick-area" class="select"></select>
    `;
    const divSel = document.getElementById('pick-area-division');
    const areaSel = document.getElementById('pick-area');
    const fillAreas = () => {
      const div = DATA.divisions.find(d => d.division === divSel.value);
      areaSel.innerHTML = div.areas
        .slice().sort((a, b) => a.area.localeCompare(b.area))
        .map(a => `<option value="${a.area}">Area ${a.area}</option>`).join('');
      updateLinks();
    };
    const updateLinks = () => {
      closePreview();
      const key = `${divSel.value}-${areaSel.value}`;
      links.innerHTML = downloadButtons(MANIFEST.areas[key], 'area');
    };
    divSel.onchange = fillAreas;
    areaSel.onchange = updateLinks;
    fillAreas();
    return;
  }

  if (currentRole === 'club') {
    picker.innerHTML = `<input type="search" id="pick-club" class="select" style="width:100%;max-width:320px;" placeholder="Type a club name&hellip;">
      <div id="pick-club-results" style="margin-top:8px;max-height:220px;overflow:auto;"></div>`;
    const input = document.getElementById('pick-club');
    const results = document.getElementById('pick-club-results');
    const paint = (q) => {
      const matches = DATA.club_leaderboard.filter(c => c.club_name.toLowerCase().includes(q.toLowerCase())).slice(0, 15);
      results.innerHTML = matches.map(c => `
        <div class="club-row" style="grid-template-columns:1fr;cursor:pointer;" data-club="${c.club_number}">
          <div class="club-name">${c.club_name} <span class="club-sub">Div ${c.division}-${c.area}</span></div>
        </div>`).join('');
      results.querySelectorAll('[data-club]').forEach(row => {
        row.addEventListener('click', () => {
          closePreview();
          const info = MANIFEST.clubs[row.dataset.club];
          links.innerHTML = downloadButtons(info.slug, 'club');
        });
      });
    };
    input.oninput = (e) => paint(e.target.value);
    paint('');
    links.innerHTML = '<p class="dl-empty">Search and select a club above.</p>';
    return;
  }
}

/* ---------------- TAB SWITCHING ---------------- */
const PANEL_RENDERERS = {
  overview: renderOverview,
  divisions: renderDivisions,
  areas: renderAreas,
  clubs: renderClubs,
  award: renderAward,
  downloads: renderDownloads,
};

function showTab(tab) {
  const activeBtn = document.querySelector(`.tab[data-tab="${tab}"]`);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  positionTabIndicator(activeBtn);
  const app = document.getElementById('app');
  const tpl = document.getElementById('tpl-' + tab);
  app.innerHTML = '';
  app.appendChild(tpl.content.cloneNode(true));
  PANEL_RENDERERS[tab]();
}

async function init() {
  await loadData();
  document.getElementById('snapshot-date').textContent = fmtDate(DATA.meta.snapshot_date);
  document.getElementById('generated-date').textContent = fmtDateTime(DATA.meta.generated_at);
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) showTab(btn.dataset.tab);
  });
  window.addEventListener('resize', () => {
    positionTabIndicator(document.querySelector('.tab.active'));
  });
  showTab('overview');
}

init();
