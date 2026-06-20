import { fetchConfig, fetchWeather, fetchAQI, fetchAlerts, fetchNHLScores, fetchNHLBracket, fetchRSS, fetchCalendar, fetchCalendars, fetchJSON, fetchCustomDates, fetchYoLink, fetchYoLinkHistory, fetchFavoriteTeams, fetchStocks, fetchMovies, fetchJellyfin } from './api.js';
import {
  renderClock, renderAQI, renderAlerts, renderIframe, renderImage,
  renderWeatherCurrent, renderWeatherHourly, renderWeatherDaily,
  renderNHLScores, renderNHLSchedule, renderNHLBracket, renderRSS,
  renderText, renderScheduledText, renderCountdown, renderSunTimes,
  renderGauge, renderJSON, renderCalendar, renderWeekCalendar,
  renderAstroInfo, renderCalendarMonth, renderYoLink, renderYoLinkDoor, renderYoLinkTemp, renderYoLinkOutlet, renderYoLinkSmoke,
  renderServerStats, renderServerStorage,
  renderServerHardware, renderServerDrives, renderServerUPS, renderServerLoad, renderServerDocker,
  renderStockTicker, renderStockCountdown, renderStockCharts,
  renderMovieTheaters, renderMovieStreaming,
  renderJellyfinMovies, renderJellyfinShows,
} from './widgets.js';

let uid    = null;
let config = null;
let pages  = [];
let pageList = [];
let currentPage = 0;
let rotateTimer = null;
let weatherData = null;
let aqiData = null;
let weatherFailCount = 0;
let yolinkData = null;
const yolinkCallbacks = [];
const weatherCallbacks = [];
let favoriteTeams = [];

// ─── Failsafe reloads ────────────────────────────────────────────
// 1. Nightly at 3am — clears memory leaks, picks up config changes
function scheduleNightlyReload() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(3, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  setTimeout(() => location.reload(), target - now);
}

// ─── Data layer ─────────────────────────────────────────────────
async function loadWeather() {
  const { lat, lon } = config.site.location;
  try {
    weatherData = await fetchWeather(lat, lon);
    weatherFailCount = 0;
  } catch (e) {
    if (++weatherFailCount >= 3) {
      // 3+ consecutive failures: show offline overlay if network error, else just reload
      isNetworkError(e) ? showOfflineOverlay() : location.reload();
    }
  }
}

async function loadYoLink() {
  try {
    yolinkData = await fetchYoLink();
  } catch {
    if (!yolinkData) yolinkData = { sensors: [], error: true };
    else yolinkData._fetchError = true;
  }
  yolinkCallbacks.forEach(cb => cb(yolinkData));
  updateAlertBanner(yolinkData);
}

async function loadAQI() {
  const { lat, lon } = config.site.location;
  try { aqiData = await fetchAQI(lat, lon); } catch {}
}

async function loadAlerts() {
  const { lat, lon } = config.site.location;
  try {
    const data = await fetchAlerts(lat, lon);
    document.querySelectorAll('.widget-alerts-el').forEach(el => renderAlerts(el, data));
  } catch {}
}

