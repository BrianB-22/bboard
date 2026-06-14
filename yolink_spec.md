# YoLink API Spec & Integration Notes

Reference: https://doc.yosmart.com/docs/overall/intro

---

## Authentication

**Token endpoint:** `POST https://api.yosmart.com/open/yolink/token`  
**Grant type:** `client_credentials`  
**Params:** `client_id` (UAID), `client_secret` (Secret Key)  
**Response includes:** `access_token`, `refresh_token`, `expires_in`  
**Header for all API calls:** `Authorization: Bearer <access_token>`

---

## HTTP API

**Endpoint:** `POST https://api.yosmart.com/open/yolink/v2/api`  
**Content-Type:** `application/json`

### Request (BDDP)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `method` | String | **Yes** | e.g. `DoorSensor.getState` |
| `time` | Timestamp (ms) | **Yes** | `Date.now()` — **missing this returns error 010201** |
| `targetDevice` | String | For device calls | Device ID from device list |
| `token` | String | For device calls | Per-device net token from device list |
| `msgid` | String | No | Defaults to timestamp if omitted |
| `params` | Object | Special methods only | e.g. `setState` |

### Response (BUDP)

| Field | Type | Notes |
|-------|------|-------|
| `code` | String | `"000000"` = success; anything else = error |
| `desc` | String | Human-readable status |
| `method` | String | Echoed from request |
| `time` | Timestamp | Server timestamp |
| `msgid` | String | Echoed from request |
| `data` | Object | Null on error or rate limit |

> **Always check `code === "000000"` before using `data`. A non-000000 response will have `data: null`.**

---

## Error / Status Codes

| Code | Meaning |
|------|---------|
| `000000` | Success |
| `000101` | Can't connect to Hub |
| `000102` | Hub cannot respond to command |
| `000103` | Token is invalid |
| `000201` | Cannot connect to device |
| `000202` | Device cannot respond to command |
| `010000` | Service unavailable — retry |
| `010001` | Internal connection failure — retry |
| `010103` | Authorization invalid |
| `010104` | Token expired |
| `010200` | params not valid |
| `010201` | **`time` cannot be null** — missing required field |
| `010202` | `method` cannot be null |
| `010203` | Method not supported |
| `010301` | **Rate limit exceeded** — retry later |
| `020101` | Device does not exist |
| `020104` | Device busy — try again later |
| `999999` | Unknown error |

---

## Device List

```
method: "Home.getDeviceList"
```
Response: `data.devices[]` — each device has:
- `deviceId` — stable unique ID (use for matching, not name)
- `name` — user-editable display name (fragile for matching)
- `type` — device type string (see below)
- `token` — per-device net token required for state calls

> **Don't cache an empty device list.** If `data.devices` is empty the call likely failed silently. Keep the prior cached list.

---

## Device Types & State Formats

### DoorSensor (also used for GarageDoor reading)

```
method: "DoorSensor.getState"
```

Response structure:
```
data.online            Boolean   Device connectivity
data.reportAt          Date      ISO timestamp of last report
data.state.state       String    "open" | "closed" | "error"
data.state.battery     String    0–4 (empty→full)
data.state.stateChangedAt  Timestamp  ms — when state last changed
data.state.openRemindDelay Integer  minutes before open reminder
data.state.alertInterval   Integer  continuous alert frequency (min)
data.state.version     String    Firmware version
```

**GarageDoor note:** Has no `getState` — read via `DoorSensor.getState`. Only control method is `GarageDoor.toggle` (use with caution; check state first).

---

### THSensor (Temperature & Humidity)

```
method: "THSensor.getState"
```

Response structure:
```
data.online                    Boolean
data.reportAt                  Date
data.state.temperature         Float    Always in °C raw
data.state.humidity            Float    Percent
data.state.mode                String   "c" or "f" — display unit preference
data.state.battery             String   0–4
data.state.state               String   "normal" | "alert"
data.state.alarm.lowBattery    Boolean
data.state.alarm.lowTemp       Boolean
data.state.alarm.highTemp      Boolean
data.state.alarm.lowHumidity   Boolean
data.state.alarm.highHumidity  Boolean
data.state.tempLimit.max/min   Float
data.state.humidityLimit.max/min Float
data.state.tempCorrection      Float    Calibration offset
data.state.humidityCorrection  Float
data.state.version             String
```

> `temperature` is always raw °C. If `state.mode === 'f'`, the user prefers Fahrenheit display — convert: `°F = (°C × 9/5) + 32`.

---

### MotionSensor

```
method: "MotionSensor.getState"
```

```
data.online                        Boolean
data.reportAt                      Date
data.state.state                   String   "normal" | "alert"
data.state.stateChangedAt          Date     Last state change timestamp
data.state.battery                 String   0–4
data.state.sensitivity             String
data.state.sensorMode              String
data.state.beep                    Boolean
data.state.devTemperature          Double
data.state.interval                Integer  (optional)
data.state.alarmStateonline.stayError     Boolean
data.state.alarmStateonline.detectorError Boolean
data.state.alarmStateonline.freezeError   Boolean
data.state.alarmStateonline.reminder      Boolean
```

---

### LeakSensor

```
method: "LeakSensor.getState"
```

```
data.online                              Boolean
data.reportAt                            Date
data.state.state                         String   "normal" | "alert"
data.state.stateChangedAt               Date
data.state.battery                       String   0–4
data.state.beep                          Boolean
data.state.sensitivity                   String
data.state.sensorMode                    String
data.state.devTemperature                Double
data.state.alertStandby                  Integer
data.state.interval                      Integer  (optional)
data.state.alarmStateonline.stayError    Boolean
data.state.alarmStateonline.detectorError Boolean
data.state.alarmStateonline.freezeError  Boolean
data.state.alarmStateonline.reminder     Boolean
```

