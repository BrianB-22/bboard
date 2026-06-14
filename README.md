# bboard

A self-hosted dashboard for an always-on display — a free alternative to Dakboard. Built with Node.js and vanilla JS, no frameworks.

<table>
<tr>
<td><img src="marketing/screenshot-weather.png" alt="Weather screen"></td>
<td><img src="marketing/screenshot-hockey.png" alt="Hockey screen"></td>
</tr>
<tr>
<td><img src="marketing/Screenshot-calendar.png" alt="Calendar screen"></td>
<td><img src="marketing/screenshot-yolink.png" alt="Home/YoLink screen"></td>
</tr>
<tr>
<td colspan="2"><img src="marketing/Screenshot-serverinfo.png" alt="Server monitoring screen"></td>
</tr>
</table>

## Features

- **Weather screen** — live clock, week calendar, AQI badge, NWS alerts banner, Nullschool wind map, NOAA national forecast, radar loop, current conditions, hourly and daily forecasts
- **Hockey screen** — NHL scores, playoff schedule with series status, Stanley Cup bracket with East/West conference colors, favorite team game alerts
- **Home screen** — door sensors, freezer/outdoor temperature graphs, smoke alarm status badge, YoLink alert banner
- **Calendar screen** — full month calendar with federal holidays, observances, moon phase, season tracker, year progress bar
- **Server monitoring screen** — CPU/RAM/swap/disk/uptime bar, hardware temps (CPU/PCH/ambient), drive temperatures, UPS status, load average bars, Docker container health, storage pair usage with backup age tracking
- **Page rotation** — automatically cycles between screens on a configurable interval with optional indicator dots (clickable for direct access)
- **Auto-reload** — all connected browsers reload automatically when config files change on the server
- **Hot reload** — all JSON config files are re-read on every request; no restart needed for layout changes
- **No API keys** — uses Open-Meteo (weather/AQI), NWS (alerts), and the public NHL API, all free
- **YoLink integration** — door sensors, temp/humidity sensors, smoke detector, outlets, power failure alarm
- **Admin page** — manage page schedule, backgrounds, durations, and screen indicator via `/admin`
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
    { "screen": "home",     "background": "dark-blue",       "duration": 60, "enabled": true },
    { "screen": "server",   "background": "neon-tech",       "duration": 60, "enabled": true }
  ]
}
```

### Screen JSON format

Every file in `screens/` must include `id` and `name` at the top level — these are required for direct URL navigation (`?screen=<id>`) to work:

```json
{
  "id": "server",
  "name": "Server",
  "widgets": [...]
}
```

### Site settings

| Key | Default | Description |
|-----|---------|-------------|
| `showScreenIndicator` | `false` | Show clickable page indicator dots at the bottom of the screen |

### Widget types

`clock` · `aqi` · `alerts` · `iframe` · `image` · `weather-current` · `weather-hourly` · `weather-daily` · `nhl-scores` · `nhl-schedule` · `nhl-bracket` · `rss` · `astro-info` · `calendar-month` · `text` · `scheduled-text` · `countdown` · `sun-times` · `gauge` · `json` · `calendar` · `yolink-door` · `yolink-temp` · `yolink-outlet` · `yolink-smoke` · `server-stats` · `server-hardware` · `server-drives` · `server-ups` · `server-load` · `server-docker` · `server-storage`

Each widget is positioned absolutely via a `style` block in its screen JSON:

```json
{
  "type": "weather-current",
  "style": { "bottom": "0%", "left": "0%", "width": "30%", "height": "27%" }
}
```

#### Widget options

| Widget | Option | Description |
|--------|--------|-------------|
| `yolink-outlet` | `"hideWhenOff": true` | Hide the widget when the outlet is off |
| `server-stats` | `"label": "Home Server"` | Name shown on the left side of the stats bar |

### Backgrounds

| Name | Description |
|------|-------------|
| `animated-aurora` | Slow-moving color blobs with blur — green, purple, blue |
| `neon-tech` | Scrolling cyan grid + neon glow blobs — cyan, magenta, purple |
| `hockey-night` | Ice rink glow from below + arena overhead lights |
| `dark-slate` | Static dark slate gradient |
| `dark-blue` | Static dark blue gradient |
| `picsum-nature` | Rotating nature/landscape photos from picsum.photos |
| `picsum-space` | Rotating space/galaxy photos |
| `picsum-city` | Rotating city/architecture photos |

### URL parameters

| Param | Effect |
|-------|--------|
| `?screen=server` | Pin to a single screen by its `id`, skip rotation |
| `?mockAlerts` | Show fake NWS weather alerts for testing |

## YoLink Integration

Requires a [YoLink hub and sensors](https://shop.yosmart.com/) and a YoLink account. Add credentials to `.env`:

```
YOLINK_UAID=ua_xxxx
YOLINK_SECRET=sec_v1_xxxx
```

Supported device types: `THSensor`, `DoorSensor`, `MotionSensor`, `COSmokeSensor`, `MultiOutlet`, `PowerFailureAlarm`

The home screen overlays (smoke alarm badge + alert banner) are fixed position and only appear on the `home` screen. Alerts are checked every 5 minutes.

## Server Monitoring

The server screen displays live stats about the machine running bboard. Most data is served directly by the Node process (`/api/server/stats`). Hardware temperatures, fan speeds, UPS status, and load averages come from a companion shell script.

### bboard-health.sh

Copy `bboard-health.sh` to the server and run it via cron as root. It writes structured key=value data to `/home/brian/bboard-health.txt` which the `/api/server/health` endpoint reads.

```bash
# Install dependencies (Debian/Ubuntu)
sudo apt install lm-sensors smartmontools

# Run sensors detect once to configure lm-sensors
sudo sensors-detect

# Add to root crontab (sudo crontab -e)
*/5 * * * * /opt/bboard/bboard-health.sh

# Run immediately to populate data
sudo /opt/bboard/bboard-health.sh
```

Override the output path via `.env` if needed:

```
HEALTH_FILE=/home/brian/bboard-health.txt
```

### Server widget reference

| Widget | API | Updates |
|--------|-----|---------|
| `server-stats` | `/api/server/stats` | Every 30s |
| `server-hardware` | `/api/server/health` | Every 5 min |
| `server-drives` | `/api/server/health` | Every 5 min |
| `server-ups` | `/api/server/health` | Every 5 min |
| `server-load` | `/api/server/health` | Every 5 min |
| `server-docker` | `/api/server/stats` | Every 30s |
| `server-storage` | `/api/server/storage` | Every 2 min |

The health widgets show a **stale** badge when the health file hasn't been updated in over 5 minutes (e.g. cron not running).

UPS support requires CyberPower `pwrstat` at `/sbin/pwrstat`. Drive temperatures use `hddtemp` for SSDs and `smartctl` (smartmontools) for spinning drives.

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
- [YoSmart/YoLink](https://shop.yosmart.com/) — sensor data (requires credentials)

## Security Note

This app is designed to run on a private LAN and is not hardened for public hosting. The proxy endpoints (`/api/proxy-image`, `/api/rss`, `/api/json-fetch`) will fetch any URL passed to them, and there is no authentication. If you choose to expose this to the internet, additional hardening measures (URL allowlists, authentication, reverse proxy with rate limiting, etc.) should be put in place first.

---

Built by [Brian Bernacki](https://bernacki.me)
