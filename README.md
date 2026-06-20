# bboard

A self-hosted, always-on dashboard for a monitor or TV — a free alternative to Dakboard. Drop it on any server, point a browser at it, and you have a living display that rotates through weather, sports, home automation, calendar, and server health. It ships with ready-to-use screens and is built to grow — add your own custom screens by combining 30+ widgets to show exactly what you want.

The server can be anything from a Raspberry Pi to a full desktop. The display ("smart board") can be anything that runs a web browser — a computer, a Raspberry Pi with an HDMI screen, or a smart TV. Once the page is loaded, everything is managed remotely from the server: no touching the display device.

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

## What's included

**Weather** — live clock, AQI badge, NWS severe weather alerts, Nullschool wind map, radar loop, current conditions, hourly and daily forecasts, and a week-at-a-glance calendar. Powered by Open-Meteo and NWS — no API keys.

**Hockey** — live scores, playoff schedule with series status, and a full Stanley Cup bracket with conference colors. Highlights your favorite team's upcoming games. Powered by the public NHL API.

**Calendar** — full month view with federal holidays, moon phase, season tracker, year progress bar, and your own custom dates. Everything shown at a glance.

**iCloud Calendar** — 3-column "next 3 days" view pulling from multiple ICS feeds (iCloud, Outlook, Google, Apple Holidays, or any public `.ics` URL). Feeds are color-coded by calendar with per-event labels. Microsoft Teams, Zoom, and in-person meeting types are auto-detected. Multi-day events span across day columns; recurring events (RRULE) expand correctly for the current year.

