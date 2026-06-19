#!/bin/bash
# bboard-health.sh — runs as root via cron, writes structured key=value output
# Cron (as root): */5 * * * * /opt/bboard/bboard-health.sh
#
# Output file is read by bboard's /api/server/health endpoint.
# Set HEALTH_FILE in bboard's .env if you change OUTPUT below.

PATH=/usr/local/sbin:/usr/sbin:/sbin:/usr/local/bin:/usr/bin:/bin
OUTPUT=/home/brian/bboard-health.txt
TMPFILE=$(mktemp /home/brian/.bboard-health.tmp.XXXXXX)

{
  # ── Timestamp ─────────────────────────────────────────────────
  echo "timestamp=$(date '+%Y-%m-%d %H:%M:%S')"

  # ── Load average ──────────────────────────────────────────────
  read load1 load5 load15 _ < /proc/loadavg
  echo "load_1=$load1"
  echo "load_5=$load5"
  echo "load_15=$load15"

  # ── CPU / motherboard temps & fans ────────────────────────────
  sensors 2>/dev/null | awk '
    /^pch_/            { in_pch=1 }
    in_pch && /temp1:/ {
      match($0, /[0-9]+\.[0-9]+/)
      print "pch_temp=" substr($0, RSTART, RLENGTH)
      in_pch=0
    }
    /^coretemp/        { in_core=1 }
    in_core && /Package id 0/ {
      match($0, /[0-9]+\.[0-9]+/)
      print "cpu_temp=" substr($0, RSTART, RLENGTH)
      in_core=0
    }
    /Ambient:/         { match($0, /[0-9]+\.[0-9]+/); print "ambient_temp=" substr($0, RSTART, RLENGTH) }
    /Processor Fan:/   { match($0, /[0-9]+/);          print "fan_proc="     substr($0, RSTART, RLENGTH) }
    /Motherboard Fan:/ { match($0, /[0-9]+/);          print "fan_mb="       substr($0, RSTART, RLENGTH) }
  '

  # ── Drive temps (auto-detect all drives via smartctl --scan) ──
  # -n standby skips the drive entirely if it is parked/sleeping,
  # preventing this script from waking attached or backup spinning disks.
  while IFS= read -r scanline; do
    dev=$(echo "$scanline" | awk '{print $1}')
    [ -z "$dev" ] && continue
    devname=$(basename "$dev")
    smart_a=$(smartctl -n standby -A "$dev" 2>/dev/null)
    # Exit code 2 means drive is in standby — record it and skip
    if [ $? -eq 2 ]; then
      echo "drive_${devname}_sleep=1"
      continue
    fi
    temp=$(echo "$smart_a" | awk '
      /Temperature_Celsius/       { t=$10 }
      /Current Drive Temperature/ { t=$4  }
      /^Temperature:/             { if (!t) t=$2 }
      END { print t }
    ')
    health=$(smartctl -n standby -H "$dev" 2>/dev/null | awk '/overall-health self-assessment/{print $NF}')
    # Skip drive only if no useful data at all
    [ -z "$temp" ] && [ -z "$health" ] && continue
    [ -n "$temp"   ] && echo "drive_${devname}_temp=$temp"
    [ -n "$health" ] && echo "drive_${devname}_health=$health"
    # Reallocated sectors (>0 = early warning)
    realloc=$(echo "$smart_a" | awk '/Reallocated_Sector_Ct/{print $10}')
    [ -n "$realloc" ] && [ "$realloc" -gt 0 ] 2>/dev/null && echo "drive_${devname}_realloc=$realloc"
    # Only emit model for SSDs (rotation rate = Solid State Device or 0)
    rotrate=$(smartctl -n standby -i "$dev" 2>/dev/null | awk -F': ' '/Rotation Rate/{gsub(/^[ \t]+/,"",$2);print $2}')
    if echo "$rotrate" | grep -qi "solid state\|^0 "; then
      model=$(smartctl -n standby -i "$dev" 2>/dev/null | awk -F': ' \
        '/Device Model|Model Number/ { gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2; exit }')
      [ -n "$model" ] && echo "drive_${devname}_model=$model"
    fi
  done < <(smartctl --scan 2>/dev/null)

  # ── Swap ──────────────────────────────────────────────────────
  awk '/SwapTotal/{t=$2} /SwapFree/{f=$2} END{print "swap_used_kb=" t-f "\nswap_total_kb=" t}' /proc/meminfo

  # ── SSH sessions ──────────────────────────────────────────────
  echo "ssh_sessions=$(who 2>/dev/null | grep -c .)"

  # ── Failed systemd services ───────────────────────────────────
  echo "systemd_failed=$(systemctl --failed --no-legend 2>/dev/null | grep -c .)"

  # ── UPS (CyberPower pwrstat) ───────────────────────────────────
  /sbin/pwrstat -status 2>/dev/null | awk -F'[.][.]+' '{
    gsub(/^[ \t]+|[ \t]+$/, "", $1)
    gsub(/^[ \t]+|[ \t]+$/, "", $2)
    if ($1 == "State")             print "ups_state="        $2
    if ($1 == "Power Supply by")   print "ups_supply="       $2
    if ($1 == "Utility Voltage")   { gsub(/ V/, "", $2);     print "ups_utility_v="   $2 }
    if ($1 == "Battery Capacity")  { gsub(/ %/, "", $2);     print "ups_battery="     $2 }
    if ($1 == "Remaining Runtime") { gsub(/ min\./, "", $2); print "ups_runtime_min=" $2 }
    if ($1 == "Load") {
      match($2, /([0-9]+) Watt\(([0-9]+) %\)/, a)
      print "ups_load_watts=" a[1]
      print "ups_load_pct="   a[2]
    }
    if ($1 == "Last Power Event")  print "ups_last_event="   $2
  }'

} > "$TMPFILE"
chmod 644 "$TMPFILE"
mv "$TMPFILE" "$OUTPUT"
