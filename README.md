# bboard

A self-hosted dashboard for an always-on display — a free alternative to Dakboard. Built with Node.js and vanilla JS, no frameworks.

![bboard weather screen](marketing/screenshot1.png)

## Features

- **Weather screen** — live clock, week calendar, AQI badge, NWS alerts banner, Nullschool wind map, NOAA national forecast, radar loop, current conditions, hourly and daily forecasts
- **Hockey screen** — NHL scores, playoff schedule with series status, Stanley Cup bracket with East/West conference colors, favorite team game alerts
- **Home screen** — door sensors, freezer/outdoor temperature graphs, smoke alarm status badge, YoLink alert banner
- **Calendar screen** — full month calendar with federal holidays, observances, moon phase, season tracker, year progress bar
- **Page rotation** — automatically cycles between screens on a configurable interval with optional indicator dots
- **Auto-reload** — all connected browsers reload automatically when config files change on the server (within 5 minutes)
- **Hot reload** — all JSON config files are re-read on every request; no restart needed for layout changes
- **No API keys** — uses Open-Meteo (weather/AQI), NWS (alerts), and the public NHL API, all free
- **YoLink integration** — door sensors, temp/humidity sensors, smoke detector, outlets, power failure alarm
- **Easily extended** — add a new screen by dropping a JSON file in `screens/`; add a new background in `backgrounds.json`

## Stack

- **Server:** Node.js + Express, port 3030
- **Frontend:** Vanilla JS ES modules, no build step
- **Config:** JSON files — edit and refresh the browser

## Getting Started

```bash
npm install
npm start        # http://localhost:3030
npm run dev      # auto-restarts on server.js changes
```

## Configuration

All layout is defined in JSON — no GUI editor needed.

| File | Purpose |
|------|---------|
| `schedule.json` | Page list: which screen, which background, how long to show, enabled/disabled |
| `screens/*.json` | Widget layout for each screen |
| `backgrounds.json` | Named background definitions |
| `data/custom-dates.json` | User-defined dates highlighted on the calendar (hot-reloaded) |
| `data/favorite-teams.json` | NHL team abbreviations (e.g. `["WSH", "CAR"]`) for hockey screen alerts |

### schedule.json

```json
{
  "site": {
    "location": { "lat": 34.92, "lon": -80.74, "name": "Charlotte, NC" },
    "showScreenIndicator": true
  },
  "pages": [
    { "screen": "weather",  "background": "animated-aurora", "duration": 60, "enabled": true },
    { "screen": "hockey",   "background": "hockey-night",    "duration": 60, "enabled": true },
    { "screen": "calendar", "background": "dark-slate",      "duration": 60, "enabled": true },
    { "screen": "home",     "background": "dark-blue",       "duration": 60, "enabled": true }
  ]
}
```

### Site settings

| Key | Default | Description |
|-----|---------|-------------|
| `showScreenIndicator` | `false` | Show page indicator dots at the bottom of the screen |

### Widget types

`clock` · `aqi` · `alerts` · `iframe` · `image` · `weather-current` · `weather-hourly` · `weather-daily` · `nhl-scores` · `nhl-schedule` · `nhl-bracket` · `rss` · `astro-info` · `calendar-month` · `text` · `scheduled-text` · `countdown` · `sun-times` · `gauge` · `json` · `calendar` · `yolink-door` · `yolink-temp` · `yolink-outlet` · `yolink-smoke`

Each widget is positioned absolutely via a `style` block in its screen JSON:

```json
{
  "type": "weather-current",
  "id": "weather-now",
  "style": { "bottom": "0%", "left": "0%", "width": "30%", "height": "27%" }
}
```

#### YoLink widget options

| Widget | Option | Description |
|--------|--------|-------------|
| `yolink-outlet` | `"hideWhenOff": true` | Hide the widget when the outlet is off |

### Backgrounds

| Name | Description |
|------|-------------|
| `animated-aurora` | Animated color blobs with blur |
| `hockey-arena` | Ice rink glow + overhead arena lights |
| `dark-slate` | Static dark gradient |
| `dark-blue` | Static dark blue gradient |
| `picsum-*` | Rotating photos from picsum.photos |

### URL parameters

| Param | Effect |
|-------|--------|
| `?screen=hockey` | Pin to a single screen, skip rotation |
| `?mockAlerts` | Show fake NWS weather alerts for testing |

## YoLink Integration

Requires a YoLink account and hub. Add credentials to `.env`:

```
YOLINK_UAID=ua_xxxx
YOLINK_SECRET=sec_v1_xxxx
```

Supported device types: `THSensor`, `DoorSensor`, `MotionSensor`, `COSmokeSensor`, `MultiOutlet`, `PowerFailureAlarm`

The home screen overlays (smoke alarm badge + alert banner) are fixed position and only appear on the `home` screen. Alerts are checked every 5 minutes.

## Deployment

Edit `deploy.sh` with your server details, then:

```bash
./deploy.sh                                          # rsync files to server
ssh user@host "sudo systemctl restart bboard"        # only needed after server.js changes
```

Config and frontend changes take effect automatically across all connected browsers within 5 minutes (the server tracks config file modification times and triggers a page reload when anything changes). See `SERVERSETUP.md` for full server setup instructions.

## APIs used

All free, no keys required (except YoLink for sensor integration):

- [Open-Meteo](https://open-meteo.com/) — weather forecast and air quality
- [NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) — weather alerts
- [NHL API](https://api-web.nhle.com/) — scores, schedule, playoff bracket
- [Nullschool Earth](https://earth.nullschool.net/) — wind map
- [Picsum Photos](https://picsum.photos/) — rotating background images
- [YoSmart/YoLink](https://www.yosmart.com/) — sensor data (requires credentials)

## Security Note

This app is designed to run on a private LAN and is not hardened for public hosting. The proxy endpoints (`/api/proxy-image`, `/api/rss`, `/api/json-fetch`) will fetch any URL passed to them, and there is no authentication. If you choose to expose this to the internet, additional hardening measures (URL allowlists, authentication, reverse proxy with rate limiting, etc.) should be put in place first.

---

Built by [Brian Bernacki](https://bernacki.me)
