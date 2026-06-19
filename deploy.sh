#!/bin/bash
rsync -av \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude keys/ \
  --exclude 'screens/*.delete' \
  --exclude 'schedule.json' \
  --exclude 'data/temp-history.json' \
  /Users/brian/code/bboard/ brian@192.168.0.75:/opt/bboard/
