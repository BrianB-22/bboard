# YoLink API Spec & Integration Notes

Reference: https://doc.yosmart.com/docs/overall/intro

---

## Credential Types

| Type | Who | Scope | How to get |
|------|-----|-------|-----------|
| **UAC** (User Access Credential) | Individual users | Only devices under your own account | YoLink App → Account → Advanced Settings → Personal Access Credentials |
| **CSID** (Third-Party Service ID) | Business partners / integrators | Cross-account device access (requires user consent) | Contact service@yosmart.com |

bboard uses UAC. CSID is for enterprise integrations.

---

## Authentication

### UAC Flow (what bboard uses)

**Token endpoint:** `POST https://api.yosmart.com/open/yolink/token`
```
grant_type=client_credentials&client_id={UAID}&client_secret={Secret Key}
```
**Response:** `access_token`, `refresh_token`, `expires_in`
**Header for all API calls:** `Authorization: Bearer <access_token>`

### CSID Flow

Same token endpoint and format, but using CSID credentials. CSID also gains access to `Manage.*` methods for device registration and callback configuration.

### Local Hub Flow

Same format as UAC but against the local hub:
`POST http://{hub-ip}:1080/open/yolink/token`
Credentials from: YoLink App → Local Hub → Local Network → Integrations → Local API

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

## Account Methods

### Home.getDeviceList
Returns all devices associated with the UAC account.
```
method: "Home.getDeviceList"
```
Response: `data.devices[]` — each device has:
- `deviceId` — stable unique ID (use for matching, not name)
- `deviceUUID` — UUID
- `name` — user-editable display name (fragile for matching)
- `type` — device type string (determines which API methods apply)
- `token` — per-device net token required for all state calls

> **Don't cache an empty device list.** Empty likely means a failed call. Keep the prior cached list.

### Home.getGeneralInfo
```
method: "Home.getGeneralInfo"
```
Response: `data.id` — the home ID (used for MQTT topic construction)

### Hub.getState
```
method: "Hub.getState"
targetDevice: {hubDeviceId}
token: {hubToken}
```
Returns hub connectivity and status.

---

## Manage Methods (CSID only)

### Manage.addYoLinkDevice
Register a device by serial number (from QR code on device label).
- `params.sn` (String) — serial number
- Response: `deviceId`, `deviceUUID`, `token`, `name`, `type`, `modelName`

### Manage.delYoLinkDevice
- `params.deviceId` — Response: `data.success` (Boolean)

### Manage.syncAccountDevice
Retrieve all devices linked to a user's YoSmart account.
- `params.accessToken` — user's OAuth token
- Response: `data.list[]` with same fields as getDeviceList

### Manage.retrieveYoLinkDevice
Query device metadata by serial without registering it.
- `params.sn` — Response: `data.list[]`

### Manage.createAccessToken
Generate scoped API credentials.
- `params.scope` — Response: `access_token`, `token_type`, `expires_in`, `scope[]`

### Manage.setCallbackURL
Configure HTTP callback endpoint for event push (staging only).
- `params.url` — Response: `data.id`, `data.url`, `data.name`

---

## Common Method Patterns (all device types)

These methods follow the same pattern for every device type — documented once here:

**`{Type}.getActivityLogs`** — paginated activity history (requires `DEVICE.HISTORICAL_DATA.READ` permission)
- `params.search.startDate` / `endDate` (YYYY-MM-DD)
- `params.retrievalKey` — pagination token
- Response: `data.logs[].{id, time, data}`, `data.retrievalKeys.next`

**`{Type}.getSchedules` / `{Type}.setSchedules`** — on/off schedule management
- Schedule entry shape: `{ isValid, index, on, off, week }` where `week` is a bitmask (bit 0=Sunday … bit 6=Saturday)
- Max 6 schedules (indices 0–5) unless otherwise noted

**`{Type}.getVersion` / `{Type}.startUpgrade`** — firmware info and OTA update

---

## Device Types & State Formats

### DoorSensor (also used for GarageDoor reading)

