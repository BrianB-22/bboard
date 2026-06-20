# bboard — Todo

## In Progress / Active

- [ ] Deploy to Linux server and verify all widgets render correctly at 2K resolution
- [ ] Test NWS weather alerts endpoint (no active alerts in area to verify display)
- [ ] Verify NOAA forecast map proxy (HTTP source through HTTPS server)
- [ ] Verify KCAE radar GIF auto-refresh

---

## Core Features — Remaining

- [ ] **Kiosk setup** — document Chromium kiosk mode command for Linux (`chromium --kiosk --noerrdialogs http://localhost:3000`)
- [ ] **Auto-start** — systemd unit file for bboard server so it starts on boot
- [ ] **Recurring ICS events** — current ICS parser skips RRULE; expand recurring events so weekly/monthly calendar events show correctly
- [ ] **Traffic widget** — add `traffic` widget type (embed Google Maps with traffic layer, or TomTom Routing API)
- [ ] **Stock/ticker widget** — scrolling price ticker widget
- [ ] **Background: local folder slideshow** — serve images from a local `public/backgrounds/` folder, rotate through them
- [ ] **Background: NASA APOD** — Astronomy Picture of the Day as background option

---

## Screens to Build

- [ ] **Home screen** — family calendar + countdown timer + scheduled greeting + weather current
- [ ] **Sports screen** — NHL scores + RSS sports news (toggle on/off seasonally via `orchestrator.json`)
- [ ] **System/metrics screen** — server health gauges (CPU, memory, disk) via `/api/json-fetch` from a local metrics endpoint
- [ ] **Morning briefing screen** — sun times + weather daily + calendar events for the day

---

## Widget Enhancements

- [ ] **`weather-hourly`** — add UV index and wind gust rows as optional config
- [ ] **`calendar`** — color-code events by calendar source (when multiple ICS URLs fed in)
- [ ] **`calendar`** — support multiple ICS URLs merged into one widget
- [ ] **`gauge`** — add needle/pointer style as alternative to arc fill
- [ ] **`json`** — support simple templating in display values (e.g. `"template": "{{value}} active"`)
- [ ] **`nhl-scores`** — filter to show only specific teams
- [ ] **`image`** — add crossfade between refreshes instead of hard swap
- [ ] **`clock`** — optional timezone display for second clock (e.g., show UTC or another city)
- [ ] **`alerts`** — expand to show full alert text on click/tap
- [x] **`alerts` banner** — show a short description and severity icon alongside the alert type (e.g. "⚠ Special Weather Statement — Thunderstorms possible this afternoon"); currently only shows the event name with no context, which isn't useful on a kiosk with no click/tap

---

## Visual / UX

- [ ] **Touch/click swipe** — swipe left/right to advance pages on touch screens
- [ ] **Nighttime dimming** — reduce brightness automatically between configurable hours (e.g., 11pm–6am)
- [ ] **Custom fonts** — add Google Fonts or local font option per screen via config
- [ ] **Widget border/accent colors** — allow per-widget accent color override in config
- [ ] **Transition styles** — add slide and zoom transition options alongside the current fade

---

## Infrastructure

- [ ] **Hot reload** — watch `orchestrator.json` / `screens/*.json` on the server and push a reload signal to connected browsers (SSE or WebSocket) so layout changes apply without manual refresh
- [ ] **Health endpoint** — `GET /api/health` returns server uptime, last weather fetch timestamp, etc.
- [ ] **Logging** — add request logging and error logging to a file for debugging deployed server

---

## Completed

- [x] Express server with static file serving
- [x] Config merge: schedule + screens + backgrounds into single API response
- [x] Open-Meteo weather API proxy (current, hourly, daily, 5-day)
- [x] Open-Meteo AQI proxy
- [x] NWS weather alerts proxy
- [x] NHL scores proxy and normalization
- [x] RSS feed proxy + XML parser (no deps)
- [x] ICS/iCal proxy + parser
- [x] JSON fetch proxy
- [x] Image proxy (HTTP→HTTPS mixed content fix)
- [x] Clock widget
- [x] AQI widget with color-coded severity
- [x] Weather alerts banner (auto-hides when clear)
- [x] iframe widget
- [x] Image widget with auto-refresh
- [x] weather-current widget (temp, feels-like, condition, wind, humidity, sunset)
- [x] weather-hourly widget
- [x] weather-daily widget
- [x] NHL scores widget (live game highlighting)
- [x] RSS feed widget
- [x] Calendar widget (ICS, today highlighting)
- [x] JSON data widget (dot-path field extraction)
- [x] SVG arc gauge widget with thresholds
- [x] Static text widget
- [x] Scheduled text widget (time-of-day content)
- [x] Countdown timer widget
- [x] Sun times widget
- [x] Multi-page rotation with fade transition and dot indicator
- [x] Picsum Photos rotating background with crossfade
- [x] CSS animated aurora/gradient background
- [x] Viewport-scaled font sizes (2K/4K compatible)
- [x] Weather screen layout (wind map + NOAA map + KCAE radar + weather widgets)
- [x] Hockey screen layout (scores + NHL news RSS)
- [x] `enabled` flag on pages (easy seasonal on/off)
- [x] spec.md, design.md, todo.md