// ─── Background builder ─────────────────────────────────────────
function buildBackground(pageEl, bg) {
  if (bg.type === 'animated-gradient') {
    const div = document.createElement('div');
    div.className = 'page-bg-animated';
    pageEl.appendChild(div);
    return;
  }

  if (bg.type === 'aurora') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-aurora';
    [
      { cx: '22%', cy: '55%', rx: '75%', ry: '45%', color: 'rgba(0,255,130,0.60)',  anim: 'aurora1' },
      { cx: '72%', cy: '48%', rx: '72%', ry: '42%', color: 'rgba(120,0,255,0.52)',  anim: 'aurora2' },
      { cx: '12%', cy: '45%', rx: '65%', ry: '38%', color: 'rgba(0,80,255,0.42)',   anim: 'aurora3' },
      { cx: '88%', cy: '65%', rx: '65%', ry: '36%', color: 'rgba(200,40,255,0.45)', anim: 'aurora4' },
    ].forEach(b => {
      const blob = document.createElement('div');
      blob.className = `aurora-blob aurora-${b.anim}`;
      blob.style.cssText = `left:${b.cx};top:${b.cy};width:${b.rx};height:${b.ry};background:${b.color};`;
      wrap.appendChild(blob);
    });
    pageEl.appendChild(wrap);
    return;
  }

  if (bg.type === 'hockey-arena') {
    const div = document.createElement('div');
    div.className = 'page-bg-hockey';
    pageEl.appendChild(div);
    return;
  }

  if (bg.type === 'neon-tech') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-neon-tech';
    const grid = document.createElement('div');
    grid.className = 'neon-grid';
    wrap.appendChild(grid);
    [
      { color: 'rgba(0,255,230,0.28)',  anim: 'neon1', style: 'left:-5%;top:5%;width:65%;height:60%;' },
      { color: 'rgba(220,0,200,0.22)',  anim: 'neon2', style: 'right:-5%;top:25%;width:60%;height:55%;' },
      { color: 'rgba(0,90,255,0.26)',   anim: 'neon3', style: 'left:15%;bottom:-10%;width:55%;height:50%;' },
      { color: 'rgba(160,0,255,0.18)',  anim: 'neon4', style: 'right:10%;top:-8%;width:50%;height:45%;' },
    ].forEach(b => {
      const blob = document.createElement('div');
      blob.className = `neon-blob neon-${b.anim}`;
      blob.style.cssText = `background:${b.color};${b.style}`;
      wrap.appendChild(blob);
    });
    const scan = document.createElement('div');
    scan.className = 'neon-scanlines';
    wrap.appendChild(scan);
    pageEl.appendChild(wrap);
    return;
  }

  if (bg.type === 'starfield') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-stars';
    [
      { count: 130, size: '1px',   cls: 'stars-l1' },
      { count:  65, size: '2px',   cls: 'stars-l2' },
      { count:  28, size: '2.5px', cls: 'stars-l3' },
    ].forEach(({ count, size, cls }) => {
      const layer = document.createElement('div');
      layer.className = `stars-layer ${cls}`;
      for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'star';
        const lo  = (Math.random() * 0.2  + 0.04).toFixed(2);
        const hi  = (Math.random() * 0.55 + 0.40).toFixed(2);
        const dur = (Math.random() * 4    + 1.5 ).toFixed(1);
        const del = (Math.random() * 10         ).toFixed(1);
        s.style.cssText = `--lo:${lo};--hi:${hi};--tw-dur:${dur}s;left:${(Math.random()*106-3).toFixed(1)}%;top:${(Math.random()*106-3).toFixed(1)}%;width:${size};height:${size};animation-delay:-${del}s;`;
        layer.appendChild(s);
      }
      wrap.appendChild(layer);
    });
    pageEl.appendChild(wrap);
    return;
  }

  if (bg.type === 'lava-lamp') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-lava';
    [
      { color: 'rgba(180,20,0,0.60)',  cls: 'lava-b1', style: 'left:15%;top:55%;width:55%;height:58%;' },
      { color: 'rgba(255,75,0,0.50)',  cls: 'lava-b2', style: 'left:48%;top:28%;width:58%;height:52%;' },
      { color: 'rgba(200,45,0,0.48)',  cls: 'lava-b3', style: 'left:-8%;top:38%;width:50%;height:50%;' },
      { color: 'rgba(255,135,0,0.38)', cls: 'lava-b4', style: 'left:32%;top:68%;width:44%;height:44%;' },
      { color: 'rgba(110,8,0,0.58)',   cls: 'lava-b5', style: 'left:62%;top:50%;width:50%;height:54%;' },
    ].forEach(({ color, cls, style }) => {
      const blob = document.createElement('div');
      blob.className = `lava-blob ${cls}`;
      blob.style.cssText = `background:${color};${style}`;
      wrap.appendChild(blob);
    });
    pageEl.appendChild(wrap);
    return;
  }

  if (bg.type === 'aurora-rose') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-aurora page-bg-aurora-rose';
    [
      { cx: '25%', cy: '52%', rx: '80%', ry: '48%', color: 'rgba(255,50,110,0.55)',  anim: 'aurora1' },
      { cx: '75%', cy: '46%', rx: '72%', ry: '42%', color: 'rgba(90,0,200,0.50)',    anim: 'aurora2' },
      { cx: '10%', cy: '58%', rx: '65%', ry: '38%', color: 'rgba(255,190,0,0.38)',   anim: 'aurora3' },
      { cx: '82%', cy: '62%', rx: '60%', ry: '35%', color: 'rgba(210,25,170,0.44)',  anim: 'aurora4' },
    ].forEach(b => {
      const blob = document.createElement('div');
      blob.className = `aurora-blob aurora-${b.anim}`;
      blob.style.cssText = `left:${b.cx};top:${b.cy};width:${b.rx};height:${b.ry};background:${b.color};`;
      wrap.appendChild(blob);
    });
    pageEl.appendChild(wrap);
    return;
  }

  if (bg.type === 'deep-ocean') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-ocean';
    [
      { color: 'rgba(0,200,175,0.26)',  cls: 'ocean-b1', style: 'left:18%;top:28%;width:72%;height:62%;' },
      { color: 'rgba(0,90,210,0.30)',   cls: 'ocean-b2', style: 'left:-12%;top:48%;width:65%;height:58%;' },
      { color: 'rgba(0,220,195,0.18)',  cls: 'ocean-b3', style: 'left:52%;top:18%;width:62%;height:52%;' },
      { color: 'rgba(25,75,185,0.25)',  cls: 'ocean-b4', style: 'left:28%;top:62%;width:58%;height:50%;' },
    ].forEach(({ color, cls, style }) => {
      const blob = document.createElement('div');
      blob.className = `ocean-blob ${cls}`;
      blob.style.cssText = `background:${color};${style}`;
      wrap.appendChild(blob);
    });
    pageEl.appendChild(wrap);
    return;
  }

  if (bg.type === 'ember-rise') {
    const wrap = document.createElement('div');
    wrap.className = 'page-bg-ember';
    const colors = ['#ff2000','#ff4400','#ff6600','#ff8c00','#ffaa00','#ffd000','#fff3a0'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'ember-particle';
      const size  = (Math.random() * 2.5 + 1.2).toFixed(1);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const x     = (Math.random() * 100).toFixed(1);
      const dur   = (Math.random() * 12 + 9).toFixed(1);
      const del   = (Math.random() * 20).toFixed(1);
      const drift = ((Math.random() - 0.5) * 80).toFixed(0);
      p.style.cssText = `--drift:${drift}px;left:${x}%;width:${size}px;height:${size}px;background:${color};box-shadow:0 0 5px 1px ${color};animation-duration:${dur}s;animation-delay:-${del}s;`;
      wrap.appendChild(p);
    }
    pageEl.appendChild(wrap);
    return;
  }

  const bgEl = document.createElement('div');
  bgEl.className = 'page-bg';

  if (bg.type === 'color') {
    bgEl.style.background = bg.value;
    pageEl.appendChild(bgEl);
    return;
  }

  if (bg.type === 'picsum') {
    // Picsum: random photo from picsum.photos, rotated on an interval
    const img = document.createElement('img');
    img.alt = '';

    function loadPhoto() {
      // Use a seed based on time bucket so it stays stable during a rotation interval
      const bucket = Math.floor(Date.now() / ((bg.rotate || 60) * 1000));
      const w = window.screen.width || 2560;
      const h = window.screen.height || 1440;
      // Add cache-busting via the seed so different intervals get different images
      img.src = `https://picsum.photos/seed/${bucket}/${w}/${h}`;
    }

    img.onload = () => img.classList.remove('fading');
    loadPhoto();
    bgEl.appendChild(img);
    pageEl.appendChild(bgEl);

    if (bg.rotate) {
      setInterval(() => {
        img.classList.add('fading');
        setTimeout(loadPhoto, 800);
      }, bg.rotate * 1000);
    }
    return;
  }

  if (bg.type === 'image') {
    bgEl.style.backgroundImage = `url(${bg.url})`;
    bgEl.style.backgroundSize = 'cover';
    bgEl.style.backgroundPosition = 'center';
    pageEl.appendChild(bgEl);
    return;
  }

  // Fallback
  bgEl.style.background = '#0d1b2a';
  pageEl.appendChild(bgEl);
}

