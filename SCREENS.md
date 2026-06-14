# bboard Screen & Background Design Spec

Reference for building screen JSON files and background definitions from scratch. Covers structure, positioning, every widget type, all config params, and conventions used across the codebase.

---

## Screen JSON

Every screen lives in `screens/<name>.json`. The file is referenced from `schedule.json` by its filename (without `.json`). The `id` field **must match the filename** — it is used for `?screen=<id>` direct URL navigation. Missing `id` produces "Screen not found in schedule.json" even if the file exists.

### Top-level structure

```json
{
  "id": "my-screen",
  "name": "My Screen",
  "widgets": []
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | **yes** | Matches the filename. Used for `?screen=<id>` URL pinning. |
| `name` | **yes** | Display name shown in the admin page. |
| `widgets` | **yes** | Array of widget objects. |

---

## Widget object

Every widget in the `widgets` array shares this base shape:

```json
{
  "type": "widget-type",
  "id": "unique-id",
  "enabled": true,
  "style": {
    "top": "10%",
    "left": "5%",
    "width": "40%",
    "height": "25%"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | **yes** | Widget type identifier (see catalog below). |
| `id` | no | Optional stable DOM id. Useful for debugging; not required. |
| `enabled` | no | Set to `false` to hide the widget without removing it. Defaults to `true`. |
| `style` | **yes** | Absolute positioning within the screen. All values are percentages. |

### Positioning system

Widgets are absolutely positioned inside a full-viewport page element. All values are **percentage strings** of the parent (the screen).

Valid position properties: `top`, `left`, `bottom`, `right`, `width`, `height`.

Use `top`+`left` for most widgets. Use `bottom` instead of `top` when anchoring to the bottom edge is more natural (e.g. weather strips).

```json
"style": { "top": "2%", "left": "2%", "width": "96%", "height": "10%" }
```

#### Layout conventions

- Outer margins are typically `1–2%` on each side
- Full-width widgets span `96–99%` width with `~2%` left margin
- Leave `1–2%` gaps between adjacent widgets to prevent overlap
- Row-based layouts: establish row tops, then fill left-to-right using matching `top` values
- Widgets can use `bottom: "0%"` to anchor to the screen bottom regardless of height

#### Layout math

When dividing a row across N equal columns with small gaps:
- Each column: `width ≈ (96 / N) - gap%`
- Column starts: `left = 2% + (col * (width + gap))`

Example — 4 equal columns with 0.5% gap:
- Width: `23.5%`, starts at `0.5%`, `25%`, `50%`, `75.5%`

---

## Widget catalog

### `clock`

Live time and date display with optional inline week calendar.

```json
{
  "type": "clock",
  "weekCalendar": true,
  "style": { "top": "1%", "left": "0.5%", "width": "46%", "height": "11%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `weekCalendar` | `false` | Adds a compact Mon–Sun week row below the time. |

---

### `aqi`

Air Quality Index badge. Data comes from Open-Meteo; updates every 10 minutes. No params beyond `style`.

```json
{ "type": "aqi", "style": { "top": "0.5%", "right": "0.5%", "width": "12%", "height": "12%" } }
```

---

### `alerts`

NWS weather alerts scrolling banner. Polls every 5 minutes. No params beyond `style`.

```json
{ "type": "alerts", "style": { "top": "1%", "left": "47%", "width": "38%", "height": "7%" } }
```

---

### `weather-current`

Current conditions: temperature, feels-like, wind, humidity, UV, weather icon. Updates with weather data.

```json
{ "type": "weather-current", "style": { "bottom": "0%", "left": "0%", "width": "30%", "height": "27%" } }
```

No widget-specific params.

---

### `weather-hourly`

Hourly forecast strip. Updates with weather data.

```json
{
  "type": "weather-hourly",
  "hours": 4,
  "style": { "bottom": "0%", "left": "30%", "width": "30%", "height": "27%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `hours` | `6` | Number of hours to show. |

---

### `weather-daily`

Daily forecast strip. Updates with weather data.

```json
{
  "type": "weather-daily",
  "days": 4,
  "style": { "bottom": "0%", "left": "60%", "width": "40%", "height": "27%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `days` | `5` | Number of days to show. Max 5. |

---

### `sun-times`

Sunrise and sunset times for the configured location. Updates with weather data.

```json
{ "type": "sun-times", "style": { "top": "5%", "left": "50%", "width": "20%", "height": "10%" } }
```

No widget-specific params.

---

### `iframe`

Embedded URL. Supports a `cycle` array for cycling through multiple sources.

**Single source:**
```json
{
  "type": "iframe",
  "src": "https://earth.nullschool.net/#current/wind/...",
  "style": { "top": "13%", "left": "0%", "width": "33%", "height": "60%" }
}
```

**Cycling sources:**
```json
{
  "type": "iframe",
  "cycle": [
    { "src": "https://...", "label": "Wind" },
    { "src": "https://...", "label": "Temp" }
  ],
  "cycleDuration": 30,
  "style": { "top": "13%", "left": "0%", "width": "33%", "height": "60%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `src` | — | URL to embed (single source). |
| `cycle` | — | Array of `{ src, label }` to rotate through. Overrides `src`. |
| `cycleDuration` | `60` | Seconds between cycle steps. |

---

### `image`

Static or auto-refreshing image. Use `/api/proxy-image?url=` for external images that don't support CORS.

```json
{
  "type": "image",
  "src": "/api/proxy-image?url=https%3A%2F%2Fradar.weather.gov%2F...",
  "refresh": 300,
  "style": { "top": "13%", "left": "67%", "width": "33%", "height": "60%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `src` | — | Image URL. Use URL-encoded `/api/proxy-image?url=` for external sources. |
| `refresh` | — | Seconds between image refreshes. Omit for static images. |

---

### `rss`

RSS feed headline ticker.

```json
{
  "type": "rss",
  "url": "https://www.nhl.com/rss/news.xml",
  "title": "NHL News",
  "count": 10,
  "refresh": 600,
  "style": { "top": "1%", "left": "21%", "width": "35%", "height": "9%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `url` | — | RSS feed URL. |
| `title` | — | Label shown above headlines. |
| `count` | `8` | Number of headlines to cycle through. |
| `refresh` | `600` | Seconds between feed refreshes. |

---

### `text`

Static text or HTML block.

```json
{
  "type": "text",
  "label": "Note",
  "text": "Hello world",
  "style": { "top": "5%", "left": "5%", "width": "30%", "height": "10%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `text` | — | Plain text content. |
| `html` | — | Raw HTML content (use instead of `text` for markup). |
| `label` | — | Small label rendered above the body. |

---

### `scheduled-text`

Shows different text based on time of day.

```json
{
  "type": "scheduled-text",
  "label": "Status",
  "defaultText": "Closed",
  "schedule": [
    { "time": "08:00", "text": "Open", "label": "Hours" },
    { "time": "17:00", "text": "Closing Soon" },
    { "time": "18:00", "text": "Closed" }
  ],
  "style": { "top": "5%", "left": "5%", "width": "30%", "height": "10%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `defaultText` | `''` | Text shown before the first schedule entry each day. |
| `label` | — | Default label (can be overridden per entry). |
| `schedule` | `[]` | Array of `{ time: "HH:MM", text, label? }`. Active entry is the last one whose time has passed. |

---

### `countdown`

Countdown to a target date.

```json
{
  "type": "countdown",
  "label": "Until Christmas",
  "target": "2025-12-25T00:00:00",
  "style": { "top": "5%", "left": "5%", "width": "20%", "height": "12%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `target` | — | ISO 8601 date string to count down to. |
| `label` | — | Label shown above the countdown. |

---

### `gauge`

Circular gauge. Can show a static value or poll a JSON endpoint.

```json
{
  "type": "gauge",
  "label": "CPU",
  "url": "/api/server/stats",
  "path": "cpu",
  "refresh": 30,
  "min": 0,
  "max": 100,
  "unit": "%",
  "thresholds": [
    { "value": 70, "color": "#4caf7d" },
    { "value": 90, "color": "#f5c542" },
    { "value": 101, "color": "#f08080" }
  ],
  "style": { "top": "5%", "left": "5%", "width": "15%", "height": "20%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `value` | `0` | Static value (used when no `url`). |
| `url` | — | JSON endpoint to fetch value from. |
| `path` | — | Dot-notation path into the JSON response (e.g. `"cpu"`, `"stats.cpu"`). |
| `refresh` | — | Seconds between polls (only used when `url` is set). |
| `min` | `0` | Gauge minimum. |
| `max` | `100` | Gauge maximum. |
| `unit` | `''` | Unit label shown inside the gauge (e.g. `"%"`, `"°C"`). |
| `label` | — | Label shown below the gauge. |
| `thresholds` | — | Array of `{ value, color }` sorted ascending. The last threshold whose `value` exceeds the current value sets the gauge color. |

---

### `json`

Fetches a JSON endpoint and displays selected fields.

```json
{
  "type": "json",
  "url": "/api/server/stats",
  "refresh": 30,
  "title": "Server",
  "display": [
    { "label": "CPU", "path": "cpu", "unit": "%" },
    { "label": "RAM", "path": "ram.used" }
  ],
  "style": { "top": "5%", "left": "5%", "width": "25%", "height": "20%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `url` | — | JSON endpoint. |
| `refresh` | `60` | Seconds between polls. |
| `title` | — | Heading shown above the fields. |
| `display` | `[]` | Array of `{ label, path, unit? }` — `path` is dot-notation into the response. |

---

### `calendar`

iCal calendar feed.

```json
{
  "type": "calendar",
  "url": "https://calendar.google.com/...",
  "title": "Events",
  "count": 5,
  "refresh": 3600,
  "style": { "top": "5%", "left": "5%", "width": "30%", "height": "40%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `url` | — | iCal (.ics) URL. |
| `title` | `'📅 Calendar'` | Heading. |
| `count` | `5` | Max events to display. |
| `refresh` | `3600` | Seconds between feed refreshes. |

---

### `calendar-month`

Full month calendar with federal holidays, observances, and custom dates from `data/custom-dates.json`. No params beyond `style`. Redraws at midnight.

```json
{ "type": "calendar-month", "style": { "top": "14%", "left": "0.5%", "width": "99%", "height": "85%" } }
```

---

### `astro-info`

Bar showing moon phase, meteorological season + day-of-season, year progress, and day/week/biz-day counters. No params beyond `style`.

```json
{ "type": "astro-info", "style": { "top": "1%", "left": "23.5%", "width": "76%", "height": "11%" } }
```

---

### `nhl-scores`

NHL scoreboard for today's games. Polls every 60 seconds.

```json
{ "type": "nhl-scores", "style": { "top": "11%", "left": "0%", "width": "28%", "height": "88%" } }
```

No widget-specific params.

---

### `nhl-schedule`

Playoff or regular-season schedule with series badges. Polls every 5 minutes.

```json
{ "type": "nhl-schedule", "style": { "top": "11%", "left": "29%", "width": "30%", "height": "88%" } }
```

No widget-specific params.

---

### `nhl-bracket`

Stanley Cup playoff bracket with conference colors and pip dots. Polls every 10 minutes.

```json
{ "type": "nhl-bracket", "style": { "top": "11%", "left": "60%", "width": "40%", "height": "88%" } }
```

No widget-specific params.

---

### `yolink-door`

Door/window sensor — shows open/closed state with elapsed time.

```json
{
  "type": "yolink-door",
  "device": "Front Door",
  "style": { "top": "12%", "left": "0.5%", "width": "23.5%", "height": "28%" }
}
```

| Param | Required | Description |
|-------|----------|-------------|
| `device` | **yes** | Exact device name from YoLink app, or use `deviceId` for the YoLink device ID. |
| `deviceId` | — | Alternative to `device` — matches on device ID. |

---

### `yolink-temp`

Temperature/humidity sensor with a sparkline graph of recent readings.

```json
{
  "type": "yolink-temp",
  "device": "Outdoor Temp",
  "hours": 24,
  "style": { "top": "72%", "left": "0.5%", "width": "32%", "height": "27%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `device` | — | Device name or use `deviceId`. |
| `hours` | `24` | Hours of history to show in the graph. |

---

### `yolink-outlet`

Smart outlet widget showing on/off state and power consumption.

```json
{
  "type": "yolink-outlet",
  "device": "Outside Power",
  "hideWhenOff": true,
  "style": { "top": "1%", "left": "48%", "width": "24%", "height": "9%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `device` | — | Device name or use `deviceId`. |
| `hideWhenOff` | `false` | Hides the widget entirely when the outlet is off. |

---

### `yolink-smoke`

CO/smoke detector badge.

```json
{
  "type": "yolink-smoke",
  "device": "Smoke Alarm",
  "style": { "top": "1%", "left": "74%", "width": "24%", "height": "9%" }
}
```

| Param | Required | Description |
|-------|----------|-------------|
| `device` | **yes** | Device name or use `deviceId`. |

---

### Server widgets

All server widgets require the bboard process to be running on the monitored machine. `server-hardware`, `server-drives`, `server-ups`, and `server-load` additionally require `bboard-health.sh` running via cron.

#### `server-stats`

System stats bar: CPU%, RAM, swap, root disk, uptime. Polls `/api/server/stats` every 30s.

```json
{
  "type": "server-stats",
  "label": "Home Server",
  "style": { "top": "2%", "left": "2%", "width": "96%", "height": "10%" }
}
```

| Param | Default | Description |
|-------|---------|-------------|
| `label` | — | Name shown on the left with a vertical divider. E.g. `"Home Server"`. |

#### `server-hardware`

CPU, PCH, and ambient temperatures with fill bars, plus processor and motherboard fan speeds. Polls `/api/server/health` every 5 min. Shows **stale** badge if health file is older than 5 minutes.

```json
{ "type": "server-hardware", "style": { "top": "14%", "left": "2%", "width": "24%", "height": "40%" } }
```

#### `server-drives`

Per-drive temperature list with fill bars. SSD (hddtemp) gets an SSD badge; spindle drives come from smartctl. Same poll/stale behavior as `server-hardware`.

```json
{ "type": "server-drives", "style": { "top": "14%", "left": "28%", "width": "16%", "height": "40%" } }
```

#### `server-ups`

CyberPower UPS status: battery bar, state badge (NORMAL / ON BATTERY), source, voltage, runtime, load watts/percent, last event. Same poll/stale behavior.

```json
{ "type": "server-ups", "style": { "top": "14%", "left": "46%", "width": "26%", "height": "40%" } }
```

#### `server-load`

Load average (1m/5m/15m) as horizontal bars scaled to CPU core count, plus SSH session count and failed systemd services. Same poll/stale behavior.

```json
{ "type": "server-load", "style": { "top": "14%", "left": "74%", "width": "24%", "height": "40%" } }
```

#### `server-docker`

Docker container grid: name, image, running/exited/restarting state, uptime. Polls `/api/server/stats` every 30s.

```json
{ "type": "server-docker", "style": { "top": "56%", "left": "2%", "width": "44%", "height": "42%" } }
```

#### `server-storage`

Drive pair table: `/dataN ↔ /backupN` with fill bar, used/total, backup size, and age of last backup. Age colors: <30d dim, 30–60d yellow, >60d red. Polls `/api/server/storage` every 2 min.

```json
{ "type": "server-storage", "style": { "top": "56%", "left": "48%", "width": "50%", "height": "42%" } }
```

---

## Backgrounds

Backgrounds are defined in `backgrounds.json` and referenced by name in `schedule.json`.

### backgrounds.json structure

```json
{
  "my-background": {
    "type": "...",
    ...type-specific fields...
  }
}
```

The key is the background name used in `schedule.json`. The `type` field determines how it renders.

---

### Background types

#### `color`

Static CSS background — any valid CSS `background` value including gradients.

```json
"dark-blue": {
  "type": "color",
  "value": "linear-gradient(to bottom, #1a1a2e 0%, #16213e 40%, #0f3460 100%)"
}
```

| Field | Description |
|-------|-------------|
| `value` | Any CSS `background` value: solid color, gradient, or multi-stop gradient. |

---

#### `aurora`

Animated blob background — 4 large blurred color orbs drifting slowly. Colors and positions are hardcoded in JS (green, purple, blue, magenta). No config fields.

```json
"animated-aurora": {
  "type": "aurora"
}
```

---

#### `neon-tech`

Dark cyberpunk aesthetic — scrolling cyan grid over a near-black base, with 4 slow-moving neon blobs (cyan, magenta, blue, purple) and subtle scanlines. No config fields.

```json
"neon-tech": {
  "type": "neon-tech"
}
```

---

#### `hockey-arena`

Ice rink glow from below + warm overhead arena lights, both animated. No config fields.

```json
"hockey-night": {
  "type": "hockey-arena"
}
```

---

#### `picsum`

Rotating photos from [picsum.photos](https://picsum.photos/). Uses a time-bucketed seed so photos stay stable during a rotation cycle.

```json
"picsum-nature": {
  "type": "picsum",
  "keywords": "nature,landscape",
  "rotate": 60,
  "blur": false
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `keywords` | — | Comma-separated keywords passed to picsum. |
| `rotate` | `60` | Seconds between photo changes. |
| `blur` | `false` | Apply blur to the photo. |

---

## schedule.json

Ties backgrounds to screens and controls rotation order.

```json
{
  "site": {
    "title": "bboard",
    "location": {
      "lat": 34.92,
      "lon": -80.73,
      "name": "City, State"
    },
    "showScreenIndicator": true
  },
  "pages": [
    {
      "screen": "weather",
      "background": "animated-aurora",
      "duration": 60,
      "enabled": true
    }
  ]
}
```

### `site` fields

| Field | Description |
|-------|-------------|
| `title` | Browser tab title. |
| `location.lat` / `.lon` | Used for weather, AQI, alerts, and sun times. Set via admin page postal code lookup. |
| `location.name` | Human-readable location name shown in weather widgets. |
| `showScreenIndicator` | Show clickable dot indicator at the bottom of every screen. |

### `pages` entry fields

| Field | Description |
|-------|-------------|
| `screen` | Filename of the screen (without `.json`) in `screens/`. Must have a matching `id` inside the file. |
| `background` | Key from `backgrounds.json`. |
| `duration` | Seconds to show this screen before advancing. |
| `enabled` | Set to `false` to skip this screen in rotation (it can still be reached via `?screen=<id>`). |

---

## Conventions and patterns

### Gaps and margins

- Standard outer margin: `2%` (`left: "2%"`, `top: "2%"`)
- Gap between adjacent widgets: `1–2%`
- Full-width widgets: `left: "2%"`, `width: "96%"`
- Edge-to-edge (no margin): `left: "0%"`, `width: "100%"` — use for backgrounds and iframes

### Typical row heights

| Content | Typical height |
|---------|----------------|
| Thin stat bar | `8–12%` |
| Small widget (badge, outlet) | `9–12%` |
| Medium widget (door sensor, temp) | `25–30%` |
| Large widget (bracket, calendar) | `40–88%` |
| Full remaining height | `100% - top%` |

### Widget sizing guidelines

- Widgets render responsively within whatever size you give them — going too small will clip content
- `server-stats` works well as a thin bar: `height: "10–12%"`
- Temperature/door sensor widgets need at least `height: "25%"` to show their content clearly
- Calendar month needs most of the screen: `height: "80–88%"` is typical

### Naming conventions

- Screen `id`: lowercase, hyphenated — `"home"`, `"hockey"`, `"server"`
- Widget `id`: optional but if used, kebab-case — `"home-clock"`, `"door-front"`
- Background names: lowercase, hyphenated — `"dark-blue"`, `"neon-tech"`

### Disabling widgets

Set `"enabled": false` on any widget to hide it without removing it from the file. Useful for seasonal widgets or work-in-progress layouts.

```json
{ "type": "nhl-bracket", "enabled": false, "style": { ... } }
```

### Direct URL access

Pin to a single screen by appending `?screen=<id>` to the bboard URL:

```
http://192.168.0.75:3030/?screen=server
```

This works even if the screen is set to `"enabled": false` in `schedule.json`. The screen's JSON file **must have a matching `id` field** or this returns a "not found" error.

---

## Design guide

This section is the practical companion to the spec above — how to think about composing a screen, what sizes work, and how to lay out a new screen from scratch without trial and error.

---

### The coordinate system in plain terms

The screen is always full-viewport. Treat it as a 100×100 grid where every value is a percentage. `top: "10%"` means 10% down from the top edge. Widgets don't interact with each other — there is no flex, no flow, no margin collapse. You place everything by hand. Overlap is possible and sometimes intentional (e.g. a badge over a map) but usually a mistake.

The display this is designed for is a **16:9 landscape TV or monitor**. Design for that ratio. Vertical space is more precious than horizontal.

---

### Widget minimum usable sizes

Going below these will clip content or make text unreadable at TV viewing distance:

| Widget | Min width | Min height | Notes |
|--------|-----------|------------|-------|
| `clock` | 20% | 9% | Wider if `weekCalendar: true` (needs ~40%+) |
| `aqi` | 10% | 10% | Square looks best |
| `alerts` | 30% | 6% | Short, wide |
| `weather-current` | 25% | 22% | Needs height for icon + stats |
| `weather-hourly` | 25% | 20% | Gets cramped under 4 hours |
| `weather-daily` | 30% | 20% | |
| `iframe` | 25% | 35% | Maps need room to be readable |
| `image` | 20% | 20% | |
| `yolink-door` | 20% | 22% | Smaller is fine for a compact row |
| `yolink-temp` | 28% | 22% | Graph needs height |
| `nhl-scores` | 22% | 50% | Tall — needs room for multiple games |
| `nhl-schedule` | 25% | 50% | |
| `nhl-bracket` | 35% | 60% | Bracket is wide |
| `calendar-month` | 80% | 70% | Needs most of the screen |
| `astro-info` | 50% | 9% | Short bar widget |
| `server-stats` | 60% | 8% | Thin bar |
| `server-hardware` | 18% | 35% | |
| `server-drives` | 12% | 35% | Can be narrow |
| `server-ups` | 20% | 35% | |
| `server-load` | 18% | 35% | |
| `server-docker` | 35% | 30% | Needs width for 3-column card grid |
| `server-storage` | 40% | 30% | Table needs width for all columns |

---

### Layout archetypes

Most screens fit one of these patterns. Start from the closest one and adjust.

#### Header + body

A thin bar across the top (clock, status) with one or two large widgets filling the rest.

```
┌─────────────────────────────────────────┐
│  clock / status bar          top 1–12%  │
├─────────────────────────────────────────┤
│                                         │
│         main content                    │
│         top 14–98%                      │
│                                         │
└─────────────────────────────────────────┘
```

Used by: `calendar` screen (clock + astro bar, then full calendar).

#### Header + columns

Top bar, then 2–4 equal columns below.

```
┌─────────────────────────────────────────┐
│  header                      top 1–12%  │
├───────────┬───────────┬─────────────────┤
│  col A    │  col B    │  col C          │
│  top 14%  │  top 14%  │  top 14%        │
│           │           │                 │
└───────────┴───────────┴─────────────────┘
```

Used by: `home` screen (clock, then 4 door sensors × 2 rows, then 3 temp graphs).

#### Header + rows

Top bar, then stacked full-width or near-full-width sections.

```
┌─────────────────────────────────────────┐
│  header bar                  top 2–12%  │
├─────────────────────────────────────────┤
│  row 1                      top 14–54%  │
├─────────────────────────────────────────┤
│  row 2A          │  row 2B  top 56–98%  │
└──────────────────┴──────────────────────┘
```

Used by: `server` screen (stats bar, then 4 health widgets, then docker + storage).

#### Map + strip

Large map or visual widget covering the middle, small widgets top and bottom.

```
┌─────────────────────────────────────────┐
│  top widgets                 top 1–12%  │
├──────────┬──────────┬───────────────────┤
│          │          │                   │
│  map /   │  map /   │  map /            │
│  iframe  │  iframe  │  iframe           │
│         top 13–73%                      │
├──────────┴──────────┴───────────────────┤
│  bottom strip               top 74–98%  │
└─────────────────────────────────────────┘
```

Used by: `weather` screen (clock + alerts + AQI, then 3 maps, then weather strip).

---

### Row arithmetic

The most common layout mistake is rows that don't add up. Use this formula before writing coordinates:

```
top of row N+1 = top of row N + height of row N + gap (1–2%)
```

Example — 3 rows with 2% margins and 2% gaps:
- Row 1: `top: 2%`, `height: 12%` → ends at 14%
- Gap: 2%
- Row 2: `top: 16%`, `height: 38%` → ends at 54%
- Gap: 2%
- Row 3: `top: 56%`, `height: 42%` → ends at 98% ✓

Always verify the last row ends at or before 98%.

### Column arithmetic

For N columns across a row, with standard 2% outer margins and ~1% gaps:

```
available width = 96%
each column width = (96 - (N-1) × gap) / N
column N left = 2% + N × (width + gap)
```

Example — 4 columns, 0.5% gap:
- Width: `(96 - 1.5) / 4 = 23.6%` → round to `23.5%`
- Starts: `2%`, `26%`, `50%`, `74%`

Example — 3 columns, 1% gap:
- Width: `(96 - 2) / 3 = 31.3%` → round to `31%`
- Starts: `2%`, `34%`, `66%`

---

### Background pairing

Match backgrounds to screen content and mood:

| Screen type | Recommended background |
|-------------|----------------------|
| Weather | `animated-aurora` — dynamic, atmospheric |
| Sports | `hockey-night` — thematic |
| Calendar | `dark-slate` — neutral, doesn't compete with text |
| Home/sensors | `dark-blue` — calm, easy to read |
| Server/tech | `neon-tech` — fits the aesthetic |
| Photo slideshow | `picsum-nature` / `picsum-space` / `picsum-city` |

Avoid `animated-aurora` and `picsum-*` for dense data screens (server, calendar) — the movement competes with text. Use `dark-slate` or `dark-blue` when maximum readability matters.

---

### Existing screen layouts (reference)

These are the actual coordinates used in production. Use as a starting point when creating similar screens.

#### weather screen

```
clock (weekCalendar)     top:1%  left:0.5%  w:46%  h:11%
alerts                   top:1%  left:47%   w:38%  h:7%
aqi                      top:0.5% right:0.5% w:12% h:12%
iframe (wind map)        top:13% left:0%    w:33%  h:60%
image (NOAA map)         top:13% left:33%   w:34%  h:60%
image (radar)            top:13% left:67%   w:33%  h:60%
weather-current          bot:0%  left:0%    w:30%  h:27%
weather-hourly (4h)      bot:0%  left:30%   w:30%  h:27%
weather-daily  (4d)      bot:0%  left:60%   w:40%  h:27%
```

#### home screen

```
clock                    top:1%  left:0.5%  w:46%  h:9%
yolink-outlet            top:1%  left:48%   w:24%  h:9%
yolink-door (×4, row 1)  top:12% left:0.5/25.5/50.5/75.5%  w:23.5/23.5/23.5/24%  h:28%
yolink-door (×4, row 2)  top:42% left:0.5/25.5/50.5/75.5%  w:23.5/23.5/23.5/24%  h:28%
yolink-temp (×3)         top:72% left:0.5/34/67.5%          w:32/32/32%            h:27%
```

#### calendar screen

```
clock                    top:1%  left:0.5%  w:22%  h:11%
astro-info               top:1%  left:23.5% w:76%  h:11%
calendar-month           top:14% left:0.5%  w:99%  h:85%
```

#### hockey screen

```
clock                    top:1%  left:0.5%  w:20%  h:9%
rss (NHL news)           top:1%  left:21%   w:35%  h:9%
nhl-scores               top:11% left:0%    w:28%  h:88%
nhl-schedule             top:11% left:29%   w:30%  h:88%
nhl-bracket              top:11% left:60%   w:40%  h:88%
```

#### server screen

```
server-stats (label)     top:2%  left:2%    w:96%  h:10%
server-hardware          top:14% left:2%    w:24%  h:40%
server-drives            top:14% left:28%   w:16%  h:40%
server-ups               top:14% left:46%   w:26%  h:40%
server-load              top:14% left:74%   w:24%  h:40%
server-docker            top:56% left:2%    w:44%  h:42%
server-storage           top:56% left:48%   w:50%  h:42%
```

---

### Design checklist for a new screen

Before finalizing a layout, verify:

- [ ] `id` and `name` are at the top of the JSON and `id` matches the filename
- [ ] All rows add up — last widget ends ≤ 98% vertically
- [ ] All columns add up — last widget ends ≤ 98% horizontally  
- [ ] No widget is below its minimum usable size
- [ ] Background suits the content (avoid busy backgrounds on dense data screens)
- [ ] Screen is registered in `schedule.json` with a background and duration
- [ ] Test with `?screen=<id>` to view in isolation before enabling in rotation
