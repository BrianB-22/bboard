#!/bin/bash
# bboard-drives.sh — daily SMART health scan, wakes all drives once
# Cron (as root): 0 3 * * * /opt/bboard/bboard-drives.sh

PATH=/usr/local/sbin:/usr/sbin:/sbin:/usr/local/bin:/usr/bin:/bin
OUTPUT=/home/brian/bboard-drives.txt
TMPFILE=$(mktemp /home/brian/.bboard-drives.tmp.XXXXXX)

{
  echo "drives_scanned=$(date '+%Y-%m-%d %H:%M:%S')"

  while IFS= read -r scanline; do
    dev=$(echo "$scanline" | awk '{print $1}')
    [ -z "$dev" ] && continue
    devname=$(basename "$dev")

    health=$(smartctl -H "$dev" 2>/dev/null | awk '/overall-health self-assessment/{print $NF}')
    [ -z "$health" ] && continue
    echo "drive_${devname}_health=$health"

    smart_a=$(smartctl -A "$dev" 2>/dev/null)
    temp=$(echo "$smart_a" | awk '
      /Temperature_Celsius/       { t=$10 }
      /Current Drive Temperature/ { t=$4  }
      /^Temperature:/             { if (!t) t=$2 }
      END { print t }
    ')
    [ -n "$temp" ] && echo "drive_${devname}_temp=$temp"
    realloc=$(echo "$smart_a" | awk '/Reallocated_Sector_Ct/{print $10}')
    [ -n "$realloc" ] && [ "$realloc" -gt 0 ] 2>/dev/null && echo "drive_${devname}_realloc=$realloc"

    rotrate=$(smartctl -i "$dev" 2>/dev/null | awk -F': ' '/Rotation Rate/{gsub(/^[ \t]+/,"",$2);print $2}')
    if echo "$rotrate" | grep -qi "solid state\|^0 "; then
      model=$(smartctl -i "$dev" 2>/dev/null | awk -F': ' \
        '/Device Model|Model Number/ { gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2; exit }')
      [ -n "$model" ] && echo "drive_${devname}_model=$model"
    fi
  done < <(smartctl --scan 2>/dev/null)
} > "$TMPFILE"
chmod 644 "$TMPFILE"
mv "$TMPFILE" "$OUTPUT"