// ─── Widget factory ─────────────────────────────────────────────
async function mountWidget(widgetCfg) {
  const el = document.createElement('div');
  el.id = widgetCfg.id;
  el.className = 'widget';

  const s = widgetCfg.style || {};
  Object.assign(el.style, s);

  switch (widgetCfg.type) {
    case 'clock':
      renderClock(el, widgetCfg);
      break;

    case 'week-calendar':
      renderWeekCalendar(el);
      break;

    case 'aqi':
      renderAQI(el, aqiData);
      setInterval(async () => {
        await loadAQI();
        el.innerHTML = '';
        el.className = 'widget';
        renderAQI(el, aqiData);
      }, 10 * 60 * 1000);
      break;

    case 'alerts': {
      el.classList.add('widget-alerts-el');
      // Initial render directly on element (before it's in the DOM)
      try {
        const { lat, lon } = config.site.location;
        const data = await fetchAlerts(lat, lon);
        renderAlerts(el, data);
      } catch {}
      setInterval(loadAlerts, 5 * 60 * 1000);
      break;
    }

    case 'iframe':
      renderIframe(el, widgetCfg);
      break;

    case 'image':
      renderImage(el, widgetCfg);
      break;

    case 'weather-current':
      renderWeatherCurrent(el, weatherData);
      weatherCallbacks.push(() => {
        el.innerHTML = '';
        el.className = 'widget';
        renderWeatherCurrent(el, weatherData);
      });
      break;

    case 'weather-hourly':
      renderWeatherHourly(el, weatherData, widgetCfg);
      weatherCallbacks.push(() => {
        el.innerHTML = '';
        el.className = 'widget';
        renderWeatherHourly(el, weatherData, widgetCfg);
      });
      break;

    case 'weather-daily':
      renderWeatherDaily(el, weatherData, widgetCfg);
      weatherCallbacks.push(() => {
        el.innerHTML = '';
        el.className = 'widget';
        renderWeatherDaily(el, weatherData, widgetCfg);
      });
      break;

    case 'nhl-scores': {
      const d = await fetchNHLScores().catch(() => null);
      renderNHLScores(el, d);
      updateHockeyAlerts(d);
      setInterval(async () => {
        const nd = await fetchNHLScores().catch(() => null);
        el.innerHTML = '';
        el.className = 'widget';
        renderNHLScores(el, nd);
        updateHockeyAlerts(nd);
      }, 60 * 1000);
      break;
    }

    case 'nhl-schedule': {
      const d = await fetchNHLScores().catch(() => null);
      renderNHLSchedule(el, d);
      setInterval(async () => {
        const nd = await fetchNHLScores().catch(() => null);
        el.innerHTML = '';
        el.className = 'widget';
        renderNHLSchedule(el, nd);
      }, 5 * 60 * 1000);
      break;
    }

    case 'nhl-bracket': {
      const d = await fetchNHLBracket().catch(() => null);
      renderNHLBracket(el, d);
      setInterval(async () => {
        const nd = await fetchNHLBracket().catch(() => null);
        el.innerHTML = '';
        el.className = 'widget';
        renderNHLBracket(el, nd);
      }, 10 * 60 * 1000);
      break;
    }

    case 'rss': {
      const d = await fetchRSS(widgetCfg.url).catch(() => null);
      renderRSS(el, d, widgetCfg);
      setInterval(async () => {
        const nd = await fetchRSS(widgetCfg.url).catch(() => null);
        el.innerHTML = '';
        el.className = 'widget';
        renderRSS(el, nd, widgetCfg);
      }, (widgetCfg.refresh || 600) * 1000);
      break;
    }

    case 'text':
      renderText(el, widgetCfg);
      break;

    case 'scheduled-text':
      renderScheduledText(el, widgetCfg);
      break;

    case 'countdown':
      renderCountdown(el, widgetCfg);
      break;

    case 'sun-times':
      renderSunTimes(el, weatherData);
      weatherCallbacks.push(() => {
        el.innerHTML = '';
        el.className = 'widget';
        renderSunTimes(el, weatherData);
      });
      break;

    case 'gauge': {
      async function updateGauge() {
        let value = widgetCfg.value ?? 0;
        if (widgetCfg.url) {
          const d = await fetchJSON(widgetCfg.url).catch(() => null);
          if (d && widgetCfg.path) {
            value = widgetCfg.path.split('.').reduce((o, k) => o?.[k], d) ?? value;
          }
        }
        el.innerHTML = '';
        el.className = 'widget';
        renderGauge(el, value, widgetCfg);
      }
      await updateGauge();
      if (widgetCfg.url && widgetCfg.refresh) {
        setInterval(updateGauge, widgetCfg.refresh * 1000);
      }
      break;
    }

    case 'json': {
      const d = await fetchJSON(widgetCfg.url).catch(() => null);
      renderJSON(el, d, widgetCfg);
      setInterval(async () => {
        const nd = await fetchJSON(widgetCfg.url).catch(() => null);
        el.innerHTML = '';
        el.className = 'widget';
        renderJSON(el, nd, widgetCfg);
      }, (widgetCfg.refresh || 60) * 1000);
      break;
    }

    case 'calendar': {
      const calUrls = widgetCfg.urls || (widgetCfg.url ? [widgetCfg.url] : []);
      const fetcher = calUrls.length ? () => fetchCalendar(calUrls) : () => fetchCalendars();
      const d = await fetcher().catch(() => null);
      renderCalendar(el, d, widgetCfg);
      setInterval(async () => {
        const nd = await fetcher().catch(() => null);
        el.innerHTML = '';
        el.className = 'widget';
        renderCalendar(el, nd, widgetCfg);
      }, (widgetCfg.refresh || 3600) * 1000);
      break;
    }

    case 'astro-info':
      renderAstroInfo(el);
      break;

    case 'yolink':
      renderYoLink(el, yolinkData);
      yolinkCallbacks.push(data => {
        el.innerHTML = ''; el.className = 'widget';
        renderYoLink(el, data);
      });
      break;

    case 'yolink-temp': {
      let tempHours = widgetCfg.hours || 24;
      const findTemp = d => d?.sensors?.find(
        s => s.name === widgetCfg.device || s.id === widgetCfg.deviceId
      );

      async function drawTemp() {
        const hist = await fetchYoLinkHistory(tempHours).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderYoLinkTemp(el, findTemp(yolinkData), hist, tempHours, yolinkData);
        el.querySelectorAll('.ylt-range').forEach(btn => {
          btn.addEventListener('click', async () => {
            tempHours = parseInt(btn.dataset.h);
            await drawTemp();
          });
        });
      }

      await drawTemp();
      yolinkCallbacks.push(async () => drawTemp());
      setInterval(drawTemp, 10 * 60 * 1000);
      break;
    }

    case 'yolink-door': {
      const findSensor = d => d?.sensors?.find(
        s => s.name === widgetCfg.device || s.id === widgetCfg.deviceId
      );
      renderYoLinkDoor(el, findSensor(yolinkData), widgetCfg, yolinkData);
      yolinkCallbacks.push(d => {
        el.innerHTML = ''; el.className = 'widget';
        renderYoLinkDoor(el, findSensor(d), widgetCfg, d);
      });
      break;
    }

    case 'yolink-smoke': {
      const findSmoke = d => d?.sensors?.find(
        s => s.name === widgetCfg.device || s.id === widgetCfg.deviceId
      );
      renderYoLinkSmoke(el, findSmoke(yolinkData));
      yolinkCallbacks.push(d => { el.innerHTML = ''; el.className = 'widget'; renderYoLinkSmoke(el, findSmoke(d)); });
      break;
    }

    case 'yolink-outlet': {
      const findOutlet = d => d?.sensors?.find(
        s => s.name === widgetCfg.device || s.id === widgetCfg.deviceId
      );
      const applyOutlet = (d) => {
        const sensor = findOutlet(d);
        el.hidden = !!(widgetCfg.hideWhenOff && sensor && !sensor.on);
        if (!el.hidden) { el.innerHTML = ''; el.className = 'widget'; renderYoLinkOutlet(el, sensor, d); }
      };
      applyOutlet(yolinkData);
      yolinkCallbacks.push(applyOutlet);
      break;
    }

    case 'calendar-month': {
      const cd = await fetchCustomDates().catch(() => ({ dates: [] }));
      renderCalendarMonth(el, cd.dates || [], widgetCfg);
      // Redraw at midnight
      const now = new Date();
      const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
      setTimeout(() => {
        const refresh = async () => {
          const ncd = await fetchCustomDates().catch(() => ({ dates: [] }));
          el.innerHTML = ''; el.className = 'widget';
          renderCalendarMonth(el, ncd.dates || [], widgetCfg);
        };
        refresh();
        setInterval(refresh, 86400000);
      }, msToMidnight);
      break;
    }

    case 'server-stats': {
      async function loadServerStats() {
        const d = await fetch('/api/server/stats').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerStats(el, d, widgetCfg);
      }
      await loadServerStats();
      setInterval(loadServerStats, 30 * 1000);
      break;
    }

    case 'server-hardware': {
      async function loadServerHardware() {
        const d = await fetch('/api/server/health').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerHardware(el, d);
      }
      await loadServerHardware();
      setInterval(loadServerHardware, 5 * 60 * 1000);
      break;
    }

    case 'server-drives': {
      async function loadServerDrives() {
        const d = await fetch('/api/server/health').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerDrives(el, d);
      }
      await loadServerDrives();
      setInterval(loadServerDrives, 5 * 60 * 1000);
      break;
    }

    case 'server-ups': {
      async function loadServerUPS() {
        const d = await fetch('/api/server/health').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerUPS(el, d);
      }
      await loadServerUPS();
      setInterval(loadServerUPS, 5 * 60 * 1000);
      break;
    }

    case 'server-load': {
      async function loadServerLoad() {
        const d = await fetch('/api/server/health').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerLoad(el, d);
      }
      await loadServerLoad();
      setInterval(loadServerLoad, 5 * 60 * 1000);
      break;
    }

    case 'server-docker': {
      async function loadServerDocker() {
        const d = await fetch('/api/server/stats').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerDocker(el, d);
      }
      await loadServerDocker();
      setInterval(loadServerDocker, 30 * 1000);
      break;
    }

    case 'server-storage': {
      async function loadServerStorage() {
        const d = await fetch('/api/server/storage').then(r => r.json()).catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderServerStorage(el, d);
      }
      await loadServerStorage();
      setInterval(loadServerStorage, 6 * 60 * 60 * 1000);
      break;
    }

    case 'stock-ticker': {
      async function loadStockTicker() {
        const d = await fetchStocks().catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderStockTicker(el, d);
      }
      await loadStockTicker();
      setInterval(loadStockTicker, 60 * 1000);
      break;
    }

    case 'stock-countdown':
      renderStockCountdown(el);
      break;

    case 'stock-charts': {
      async function loadStockCharts() {
        const d = await fetchStocks().catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderStockCharts(el, d);
      }
      await loadStockCharts();
      setInterval(loadStockCharts, 60 * 1000);
      break;
    }

    case 'jellyfin-movies': {
      async function loadJellyfinMovies() {
        const d = await fetchJellyfin().catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderJellyfinMovies(el, d);
      }
      await loadJellyfinMovies();
      setInterval(loadJellyfinMovies, 30 * 60 * 1000);
      break;
    }

    case 'jellyfin-shows': {
      async function loadJellyfinShows() {
        const d = await fetchJellyfin().catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderJellyfinShows(el, d);
      }
      await loadJellyfinShows();
      setInterval(loadJellyfinShows, 30 * 60 * 1000);
      break;
    }

    case 'movie-theaters': {
      async function loadMovieTheaters() {
        const d = await fetchMovies().catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderMovieTheaters(el, d);
      }
      await loadMovieTheaters();
      setInterval(loadMovieTheaters, 4 * 60 * 60 * 1000);
      break;
    }

    case 'movie-streaming': {
      async function loadMovieStreaming() {
        const d = await fetchMovies().catch(() => null);
        el.innerHTML = ''; el.className = 'widget';
        renderMovieStreaming(el, d);
      }
      await loadMovieStreaming();
      setInterval(loadMovieStreaming, 4 * 60 * 60 * 1000);
      break;
    }
  }

  return el;
}

