import express from 'express';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3030;

app.use(express.json());
app.use(express.static(join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    // Never cache JS/CSS so layout changes are always immediate
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.set('Cache-Control', 'no-store');
    }
  }
}));

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Merges schedule.json + screens/*.json + backgrounds.json into one config
app.get('/api/config', (req, res) => {
  try {
    const schedule = readJSON(join(__dirname, 'schedule.json'));
    const backgrounds = readJSON(join(__dirname, 'backgrounds.json'));

    const pages = schedule.pages
      .map(p => {
        const screenPath = join(__dirname, 'screens', `${p.screen}.json`);
        if (!existsSync(screenPath)) {
          console.warn(`Screen "${p.screen}" not found`);
          return null;
        }
        const screen = readJSON(screenPath);
        return {
          ...screen,
          duration: p.duration,
          enabled: p.enabled !== false,
          background: backgrounds[p.background] || { type: 'color', value: '#1a1a2e' },
        };
      })
      .filter(Boolean);

    const configFiles = [
      join(__dirname, 'schedule.json'),
      join(__dirname, 'backgrounds.json'),
      join(__dirname, 'public', 'index.html'),
      ...readdirSync(join(__dirname, 'screens')).map(f => join(__dirname, 'screens', f)),
    ];
    const lastUpdated = Math.max(...configFiles.map(f => statSync(f).mtimeMs));

    res.json({ site: schedule.site, pages, lastUpdated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to build config', detail: e.message });
  }
});

app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=5`;

    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Weather fetch failed', detail: e.message });
  }
});

app.get('/api/aqi', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=us_aqi,pm2_5,pm10,ozone&timezone=auto`;

    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'AQI fetch failed', detail: e.message });
  }
});

const MOCK_ALERTS = {
  features: [
    { properties: { event: 'Severe Thunderstorm Warning', severity: 'Severe' } },
    { properties: { event: 'Flash Flood Watch',           severity: 'Moderate' } },
    { properties: { event: 'Heat Advisory',               severity: 'Minor' } },
  ]
};

app.get('/api/alerts', async (req, res) => {
  const { lat, lon, mock } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon required' });
  if (mock) return res.json(MOCK_ALERTS);
  try {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      { headers: { 'User-Agent': 'bboard-dashboard (contact@localhost)' } }
    );
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Alerts fetch failed', detail: e.message });
  }
});

function normalizeNHLGame(g) {
  return {
    gameState: g.gameState,
    gameType: g.gameType,
    period: g.periodDescriptor?.number,
    clock: g.clock?.timeRemaining,
    startTimeUTC: g.startTimeUTC,
    startTime: g.startTimeUTC
      ? new Date(g.startTimeUTC).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '',
    awayAbbr: g.awayTeam?.abbrev,
    homeAbbr: g.homeTeam?.abbrev,
    awayScore: g.awayTeam?.score ?? '',
    homeScore: g.homeTeam?.score ?? '',
    seriesStatus: g.seriesStatus ?? null,
  };
}

app.get('/api/nhl/scores', async (req, res) => {
  try {
    const r = await fetch('https://api-web.nhle.com/v1/scoreboard/now', {
      headers: { 'User-Agent': 'bboard-dashboard' }
    });
    const raw = await r.json();

    const gamesByDate = raw.gamesByDate ?? [];
    const isPlayoffs = gamesByDate.flat().some(d => d.games?.some(g => g.gameType === 3));
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

    // Find best date for the scores widget: today → most recent past → next upcoming
    const past = gamesByDate.filter(d => d.date <= todayStr);
    const future = gamesByDate.filter(d => d.date > todayStr);
    const bestEntry = past.at(-1) ?? future[0] ?? {};
    const games = (bestEntry.games ?? []).map(normalizeNHLGame);
    const gamesDate = bestEntry.date ?? todayStr;

    // Full schedule (all days returned by API)
    const schedule = gamesByDate.map(d => ({
      date: d.date,
      games: (d.games ?? []).map(normalizeNHLGame),
    }));

    res.json({ games, gamesDate, schedule, isPlayoffs, todayStr });
  } catch (e) {
    res.status(500).json({ error: 'NHL fetch failed', detail: e.message });
  }
});

app.get('/api/favorite-teams', (req, res) => {
  try {
    const teams = JSON.parse(readFileSync('./data/favorite-teams.json', 'utf8'));
    res.json(teams);
  } catch {
    res.json([]);
  }
});

app.get('/api/nhl/bracket', async (req, res) => {
  try {
    // Determine current season from scoreboard
    const sbR = await fetch('https://api-web.nhle.com/v1/scoreboard/now', {
      headers: { 'User-Agent': 'bboard-dashboard' }
    });
    const sb = await sbR.json();
    const season = sb.gamesByDate?.[0]?.games?.[0]?.season;
    if (!season) return res.json({ rounds: [], currentRound: 0 });

    const r = await fetch(`https://api-web.nhle.com/v1/playoff-series/carousel/${season}`, {
      headers: { 'User-Agent': 'bboard-dashboard' }
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Bracket fetch failed', detail: e.message });
  }
});

app.get('/api/rss', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'bboard-dashboard' } });
    const xml = await r.text();

    // Minimal RSS parser — no dependencies
    const feedTitle = (xml.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const itemMatches = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)];
    const items = itemMatches.slice(0, 20).map(m => {
      const block = m[1];
      const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '';
      const link  = (block.match(/<link>([^<]*)<\/link>/) || [])[1]?.trim() || '';
      return { title, link };
    }).filter(i => i.title);

    res.json({ feedTitle, items });
  } catch (e) {
    res.status(500).json({ error: 'RSS fetch failed', detail: e.message });
  }
});

app.get('/api/custom-dates', (req, res) => {
  try {
    const data = readJSON(join(__dirname, 'data', 'custom-dates.json'));
    res.json(data);
  } catch (e) {
    res.json({ dates: [] });
  }
});

// Generic JSON proxy (avoids CORS issues with external APIs)
app.get('/api/json-fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'bboard-dashboard' } });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'JSON fetch failed', detail: e.message });
  }
});

// ICS/iCal calendar parser
app.get('/api/ical', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'bboard-dashboard' } });
    const text = await r.text();
    res.json({ events: parseICS(text) });
  } catch (e) {
    res.status(500).json({ error: 'iCal fetch failed', detail: e.message });
  }
});

function parseICSDate(str) {
  str = str.replace(/^TZID=[^:]+:/, '');
  if (str.length === 8) {
    // Parse as local end-of-day so all-day events stay visible the entire day
    return new Date(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T23:59:59`);
  }
  if (str.includes('T')) {
    const d = str.slice(0,8);
    const t = str.slice(9,15);
    const utc = str.endsWith('Z');
    return new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}${utc ? 'Z' : ''}`);
  }
  return null;
}

function parseICS(text) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  const events = [];

  for (const match of text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)) {
    const block = match[1];
    const get = (name) => {
      const m = block.match(new RegExp(`${name}[^:]*:([^\r\n]+)`));
      return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\n/g, ' ') : '';
    };

    const summary = get('SUMMARY');
    const dtstart = get('DTSTART');
    if (!summary || !dtstart) continue;

    const start = parseICSDate(dtstart);
    if (!start || start < cutoff) continue;

    events.push({
      summary,
      location: get('LOCATION'),
      description: get('DESCRIPTION'),
      start: start.toISOString(),
      allDay: !dtstart.includes('T'),
    });
  }

  return events.sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Proxy images to avoid mixed-content (HTTP sources on HTTPS page) and CORS issues
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('url required');
  try {
    const r = await fetch(url);
    const buf = await r.arrayBuffer();
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).send('Proxy failed');
  }
});

// ─── YoLink ──────────────────────────────────────────────────────
const HISTORY_FILE = join(__dirname, 'data', 'temp-history.json');
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

let tempHistory = { sensors: {} };
try { tempHistory = readJSON(HISTORY_FILE); } catch {}

function saveHistory() {
  try { writeFileSync(HISTORY_FILE, JSON.stringify(tempHistory)); } catch (e) { console.warn('History write failed:', e.message); }
}

function recordHistory(sensors) {
  const now = Date.now();
  const cutoff = now - ONE_MONTH_MS;
  let dirty = false;
  for (const s of sensors) {
    if (s.type !== 'THSensor' || s.error || s.temp == null) continue;
    if (!tempHistory.sensors[s.id]) tempHistory.sensors[s.id] = { name: s.name, unit: s.unit, readings: [] };
    tempHistory.sensors[s.id].name = s.name;
    tempHistory.sensors[s.id].unit = s.unit;
    tempHistory.sensors[s.id].readings.push({ t: now, v: s.temp, h: s.humidity });
    tempHistory.sensors[s.id].readings = tempHistory.sensors[s.id].readings.filter(r => r.t > cutoff);
    dirty = true;
  }
  if (dirty) saveHistory();
}

const YOLINK_ENABLED = !!(process.env.YOLINK_UAID && process.env.YOLINK_SECRET);

let _yolinkPollStatus = { lastSuccessAt: null, error: null };
let _yolinkSensorCache = {}; // keyed by deviceId → last known-good sensor object

let _yolinkToken = null;
let _yolinkTokenExpiry = 0;

async function getYoLinkToken() {
  if (_yolinkToken && Date.now() < _yolinkTokenExpiry) return _yolinkToken;
  const r = await fetch('https://api.yosmart.com/open/yolink/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${process.env.YOLINK_UAID}&client_secret=${process.env.YOLINK_SECRET}`,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error(`YoLink auth failed: ${JSON.stringify(data)}`);
  _yolinkToken = data.access_token;
  _yolinkTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _yolinkToken;
}

async function yolinkCall(method, extra = {}) {
  const token = await getYoLinkToken();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8000);
  try {
    const r = await fetch('https://api.yosmart.com/open/yolink/v2/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ method, time: Date.now(), ...extra }),
      signal: abort.signal,
    });
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

const YOLINK_STATE_METHODS = {
  THSensor:      'THSensor.getState',
  DoorSensor:    'DoorSensor.getState',
  MotionSensor:  'MotionSensor.getState',
  COSmokeSensor: 'COSmokeSensor.getState',
  MultiOutlet:        'MultiOutlet.getState',
  PowerFailureAlarm:  'PowerFailureAlarm.getState',
};

let _yolinkDevices = null;
let _yolinkDeviceExpiry = 0;

async function getYoLinkDevices() {
  if (_yolinkDevices && Date.now() < _yolinkDeviceExpiry) return _yolinkDevices;
  const data = await yolinkCall('Home.getDeviceList');
  const devices = data.code === '000000' ? (data.data?.devices ?? []) : [];
  if (devices.length) {
    _yolinkDevices = devices;
    _yolinkDeviceExpiry = Date.now() + 10 * 60 * 1000;
  }
  return _yolinkDevices ?? [];
}

function normalizeYoLink(type, state, online, reportAt) {
  if (type === 'THSensor') {
    const tempC = state?.temperature;
    const fahrenheit = state?.mode === 'f';
    return {
      temp: fahrenheit && tempC != null ? +(tempC * 9/5 + 32).toFixed(1) : tempC,
      humidity: state?.humidity,
      unit: fahrenheit ? 'F' : 'C',
      battery: state?.battery,
      alarm: state?.alarm,
      online, reportAt,
    };
  }
  if (type === 'DoorSensor') return {
    open: state?.state === 'open',
    battery: state?.battery,
    stateChangedAt: state?.stateChangedAt,
    online, reportAt,
  };
  if (type === 'MotionSensor') return {
    motion: state?.state === 'alert',
    battery: state?.battery,
    stateChangedAt: state?.stateChangedAt,
    online, reportAt,
  };
  if (type === 'COSmokeSensor') return {
    smokeAlarm:    state?.state?.smokeAlarm    ?? false,
    gasAlarm:      state?.state?.gasAlarm      ?? false,
    highTempAlarm: state?.state?.highTempAlarm ?? false,
    lowBattery:    state?.state?.sLowBattery   ?? false,
    battery: state?.battery,
    online: state?.online ?? online, // spec: COSmokeSensor puts online inside data.state, not data
    reportAt,
  };
  if (type === 'MultiOutlet') {
    const channels = Array.isArray(state) ? state : [];
    return {
      on: channels.some(c => c === 'open'),
      activeCount: channels.filter(c => c === 'open').length,
      online, reportAt,
    };
  }
  if (type === 'PowerFailureAlarm') return {
    powerSupply: state?.powerSupply ?? true,
    alarm: state?.state === 'alert',
    battery: state?.battery,
    online, reportAt,
  };
  return { online, reportAt };
}

app.get('/api/yolink/states', async (req, res) => {
  if (!YOLINK_ENABLED) return res.json({ sensors: [], disabled: true });
  try {
    const devices = await getYoLinkDevices();
    const relevant = devices.filter(d => YOLINK_STATE_METHODS[d.type]);

    const sensors = await Promise.all(relevant.map(async d => {
      const fallback = (offline = false) => {
        if (_yolinkSensorCache[d.deviceId]) {
          return { ..._yolinkSensorCache[d.deviceId], ...(offline ? { online: false } : {}), stale: true };
        }
        if (d.type === 'THSensor') {
          const hist = tempHistory.sensors[d.deviceId];
          const last = hist?.readings?.at(-1);
          if (last) return { id: d.deviceId, name: d.name, type: d.type, unit: hist.unit, temp: last.v, humidity: last.h, reportAt: last.t, stale: true };
        }
        return { id: d.deviceId, name: d.name, type: d.type, online: offline ? false : undefined, stale: true };
      };

      try {
        const s = await yolinkCall(YOLINK_STATE_METHODS[d.type], {
          targetDevice: d.deviceId,
          token: d.token,
        });
        if (s.code !== '000000' || s.data == null) return fallback();

        const sensor = {
          id: d.deviceId,
          name: d.name,
          type: d.type,
          ...normalizeYoLink(d.type, s.data?.state, s.data?.online, s.data?.reportAt),
        };
        // Only cache if data is complete (THSensor must have temp)
        const isComplete = d.type !== 'THSensor' || sensor.temp != null;
        if (isComplete) {
          _yolinkSensorCache[d.deviceId] = sensor;
          return sensor;
        }
        return fallback();
      } catch {
        return fallback(true);
      }
    }));

    recordHistory(sensors.filter(s => !s.stale));
    _yolinkPollStatus = { lastSuccessAt: Date.now(), error: null };
    res.json({ sensors, lastSuccessAt: _yolinkPollStatus.lastSuccessAt });
  } catch (e) {
    _yolinkPollStatus.error = e.message;
    res.status(500).json({ error: 'YoLink states failed', detail: e.message, lastSuccessAt: _yolinkPollStatus.lastSuccessAt });
  }
});

app.get('/api/yolink/history', (req, res) => {
  if (!YOLINK_ENABLED) return res.json({});
  const hours = Math.min(parseInt(req.query.hours) || 24, 30 * 24);
  const since = Date.now() - hours * 60 * 60 * 1000;
  const result = {};
  for (const [id, data] of Object.entries(tempHistory.sensors)) {
    result[id] = {
      name: data.name,
      unit: data.unit,
      readings: data.readings.filter(r => r.t >= since),
    };
  }
  res.json(result);
});

// Server-side polling so history accumulates even when no browser is open
async function pollYoLinkHistory() {
  try {
    const devices = await getYoLinkDevices();
    const thSensors = devices.filter(d => d.type === 'THSensor');
    const results = await Promise.all(thSensors.map(async d => {
      const s = await yolinkCall('THSensor.getState', { targetDevice: d.deviceId, token: d.token });
      if (s.code !== '000000' || s.data == null) return null;
      return { id: d.deviceId, name: d.name, type: 'THSensor', ...normalizeYoLink('THSensor', s.data?.state, s.data?.online, s.data?.reportAt) };
    }));
    recordHistory(results.filter(Boolean));
    _yolinkPollStatus = { lastSuccessAt: Date.now(), error: null };
  } catch (e) {
    _yolinkPollStatus.error = e.message;
    console.warn('YoLink history poll failed:', e.message);
  }
}
if (YOLINK_ENABLED) {
  pollYoLinkHistory();
  setInterval(pollYoLinkHistory, 10 * 60 * 1000);
} else {
  console.log('YoLink disabled — set YOLINK_UAID and YOLINK_SECRET in .env to enable');
}

// ─── Admin UI ────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/api/admin/data', (req, res) => {
  try {
    const schedule = readJSON(join(__dirname, 'schedule.json'));
    const backgrounds = Object.keys(readJSON(join(__dirname, 'backgrounds.json')));
    const allFiles = readdirSync(join(__dirname, 'screens'));
    const screens = allFiles.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    const deleted = allFiles.filter(f => f.endsWith('.delete')).map(f => f.replace('.delete', ''));
    res.json({ schedule, backgrounds, screens, deleted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/config', (req, res) => {
  try {
    const { site, pages, deleteScreens = [] } = req.body;
    const current = readJSON(join(__dirname, 'schedule.json'));
    writeFileSync(join(__dirname, 'schedule.json'), JSON.stringify({ ...current, site, pages }, null, 2));
    const remainingScreens = new Set(pages.map(p => p.screen));
    for (const name of deleteScreens) {
      if (remainingScreens.has(name)) continue; // still in use by another page
      const from = join(__dirname, 'screens', `${name}.json`);
      const to   = join(__dirname, 'screens', `${name}.delete`);
      if (existsSync(from)) renameSync(from, to);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/screens/create-example', (req, res) => {
  try {
    const dest = join(__dirname, 'screens', 'example.json');
    if (existsSync(dest)) return res.status(409).json({ error: 'example.json already exists — delete or rename it first.' });
    const template = {
      id: 'example',
      name: 'Example Screen',
      widgets: [
        {
          type: 'clock',
          id: 'ex-clock',
          style: { top: '5%', left: '25%', width: '50%', height: '12%' }
        },
        {
          type: 'text',
          id: 'ex-message',
          html: '<div style="font-size:10vw;font-weight:700;text-align:center;line-height:1.2;color:#fff">Hey Buddy!</div>',
          style: { top: '25%', left: '5%', width: '90%', height: '50%' }
        }
      ]
    };
    writeFileSync(dest, JSON.stringify(template, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/screens/:name/restore', (req, res) => {
  try {
    const { name } = req.params;
    const from = join(__dirname, 'screens', `${name}.delete`);
    const to   = join(__dirname, 'screens', `${name}.json`);
    if (!existsSync(from)) return res.status(404).json({ error: 'Not found' });
    if (existsSync(to))   return res.status(409).json({ error: 'A screen with that name already exists' });
    renameSync(from, to);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`bboard running at http://localhost:${PORT}`);
});
