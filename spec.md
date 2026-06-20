# bboard — Functional Specification

## Overview

bboard is a self-hosted, full-screen dashboard web app designed for always-on display on a monitor or TV. It serves as a replacement for Dakboard. There is no GUI editor — layouts are defined in JSON files and updated via AI assistance or direct editing.

---

## Goals

- Display one or more full-screen pages that rotate automatically on a configurable timer
- Each page is composed of positioned widgets showing live data, media, or custom content
- All configuration is file-based (JSON); no database required
- Deployable on a Linux server with Node.js; accessible from any browser on the local network
- Modern, slick visual style — dark theme, glass morphism, smooth transitions
- Scales correctly at any resolution including 2K and 4K displays

---

## Pages & Rotation

- Pages are defined in `orchestrator.json` and can be enabled or disabled individually
- Each page has a `duration` in seconds before rotating to the next
- Pages transition with a fade animation
- A dot indicator at the bottom shows current page; dots are clickable to jump
- Only `enabled: true` pages participate in rotation
- A single enabled page shows permanently with no rotation UI

---

## Multi-Schedule / Multi-Kiosk

`orchestrator.json` holds an array of schedules, each with a unique `uid`. Different kiosks or screens load their own schedule by visiting `/<uid>` (e.g. `http://server:3030/100`). The root `/` shows a picker listing all available schedules.

Each schedule has its own `site` config (location, title, etc.) so kiosks in different locations get independent weather, alerts, and timezone data.

---

## Configuration Files

### `orchestrator.json` — Master Orchestration
Holds all schedules. Each schedule controls which screens are active, what background they use, and how long each displays.

```json
{
  "schedules": [
    {
      "uid": "100",
      "desc": "MainLoop",
      "site": { "title": "bboard", "location": { "lat": 0, "lon": 0, "name": "..." } },
      "pages": [
        { "screen": "weather", "background": "picsum-nature", "duration": 300, "enabled": true }
      ]
    }
  ]
}
```

### `screens/*.json` — Screen Layout
Each screen file defines the widget layout for one page. Widgets use percentage-based absolute positioning.

```json
{
  "id": "weather",
  "name": "Weather",
  "widgets": [
    {
      "type": "clock",
      "id": "main-clock",
      "style": { "top": "1%", "left": "0.5%", "width": "18%", "height": "8%" }
    }
  ]
}
```

### `backgrounds.json` — Background Library
Named background definitions referenced by ID in `orchestrator.json`.

```json
{
  "picsum-nature": { "type": "picsum", "rotate": 60 },
  "animated-aurora": { "type": "animated-gradient" },
  "dark-blue": { "type": "color", "value": "linear-gradient(...)" }
}
```

---

## Background Types

| Type | Description | Options |
|---|---|---|
| `color` | CSS color or gradient | `value` (any CSS background) |
| `picsum` | Random photo from picsum.photos, rotates on interval | `rotate` (seconds) |
| `image` | Static image URL | `url` |
| `animated-gradient` | CSS-animated dark aurora/nebula effect | — |

---

## Widget Types

### Data Widgets (live, auto-refreshing)

| Widget | Data Source | Refresh |
|---|---|---|
| `clock` | Browser time | 1 second |
| `aqi` | Open-Meteo Air Quality API | 10 minutes |
| `alerts` | NWS api.weather.gov | 5 minutes |
| `weather-current` | Open-Meteo Forecast API | 15 minutes |
| `weather-hourly` | Open-Meteo Forecast API | 15 minutes |
| `weather-daily` | Open-Meteo Forecast API | 15 minutes |
| `sun-times` | Derived from weather data | 15 minutes |
| `nhl-scores` | api-web.nhle.com (no key) | 5 minutes |
| `rss` | Any RSS feed URL | configurable |
| `calendar` | Any ICS/iCal URL | configurable (default 1 hour) |
| `json` | Any JSON URL | configurable |
| `gauge` | Fixed value or any JSON URL path | configurable |

### Display Widgets (static or time-driven)

| Widget | Description |
|---|---|
| `iframe` | Embeds any URL in a frame |
| `image` | Displays an image URL with optional auto-refresh |
| `text` | Static HTML or plain text content |
| `scheduled-text` | Displays different text based on time of day |
| `countdown` | Counts down to a target datetime |

---

## Widget: `clock`
Displays current time (12-hour with seconds) and date.

```json
{ "type": "clock", "id": "main-clock", "style": { ... } }
```

---

## Widget: `weather-current`
Shows temperature, feels-like, condition icon, wind speed, humidity, and sunset time.
Location is inherited from `site.location` in `orchestrator.json`.

---

## Widget: `weather-hourly`
Horizontal strip of upcoming hours. Shows time, condition icon, precip %, and temperature.

```json
{ "type": "weather-hourly", "hours": 4, "style": { ... } }
```

---

## Widget: `weather-daily`
Multi-day forecast cards. Shows day name, icon, precip %, high/low temps.

