// WMO weather code → { icon, description }
const WMO = {
  0: { icon: '☀️', desc: 'Clear' },
  1: { icon: '🌤️', desc: 'Mostly Clear' },
  2: { icon: '⛅', desc: 'Partly Cloudy' },
  3: { icon: '☁️', desc: 'Overcast' },
  45: { icon: '🌫️', desc: 'Fog' },
  48: { icon: '🌫️', desc: 'Freezing Fog' },
  51: { icon: '🌦️', desc: 'Light Drizzle' },
  53: { icon: '🌦️', desc: 'Drizzle' },
  55: { icon: '🌧️', desc: 'Heavy Drizzle' },
  61: { icon: '🌧️', desc: 'Light Rain' },
  63: { icon: '🌧️', desc: 'Rain' },
  65: { icon: '🌧️', desc: 'Heavy Rain' },
  71: { icon: '🌨️', desc: 'Light Snow' },
  73: { icon: '🌨️', desc: 'Snow' },
  75: { icon: '❄️', desc: 'Heavy Snow' },
  77: { icon: '🌨️', desc: 'Snow Grains' },
  80: { icon: '🌦️', desc: 'Light Showers' },
  81: { icon: '🌧️', desc: 'Showers' },
  82: { icon: '🌧️', desc: 'Heavy Showers' },
  85: { icon: '🌨️', desc: 'Snow Showers' },
  86: { icon: '❄️', desc: 'Heavy Snow Showers' },
  95: { icon: '⛈️', desc: 'Thunderstorm' },
  96: { icon: '⛈️', desc: 'Thunderstorm w/ Hail' },
  99: { icon: '⛈️', desc: 'Severe Thunderstorm' },
};

function wmo(code) {
  return WMO[code] || { icon: '🌡️', desc: 'Unknown' };
}

function aqiCategory(value) {
  if (value <= 50)  return { label: 'Good',        color: '#69f0ae' };
  if (value <= 100) return { label: 'Moderate',    color: '#ffee58' };
  if (value <= 150) return { label: 'Unhealthy*',  color: '#ffa726' };
  if (value <= 200) return { label: 'Unhealthy',   color: '#ef5350' };
  if (value <= 300) return { label: 'Very Unhlt',  color: '#ab47bc' };
  return               { label: 'Hazardous',    color: '#b71c1c' };
}

