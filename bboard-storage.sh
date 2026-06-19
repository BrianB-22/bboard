#!/bin/bash
# bboard-storage.sh — captures storage usage for the bboard dashboard
# without keeping spinning/standby drives awake via frequent polling.
#
# Run weekly via root cron — drives are already awake during scheduled backup:
#   0 4 * * 0 /opt/bboard/bboard-storage.sh
#
# Output is read by bboard's /api/server/storage endpoint.
# Set STORAGE_FILE in bboard's .env to override the output path.

PATH=/usr/local/sbin:/usr/sbin:/sbin:/usr/local/bin:/usr/bin:/bin
OUTPUT=/home/brian/bboard-storage.json
TMPFILE=$(mktemp /home/brian/.bboard-storage.tmp.XXXXXX)

checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

pair_list=""
sep=""

for n in "" 1 2 3 4; do
  data_mnt="/data${n}"
  backup_mnt="/backup${n}"

  data_line=$(df -Pk "$data_mnt" 2>/dev/null | awk 'NR==2')
  backup_line=$(df -Pk "$backup_mnt" 2>/dev/null | awk 'NR==2')

  [ -z "$data_line" ] && [ -z "$backup_line" ] && continue

  if [ -n "$data_line" ]; then
    d_total=$(echo "$data_line" | awk '{printf "%d", $2 * 1024}')
    d_used=$(echo  "$data_line" | awk '{printf "%d", $3 * 1024}')
    data_json="{\"total\":$d_total,\"used\":$d_used}"
  else
    data_json="null"
  fi

  if [ -n "$backup_line" ]; then
    b_total=$(echo "$backup_line" | awk '{printf "%d", $2 * 1024}')
    b_used=$(echo  "$backup_line" | awk '{printf "%d", $3 * 1024}')
    backup_json="{\"total\":$b_total,\"used\":$b_used}"
  else
    backup_json="null"
  fi

  ts_file="${backup_mnt}/data${n}/backup-timestamp"
  if [ -f "$ts_file" ]; then
    epoch=$(stat -c '%Y' "$ts_file" 2>/dev/null)
    last_backup="\"$(date -u -d "@$epoch" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null)\""
  else
    last_backup="null"
  fi

  pair_json="{\"dataMnt\":\"$data_mnt\",\"backupMnt\":\"$backup_mnt\",\"data\":$data_json,\"backup\":$backup_json,\"lastBackup\":$last_backup}"
  pair_list="${pair_list}${sep}${pair_json}"
  sep=","
done

printf '{"checkedAt":"%s","pairs":[%s]}\n' "$checked_at" "$pair_list" > "$TMPFILE"
chmod 644 "$TMPFILE"
mv "$TMPFILE" "$OUTPUT"
