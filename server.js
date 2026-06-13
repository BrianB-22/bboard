import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3030;

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

    res.json({ site: schedule.site, pages });
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
    return new Date(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`);
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
  const r = await fetch('https://api.yosmart.com/open/yolink/v2/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ method, ...extra }),
  });
  return r.json();
}

const YOLINK_STATE_METHODS = {
  THSensor:     'THSensor.getState',
  DoorSensor:   'DoorSensor.getState',
  MotionSensor: 'MotionSensor.getState',
};

let _yolinkDevices = null;
let _yolinkDeviceExpiry = 0;

async function getYoLinkDevices() {
  if (_yolinkDevices && Date.now() < _yolinkDeviceExpiry) return _yolinkDevices;
  const data = await yolinkCall('Home.getDeviceList');
  _yolinkDevices = data.data?.devices ?? [];
  _yolinkDeviceExpiry = Date.now() + 10 * 60 * 1000; // cache 10 min
  return _yolinkDevices;
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
  return { online, reportAt };
}

app.get('/api/yolink/states', async (req, res) => {
  try {
    const devices = await getYoLinkDevices();
    const relevant = devices.filter(d => YOLINK_STATE_METHODS[d.type]);

    const sensors = await Promise.all(relevant.map(async d => {
      try {
        const s = await yolinkCall(YOLINK_STATE_METHODS[d.type], {
          targetDevice: d.deviceId,
          token: d.token,
        });
        return {
          id: d.deviceId,
          name: d.name,
          type: d.type,
          ...normalizeYoLink(d.type, s.data?.state, s.data?.online, s.data?.reportAt),
        };
      } catch {
        return { id: d.deviceId, name: d.name, type: d.type, online: false, error: true };
      }
    }));

    recordHistory(sensors);
    res.json({ sensors });
  } catch (e) {
    res.status(500).json({ error: 'YoLink states failed', detail: e.message });
  }
});

app.get('/api/yolink/history', (req, res) => {
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
      return { id: d.deviceId, name: d.name, type: 'THSensor', ...normalizeYoLink('THSensor', s.data?.state, s.data?.online, s.data?.reportAt) };
    }));
    recordHistory(results);
  } catch (e) {
    console.warn('YoLink history poll failed:', e.message);
  }
}
pollYoLinkHistory();
setInterval(pollYoLinkHistory, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`bboard running at http://localhost:${PORT}`);
});