---

### COSmokeSensor

```
method: "COSmokeSensor.getState"
```

```
data.reportAt                          Date
data.state.online                      Boolean   NOTE: online is inside state, not at data level
data.state.battery                     String    0–4
data.state.devTemperature              Integer
data.state.version                     String
data.state.state.smokeAlarm            Boolean
data.state.state.gasAlarm              Boolean
data.state.state.highTempAlarm         Boolean
data.state.state.sLowBattery           Boolean   (note: 's' prefix)
data.state.state.unexpected            Boolean   Base cannot connect to sensor
data.state.state.silence               Boolean   Reserved
data.state.interval                    Integer   (optional)
data.state.metadata.inspect            Boolean   Self-check result (optional)
data.state.sche.type                   String    "disable"|"weekly"|"monthly"
data.state.sche.day                    Integer
data.state.sche.time                   String    "HH:MM"
```

> **Note:** `online` is nested at `data.state.online`, not `data.online` like other devices.

---

### PowerFailureAlarm

```
method: "PowerFailureAlarm.getState"
```

```
data.reportAt              Date
data.deviceId              String
data.state.state           String   "normal" | "alert" | "off"
data.state.powerSupply     Boolean  False = power loss detected
data.state.battery         Integer  0–4
data.state.sound           Integer  Audio level
data.state.beep            Boolean
data.state.mute            Boolean
data.state.alertType       String   (optional)
data.state.version         String
```

---

### Outlet (single socket)

```
method: "Outlet.getState"
method: "Outlet.setState"  params: { state: "open"|"close" }
```

```
data.state      String   "open" | "closed"
data.delay.on   Integer  Remaining delay-on minutes (0=off)
data.delay.off  Integer  Remaining delay-off minutes (0=off)
data.power      Integer  Current watts (0 if unsupported)
data.version    String
data.tz         Integer  -12 to 12
```

---

### MultiOutlet (power strip)

```
method: "MultiOutlet.getState"
```

```
data.state          Array    ["open"|"closed", ...] — one entry per socket
data.delays[i].on   Integer  Remaining delay-on for socket i
data.delays[i].off  Integer  Remaining delay-off for socket i
data.version        String
data.tz             Integer
```

---

### SpeakerHub

```
method: "SpeakerHub.getState"
method: "SpeakerHub.playAudio"
method: "SpeakerHub.setWiFi"
method: "SpeakerHub.setOption"
```

```
data.version              String
data.wifi.enable          Boolean
data.wifi.ssid            String
data.wifi.ip              String
data.wifi.gateway         String
data.wifi.mask            String
data.eth.enable           Boolean
data.options.volume       Integer
data.options.enableBeep   Boolean
data.options.mute         Boolean
```

---

## Rate Limits

- **MQTT only documented:** max 5 concurrent connections, max 10 new connections per 5 minutes per UAC
- **HTTP rate limit:** returns code `010301` when exceeded
- **Observed behavior:** heavy polling (many server restarts × 12+ concurrent device calls) causes YoLink to return `data: null` with a non-000000 code — appears to recover within minutes

---

## Integration Bugs Found & Fixed

| Bug | Symptom | Fix |
|-----|---------|-----|
| Missing `time` in request body | YoLink returns `data: null` (code 010201) for many calls | Added `time: Date.now()` to all `yolinkCall` requests |
| No `code === "000000"` check | Partial/error responses could be normalized as real data | Check `s.code !== '000000' \|\| s.data == null` before normalizing |
| Caching empty device list | `sensors: []` for 10 minutes after a failed device list call | Only cache non-empty device lists; check code before reading devices |
| Stale cache written as new history | Duplicate readings when serving cached sensor values | `recordHistory(sensors.filter(s => !s.stale))` |
| THSensor unit lost on cache fallback | Showed `84.6°C` when sensor is in Fahrenheit mode | Cache and restore `unit` from `tempHistory.sensors[id].unit` |
| COSmokeSensor `online` wrong path | Offline smoke alarm showed as normal/operational | Fixed: `normalizeYoLink` now uses `state?.online ?? online` for COSmokeSensor |

---

## Local Hub API (future reference — interesting for LAN-only use)

Direct control without cloud dependency. Lower latency, works offline.

**Requires:** YoLink Local Hub hardware  
**Setup:** YoLink App → Local Hub → Local Network → Integrations → Local API → get ClientId + ClientSecret

**Token endpoint:** `POST http://{hub-ip}:1080/open/yolink/token`  
**API endpoint:** `POST http://{hub-ip}:1080/open/yolink/v2/api`  
**Same BDDP/BUDP format** as cloud API (including required `time` field)

**Local MQTT:**  
Broker: `{hub-ip}:18080`  
Auth: username=ClientId, password=ClientSecret or AccessToken  
Topics: `ylsubnet/{SubNetId}/+/report` (device events), `ylsubnet/{SubNetId}/**/request` (commands)

Device list via `Home.getDeviceList` — same response structure as cloud.

> **Why this matters:** Eliminates cloud round-trips, no rate limiting, works during internet outages. Worth revisiting if cloud polling becomes a bottleneck.

---

## MQTT (future reference)

Broker: `mqtt.api.yosmart.com` port 8003 (TCP) / 8004 (WebSocket)  
Auth: username = access_token, no password, unique client UUID  
Topics:
- `yl-home/{homeId}/+/report` — subscribe for device events (real-time push)
- `yl-home/{homeId}/**/request` — publish commands
- `yl-home/{homeId}/+/response` — subscribe for command responses

MQTT push would eliminate polling entirely and get instant state updates.
