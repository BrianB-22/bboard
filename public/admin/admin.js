let state = null;   // raw data from server
let pages = [];     // working copy of schedule.pages
let site  = {};     // working copy of schedule.site
let pendingDeletes = [];
let currentUid = null;

// ── Schedule management ───────────────────────────────────────────
async function loadSchedules() {
  const schedules = await fetch('/api/schedules').then(r => r.json());
  const sel = document.getElementById('schedule-sel');
  sel.innerHTML = '';
  schedules.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.uid;
    opt.textContent = `${s.desc} (${s.uid})`;
    sel.appendChild(opt);
  });

  const params = new URLSearchParams(location.search);
  const preferred = params.get('uid') || schedules[0]?.uid;
  if (preferred) sel.value = preferred;

  currentUid = sel.value;
  document.getElementById('del-schedule-btn').disabled = schedules.length <= 1;
  updateBackLink();
}

function selectSchedule(uid) {
  currentUid = uid;
  updateBackLink();
  load();
}

function updateBackLink() {
  const link = document.getElementById('back-link');
  if (currentUid) link.href = `/${currentUid}`;
}

async function newSchedule() {
  const desc = prompt('Schedule description (e.g. "Kitchen Display"):');
  if (!desc) return;

  try {
    const r = await fetch('/api/admin/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desc }),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);

    await loadSchedules();
    document.getElementById('schedule-sel').value = result.uid;
    selectSchedule(result.uid);
  } catch (e) {
    alert('Failed to create schedule: ' + e.message);
  }
}

async function deleteSchedule() {
  if (!currentUid) return;
  const label = document.getElementById('schedule-sel').options[document.getElementById('schedule-sel').selectedIndex]?.text;
  if (!confirm(`Delete schedule "${label}"? This cannot be undone.`)) return;

  try {
    const r = await fetch(`/api/admin/schedules/${encodeURIComponent(currentUid)}`, { method: 'DELETE' });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    await loadSchedules();
    load();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

// ── Load ──────────────────────────────────────────────────────────
async function load() {
  const r = await fetch(`/api/admin/data?uid=${encodeURIComponent(currentUid)}`);
  state = await r.json();
  pages = state.schedule.pages.map(p => ({ ...p }));
  site  = { ...state.schedule.site, location: { ...state.schedule.site.location } };
  pendingDeletes = [];
  render();
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  renderSiteSettings();
  renderPages();
  renderAddPage();
  renderDeleted();
  setDirty(false);
}

function renderSiteSettings() {
  document.getElementById('loc-name').value = site.location?.name ?? '';
  document.getElementById('show-indicator').checked = !!site.showScreenIndicator;
  document.getElementById('postal-code').value = '';
  document.getElementById('country-code').value = 'US';
  document.getElementById('lookup-status').textContent = '';
  document.getElementById('lookup-status').className = '';
}

function renderPages() {
  const tbody = document.getElementById('pages-tbody');
  tbody.innerHTML = '';

  pages.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="screen-name">${p.screen}</span></td>
      <td>
        <select class="page-bg" onchange="updatePage(${i},'background',this.value)">
          ${state.backgrounds.map(b =>
            `<option value="${b}" ${b === p.background ? 'selected' : ''}>${b}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <input type="number" class="page-dur" value="${p.duration ?? 60}" min="5"
          onchange="updatePage(${i},'duration',+this.value)">
      </td>
      <td class="center">
        <a href="/${currentUid}?screen=${p.screen}" target="_blank">
          <button type="button" class="ghost">View</button>
        </a>
      </td>
      <td class="center">
        <input type="checkbox" class="page-en" ${p.enabled !== false ? 'checked' : ''}
          onchange="updatePage(${i},'enabled',this.checked)">
      </td>
      <td class="center">
        <div class="order-btns">
          <button type="button" onclick="movePage(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" onclick="movePage(${i},1)"  ${i === pages.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
      </td>
      <td class="center">
        <button type="button" class="danger" onclick="deletePage(${i})" title="Remove page">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAddPage() {
  const available = state.screens.filter(s => !pendingDeletes.includes(s));

  const sel = document.getElementById('new-screen');
  sel.innerHTML = available.map(s => `<option value="${s}">${s}</option>`).join('');

  const bgSel = document.getElementById('new-bg');
  if (!bgSel.options.length) {
    bgSel.innerHTML = state.backgrounds.map(b => `<option value="${b}">${b}</option>`).join('');
  }

  const hasAvailable = available.length > 0;
  document.getElementById('add-form').style.display = hasAvailable ? '' : 'none';
  document.getElementById('no-screens-msg').style.display = hasAvailable ? 'none' : 'block';
}

function renderDeleted() {
  const section = document.getElementById('deleted-section');
  const list = document.getElementById('deleted-list');
  list.innerHTML = '';

  if (!state.deleted.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  state.deleted.forEach(name => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="del-name">${name}</span>
      <button type="button" class="restore" onclick="restoreScreen('${name}')">Restore</button>
    `;
    list.appendChild(li);
  });
}

// ── Page operations ───────────────────────────────────────────────
function updatePage(idx, field, value) {
  pages[idx][field] = value;
  markDirty();
}

function movePage(idx, dir) {
  const to = idx + dir;
  if (to < 0 || to >= pages.length) return;
  [pages[idx], pages[to]] = [pages[to], pages[idx]];
  markDirty();
  renderPages();
}

async function deletePage(idx) {
  pages.splice(idx, 1);
  renderPages();
  renderAddPage();
  await save();
}

function addPage() {
  const screen   = document.getElementById('new-screen').value;
  const bg       = document.getElementById('new-bg').value;
  const duration = parseInt(document.getElementById('new-duration').value) || 60;
  const enabled  = document.getElementById('new-enabled').checked;
  if (!screen) return;

  pages.push({ screen, background: bg, duration, enabled });
  pendingDeletes = pendingDeletes.filter(n => n !== screen);
  markDirty();
  renderPages();
  renderAddPage();
}

// ── Create example screen ─────────────────────────────────────────
async function createExample() {
  const btn = document.getElementById('create-example-btn');
  const statusEl = document.getElementById('create-example-status');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  statusEl.textContent = '';
  statusEl.className = '';

  try {
    const r = await fetch('/api/admin/screens/create-example', { method: 'POST' });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    statusEl.textContent = 'Created screens/example.json — use Add Page below to add it to the rotation.';
    statusEl.className = 'ok';
    await load();
  } catch (e) {
    statusEl.textContent = e.message;
    statusEl.className = 'error';
    btn.disabled = false;
  } finally {
    btn.textContent = 'Create Example Template';
    btn.disabled = false;
  }
}

// ── Geocoding ─────────────────────────────────────────────────────
async function lookupPostal() {
  const code = document.getElementById('postal-code').value.trim();
  if (!code) return;

  const btn = document.getElementById('lookup-btn');
  const statusEl = document.getElementById('lookup-status');
  btn.disabled = true;
  btn.textContent = 'Looking up…';
  statusEl.textContent = '';
  statusEl.className = '';

  try {
    const country = document.getElementById('country-code').value.trim().toLowerCase();
    const countryParam = country ? `&countrycodes=${encodeURIComponent(country)}` : '';
    const nominatim = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(code)}&format=json&limit=3&addressdetails=1${countryParam}`;
    const r = await fetch(`/api/json-fetch?url=${encodeURIComponent(nominatim)}`);
    const results = await r.json();

    if (!Array.isArray(results) || !results.length) {
      statusEl.textContent = 'No results found';
      statusEl.className = 'error';
      return;
    }

    const result = results[0];
    const addr = result.address || {};
    const city       = addr.city || addr.town || addr.village || addr.municipality || '';
    const region     = addr.state || addr.region || '';
    const countryName = addr.country || '';
    const name = city
      ? [city, region || countryName].filter(Boolean).join(', ')
      : result.display_name.split(',').slice(0, 2).join(',').trim();

    site.location = site.location || {};
    site.location.lat  = parseFloat(result.lat);
    site.location.lon  = parseFloat(result.lon);
    site.location.name = name;

    document.getElementById('loc-name').value = name;
    statusEl.textContent = `Found: ${result.display_name.split(',').slice(0, 3).join(',').trim()}`;
    statusEl.className = 'ok';
    markDirty();
  } catch {
    statusEl.textContent = 'Lookup failed';
    statusEl.className = 'error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lookup';
  }
}

document.getElementById('postal-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupPostal();
});

// ── Restore deleted screen ────────────────────────────────────────
async function restoreScreen(name) {
  const r = await fetch(`/api/admin/screens/${encodeURIComponent(name)}/restore`, { method: 'POST' });
  const result = await r.json();
  if (!r.ok) { alert('Restore failed: ' + result.error); return; }
  await load();
}

// ── Save ──────────────────────────────────────────────────────────
async function save() {
  site.location = site.location || {};
  site.location.name = document.getElementById('loc-name').value.trim();
  site.showScreenIndicator = document.getElementById('show-indicator').checked;

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const r = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: currentUid, site, pages, deleteScreens: [] }),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    await load();
  } catch (e) {
    alert('Save failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
}

// ── Dirty state ───────────────────────────────────────────────────
function markDirty() { setDirty(true); }

function setDirty(val) {
  document.getElementById('save-bar').classList.toggle('dirty', val);
}

// ── YoLink device list ────────────────────────────────────────────
async function loadYoLinkDevices(forceRefresh = false) {
  const status  = document.getElementById('yl-status');
  const table   = document.getElementById('yl-table');
  const tbody   = document.getElementById('yl-tbody');
  const loadBtn = document.getElementById('yl-load-btn');
  const refBtn  = document.getElementById('yl-refresh-btn');

  status.textContent = 'Loading…';
  loadBtn.disabled = true;

  try {
    const url = '/api/admin/yolink-devices' + (forceRefresh ? '?refresh=1' : '');
    const { devices, disabled, error } = await fetch(url).then(r => r.json());

    if (disabled) { status.textContent = 'YoLink not configured.'; return; }
    if (error)    { status.textContent = `Error: ${error}`; return; }

    const sorted = [...devices].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    tbody.innerHTML = sorted.map(d => `
      <tr>
        <td><code>${d.name}</code></td>
        <td class="dim">${d.type}</td>
        <td class="dim" style="font-size:0.75rem">${d.deviceId}</td>
      </tr>`).join('');

    table.style.display = '';
    loadBtn.style.display = 'none';
    refBtn.style.display  = '';
    status.textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;
  } catch (e) {
    status.textContent = `Failed: ${e.message}`;
  } finally {
    loadBtn.disabled = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────
loadSchedules().then(() => load());