```
method: "DoorSensor.getState"
```

```
data.online                Boolean   Device connectivity
data.reportAt              Date      ISO timestamp of last report
data.deviceId              String
data.state.state           String    "open" | "closed" | "error"
data.state.battery         String    0–4 (empty→full)
data.state.stateChangedAt  String    Timestamp of last state change
data.state.openRemindDelay Integer   Delay (seconds) before open reminder [10–64800]
data.state.alertInterval   Integer   Continuous alert frequency (minutes) [0–120]
data.state.delay           Float     Device response delay
data.state.version         String    Firmware version
```

Additional methods: `DoorSensor.setAttributes` (openRemindDelay, alertInterval), `DoorSensor.getActivityLogs`

**GarageDoor note:** Has no `getState` — read via `DoorSensor.getState`. Control via `GarageDoor.toggle` (check state first; no undo). Control via `Finger.toggle` for the physical press device.

---

### THSensor (Temperature & Humidity)

```
method: "THSensor.getState"
```

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

> `temperature` is always raw °C. If `state.mode === 'f'`, convert: `°F = (°C × 9/5) + 32`.

---

### SoilThcSensor (Soil Temperature, Humidity & Conductivity)

```
method: "SoilThcSensor.getState"
```

```
data.online                           Boolean
data.reportAt                         Date
data.deviceId                         String
data.state.state.temperature          Float
data.state.state.humidity             Float
data.state.state.conductivity         Float    µS/cm
data.state.alarm.lowTemp              Boolean
data.state.alarm.highTemp             Boolean
data.state.alarm.lowHumidity          Boolean
data.state.alarm.highHumidity         Boolean
data.state.alarm.lowConductivity      Boolean
data.state.alarm.highConductivity     Boolean
data.state.alarm.period               Boolean  Alert frequency flag
data.state.attributes.alertInterval   Integer
data.state.attributes.reportInterval  Integer
data.state.attributes.tempLimit       Object   {min, max Float}
data.state.attributes.humidityLimit   Object   {min, max Float}
data.state.attributes.conductivityLimit Object {min, max Float}
data.state.tz                         Integer  -12 to 12
data.state.battery                    String   0–4
data.state.version                    String
```

Additional methods: `SoilThcSensor.getActivityLogs`, `SoilThcSensor.getMetricsLogs` (date-range metrics history)

---

### MotionSensor

```
method: "MotionSensor.getState"
```

```
data.online                                  Boolean
data.reportAt                                Date
data.state.state                             String   "normal" | "alert"
data.state.stateChangedAt                    Date
data.state.battery                           String   0–4
data.state.sensitivity                       String
data.state.sensorMode                        String
data.state.beep                              Boolean
data.state.devTemperature                    Float
data.state.interval                          Integer  (optional)
data.state.alarmStateonline.stayError        Boolean
data.state.alarmStateonline.detectorError    Boolean
data.state.alarmStateonline.freezeError      Boolean
data.state.alarmStateonline.reminder         Boolean
```

---

### VibrationSensor

```
method: "VibrationSensor.getState"
```

```
data.state.online              Boolean   NOTE: online is inside state, not at data level
data.state.state               String    "normal" | "alert"
data.state.battery             String    0–4
data.state.alertInterval       Integer   Duration between alert notifications (optional)
data.state.noVibrationDelay    Integer   Time threshold before entering no-vibration state (optional)
data.state.version             String
data.reportAt                  Date
data.deviceId                  String
```

> **Note:** Like COSmokeSensor, `online` is at `data.state.online`, not `data.online`.

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
data.state.devTemperature                Float
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

> **Note:** `online` is nested at `data.state.online`, not `data.online` like most other devices.

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

### Dimmer

```
method: "Dimmer.getState"
method: "Dimmer.setState"   params: { state: "open"|"close", brightness: 1–100 }
method: "Dimmer.setDelay"   params: { delayOn, delayOff } (minutes; 0 cancels)
```