// ─── Page builder ────────────────────────────────────────────────
async function buildPage(pageCfg) {
  const pageEl = document.createElement('div');
  pageEl.className = 'page';
  pageEl.dataset.pageId = pageCfg.id;

  buildBackground(pageEl, pageCfg.background || { type: 'color', value: '#0d1b2a' });

  for (const widgetCfg of pageCfg.widgets || []) {
    if (widgetCfg.enabled === false) continue;
    const el = await mountWidget(widgetCfg);
    pageEl.appendChild(el);
  }

  return pageEl;
}

// ─── Page rotation ───────────────────────────────────────────────
function showPage(idx) {
  pages.forEach((p, i) => p.classList.toggle('active', i === idx));
  document.querySelectorAll('.page-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  currentPage = idx;
  const onHome = config.pages[idx]?.id === 'home';
  const corner = document.getElementById('yl-top-right');
  if (corner) corner.hidden = !onHome;
  const hockeyBanner = document.getElementById('hockey-alert-banner');
  if (hockeyBanner) hockeyBanner.hidden = config.pages[idx]?.id !== 'hockey';
}

function startRotation() {
  if (rotateTimer) clearTimeout(rotateTimer);
  if (pages.length <= 1) return;

  const duration = (pageList[currentPage]?.duration || 300) * 1000;
  rotateTimer = setTimeout(() => {
    showPage((currentPage + 1) % pages.length);
    startRotation();
  }, duration);
}

// ─── YoLink alert banner ─────────────────────────────────────────
function computeYoLinkAlerts(data) {
  const alerts = [];
  if (!data?.sensors) return alerts;
  for (const s of data.sensors) {
    if (s.alarm?.highTemp) alerts.push({ level: 'error', msg: `🌡️ ${s.name}: high temp` });
    if (s.alarm?.lowTemp)  alerts.push({ level: 'warn',  msg: `❄️ ${s.name}: low temp` });
    if (s.alarm?.lowBattery || (s.battery != null && s.battery <= 1 && !s.alarm?.lowBattery))
      alerts.push({ level: 'warn', msg: `🔋 ${s.name}: battery low` });
    if (s.online === false)
      alerts.push({ level: 'warn', msg: `📡 ${s.name}: offline` });
    if (s.type === 'PowerFailureAlarm' && (s.alarm || s.powerSupply === false))
      alerts.push({ level: 'error', msg: `⚡ ${s.name}: POWER FAILURE` });
    if (s.type === 'COSmokeSensor') {
      if (s.smokeAlarm)    alerts.push({ level: 'error', msg: `🔥 ${s.name}: SMOKE DETECTED` });
      if (s.gasAlarm)      alerts.push({ level: 'error', msg: `☁️ ${s.name}: GAS/CO DETECTED` });
      if (s.highTempAlarm) alerts.push({ level: 'error', msg: `🌡️ ${s.name}: HIGH TEMP ALARM` });
      if (s.lowBattery)    alerts.push({ level: 'warn',  msg: `🔋 ${s.name}: battery low` });
    }
    if (s.type === 'THSensor' && s.name.toLowerCase().includes('freez')) {
      const tooWarm = s.unit === 'C' ? s.temp > -10 : s.temp > 14;
      if (tooWarm) alerts.push({ level: 'error', msg: `❄️ ${s.name}: ${s.temp}°${s.unit} — too warm!` });
    }
  }
  return alerts;
}

function updateAlertBanner(data) {
  let corner = document.getElementById('yl-top-right');
  if (!corner) {
    corner = document.createElement('div');
    corner.id = 'yl-top-right';
    document.body.appendChild(corner);
  }
  corner.hidden = config.pages[currentPage]?.id !== 'home';

  let banner = document.getElementById('yl-alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'yl-alert-banner';
    corner.appendChild(banner);
  }

  let badge = document.getElementById('yl-smoke-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'yl-smoke-badge';
    corner.appendChild(badge);
  }

  const smoke = data?.sensors?.find(s => s.type === 'COSmokeSensor');
  const alarms = smoke ? [
    smoke.smokeAlarm    && 'SMOKE',
    smoke.gasAlarm      && 'CO/GAS',
    smoke.highTempAlarm && 'HIGH TEMP',
    smoke.lowBattery    && 'LOW BATTERY',
  ].filter(Boolean) : [];
  const smokeOffline = !smoke || smoke.online === false;
  const smokeError = !smoke || smoke.error;
  badge.className = (smokeOffline || smokeError) ? 'yl-smoke-badge-warn'
    : alarms.length ? 'yl-smoke-badge-alarm'
    : 'yl-smoke-badge-ok';
  badge.innerHTML = alarms.length
    ? `<span>🔥 SMOKE ALARM</span><span>${alarms.join(' · ')}</span>`
    : (smokeOffline || smokeError)
      ? '<span>⚠ SMOKE ALARM</span><span>UNAVAILABLE</span>'
      : '<span>🛡 SMOKE ALARM</span><span>OPERATIONAL</span>';
  badge.hidden = false;

  // Power failure alarm badge
  let powerBadge = document.getElementById('yl-power-badge');
  if (!powerBadge) {
    powerBadge = document.createElement('div');
    powerBadge.id = 'yl-power-badge';
    corner.appendChild(powerBadge);
  }
  const power = data?.sensors?.find(s => s.type === 'PowerFailureAlarm');
  if (!power) {
    powerBadge.hidden = true;
  } else {
    const powerAlarm   = power.alarm || power.powerSupply === false;
    const powerOffline = power.online === false;
    powerBadge.className = powerAlarm   ? 'yl-smoke-badge-alarm'
                         : powerOffline ? 'yl-smoke-badge-warn'
                         :                'yl-smoke-badge-ok';
    powerBadge.innerHTML = powerAlarm
      ? '<span>⚡ POWER ALARM</span><span>POWER FAILURE</span>'
      : powerOffline
      ? '<span>⚡ POWER MONITOR</span><span>UNAVAILABLE</span>'
      : '<span>⚡ POWER MONITOR</span><span>OK</span>';
    powerBadge.hidden = false;
  }

  const alerts = computeYoLinkAlerts(data);
  if (!alerts.length) { banner.hidden = true; return; }

  banner.hidden = false;
  banner.innerHTML = alerts.map(a =>
    `<div class="yl-banner-row yl-banner-${a.level}">${a.msg}</div>`
  ).join('');
}

// ─── Hockey favorite teams alert ─────────────────────────────────
function updateHockeyAlerts(nhlData) {
  let banner = document.getElementById('hockey-alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'hockey-alert-banner';
    document.body.appendChild(banner);
  }
  banner.hidden = config.pages[currentPage]?.id !== 'hockey';

  if (!nhlData || !favoriteTeams.length) return;

  const todayGames = (nhlData.schedule ?? []).find(d => d.date === nhlData.todayStr)?.games ?? [];
  const matches = todayGames.filter(g =>
    favoriteTeams.some(abbr => g.awayAbbr === abbr || g.homeAbbr === abbr)
  );

  if (!matches.length) { banner.innerHTML = ''; return; }

  banner.innerHTML = matches.map(g => {
    const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT';
    const isDone = g.gameState === 'FINAL' || g.gameState === 'OFF';
    const status = isLive ? '🔴 LIVE' : isDone ? 'FINAL' : g.startTime;
    return `<div class="hockey-alert-pill">${g.awayAbbr} vs ${g.homeAbbr}<br><span>${status}</span></div>`;
  }).join('');
}

// ─── Indicator dots ──────────────────────────────────────────────
function buildIndicator(count) {
  const container = document.getElementById('page-indicator');
  container.innerHTML = '';
  if (count <= 1 || !config.site?.showScreenIndicator) return;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.className = 'page-dot';
    dot.setAttribute('aria-label', `Go to page ${i + 1}`);
    dot.addEventListener('click', () => {
      if (rotateTimer) clearTimeout(rotateTimer);
      showPage(i);
      startRotation();
    });
    container.appendChild(dot);
  }
}