**Home** — door sensors, freezer and outdoor temperature graphs, smoke alarm status, and a YoLink alert banner. Pulls live data from [YoLink](https://shop.yosmart.com/) home automation sensors — door/window sensors, temperature and humidity sensors, smoke detectors, smart outlets, and power failure alarms.

**Server** — CPU, RAM, swap, disk, and uptime at a glance. Hardware temperatures, drive temps, UPS status, load averages, Docker container health, and storage pair usage with backup age tracking.

**Stocks** — scrolling ticker across the top, live market open/close countdown, and individual price charts with 30-day trend lines and volume bars for each symbol you configure. Powered by Yahoo Finance's public API — no key required.

## Why bboard

- **No subscriptions.** All data sources are free. Weather, alerts, sports — no keys, no accounts, no monthly fees.
- **No cloud dependency.** Runs entirely on your local network. The only outbound calls are to public APIs for live data. Your home sensor data, schedule, and layout never leave your network.
- **Modular and extensible.** Add a new screen by dropping a JSON file in `screens/`. Add a widget type by writing one JS module. No build step, no framework, no boilerplate.
- **Runs on anything.** The server can be a Raspberry Pi, an old laptop, a NAS, or a full server. The display just needs a web browser — smart TV, Pi with HDMI, laptop, anything.
- **Fully remote-managed.** Once the browser is open on the display, you never touch it again. All changes — schedule, layout, backgrounds, durations — are made on the server and pushed to every connected screen automatically.
- **Hot reload.** Edit a config file and refresh the browser — no server restart needed.
- **Auto-reload.** All connected browsers reload automatically when config changes are detected on the server.
- **Page rotation.** Cycles through screens on a configurable interval. Clickable indicator dots let you jump directly to any screen.
- **Admin page.** Manage the schedule, backgrounds, durations, and screen order at `/admin` — no file editing required for day-to-day changes.
- **Multi-kiosk.** Run multiple named schedules from one server. Each kiosk opens `/<uid>` to get its own independent page rotation, location, and settings. Add a second display by creating a new schedule in the admin.
- **YoLink home automation.** First-class support for YoLink sensors: door/window, temperature, smoke, outlets, and power failure alarms. See live sensor state on the Home screen with alert banners for anything that needs attention.

## Quick start

```bash
npm install
npm start        # http://localhost:3030
npm run dev      # auto-restarts on server changes
```

The root `/` shows a schedule picker. Point each display at `/<uid>` (e.g. `/S_100`) to load its schedule. The admin page at `/admin` lets you manage schedules, adjust timings, backgrounds, and screen order without touching files.

For production deployment to a Linux server (systemd, rsync, nvm), see [SERVERSETUP.md](SERVERSETUP.md).

## Multi-schedule system

bboard supports multiple independent schedules from a single server, stored in `orchestrator.json`. Each schedule has its own UID, location (for weather/alerts), and page rotation.

```
/          → schedule picker (lists all schedules)
/S_100     → loads schedule with uid "S_100"
/admin     → admin panel (schedule selector at top)
```

Create, switch, and delete schedules from the admin panel. Each schedule is fully independent — different screens, different backgrounds, different locations, different durations.

## iCloud Calendar integration

The iCloud Calendar screen merges multiple calendar feeds into a 3-column day view. Feeds are configured in `.env` — URLs never go in the repo.

```
ICAL_1_URL=https://p51-caldav.icloud.com/published/2/your-url
ICAL_1_LABEL=Personal
ICAL_2_URL=https://outlook.office365.com/owa/calendar/.../calendar.ics
ICAL_2_LABEL=Work
ICAL_3_URL=https://calendars.icloud.com/holidays/us_en-us.ics/
ICAL_3_LABEL=US Holidays
```

Add as many feeds as needed by incrementing the number. Supported sources:

- **iCloud** — publish a calendar in iCloud.com → Calendar → share icon → Copy Link (use `https://`, not `webcal://`)
- **Outlook / Microsoft 365** — right-click a calendar → Share → Get a link → ICS format
- **Apple curated feeds** — US holidays, sports schedules, and more at `calendars.icloud.com`
- **Any public `.ics` URL** — Google Calendar, Fastmail, etc.

Features:
- Events color-coded by calendar feed with label badges
- Start–end times shown for timed events
- Microsoft Teams, Zoom, and in-person (CONF) meeting types auto-detected from the location field
- Multi-day events span across day columns
- Recurring events (`RRULE:FREQ=YEARLY`) expanded correctly for the current year — Apple holidays, Father's Day, etc. all resolve
- Per-feed error isolation — one failing feed doesn't break the others

## Integrations

| Integration | What it does | Keys required |
|-------------|-------------|--------------|
| [Open-Meteo](https://open-meteo.com/) | Weather forecast & air quality | No |
| [NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) | Severe weather alerts | No |
| [NHL API](https://api-web.nhle.com/) | Scores, schedule, playoff bracket | No |
| [Nullschool Earth](https://earth.nullschool.net/) | Wind map iframe | No |
| [Picsum Photos](https://picsum.photos/) | Rotating background images | No |
| [YoSmart / YoLink](https://shop.yosmart.com/) | Door, temp, smoke, outlet sensors | Yes (free account) |
| iCloud / Outlook / any ICS | Calendar feeds for the Calendar screen | No (public share URL) |

YoLink credentials go in `.env`:

```
YOLINK_UAID=ua_xxxx
YOLINK_SECRET=sec_v1_xxxx
```

See `.env.sample` for the full list of supported environment variables.

## Screens and widgets

Screens are JSON files in `screens/`. Each one declares a list of widgets positioned on a grid. There are 30+ widget types covering weather, sports, home automation, calendar, server stats, clocks, RSS feeds, countdowns, and more.

The full widget reference — types, options, positioning, backgrounds — is in [SCREENS.md](SCREENS.md).

## Security note

bboard is designed for a private LAN and is not hardened for public hosting. The proxy endpoints will fetch any URL passed to them, and there is no authentication. Calendar feed URLs embedded in `.env` are kept off the network and out of the repository — do not commit your `.env` file.

## Docs

| Doc | Contents |
|-----|---------|
| [SCREENS.md](SCREENS.md) | Widget types, options, positioning, backgrounds — the full config reference |
| [SERVERSETUP.md](SERVERSETUP.md) | Production deployment, systemd service, deploy script |
| [spec.md](spec.md) | Full functional specification |
| [design.md](design.md) | Visual design guide — typography, colors, glass morphism, layout conventions |

## Disclaimer

This software is provided as-is. No warranties or guarantees of fitness for any particular purpose are expressed or implied. Use at your own risk.

---

Built by [Brian Bernacki](https://bernacki.me)