```
data.state          String   "open" | "closed"
data.brightness     Integer  1–100
data.delay.on       Integer  Remaining delay-on (minutes)
data.delay.off      Integer  Remaining delay-off (minutes)
data.version        String
data.tz             Integer  -12 to 12
```

Additional: `Dimmer.setDeviceAttributes` — LED indicator (on/off), level indicator (on/off), gentle on/off ramp [0–20s], low/high calibration [0–99].
Additional methods: `Dimmer.getSchedules`, `Dimmer.setSchedules`, `Dimmer.getVersion`, `Dimmer.startUpgrade`, `Dimmer.getActivityLogs`

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

### InfraredRemoter

```
method: "InfraredRemoter.getState"
method: "InfraredRemoter.learn"   params: { key: 0–63 }
method: "InfraredRemoter.send"    params: { key: 0–63 }
```

```
data.battery     Integer   1–4
data.keys        Boolean[64]  Which of the 64 key slots have learned codes
data.version     String
data.tz          Integer
```

**learn response:** `data.success` (Boolean), `data.errorCode` ("Unknow Error" | "keyError" | "started" | "timeout")
**send response:** `data.success` (Boolean), `data.errorCode` ("notLearn" | "keyError")

Additional: `InfraredRemoter.setSchedule` / `getSchedules` — up to 10 schedules; each entry: `{ isValid, week (bitmask), time (HH:mm), key (0–63) }`.
`InfraredRemoter.setTimeZone` — `params.tz` (-12 to +12)

---

### LockV2

```
method: "LockV2.fetchState"   (cached state — fast)
method: "LockV2.getState"     (live state from device)
method: "LockV2.setState"     params: { state: { lock: "locked"|"unlocked" } }
```

**fetchState response** (slightly different nesting than getState):
```
data.state.state.lock              String   "locked" | "unlocked"
data.state.attributes.autoLock     Integer  seconds (0=disabled)
data.state.attributes.enableSetButton Boolean
data.state.attributes.rlSet        String   "left" | "right"
data.state.attributes.soundLevel   Integer  0–3
data.state.battery                 Integer  0–4
data.hwVersion                     String
data.version                       String
data.tz                            Integer
```

**getState response** (flatter):
```
data.state.lock          String
data.attributes.*        (same as above)
data.battery             Integer
data.hwVersion / version / tz
```

**setAttributes:** `autoLock` (seconds), `rlSet` ("left"|"right"), `soundLevel` (0–3), `enableSetButton` (Boolean)

**userManagement** subcommands (`params.command`):
- `getUserList` → `data.users[].id` (indices 0–11, max 12 users)
- `getUserCredentials` (`params.userId`) → `data.credentials[].{ id, cipher.type, cipher.secret, startAt, endAt, effectivePeriod, effectiveStartTime, effectiveEndTime, effectiveTimes }`
  - cipher types: "Fingerprint" | "Card" | "Fob" | "Code"
- `addUserCredential` — `params.{ userId, cipher.{type, secret (base64, 4–8 chars for Code)}, effectivePeriod.{type, value}, effectiveStartTime, effectiveEndTime, effectiveTimes (0=unlimited) }`
- `delUserCredential` — `params.{ userId, credentialId, cipherType }`
- `delUser` — `params.userId`
- `getTemporaryCredentials` (`params.type`: "OneTime"|"RangeTime"|"PeriodTime") → credentials[]
- `addTemporaryCredential` — max 3 per type; `params.{ type, cipher.{type:"Password", secret (base64)}, startAt, endAt, effectivePeriod, effectiveStartTime, effectiveEndTime }`
- `delTemporaryCredential` — `params.credentialId`

---

### Thermostat

```
method: "Thermostat.getState"
method: "Thermostat.setState"
```