```json
{ "type": "weather-daily", "days": 4, "style": { ... } }
```

---

## Widget: `aqi`
Displays US AQI value with color-coded category (Good / Moderate / Unhealthy / etc.).
Positioned top-right by convention.

---

## Widget: `alerts`
Shows active NWS weather alerts as a horizontal banner. Automatically hidden when no alerts are active. Color-coded by severity (extreme = red, severe = orange, moderate = yellow).

---

## Widget: `iframe`
Embeds a web page. Useful for maps, live cameras, web apps.

```json
{ "type": "iframe", "src": "https://earth.nullschool.net/...", "style": { ... } }
```

---

## Widget: `image`
Displays an image with optional periodic refresh (useful for radar GIFs, weather maps).
Images from HTTP sources are proxied through the server to avoid mixed-content errors.

```json
{ "type": "image", "src": "/api/proxy-image?url=...", "refresh": 300, "style": { ... } }
```

---

## Widget: `nhl-scores`
Displays today's NHL games with scores and game state. Live games highlighted in red.
Can be toggled off-season by disabling the hockey page in `orchestrator.json`.

---

## Widget: `rss`
Numbered list of headlines from any RSS feed. Server parses XML; no client-side XML needed.

```json
{ "type": "rss", "url": "https://...", "title": "NHL News", "count": 12, "refresh": 600, "style": { ... } }
```

---

## Widget: `calendar`
Displays upcoming events from any ICS/iCal URL (Google Calendar, Apple iCal, Outlook, etc.).
Today's events are highlighted. All-day events shown as "All day".

```json
{ "type": "calendar", "url": "https://...ical...", "title": "My Calendar", "count": 5, "refresh": 3600, "style": { ... } }
```

---

## Widget: `json`
Fetches a JSON URL and displays selected fields as a labeled list.

```json
{
  "type": "json",
  "url": "https://api.example.com/data",
  "title": "My Data",
  "display": [
    { "label": "Temperature", "path": "sensor.temp", "unit": "°F" },
    { "label": "Humidity", "path": "sensor.humidity", "unit": "%" }
  ],
  "refresh": 60
}
```

---

## Widget: `gauge`
SVG arc gauge. Value can be static or pulled from a JSON URL via dot-path.
Color changes based on configurable thresholds.

```json
{
  "type": "gauge",
  "label": "CPU",
  "url": "http://myserver/metrics",
  "path": "cpu.percent",
  "min": 0, "max": 100, "unit": "%",
  "refresh": 30,
  "thresholds": [
    { "value": 60, "color": "#69f0ae" },
    { "value": 85, "color": "#ffa726" },
    { "value": 100, "color": "#ef5350" }
  ]
}
```

---

## Widget: `text`
Static content. Supports plain text or HTML markup.

```json
{ "type": "text", "label": "Note", "html": "<b>Hello</b>", "style": { ... } }
```

---

## Widget: `scheduled-text`
Displays different content based on time of day. Falls back to `defaultText` before the first schedule entry.

```json
{
  "type": "scheduled-text",
  "label": "Greeting",
  "defaultText": "Good night",
  "schedule": [
    { "time": "06:00", "text": "Good morning!" },
    { "time": "12:00", "text": "Good afternoon!" },
    { "time": "18:00", "text": "Good evening!" }
  ]
}
```

---

## Widget: `countdown`
Counts down to a target date/time. Shows days, hours, minutes, seconds (hides seconds when days > 0).
Displays `completedText` when the target is reached.

```json
{
  "type": "countdown",
  "label": "Christmas",
  "target": "2026-12-25T00:00:00",
  "completedText": "🎄 Merry Christmas!"
}
```

---

## Widget: `sun-times`
Shows today's sunrise time, sunset time, and total daylight hours. Derived from weather data already fetched for the weather widgets — no additional API call.

---

## Server API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/config` | Merged config (schedule + screens + backgrounds) |
| `GET /api/weather?lat=&lon=` | Open-Meteo forecast proxy |
| `GET /api/aqi?lat=&lon=` | Open-Meteo air quality proxy |
| `GET /api/alerts?lat=&lon=` | NWS active alerts proxy |
| `GET /api/nhl/scores` | NHL scoreboard proxy (normalized) |
| `GET /api/rss?url=` | RSS feed proxy + parser |
| `GET /api/ical?url=` | ICS/iCal proxy + parser |
| `GET /api/json-fetch?url=` | Generic JSON proxy |
| `GET /api/proxy-image?url=` | Image proxy (handles HTTP→HTTPS mixed content) |

---

## Deployment

**Requirements:** Node.js 18+

```bash
npm install
npm start          # default port 3000
PORT=8080 npm start
```

Access at `http://<server-ip>:3000` from any browser on the network.
For always-on display, use a browser in kiosk mode:
```bash
chromium-browser --kiosk http://localhost:3000
```
