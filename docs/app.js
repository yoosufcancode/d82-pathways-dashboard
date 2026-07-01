const LEVEL_COLORS = {
  level1: '#004165',
  level2: '#A9B2B1',
  level3: '#772432',
  level4: '#C9A227',
};

let DATA = null;
let MANIFEST = null;

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
  const kpiRow = document.getElementById('kpi-row');
  kpiRow.innerHTML = `
    <div class="kpi l1"><div class="kpi-label">Level 1</div><div class="kpi-value">${dt.level1}</div></div>
    <div class="kpi l2"><div class="kpi-label">Level 2</div><div class="kpi-value">${dt.level2}</div></div>
    <div class="kpi l3"><div class="kpi-label">Level 3</div><div class="kpi-value">${dt.level3}</div></div>
    <div class="kpi l4"><div class="kpi-label">Level 4+ / Path / DTM</div><div class="kpi-value">${dt.level4}</div></div>
    <div class="kpi total"><div class="kpi-label">Total Levels</div><div class="kpi-value">${dt.total}</div></div>
  `;

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
        ${d.areas.map(a => `
          <div style="margin-bottom:14px;">
            <strong style="font-family:'Montserrat',sans-serif;font-size:13px;color:var(--tm-blue)">
              #${a.rank_in_division} Area ${a.area}
            </strong>
            <span class="club-sub">Total ${a.total} &middot; L1 ${a.level1} &middot; L2 ${a.level2} &middot; L3 ${a.level3} &middot; L4+ ${a.level4}</span>
            ${stackBarHTML(a, 'stackbar')}
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
        `).join('')}
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
}

function paintAreas(divFilter) {
  const content = document.getElementById('areas-content');
  const divs = divFilter === '__all__' ? DATA.divisions : DATA.divisions.filter(d => d.division === divFilter);
  content.innerHTML = divs.map(d => `
    <div class="area-group-title">Division ${d.division}</div>
    <table class="rank-table">
      <thead><tr><th>Rank</th><th>Area</th><th>Level 1</th><th>Level 2</th><th>Level 3</th><th>Level 4+</th><th>Total</th><th>Clubs</th></tr></thead>
      <tbody>
        ${d.areas.map(a => `
          <tr>
            <td class="rank-num">${a.rank_in_division}</td>
            <td>Area ${a.area}</td>
            <td>${a.level1}</td><td>${a.level2}</td><td>${a.level3}</td><td>${a.level4}</td>
            <td><b>${a.total}</b></td><td>${a.clubs.length}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `).join('');
}

/* ---------------- CLUBS ---------------- */
function renderClubs() {
  paintClubs('');
  document.getElementById('club-search').oninput = (e) => paintClubs(e.target.value.toLowerCase());
}

function paintClubs(query) {
  const container = document.getElementById('club-leaderboard');
  const maxTotal = DATA.club_leaderboard[0]?.total || 1;
  const rows = DATA.club_leaderboard.filter(c => c.club_name.toLowerCase().includes(query));
  container.innerHTML = rows.map(c => {
    const widthPct = Math.max((c.total / maxTotal) * 100, 4);
    return `
    <div class="club-row">
      <div class="rank-num">${c.rank}</div>
      <div>
        <div class="club-name">${c.club_name}</div>
        <div class="club-sub">Div ${c.division} &middot; Area ${c.area} &middot; ${c.active_members} active members</div>
      </div>
      <div class="club-total">${c.total}</div>
      <div class="club-bar-wrap" style="width:${widthPct}%;min-width:60px;">
        ${['level1', 'level2', 'level3', 'level4'].map(k =>
          `<span style="width:${(c[k] / (c.total || 1)) * 100}%;background:${LEVEL_COLORS[k]}" title="${k}: ${c[k]}"></span>`
        ).join('')}
      </div>
    </div>`;
  }).join('') || '<p class="dl-empty">No clubs match your search.</p>';
}

/* ---------------- PATHWAYS AWARD ---------------- */
function renderAward() {
  const exc = DATA.pathways_award.excellence;
  const star = DATA.pathways_award.star;
  document.getElementById('excellence-count').textContent = `${exc.length} club${exc.length !== 1 ? 's' : ''}`;
  document.getElementById('star-count').textContent = `${star.length} club${star.length !== 1 ? 's' : ''}`;

  const renderList = (list, tier) => list.map(e => `
    <div class="award-row">
      <div class="award-badge ${tier}">${e.rank}</div>
      <div>
        <div class="club-name">${e.club_name}</div>
        <div class="club-sub">Div ${e.division} &middot; Area ${e.area} &middot; L1 ${e.level1} / L3 ${e.level3}
          ${e.ovation_recognized ? '<span class="award-ovation">Ovation 2027</span>' : ''}
        </div>
      </div>
      <div></div>
      <div class="award-date">Qualified<br><b>${fmtDate(e.qualifying_date)}</b></div>
    </div>
  `).join('') || '<p class="dl-empty">No clubs have qualified yet.</p>';

  document.getElementById('award-excellence').innerHTML = renderList(exc, 'excellence');
  document.getElementById('award-star').innerHTML = renderList(star, 'star');
}

/* ---------------- DOWNLOADS ---------------- */
let currentRole = 'district';

function renderDownloads() {
  document.querySelectorAll('.role-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.dataset.role;
      paintDownloadPicker();
    });
  });
  paintDownloadPicker();
}

function downloadButtons(baseName, folder) {
  return `
    <a class="dl-btn pdf" href="exports/${folder}/${baseName}.pdf" download>&#8681; PDF</a>
    <a class="dl-btn xlsx" href="exports/${folder}/${baseName}.xlsx" download>&#8681; Excel</a>
  `;
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
      const key = `${divSel.value}-${areaSel.value}`;
      links.innerHTML = downloadButtons(MANIFEST.areas[key], 'area');
    };
    divSel.onchange = fillAreas;
    areaSel.onchange = updateLinks;
    fillAreas();
    return;
  }

  if (currentRole === 'club') {
    picker.innerHTML = `<input type="search" id="pick-club" class="select" style="width:320px;" placeholder="Type a club name&hellip;">
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
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
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
  showTab('overview');
}

init();