**getState response:**
```
data.state.tempMode          String   "c" | "f"
data.state.temperature       Float    Celsius (current reading)
data.state.humidity          Float    %RH
data.state.lowTemp           Float    Heat setpoint (°C)
data.state.highTemp          Float    Cool setpoint (°C)
data.state.mode              String   "cool" | "heat" | "auto" | "off"
data.state.fan               String   "on" | "auto"
data.state.sche              String   "run" | "hold"
data.state.running           String   "cool" | "heat" | "idle"
data.state.sensor1           Float    Optional remote sensor
data.state.sensor2           Float    Optional remote sensor
data.state.other.auxiliaryHeat   Boolean  (optional)
data.state.other.secondStage     Boolean  (optional)
data.state.other.drRunning       Boolean  (optional)
data.properties.minRuntime       Object
data.properties.coolLimit        Object   Min cool setpoint
data.properties.heatLimit        Object   Max heat setpoint
data.properties.mute             Boolean  (optional)
data.properties.menuLock         Boolean  (optional)
data.properties.auxStandby       Integer  minutes (optional)
data.properties.auxMaxSpan       Integer  hours (optional)
data.properties.auxThreshold     Float    °C (optional)
data.properties.stage2Standby    Integer  minutes (optional)
data.properties.stage2MaxSpan    Integer  hours (optional)
data.properties.stage2Threshold  Float    °C (optional)
data.properties.master           String   "local"|"sensor1"|"sensor2" (optional)
data.eco                         Object
data.version                     String
data.tz                          Integer
```

**setState params:** `lowTemp`, `highTemp`, `mode` ("cool"|"heat"|"auto"|"off"), `fan` ("on"|"auto"), `sche` ("run"|"hold")

Additional methods:
- `Thermostat.getSchedules` / `setSchedules` — 7-day × 4-points/day; each: `{ time (HH:MM), lowTemp, highTemp }`
- `Thermostat.setTimeZone` — `params.tz`
- `Thermostat.setECO` — `params.{ mode ("on"|"off"), lowTemp, highTemp }` (ECO adjustment 0–5°C)
- `Thermostat.setProperties` — aux heat, second stage, min runtime, setpoint limits, mute, menu lock, master sensor
- `Thermostat.setCorrection` — `params.{ temperature (±5°C), humidity (±10%) }`
- `Thermostat.getVersion` / `startUpgrade`
- `Thermostat.getActivityLogs`

---

### SprinklerV2

```
method: "Sprinkler.getState"    (note: method prefix is "Sprinkler", not "SprinklerV2")
method: "Sprinkler.setState"    params: { running: Boolean, waterMode: "schedule"|"manual" }
method: "SprinklerV2.setAttributes"
method: "SprinklerV2.getSchedules"   params: { offset: Integer }  (paginated)
method: "Sprinkler.setSchedules"
```

**getState response:**
```
data.state.running             Boolean  Active watering
data.state.noWaterWhenRunning  Boolean  Water unavailable flag
data.waterMode                 String   "manual" | "schedule"
data.attributes.meterUnit      Integer  0=GAL, 1=CCF, 2=M³, 3=L
data.attributes.meterStepFactor Integer
data.attributes.manualWater    Object   Duration/amount settings
data.attributes.waterDelay     Object   Delay config
data.running                   Object   Current watering execution details
data.waterFlowing              Integer  Flow status
data.battery                   Integer  0–4
data.version                   String
data.tz                        Integer
```

**Schedule entry shape:** `{ index, startDate (M-d), endDate (M-d), time (h:m), waterDelay.type ("duration"|"amount"), days.type ("weekly"|"even_days"|"odd_days"|"every_few_days"), days.value (bitmask or interval), valid }`

---

### WaterMeterController

```
method: "WaterMeterController.getState"
method: "WaterMeterController.setState"     params: { valve: "open"|"close" }
method: "WaterMeterController.setMeterAttributes"
method: "WaterMeterController.getValveSchedules" / setValveSchedules
method: "WaterMeterController.getLeakSchedules"  / setLeakSchedules
```

