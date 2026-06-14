#!/bin/bash
# bboard-health.sh — runs as root via cron, writes structured key=value output
# Cron (as root): */5 * * * * /opt/bboard/bboard-health.sh
#
# Output file is read by bboard's /api/server/health endpoint.
# Set HEALTH_FILE in bboard's .env if you change OUTPUT below.

OUTPUT=/home/brian/bboard-health.txt

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

  # ── Drive temps ───────────────────────────────────────────────
  # SSD via hddtemp (also gives model name)
  hddtemp /dev/sdb 2>/dev/null | grep '°C' | awk -F': ' '{
    gsub(/°C/, "", $3)
    print "drive_sdb_model=" $2
    print "drive_sdb_temp="  $3
  }'

  # Spindle drives via smartctl
  for dev in sdc sdd sde sdf sdg sdh sdi; do
    temp=$(smartctl -A /dev/$dev 2>/dev/null | awk '/Temperature_Celsius/{print $10}')
    [ -n "$temp" ] && echo "drive_${dev}_temp=$temp"
  done

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

} > "$OUTPUT"
