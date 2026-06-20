# bboard Server Setup

## Production Server

- **Host:** 192.168.0.75 (kenny)
- **User:** brian
- **Install path:** /opt/bboard
- **Service:** systemd `bboard`
- **Node:** v20.20.2 via nvm

---

## Deploying updates

From your Mac, in the bboard directory:

```bash
./deploy.sh
```

This rsyncs everything except `node_modules` and `.git`.

After deploying:
- **Config/JS/CSS changes** — just hard refresh the browser, no restart needed
- **server.js changes** — restart the service:

```bash
ssh brian@192.168.0.75 "sudo systemctl restart bboard"
```

---

## Useful server commands

```bash
# View live logs
ssh brian@192.168.0.75 "sudo journalctl -u bboard -f"

# Check status
ssh brian@192.168.0.75 "sudo systemctl status bboard"

# Restart
ssh brian@192.168.0.75 "sudo systemctl restart bboard"
```

---

## First-time setup (reference)

### 1. Install Node via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

### 2. Create install directory

```bash
sudo mkdir -p /opt/bboard
sudo chown brian:brian /opt/bboard
```

### 3. Sync files from Mac

```bash
./deploy.sh
```

### 4. Install dependencies

```bash
ssh brian@192.168.0.75 "cd /opt/bboard && npm install"
```

### 5. Create systemd service

```bash
sudo nano /etc/systemd/system/bboard.service
```

```ini
[Unit]
Description=bboard dashboard
After=network.target

[Service]
Type=simple
User=brian
WorkingDirectory=/opt/bboard
ExecStart=/home/brian/.nvm/versions/node/v20.20.2/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable bboard
sudo systemctl start bboard
sudo systemctl status bboard
```

---

## What needs a server restart vs. not

| What changed | Action needed |
|---|---|
| `server.js` | `sudo systemctl restart bboard` |
| `orchestrator.json` / `screens/*.json` / `backgrounds.json` | Browser refresh |
| `data/custom-dates.json` | Browser refresh |
| `public/js/*.js` / `public/css/*.css` | Hard refresh (`Cmd+Shift+R`) |