**getState response:**
```
data.state.valve            String   "open" | "close"
data.state.meter            Integer  Meter reading
data.state.waterFlowing     Boolean
data.alarm.openReminder     Boolean
data.alarm.leak             Boolean
data.alarm.amountOverrun    Boolean
data.alarm.durationOverrun  Boolean
data.alarm.valveError       Boolean
data.alarm.reminder         Boolean
data.alarm.freezeError      Boolean
data.battery                Integer  0–4
data.powerSupply            String   "battery" | "PowerLine"
data.valveDelay.on/off      Integer  Minutes remaining (optional)
data.attributes.meterUnit   Integer  0=GAL, 1=CCF, 2=M3, 3=L
data.attributes.openReminder      Integer  minutes
data.attributes.alertInterval     Integer  minutes
data.attributes.leakLimit         Float
data.attributes.autoCloseValve    Boolean
data.attributes.leakPlan          String   "on"|"off"|"schedule"
data.attributes.overrunAmount     Float
data.attributes.overrunDuration   Integer  minutes
data.attributes.overrunAmountACV  Boolean  Auto-close on amount overrun
data.attributes.overrunDurationACV Boolean
data.attributes.freezeTemp        Float    °C
data.recentUsage.amount           Integer
data.recentUsage.duration         Integer  minutes
data.dailyUsage                   Integer
data.temperature                  Float
data.version                      String
data.tz                           Integer
```

**Leak schedules** add `leakLimit` (Integer, meter units) per entry.

---

### WaterLeakController

```
method: "WaterLeakController.getState"
method: "WaterLeakController.setState"         params: { valve: "open"|"close" }
method: "WaterLeakController.setAttributes"
method: "WaterLeakController.getValveSchedules" / setValveSchedules
method: "WaterLeakController.getLeakSchedules"  / setLeakSchedules
```

**getState response:**
```
data.state.valve                   String   "open" | "close"
data.state.waterTemp               Float    °C
data.state.waterFlowingDuration    Boolean  Single usage duration flag
data.alarm.leak                    Boolean
data.alarm.noWaterError            Boolean
data.alarm.freezeError             Boolean
data.alarm.durationOverrun         Boolean
data.alarm.reminder                Boolean
data.alarm.openReminder            Boolean
data.alarm.sensorDetectorError     Boolean
data.alarm.valveDetectorError      Boolean
data.battery                       Integer  0–4
data.powerSupply                   String   "battery" | "PowerLine"
data.valveDelay.on/off             Integer  Minutes remaining (optional)
data.attributes.openReminder       Integer
data.attributes.alertInterval      Integer
data.attributes.leakPlan           String   "on"|"off"|"schedule"
data.attributes.maxOverrunDuration Integer
data.attributes.sensitivity        Integer
data.attributes.closeValve         Boolean  (various flags)
data.attributes.awayDuration       Integer
data.attributes.mute               Boolean
data.attributes.muteDuration       Integer
data.attributes.waterTemperatureLevel Integer
data.attributes.freezeACVEnable    Boolean
data.attributes.dryPipeTemp        Float
data.muteRemaining                 Integer  minutes
data.heaterTemp                    Float    °C
data.waterTemperatureVariance      Float    °C
data.version                       String
data.tz                            Integer
```

**Leak plan modes:** "off" (manual) | "on" (auto) | "schedule" (away mode)
**Leak schedules** add `{ standBy (minutes), sensivity (deprecated), closeValve (Boolean) }` per entry.
Set `isValid=false` + `week=0` to remove a schedule.

> **Note:** `awaySensivity` attribute is deprecated.

---

### WaterDepthSensor

```
method: "WaterDepthSensor.getState"
method: "WaterDepthSensor.setAttributes"   (method name in spec: "WaterDepthSensor.setSettings")
```

**getState response:**
```
data.state.online                    Boolean
data.state.waterDepth                Integer  Percentage × 10 (e.g. 503 = 50.3%)
data.state.alarm.highAlarm           Boolean  Depth exceeds upper threshold
data.state.alarm.lowAlarm            Boolean  Depth below lower threshold
data.state.alarm.detectorError       Boolean  Probe malfunction
data.state.alarmSettings.standby     Integer  0–7200 seconds
data.state.alarmSettings.interval    Integer  10–240 minutes
data.state.alarmSettings.high        Integer  0–1000 (per-thousand of range)
data.state.alarmSettings.low         Integer  0–1000
data.state.battery                   Integer  0–4
data.state.reportInterval            Integer  10–240 minutes
data.state.version                   String
data.reportAt                        Date
data.deviceId                        String
```

