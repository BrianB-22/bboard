# bboard — Technical Design

## Architecture

```
Browser
  └─ HTTP GET /          → index.html (shell)
  └─ HTTP GET /api/config → merged JSON (schedule + screens + backgrounds)
  └─ HTTP GET /api/*      → proxied external APIs
  └─ GET /css, /js        → static assets

Server (Node.js + Express)
  ├─ Reads schedule.json
  ├─ Reads screens/*.json (per active page)
  ├─ Reads backgrounds.json
  ├─ Merges into single config object
  └─ Proxies all external APIs (weather, AQI, alerts, NHL, RSS, ICS, JSON, images)

Config Files
  ├─ schedule.json    ← master: active pages, background IDs, durations
  ├─ screens/*.json   ← widget layouts (one file per page)
  └─ backgrounds.json ← named background definitions
```

## Directory Layout

```
bboard/
├── server.js              Express server + API routes
├── schedule.json          Master orchestration
├── backgrounds.json       Background library
├── screens/               One file per page layout
│   ├── weather.json
│   └── hockey.json
├── package.json
└── public/                Static files served by Express
    ├── index.html         Minimal HTML shell
    ├── css/
    │   └── dashboard.css  All styles (CSS custom properties + BEM-ish classes)
    └── js/
        ├── dashboard.js   Main controller (ES module)
        ├── api.js         Fetch helpers
        └── widgets.js     Widget renderers (one export per widget type)
```

---

## Server

**Runtime:** Node.js 18+ (uses native `fetch`, ES modules)  
**Framework:** Express 4  
**No build step.** No transpilation. No template engine.

### Config Merge (`GET /api/config`)

The server merges three sources at request time:

1. Load `schedule.json` → get active page list
2. For each `enabled` page, load `screens/{screen}.json`
3. Resolve the `background` string to the full object from `backgrounds.json`
4. Return merged array of page objects to the client

This means changing any JSON file takes effect on the next browser reload — no restart required.

### API Proxy Strategy

All external API calls go through the server, not the browser. Reasons:

- Avoids CORS issues on APIs that don't set `Access-Control-Allow-Origin`
- Avoids mixed-content errors (HTTP image sources served from an HTTPS page)
- Hides any future API keys from client-side code
- Enables server-side parsing (RSS XML, ICS text) without browser XML APIs

Images are proxied with `arrayBuffer()` and re-sent as the correct content-type.

---

## Frontend

### Module Structure

```
dashboard.js
  ├─ imports api.js          (fetch wrappers)
  ├─ imports widgets.js      (render functions)
  ├─ loads config on init
  ├─ fetches weather + AQI in parallel before first render
  ├─ builds page DOM elements sequentially
  └─ starts rotation timer

api.js
  └─ thin wrappers around fetch() → /api/* endpoints

widgets.js
  └─ pure render functions: (element, data, config) → void
     Each function populates el.innerHTML and adds CSS classes.
     No framework, no VDOM, no reactivity.
```

### Widget Lifecycle

1. `dashboard.js` calls `mountWidget(cfg)` for each widget in a page
2. `mountWidget` creates a `<div class="widget">` and applies `style` properties from config
3. Widget-specific render function populates the div
4. For live widgets, `setInterval` calls the render function again after clearing `el.innerHTML`
5. The element is returned and appended to the page container

Data is held in module-level variables (`weatherData`, `aqiData`). Multiple widgets on a page share the same fetched data — weather is only fetched once per refresh cycle regardless of how many weather widgets are on the page.

### Page Rotation

```
showPage(idx)
  → sets .active class on target page (opacity 1, pointer-events all)
  → removes .active from all others (opacity 0, pointer-events none)
  → updates dot indicator

startRotation()
  → reads duration from config.pages[currentPage]
  → sets setTimeout for that duration
  → on fire: advances to next page, recurses
```

CSS handles the fade:
```css
.page { transition: opacity 0.8s ease; }
.page.active { opacity: 1; }
```

### Scaling

Root font size is set with `clamp()` to scale with viewport width:
```css
html { font-size: clamp(14px, 1.1vw, 24px); }
```

At 1920px wide → ~21px base  
At 2560px wide → ~24px base (clamped)  
At 1280px wide → ~14px base (clamped)

All widget font sizes use `clamp(min, vw, max)` — the vw unit grows the text proportionally; the clamp bounds prevent extremes on very small or very large screens.

Widget positions and dimensions are expressed as percentages of viewport width/height using absolute positioning inside the `.page` container (which is 100vw × 100vh).