function fmt12h(isoDateStr) {
  const d = new Date(isoDateStr);
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

function dayName(isoDateStr, idx) {
  if (idx === 0) return 'Today';
  const d = new Date(isoDateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// ─── Clock ──────────────────────────────────────────────────────
export function renderClock(el, cfg = {}) {
  el.classList.add('widget-glass', 'widget-clock');

  // ── Left: time section ──────────────────────────────────────────
  const clockSection = document.createElement('div');
  clockSection.className = 'clock-section';

  const timeEl = document.createElement('div');
  timeEl.className = 'clock-time';
  const mainEl = document.createElement('span');
  const subEl  = document.createElement('div');
  subEl.className = 'clock-sub';
  const secEl  = document.createElement('span');
  const ampmEl = document.createElement('span');
  secEl.className  = 'clock-seconds';
  ampmEl.className = 'clock-ampm';
  subEl.append(secEl, ampmEl);
  timeEl.append(mainEl, subEl);

  const dateEl = document.createElement('div');
  dateEl.className = 'clock-date';
  clockSection.append(timeEl, dateEl);
  el.appendChild(clockSection);

  // ── Right: inline week calendar (optional) ──────────────────────
  const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  let weekEl = null;
  if (cfg.weekCalendar) {
    const divider = document.createElement('div');
    divider.className = 'clock-divider';
    el.appendChild(divider);

    weekEl = document.createElement('div');
    weekEl.className = 'clock-week-section';
    el.appendChild(weekEl);
    drawWeek();
  }
  function drawWeek() {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    weekEl.innerHTML = '<div class="wcal-grid">' +
      DAY_NAMES.map((name, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const today = d.toDateString() === now.toDateString();
        return `<div class="wcal-cell${today ? ' wcal-today' : ''}">
          <span class="wcal-day">${name}</span>
          <span class="wcal-date">${d.getDate()}</span>
        </div>`;
      }).join('') + '</div>';
  }

  function tick() {
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? 'AM' : 'PM';
    h = h % 12 || 12;
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    mainEl.textContent = `${h}:${m}`;
    secEl.textContent  = s;
    ampmEl.textContent = ampm;
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    // Redraw week at midnight
    if (weekEl && now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
      drawWeek();
    }
  }

  tick();
  setInterval(tick, 1000);
}

// ─── AQI ────────────────────────────────────────────────────────
export function renderAQI(el, data) {
  el.classList.add('widget-glass', 'widget-aqi');

  if (!data || data.error) {
    el.classList.add('widget-error');
    el.textContent = 'AQI unavailable';
    return;
  }

  const val = Math.round(data.current?.us_aqi ?? 0);
  const cat = aqiCategory(val);

  el.style.borderTopColor = cat.color;

  el.innerHTML = `
    <div class="aqi-category" style="color:${cat.color}">${cat.label}</div>
    <div class="aqi-value">${val}</div>
    <div class="aqi-label">AQI</div>
  `;
}

// ─── Alerts Banner ───────────────────────────────────────────────
export function renderAlerts(el, data) {
  const alerts = data?.features ?? [];
  if (alerts.length === 0) {
    el.style.display = 'none';
    return;
  }

  el.style.display = '';
  el.classList.add('widget-alerts');

  const items = alerts.slice(0, 3).map(f => {
    const p = f.properties;
    const sev = (p.severity || '').toLowerCase();
    const color = sev === 'extreme' ? 'var(--accent-red)' :
                  sev === 'severe'  ? 'var(--accent-orange)' :
                  sev === 'moderate'? 'var(--accent-yellow)' : 'var(--accent)';
    return `<span class="alert-item" style="color:${color}">⚠ ${p.event}</span>`;
  });

  el.innerHTML = items.join('<span class="alert-sep">  ·  </span>');
}

// ─── iFrame (with optional layer cycling) ────────────────────────
export function renderIframe(el, cfg) {
  el.classList.add('widget-iframe');

  const layers = cfg.cycle?.length ? cfg.cycle : [{ src: cfg.src, label: '' }];
  const normalised = layers.map(l =>
    typeof l === 'string' ? { src: l, label: '' } : l
  );

  const chip = document.createElement('div');
  chip.className = 'iframe-layer-chip';
  el.appendChild(chip);

  let idx = 0;
  let currentFrame = null;

  function showLayer(i) {
    const layer = normalised[i];

    // Always remove old iframe and create fresh — guarantees hash URL reloads
    if (currentFrame) currentFrame.remove();
    currentFrame = document.createElement('iframe');
    currentFrame.src = layer.src;
    currentFrame.scrolling = 'no';
    el.insertBefore(currentFrame, chip);

    chip.textContent = layer.label || '';
    chip.style.display = layer.label ? '' : 'none';

    // Flash the chip so the layer change is obvious
    chip.classList.remove('layer-flash');
    void chip.offsetWidth; // force reflow to restart animation
    chip.classList.add('layer-flash');

    idx = i;
  }

  showLayer(0);

  if (normalised.length > 1) {
    setInterval(() => showLayer((idx + 1) % normalised.length),
      (cfg.cycleDuration || 60) * 1000);
  }
}

// ─── Image (with auto-refresh) ───────────────────────────────────
export function renderImage(el, cfg) {
  el.classList.add('widget-image');

  const img = document.createElement('img');
  img.alt = cfg.id || '';

  function load() {
    const sep = cfg.src.includes('?') ? '&' : '?';
    img.src = cfg.src + sep + '_t=' + Date.now();
  }

  load();
  el.appendChild(img);

  if (cfg.refresh) {
    setInterval(load, cfg.refresh * 1000);
  }
}

// ─── Weather Current ─────────────────────────────────────────────
export function renderWeatherCurrent(el, data) {
  el.classList.add('widget-glass', 'widget-weather-current');

  if (!data || data.error) {
    el.classList.add('widget-error');
    el.textContent = 'Weather unavailable';
    return;
  }

  const c   = data.current;
  const w   = wmo(c.weather_code);
  const sun = data.daily?.sunset?.[0]?.split('T')[1]?.replace(':00','') || '--';
  const sun2= (() => {
    const t = data.daily?.sunset?.[0];
    if (!t) return '--';
    const d = new Date(t);
    let h = d.getHours(); const am = h >= 12 ? 'pm':'am'; h = h%12||12;
    return `${h}:${String(d.getMinutes()).padStart(2,'0')} ${am}`;
  })();

  el.innerHTML = `
    <div class="wc-main">
      <div class="wc-temp">${Math.round(c.temperature_2m)}°</div>
      <div>
        <div class="wc-icon">${w.icon}</div>
        <div class="wc-desc">${w.desc}</div>
        <div class="wc-feels">Feels like ${Math.round(c.apparent_temperature)}°</div>
      </div>
    </div>
    <div class="wc-stats">
      <div class="wc-stat">
        <span class="wc-stat-label">🌅 Sunset</span>
        <span class="wc-stat-value">${sun2}</span>
      </div>
      <div class="wc-stat">
        <span class="wc-stat-label">💨 Wind</span>
        <span class="wc-stat-value">${Math.round(c.wind_speed_10m)} mph</span>
      </div>
      <div class="wc-stat">
        <span class="wc-stat-label">💧 Humidity</span>
        <span class="wc-stat-value">${Math.round(c.relative_humidity_2m)}%</span>
      </div>
    </div>
  `;
}

// ─── Weather Hourly ──────────────────────────────────────────────
export function renderWeatherHourly(el, data, cfg) {
  el.classList.add('widget-glass', 'widget-weather-hourly');

  if (!data || data.error) {
    el.classList.add('widget-error');
    el.textContent = 'Weather unavailable';
    return;
  }

  const now = new Date();
  const hourly = data.hourly;
  const count = cfg.hours || 6;

  // Find the index of the next hour
  let start = hourly.time.findIndex(t => new Date(t) > now);
  if (start < 0) start = 0;

  const hours = [];
  for (let i = start; i < start + count && i < hourly.time.length; i++) {
    hours.push({
      time: fmt12h(hourly.time[i]),
      icon: wmo(hourly.weather_code[i]).icon,
      temp: Math.round(hourly.temperature_2m[i]),
      precip: hourly.precipitation_probability[i],
    });
  }

  el.innerHTML = `
    <div class="wh-title">Hourly</div>
    <div class="wh-hours">
      ${hours.map(h => `
        <div class="wh-hour">
          <div class="wh-time">${h.time}</div>
          <div class="wh-icon">${h.icon}</div>
          <div class="wh-precip">💧${h.precip}%</div>
          <div class="wh-temp">${h.temp}°</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Weather Daily ───────────────────────────────────────────────
export function renderWeatherDaily(el, data, cfg) {
  el.classList.add('widget-glass', 'widget-weather-daily');

  if (!data || data.error) {
    el.classList.add('widget-error');
    el.textContent = 'Weather unavailable';
    return;
  }

  const daily = data.daily;
  const count = Math.min(cfg.days || 5, daily.time.length);

  const days = [];
  for (let i = 0; i < count; i++) {
    days.push({
      name: dayName(daily.time[i], i),
      icon: wmo(daily.weather_code[i]).icon,
      high: Math.round(daily.temperature_2m_max[i]),
      low:  Math.round(daily.temperature_2m_min[i]),
      precip: daily.precipitation_probability_max[i],
    });
  }

  el.innerHTML = `
    <div class="wd-days">
      ${days.map(d => `
        <div class="wd-day">
          <div class="wd-day-name">${d.name}</div>
          <div class="wd-icon">${d.icon}</div>
          <div class="wd-precip">💧${d.precip}%</div>
          <div class="wd-temps">
            <span class="wd-high">${d.high}°</span>
            <span class="wd-low">${d.low}°</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── NHL Scores ──────────────────────────────────────────────────
export function renderNHLScores(el, data) {
  el.classList.add('widget-glass', 'widget-nhl');

  if (!data || data.error || !data.games?.length) {
    el.innerHTML = `<div class="nhl-no-games">No games scheduled</div>`;
    return;
  }

  const todayStr = new Date().toLocaleDateString('en-CA');
  const gamesDate = data.gamesDate ?? todayStr;
  let dateLabel = '';
  if (gamesDate !== todayStr) {
    const d = new Date(gamesDate + 'T12:00:00');
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
    dateLabel = gamesDate === tomorrowStr ? 'Tomorrow' :
      d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const gameDateLabel = gamesDate !== todayStr
    ? new Date(gamesDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  const games = data.games.map(g => {
    const state = g.gameState;
    const isLive = state === 'LIVE' || state === 'CRIT';
    const isFinal = state === 'OFF' || state === 'FINAL';
    const status = isLive ? `🔴 P${g.period} ${g.clock || ''}` :
                   isFinal ? 'Final' :
                   g.startTime || '';

    return `
      <div class="nhl-game ${isLive ? 'nhl-live' : ''}">
        <div class="nhl-team">
          <span class="nhl-abbr">${g.awayAbbr}</span>
          <span class="nhl-score">${isFinal || isLive ? g.awayScore : ''}</span>
        </div>
        <div class="nhl-status">
          <span>${status}</span>
          ${gameDateLabel ? `<span class="nhl-game-date">${gameDateLabel}</span>` : ''}
        </div>
        <div class="nhl-team">
          <span class="nhl-score">${isFinal || isLive ? g.homeScore : ''}</span>
          <span class="nhl-abbr">${g.homeAbbr}</span>
        </div>
      </div>
    `;
  });

  el.innerHTML = `
    <div class="nhl-header">🏒 NHL Scores</div>
    <div class="nhl-games">${games.join('')}</div>
  `;
}

// ─── Static Text ─────────────────────────────────────────────────
export function renderText(el, cfg) {
  el.classList.add('widget-glass', 'widget-text');
  el.innerHTML = `
    ${cfg.label ? `<div class="text-label">${cfg.label}</div>` : ''}
    <div class="text-body">${cfg.html || cfg.text || ''}</div>
  `;
}

// ─── Scheduled Text ──────────────────────────────────────────────
export function renderScheduledText(el, cfg) {
  el.classList.add('widget-glass', 'widget-text');

  const sorted = [...(cfg.schedule || [])].sort((a, b) => {
    const [ah, am] = a.time.split(':').map(Number);
    const [bh, bm] = b.time.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
  });

  function update() {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    let active = { text: cfg.defaultText || '', label: cfg.label || '' };
    for (const entry of sorted) {
      const [h, m] = entry.time.split(':').map(Number);
      if (cur >= h * 60 + m) active = { text: entry.text, label: entry.label ?? cfg.label ?? '' };
    }
    el.innerHTML = `
      ${active.label ? `<div class="text-label">${active.label}</div>` : ''}
      <div class="text-body">${active.text}</div>
    `;
  }

  update();
  setInterval(update, 60 * 1000);
}

// ─── Countdown Timer ─────────────────────────────────────────────
export function renderCountdown(el, cfg) {
  el.classList.add('widget-glass', 'widget-countdown');
  const target = new Date(cfg.target);

  const labelEl = document.createElement('div');
  labelEl.className = 'text-label';
  if (cfg.label) labelEl.textContent = cfg.label;

  const displayEl = document.createElement('div');
  displayEl.className = 'cd-display';

  el.append(labelEl, displayEl);

  function tick() {
    const diff = target - new Date();
    if (diff <= 0) {
      displayEl.innerHTML = `<div class="cd-done">${cfg.completedText || 'Done!'}</div>`;
      return;
    }
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);

    const units = [];
    if (days > 0) units.push({ v: days, n: 'days' });
    units.push({ v: String(hours).padStart(2,'0'), n: 'hrs' });
    units.push({ v: String(mins).padStart(2,'0'), n: 'min' });
    if (days === 0) units.push({ v: String(secs).padStart(2,'0'), n: 'sec' });

    displayEl.innerHTML = `<div class="cd-units">${
      units.map(u => `<div class="cd-unit"><span class="cd-val">${u.v}</span><span class="cd-name">${u.n}</span></div>`).join('')
    }</div>`;
  }

  tick();
  setInterval(tick, 1000);
}

// ─── Sun Times ───────────────────────────────────────────────────
export function renderSunTimes(el, data) {
  el.classList.add('widget-glass', 'widget-sun-times');

  if (!data?.daily) {
    el.classList.add('widget-error');
    el.textContent = 'No sun data';
    return;
  }

  function fmtTime(isoStr) {
    if (!isoStr) return '--';
    const raw = isoStr.split('T')[1] || '';
    const [h, m] = raw.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  const srISO = data.daily.sunrise?.[0];
  const ssISO = data.daily.sunset?.[0];
  const diff  = srISO && ssISO ? new Date(ssISO) - new Date(srISO) : 0;
  const dayH  = Math.floor(diff / 3600000);
  const dayM  = Math.floor((diff % 3600000) / 60000);

  el.innerHTML = `
    <div class="sun-row"><span class="sun-icon">🌅</span>
      <div class="sun-info"><div class="sun-label">Sunrise</div><div class="sun-time">${fmtTime(srISO)}</div></div>
    </div>
    <div class="sun-row"><span class="sun-icon">🌇</span>
      <div class="sun-info"><div class="sun-label">Sunset</div><div class="sun-time">${fmtTime(ssISO)}</div></div>
    </div>
    ${diff ? `<div class="sun-daylength">☀️ ${dayH}h ${dayM}m of daylight</div>` : ''}
  `;
}

// ─── Gauge Widget ────────────────────────────────────────────────
export function renderGauge(el, value, cfg) {
  el.classList.add('widget-glass', 'widget-gauge');

  const min = cfg.min ?? 0;
  const max = cfg.max ?? 100;
  const unit = cfg.unit || '';
  const pct  = Math.max(0, Math.min(1, (value - min) / (max - min)));

  let color = 'var(--accent)';
  if (cfg.thresholds) {
    for (const t of cfg.thresholds) {
      if (value <= t.value) { color = t.color; break; }
    }
    if (!color) color = cfg.thresholds.at(-1)?.color || 'var(--accent)';
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startDeg, endDeg) {
    const s = polar(cx, cy, r, startDeg);
    const e = polar(cx, cy, r, endDeg);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }

  const cx = 60, cy = 65, r = 48;
  const startDeg = -120, totalDeg = 240;
  const bgPath = arcPath(cx, cy, r, startDeg, startDeg + totalDeg);
  const fgPath = pct > 0 ? arcPath(cx, cy, r, startDeg, startDeg + pct * totalDeg) : '';

  el.innerHTML = `
    ${cfg.label ? `<div class="gauge-label">${cfg.label}</div>` : ''}
    <svg viewBox="0 0 120 110" class="gauge-svg">
      <path d="${bgPath}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10" stroke-linecap="round"/>
      ${fgPath ? `<path d="${fgPath}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" class="gauge-arc"/>` : ''}
      <text x="${cx}" y="${cy + 6}" text-anchor="middle" class="gauge-value-text" fill="${color}">${Math.round(value)}${unit}</text>
      <text x="${cx}" y="${cy + 20}" text-anchor="middle" class="gauge-minmax-text">${min}${unit} – ${max}${unit}</text>
    </svg>
  `;
}

// ─── JSON Data Widget ────────────────────────────────────────────
export function renderJSON(el, data, cfg) {
  el.classList.add('widget-glass', 'widget-json');

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  if (!data || data.error) {
    el.classList.add('widget-error');
    el.textContent = cfg.errorText || 'Data unavailable';
    return;
  }

  const items = (cfg.display || []).map(d => {
    const raw = getPath(data, d.path);
    const val = raw !== undefined ? `${d.prefix || ''}${raw}${d.unit || ''}` : '—';
    return `<div class="json-row">
      <span class="json-label">${d.label}</span>
      <span class="json-value">${val}</span>
    </div>`;
  });

  el.innerHTML = `
    ${cfg.title ? `<div class="json-title">${cfg.title}</div>` : ''}
    <div class="json-rows">${items.join('')}</div>
  `;
}

// ─── Calendar Widget ─────────────────────────────────────────────
export function renderCalendar(el, data, cfg) {
  el.classList.add('widget-glass', 'widget-calendar');
  const title = cfg.title || '📅 Calendar';

  if (!data || data.error || !data.events?.length) {
    el.innerHTML = `<div class="cal-title">${title}</div><div class="cal-empty">No upcoming events</div>`;
    return;
  }

  const count = cfg.count || 5;
  const events = data.events.slice(0, count);

  el.innerHTML = `
    <div class="cal-title">${title}</div>
    <div class="cal-events">
      ${events.map(e => {
        const d = new Date(e.start);
        const isToday = new Date().toDateString() === d.toDateString();
        const dateStr = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = e.allDay ? 'All day' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `<div class="cal-event ${isToday ? 'cal-today' : ''}">
          <div class="cal-meta"><span class="cal-date">${dateStr}</span><span class="cal-time">${timeStr}</span></div>
          <div class="cal-summary">${e.summary}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

// ─── RSS Feed ────────────────────────────────────────────────────
export function renderRSS(el, data, cfg) {
  el.classList.add('widget-glass', 'widget-rss');

  if (!data || data.error || !data.items?.length) {
    el.innerHTML = `<div class="rss-empty">No news available</div>`;
    return;
  }

  const count = cfg.count || 8;
  const items = data.items.slice(0, count);

  el.innerHTML = `
    <div class="rss-title">${data.feedTitle || cfg.title || 'News'}</div>
    <div class="rss-items">
      ${items.map((item, i) => `
        <div class="rss-item">
          <span class="rss-n">${i + 1}</span>
          <span class="rss-headline">${item.title}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Week Calendar ───────────────────────────────────────────────
export function renderWeekCalendar(el) {
  el.classList.add('widget-glass', 'widget-week-calendar');

  const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  function draw() {
    const now = new Date();
    // Find Monday of the current week (week starts Monday)
    const dow = now.getDay(); // 0=Sun
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMon);
    monday.setHours(0, 0, 0, 0);

    el.innerHTML = '<div class="wcal-grid">' +
      DAY_NAMES.map((name, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const isToday = d.toDateString() === now.toDateString();
        return `<div class="wcal-cell${isToday ? ' wcal-today' : ''}">
          <span class="wcal-day">${name}</span>
          <span class="wcal-date">${d.getDate()}</span>
        </div>`;
      }).join('') +
    '</div>';
  }

  draw();

  // Re-draw at midnight
  function scheduleMidnight() {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    setTimeout(() => { draw(); scheduleMidnight(); }, ms);
  }
  scheduleMidnight();
}

// ─── NHL Schedule (multi-day with series status) ─────────────────
export function renderNHLSchedule(el, data) {
  el.classList.add('widget-glass', 'widget-nhl-sched');

  if (!data || data.error) {
    el.innerHTML = '<div class="nhl-no-games">Schedule unavailable</div>';
    return;
  }

  const isPlayoffs = data.isPlayoffs;
  const todayStr = data.todayStr || new Date().toLocaleDateString('en-CA');

  // Show 2 most-recent past days + today + all future days, up to 8 total
  const allDays = (data.schedule || []).filter(d => d.games.length > 0);
  const pastDays = allDays.filter(d => d.date < todayStr).slice(-2);
  const todayAndFuture = allDays.filter(d => d.date >= todayStr);
  const schedule = [...pastDays, ...todayAndFuture].slice(0, 8);

  if (!schedule.length) {
    el.innerHTML = `<div class="nhl-header">🏒 NHL</div><div class="nhl-no-games">Off season</div>`;
    return;
  }

  const days = schedule.map(day => {
    const isToday = day.date === todayStr;
    const d = new Date(day.date + 'T12:00:00');
    const label = isToday ? 'Today' :
      d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const rows = day.games.map(g => {
      const isLive  = g.gameState === 'LIVE' || g.gameState === 'CRIT';
      const isFinal = g.gameState === 'OFF'  || g.gameState === 'FINAL';
      const showScore = isLive || isFinal;

      const statusText = isLive  ? `🔴 P${g.period}` :
                         isFinal ? 'Final' :
                         g.startTime || '';

      let seriesTag = '';
      if (g.seriesStatus) {
        const s = g.seriesStatus;
        const abbrev = s.seriesAbbrev || '';
        const conf = abbrev.includes('SCF') ? 'F' : abbrev.includes('E') ? 'E' : abbrev.includes('W') ? 'W' : '';
        const aW = s.topSeedTeamAbbrev === g.awayAbbr ? s.topSeedWins : s.bottomSeedWins;
        const hW = s.topSeedTeamAbbrev === g.homeAbbr ? s.topSeedWins : s.bottomSeedWins;
        const leader = aW > hW ? g.awayAbbr : hW > aW ? g.homeAbbr : null;
        const seriesSum = leader ? `${leader} leads ${Math.max(aW,hW)}-${Math.min(aW,hW)}` : `Tied ${aW}-${hW}`;
        if (s.topSeedWins === 4 || s.bottomSeedWins === 4) {
          const winnerA = aW > hW ? g.awayAbbr : g.homeAbbr;
          seriesTag = `<span class="sched-series-tag sched-series-done" data-conf="${conf}">${winnerA} wins</span>`;
        } else {
          seriesTag = `<span class="sched-series-tag" data-conf="${conf}">${abbrev} · ${seriesSum}</span>`;
        }
      }

      return `
        <div class="sched-row ${isLive ? 'sched-live' : ''}">
          <div class="sched-matchup">
            <span class="sched-abbr">${g.awayAbbr}</span>
            ${showScore ? `<span class="sched-score">${g.awayScore}</span>` : ''}
            <span class="sched-at">@</span>
            ${showScore ? `<span class="sched-score">${g.homeScore}</span>` : ''}
            <span class="sched-abbr">${g.homeAbbr}</span>
          </div>
          <div class="sched-meta">
            ${seriesTag}
            <span class="sched-status">${statusText}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="sched-day-block">
        <div class="sched-day-hdr ${isToday ? 'sched-today-hdr' : ''}">${label}</div>
        ${rows}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="nhl-header">🏒 ${isPlayoffs ? 'Playoff Schedule' : 'NHL Schedule'}</div>
    <div class="sched-scroll">${days}</div>
  `;
}

// ─── NHL Playoff Bracket ─────────────────────────────────────────
export function renderNHLBracket(el, data) {
  el.classList.add('widget-glass', 'widget-nhl-bracket');

  if (!data || data.error || !data.rounds?.length) {
    el.innerHTML = '<div class="nhl-no-games">No bracket data</div>';
    return;
  }

  const ROUND_LABELS = { 1: 'R1', 2: 'R2', 3: 'Conf Finals', 4: 'Cup Final' };

  const cols = data.rounds.map(round => {
    const label = ROUND_LABELS[round.roundNumber] || round.roundAbbrev || `R${round.roundNumber}`;

    const cards = round.series.map(s => {
      const top = s.topSeed;
      const bot = s.bottomSeed;
      if (!top || !bot) return '';

      const topWon = s.winningTeamId && s.winningTeamId === top.id;
      const botWon = s.winningTeamId && s.winningTeamId === bot.id;

      const pips = (wins) => Array.from({ length: 4 }, (_, i) =>
        `<span class="bp ${i < wins ? 'bpf' : ''}"></span>`
      ).join('');

      const teamRow = (abbr, wins, won, lost) => `
        <div class="bt ${won ? 'bt-w' : ''} ${lost ? 'bt-l' : ''}">
          <span class="bt-abbr">${abbr}</span>
          <span class="bt-pips">${pips(wins)}</span>
          <span class="bt-num">${wins}</span>
        </div>`;

      return `
        <div class="bcard ${s.winningTeamId ? 'bcard-done' : ''}">
          ${teamRow(top.abbrev, top.wins, topWon, botWon)}
          ${teamRow(bot.abbrev, bot.wins, botWon, topWon)}
        </div>`;
    }).join('');

    return `
      <div class="bracket-col">
        <div class="bracket-col-hdr">${label}</div>
        <div class="bracket-col-body">${cards}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="nhl-header">🏆 Stanley Cup Playoffs ${data.currentRound ? `· Round ${data.currentRound}` : ''}</div>
    <div class="bracket-wrap">${cols}</div>
  `;
}

// ─── Astro / Calendar helpers ─────────────────────────────────────

function getMoonPhase(date) {
  const known = new Date('2000-01-06T18:14:00Z');
  const synodic = 29.53058867;
  const days = (date - known) / 86400000;
  return ((days % synodic) + synodic) % synodic;
}

function moonIcon(phase) {
  if (phase < 1.85)  return { icon: '🌑', name: 'New Moon' };
  if (phase < 7.38)  return { icon: '🌒', name: 'Waxing Crescent' };
  if (phase < 9.22)  return { icon: '🌓', name: 'First Quarter' };
  if (phase < 14.76) return { icon: '🌔', name: 'Waxing Gibbous' };
  if (phase < 16.61) return { icon: '🌕', name: 'Full Moon' };
  if (phase < 22.15) return { icon: '🌖', name: 'Waning Gibbous' };
  if (phase < 23.99) return { icon: '🌗', name: 'Last Quarter' };
  if (phase < 29.53) return { icon: '🌘', name: 'Waning Crescent' };
  return { icon: '🌑', name: 'New Moon' };
}

function getSeason(date) {
  const m = date.getMonth() + 1; // 1-indexed
  const d = date.getDate();
  const y = date.getFullYear();
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

  let name, icon, start, totalDays;
  if (m === 12 || m <= 2) {
    name = 'Winter'; icon = '❄️';
    start = new Date(m === 12 ? y : y - 1, 11, 1);
    totalDays = 31 + 31 + (isLeap ? 29 : 28);
  } else if (m <= 5) {
    name = 'Spring'; icon = '🌱';
    start = new Date(y, 2, 1);
    totalDays = 92;
  } else if (m <= 8) {
    name = 'Summer'; icon = '☀️';
    start = new Date(y, 5, 1);
    totalDays = 92;
  } else {
    name = 'Autumn'; icon = '🍂';
    start = new Date(y, 8, 1);
    totalDays = 91;
  }
  const dayOfSeason = Math.floor((date - start) / 86400000) + 1;
  return { name, icon, day: dayOfSeason, total: totalDays };
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date - start) / 86400000) + 1;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getBizDaysInMonth(date) {
  const y = date.getFullYear(), m = date.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  let biz = 0;
  for (let i = 1; i <= days; i++) {
    const dow = new Date(y, m, i).getDay();
    if (dow !== 0 && dow !== 6) biz++;
  }
  return biz;
}

function nthWeekday(y, m, dow, n) {
  // m: 0-indexed month, dow: 0=Sun, n: 1-based
  const first = new Date(y, m, 1).getDay();
  let day = (dow - first + 7) % 7 + 1;
  return day + (n - 1) * 7;
}

function lastWeekday(y, m, dow) {
  const last = new Date(y, m + 1, 0);
  return last.getDate() - (last.getDay() - dow + 7) % 7;
}

function getEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * mm + 114) / 31);
  const dy = (h + l - 7 * mm + 114) % 31 + 1;
  return { m: mo, d: dy }; // m is 1-indexed
}

function observed(y, m, d) {
  // If holiday falls Sat → observed Fri, Sun → observed Mon
  const dow = new Date(y, m - 1, d).getDay();
  if (dow === 6) return { m, d: d - 1 };
  if (dow === 0) return { m, d: d + 1 };
  return { m, d };
}

function getHolidays(year) {
  const h = []; // { m (1-based), d, label, type: 'federal'|'observance' }

  // Federal holidays
  h.push({ ...observed(year, 1, 1),   label: "New Year's Day",     type: 'federal' });
  h.push({ m: 1, d: nthWeekday(year, 0, 1, 3), label: 'MLK Day',         type: 'federal' });
  h.push({ m: 2, d: nthWeekday(year, 1, 1, 3), label: "Presidents' Day", type: 'federal' });
  h.push({ m: 5, d: lastWeekday(year, 4, 1),    label: 'Memorial Day',    type: 'federal' });
  h.push({ ...observed(year, 6, 19),  label: 'Juneteenth',          type: 'federal' });
  h.push({ ...observed(year, 7, 4),   label: 'Independence Day',    type: 'federal' });
  h.push({ m: 9, d: nthWeekday(year, 8, 1, 1),  label: 'Labor Day',       type: 'federal' });
  h.push({ m: 10, d: nthWeekday(year, 9, 1, 2), label: 'Columbus Day',    type: 'federal' });
  h.push({ ...observed(year, 11, 11), label: "Veterans Day",         type: 'federal' });
  h.push({ m: 11, d: nthWeekday(year, 10, 4, 4),label: 'Thanksgiving',    type: 'federal' });
  h.push({ ...observed(year, 12, 25), label: 'Christmas Day',        type: 'federal' });

  // Observances
  h.push({ m: 1,  d: 1,  label: "New Year's Day",    type: 'observance' });
  h.push({ m: 2,  d: 2,  label: 'Groundhog Day',      type: 'observance' });
  h.push({ m: 2,  d: 14, label: "Valentine's Day",    type: 'observance' });
  h.push({ m: 3,  d: 17, label: "St. Patrick's Day",  type: 'observance' });
  h.push({ m: 4,  d: 1,  label: "April Fools' Day",   type: 'observance' });
  const easter = getEaster(year);
  h.push({ m: easter.m, d: easter.d, label: 'Easter Sunday',         type: 'observance' });
  h.push({ m: 5,  d: nthWeekday(year, 4, 0, 2), label: "Mother's Day",    type: 'observance' });
  h.push({ m: 6,  d: 14, label: 'Flag Day',            type: 'observance' });
  h.push({ m: 6,  d: nthWeekday(year, 5, 0, 3), label: "Father's Day",    type: 'observance' });
  h.push({ m: 10, d: 31, label: 'Halloween',           type: 'observance' });
  h.push({ m: 11, d: 11, label: "Veterans Day",         type: 'observance' });
  h.push({ m: 12, d: 24, label: 'Christmas Eve',        type: 'observance' });
  h.push({ m: 12, d: 31, label: "New Year's Eve",       type: 'observance' });

  return h;
}

// ─── Astro Info Bar ───────────────────────────────────────────────
export function renderAstroInfo(el) {
  el.classList.add('widget-glass', 'widget-astro');

  function draw() {
    const now = new Date();
    const y = now.getFullYear();
    const doy = getDayOfYear(now);
    const wk = getISOWeek(now);
    const season = getSeason(now);
    const moon = moonIcon(getMoonPhase(now));

    const startOfYear = new Date(y, 0, 1);
    const endOfYear = new Date(y + 1, 0, 1);
    const pct = Math.round(((now - startOfYear) / (endOfYear - startOfYear)) * 100);
    const daysLeft = Math.ceil((endOfYear - now) / 86400000);
    const bizDays = getBizDaysInMonth(now);
    const mo = now.getMonth() + 1;
    const monthName = now.toLocaleDateString('en-US', { month: 'short' });

    el.innerHTML = `
      <div class="astro-row astro-top">
        <span class="astro-moon">${moon.icon} ${moon.name}</span>
        <span class="astro-sep">·</span>
        <span class="astro-season">${season.icon} ${season.name} &middot; Day ${season.day} of ${season.total}</span>
      </div>
      <div class="astro-progress">
        <span class="astro-year">${y}</span>
        <div class="astro-bar-wrap">
          <div class="astro-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="astro-pct">${pct}%</span>
      </div>
      <div class="astro-row astro-stats">
        <span>Day ${doy}</span>
        <span class="astro-dot">·</span>
        <span>Mo ${mo}</span>
        <span class="astro-dot">·</span>
        <span>Wk ${wk}</span>
        <span class="astro-dot">·</span>
        <span>${daysLeft} days left in ${y}</span>
        <span class="astro-dot">·</span>
        <span>${bizDays} biz days in ${monthName}</span>
      </div>
    `;
  }

  draw();
  // Redraw at midnight
  const now = new Date();
  const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
  setTimeout(() => { draw(); setInterval(draw, 86400000); }, msToMidnight);
}

// ─── Month Calendar ───────────────────────────────────────────────
export function renderCalendarMonth(el, customDates = []) {
  el.classList.add('widget-glass', 'widget-cal');

  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const todayDate = today.getDate();

  const holidays = getHolidays(year);

  // Build lookup: "M-D" → [{label, type}]
  const lookup = {};
  const add = (m, d, label, type) => {
    const key = `${m}-${d}`;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push({ label, type });
  };

  holidays.forEach(h => {
    if (h.m === month + 1) add(h.m, h.d, h.label, h.type);
  });

  customDates.forEach(c => {
    if (c.month === month + 1 && (!c.year || c.year === year)) {
      add(c.month, c.day, c.label, c.color || 'custom');
    }
  });

  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build grid cells
  let cells = '';
  // Leading blanks
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell cal-empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (firstDow + d - 1) % 7;
    const isToday = d === todayDate;
    const isWeekend = dow === 0 || dow === 6;
    const events = lookup[`${month + 1}-${d}`] || [];

    const federal = events.find(e => e.type === 'federal');
    const observance = events.find(e => e.type === 'observance');
    const custom = events.find(e => e.type === 'custom' || e.type === 'cyan' || e.type === 'personal');

    const topEvent = federal || custom || observance;
    const extraCount = events.length - (topEvent ? 1 : 0);

    cells += `
      <div class="cal-cell ${isToday ? 'cal-today' : ''} ${isWeekend ? 'cal-weekend' : ''} ${federal ? 'cal-has-federal' : ''}">
        <div class="cal-day-num">${d}</div>
        ${topEvent ? `<div class="cal-event cal-event-${topEvent.type}">${topEvent.label}</div>` : ''}
        ${extraCount > 0 ? `<div class="cal-event-more">+${extraCount}</div>` : ''}
      </div>`;
  }

  el.innerHTML = `
    <div class="cal-month-hdr">${monthLabel}</div>
    <div class="cal-dow-row">${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
  `;
}

// ─── YoLink Sensors ──────────────────────────────────────────────
export function renderYoLink(el, data) {
  el.classList.add('widget-glass', 'widget-yolink');

  if (!data || data.error || !data.sensors?.length) {
    el.innerHTML = '<div class="yl-empty">Sensor data unavailable</div>';
    return;
  }

  const sensors = data.sensors;
  const temps    = sensors.filter(s => s.type === 'THSensor');
  const doors    = sensors.filter(s => s.type === 'DoorSensor');
  const motions  = sensors.filter(s => s.type === 'MotionSensor');

  function timeSince(ms) {
    if (!ms) return '';
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // Collect system-level alerts across all sensors
  const alerts = [];
  sensors.forEach(s => {
    if (s.battery != null && s.battery <= 1) alerts.push(`🔋 ${s.name} battery low`);
    if (s.alarm?.lowBattery) alerts.push(`🔋 ${s.name} battery low`);
    if (s.alarm?.highTemp) alerts.push(`🌡️ ${s.name} high temp`);
    if (s.alarm?.lowTemp)  alerts.push(`❄️ ${s.name} low temp`);
  });

  const alertHTML = alerts.length ? `
    <div class="yl-alerts">
      ${alerts.map(a => `<div class="yl-alert-row">⚠️ ${a}</div>`).join('')}
    </div>` : '';

  const tempHTML = temps.length ? `
    <div class="yl-section">
      <div class="yl-section-title">🌡️ Temperature</div>
      <div class="yl-temp-grid">
        ${temps.map(s => {
          const isFreezer = s.name.toLowerCase().includes('freez');
          const tempAlert = isFreezer && s.temp != null &&
            (s.unit === 'C' ? s.temp > -10 : s.temp > 14);
          const tempColor = tempAlert ? 'var(--accent-red)' : '';
          return `<div class="yl-temp-card ${tempAlert ? 'yl-alert' : ''}">
            <div class="yl-temp-name">${s.name}</div>
            <div class="yl-temp-val" style="color:${tempColor}">${s.temp != null ? s.temp.toFixed(1) : '--'}°${s.unit}</div>
            <div class="yl-temp-hum">💧 ${s.humidity != null ? s.humidity.toFixed(0) : '--'}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const doorHTML = doors.length ? `
    <div class="yl-section">
      <div class="yl-section-title">🚪 Doors</div>
      <div class="yl-door-list">
        ${doors.map(s => `
          <div class="yl-door-row">
            <span class="yl-door-dot ${s.open ? 'yl-open' : 'yl-closed'}"></span>
            <span class="yl-door-name">${s.name}</span>
            <span class="yl-door-state ${s.open ? 'yl-open-text' : ''}">${s.open ? 'OPEN' : 'Closed'}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  const motionHTML = motions.length ? `
    <div class="yl-section">
      <div class="yl-section-title">📬 Activity</div>
      <div class="yl-door-list">
        ${motions.map(s => `
          <div class="yl-door-row">
            <span class="yl-door-dot ${s.motion ? 'yl-open' : 'yl-closed'}"></span>
            <span class="yl-door-name">${s.name}</span>
            <span class="yl-door-state">${timeSince(s.stateChangedAt)}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  el.innerHTML = alertHTML + tempHTML + doorHTML + motionHTML;
}