> **Depth formula:** `actualDepth = (range × (waterDepth / 1000)) / density`
> `range` and `density` must be stored client-side — not returned by the API.

---

### Finger (Garage Door Actuator)

```
method: "Finger.toggle"
```

Simulates a single physical button press. No getState — check the paired DoorSensor before calling.

> **Warning:** Always check DoorSensor state first. Finger.toggle is a blind toggle with no confirmation.

---

### CSDevice (Custom LoRa Device)

```
method: "CSDevice.sendCommand"   params: { payload: byte[] }   (waits up to 4s for response)
method: "CSDevice.downlink"      params: { payload: byte[], confirmed: Boolean, fPort: Integer }
```

**sendCommand response:** `data.payload` (byte[]) — response payload from device
**downlink response:** `data.fCnt` (Integer) — frame counter

Uplink data received via HTTP Callback API or MQTT report topic: `data.payload` (byte[])

---

## Rate Limits

- **HTTP rate limit:** returns code `010301` when exceeded
- **MQTT:** max 5 concurrent connections, max 10 new connections per 5 minutes per UAC
- **Observed behavior:** heavy polling (many server restarts × concurrent device calls) causes YoLink to return `data: null` — recovers within minutes

---

## Integration Bugs Found & Fixed (bboard)

| Bug | Symptom | Fix |
|-----|---------|-----|
| Missing `time` in request body | YoLink returns `data: null` (code 010201) | Added `time: Date.now()` to all `yolinkCall` requests |
| No `code === "000000"` check | Partial/error responses treated as real data | Check `s.code !== '000000' \|\| s.data == null` before normalizing |
| Caching empty device list | `sensors: []` for 10 min after a failed device list call | Only cache non-empty device lists; check code first |
| Stale cache written as new history | Duplicate readings when serving cached sensor values | `recordHistory(sensors.filter(s => !s.stale))` |
| THSensor unit lost on cache fallback | Showed `84.6°C` when sensor is in Fahrenheit mode | Restore `unit: hist.unit` from `tempHistory.sensors[id].unit` |
| COSmokeSensor `online` wrong path | Offline smoke alarm showed as normal/operational | `normalizeYoLink` now uses `state?.online ?? online` for COSmokeSensor |

---

## Local Hub API (LAN-only, no cloud dependency)

**Requires:** YoLink Local Hub hardware
**Setup:** YoLink App → Local Hub → Local Network → Integrations → Local API → get ClientId + ClientSecret

**Token endpoint:** `POST http://{hub-ip}:1080/open/yolink/token`
**API endpoint:** `POST http://{hub-ip}:1080/open/yolink/v2/api`
**Same BDDP/BUDP format** as cloud API (including required `time` field)

Device list via `Home.getDeviceList` — same response structure as cloud.

**Local MQTT:**
Broker: `{hub-ip}:18080`
Auth: username=ClientId, password=ClientSecret or AccessToken
Topics: `ylsubnet/{SubNetId}/+/report` (device events), `ylsubnet/{SubNetId}/**/request` (commands)

> **Why this matters:** No rate limiting, lower latency, works during internet outages. Worth revisiting if cloud polling becomes a bottleneck.

---

## MQTT (Cloud)

Broker: `mqtt.api.yosmart.com` port 8003 (TCP) / 8004 (WebSocket)
Auth: username = access_token, no password, unique client UUID
Topics:
- `yl-home/{homeId}/+/report` — subscribe for device events (real-time push)
- `yl-home/{homeId}/**/request` — publish commands
- `yl-home/{homeId}/+/response` — subscribe for command responses

MQTT push would eliminate polling entirely for instant state updates.
`homeId` obtained from `Home.getGeneralInfo` → `data.id`