---

## Background System

The server resolves background names to full objects. The client receives:

```json
{ "type": "picsum", "rotate": 60 }
```

`buildBackground(pageEl, bg)` in dashboard.js handles each type:

| Type | Implementation |
|---|---|
| `color` | `bgEl.style.background = bg.value` |
| `image` | `bgEl.style.backgroundImage = url(...)` |
| `picsum` | Creates `<img>` tag, generates URL using `picsum.photos/seed/{timeBucket}/{w}/{h}`. Time bucket = `floor(Date.now() / rotate_ms)` — stable within the interval, changes when it expires. Cross-fades with opacity transition. |
| `animated-gradient` | CSS `conic-gradient` on `::before` + `@keyframes` rotation. Two radial gradients on `::after` pulse with `alternate` animation. Pure CSS, no JS. |

A vignette overlay (`::after` on `.page-bg`) darkens the top and bottom edges of photo backgrounds so widget text stays readable.

---

## Widget Design Patterns

### Data Widgets
Render once on init, then re-render on a `setInterval`. Re-render clears `innerHTML` and re-adds the CSS classes before calling the render function again.

```js
el.innerHTML = '';
el.className = 'widget';
renderWeatherCurrent(el, weatherData);
```

### Shared Data
Weather and AQI are fetched once and stored in module-level variables. All widgets that need weather read from `weatherData` — the `loadWeather()` function refreshes it and individual widget intervals call it independently, but the API is only hit once per 15 minutes regardless of widget count.

### Error States
All render functions check for null/error data and render a graceful error state rather than throwing. The widget stays visible but shows an "unavailable" message.

### Alerts Widget
Special case: the alerts widget is queried by class name (`.widget-alerts-el`) for periodic updates so that all alert widgets across all pages get updated simultaneously. Initial render happens directly on the element before DOM insertion.

The widget hides itself (`display: none`) when there are no active alerts and becomes visible automatically when alerts are present.

**Mock alerts for testing:** Append `?mockAlerts` to the page URL (e.g. `http://localhost:3000?mockAlerts`) to load three fake alerts (Severe Thunderstorm Warning, Flash Flood Watch, Heat Advisory) without waiting for a real NWS event. The server's `/api/alerts` route accepts a `mock=1` query parameter to return the fake data; the client passes it automatically when `?mockAlerts` is in the URL.

---

## WMO Weather Code Mapping

Open-Meteo uses WMO weather codes (0–99). `widgets.js` includes a lookup table mapping codes to emoji icons and description strings. Unknown codes fall back to a thermometer emoji.

---

## ICS Parser

Server-side, dependency-free. Uses regex to:
1. Extract `BEGIN:VEVENT ... END:VEVENT` blocks
2. Parse `DTSTART`, `SUMMARY`, `LOCATION`, `DESCRIPTION` properties
3. Handle TZID prefix stripping, all-day format (YYYYMMDD), and datetime format (YYYYMMDDTHHmmssZ)
4. Filter out past events (> 1 hour ago)
5. Sort by start time ascending

Recurring events (RRULE) are not currently expanded — only the base occurrence is shown.

---

## RSS Parser

Server-side, dependency-free. Uses regex to:
1. Extract feed title
2. Extract `<item>` blocks
3. Parse `<title>` with CDATA support
4. Return normalized `{ feedTitle, items: [{ title, link }] }`

---

## Gauge SVG Math

Arc gauges use SVG paths. The arc spans 240° (starting at -120° from top, ending at +120°).

```js
function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}
```

Background track: full 240° arc in dim white.  
Foreground fill: `pct * 240°` arc in threshold-matched color.

---

## Adding a New Widget Type

1. **`widgets.js`** — add `export function renderMyWidget(el, data, cfg) { ... }`
2. **`dashboard.js`** — add `case 'my-widget':` in the `mountWidget` switch
3. **`dashboard.css`** — add `.widget-my-widget { ... }` styles
4. **`server.js`** — add a `/api/my-data` endpoint if needed
5. **`api.js`** — add `export async function fetchMyData()` if needed
6. Reference in a `screens/*.json` file

---

## Adding a New Screen

1. Create `screens/my-screen.json` with `{ "id": "...", "name": "...", "widgets": [...] }`
2. Add to `schedule.json` pages array: `{ "screen": "my-screen", "background": "...", "duration": 300, "enabled": true }`
3. Reload the browser

No server restart required — config is read fresh on each `/api/config` request.