// ─── Init ─────────────────────────────────────────────────────────
async function init() {
  uid = window.location.pathname.split('/').filter(Boolean)[0];
  if (!uid) { window.location.href = '/'; return; }

  config = await fetchConfig(uid);
  if (config.error) {
    document.body.innerHTML = `<div style="color:white;padding:40px;font-family:monospace">Schedule "${uid}" not found. <a href="/" style="color:#8af">← Back</a></div>`;
    return;
  }

  // ?screen=hockey pins a single screen, no rotation
  const pinnedScreen = new URLSearchParams(location.search).get('screen');
  pageList = pinnedScreen
    ? config.pages.filter(p => p.id === pinnedScreen)
    : config.pages.filter(p => p.enabled !== false);

  if (!pageList.length) {
    const msg = pinnedScreen
      ? `Screen "${pinnedScreen}" not found in orchestrator.json.`
      : 'No enabled pages in orchestrator.json';
    document.body.innerHTML = `<div style="color:white;padding:40px;font-family:monospace">${msg}</div>`;
    return;
  }

  favoriteTeams = await fetchFavoriteTeams().catch(() => []);
  await Promise.all([loadWeather(), loadAQI(), loadYoLink()]);
  setInterval(loadYoLink, 60 * 1000);

  const container = document.getElementById('pages-container');
  for (const pageCfg of pageList) {
    const el = await buildPage(pageCfg);
    container.appendChild(el);
    pages.push(el);
  }

  setInterval(async () => {
    await loadWeather();
    for (const cb of weatherCallbacks) cb();
  }, 15 * 60 * 1000);

  buildIndicator(pages.length);
  showPage(0);
  if (!pinnedScreen) startRotation();
  scheduleNightlyReload();

  const configLastUpdated = config.lastUpdated ?? 0;
  setInterval(async () => {
    try {
      const fresh = await fetchConfig(uid);
      if ((fresh.lastUpdated ?? 0) !== configLastUpdated) location.reload();
    } catch {}
  }, 5 * 60 * 1000);
}

function isNetworkError(err) {
  return err instanceof TypeError && /fetch|network|failed/i.test(err.message);
}

function showOfflineOverlay() {
  if (document.getElementById('offline-overlay')) return;
  const el = document.createElement('div');
  el.id = 'offline-overlay';
  el.innerHTML = `
    <div class="offline-content">
      <div class="offline-icon">⚡</div>
      <div class="offline-msg">Server unreachable</div>
      <div class="offline-sub">Retrying every 30 seconds…</div>
    </div>`;
  document.body.appendChild(el);

  const timer = setInterval(async () => {
    try {
      await fetchConfig(uid);
      clearInterval(timer);
      location.reload();
    } catch {}
  }, 30000);
}

init().catch(err => {
  console.error('bboard init error:', err);
  if (isNetworkError(err)) {
    showOfflineOverlay();
  } else {
    // Real JS error — show it so it's debuggable
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;background:#000;color:#f66;padding:40px;font-family:monospace;white-space:pre-wrap;z-index:9999';
    div.textContent = `Init error: ${err.message}\n\n${err.stack || ''}`;
    document.body.appendChild(div);
  }
});
