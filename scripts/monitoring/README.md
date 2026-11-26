# Gesher ERP: server monitoring

Approved by Ankur on the Nov 19 2026 call. Monitoring has two layers:

| Layer | What it catches | Where it runs |
|---|---|---|
| **1. Uptime monitor** (UptimeRobot or Better Stack, free) | The site is down from the outside: server off, app crashed, DNS or SSL problems, database not answering | Outside our server |
| **2. `server-health.sh`** (cron, every 5 min) | Disk full, RAM or CPU too high, app or DB down (checked from inside), DB backup not taken | On our server |

Both use **`/api/health`**:

| Response | Meaning |
|---|---|
| `200` with `"status":"healthy"` | App and database are OK |
| `503` with `"status":"unhealthy"` | App is up, but the database is not answering |
| No answer | App or server is down |

---

## 1. Uptime monitor (outside check), about 10 minutes

### UptimeRobot (free: 50 monitors, 5-minute interval)

1. Sign up at https://uptimerobot.com. Use Ankur's or the company email, so alerts reach the right person.
2. Click **+ New monitor** and fill in:
   - Monitor type: **HTTP(s)**
   - Friendly name: `Gesher ERP`
   - URL: `https://<our domain>/api/health`
   - Monitoring interval: **5 minutes**
   - Under Advanced: keyword monitoring is optional. If you use it, set keyword `"healthy"` with type "exists". This also catches a 200 page that is not our app.
3. Alert contacts: add Jaimin's email and Ankur's email. The UptimeRobot mobile app can also send push alerts.
4. Click **Create monitor**. It should turn green within a few minutes.
5. Optionally, add a second monitor for the login page, `https://<our domain>/login`, with type HTTP(s).

SSL expiry: UptimeRobot (free) and Better Stack both warn before the certificate expires. Turn on "SSL errors / expiry" in the monitor settings.

### Better Stack (alternative)

At https://betterstack.com/uptime, create a monitor of type "URL becomes unavailable" with URL `https://<our domain>/api/health`, check every 3 minutes, and add email alerts.

---

## 2. `server-health.sh` (inside check)

### Checks

| Check | Problem when | Default |
|---|---|---|
| app | `APP_HEALTH_URL` does not answer 200. It retries once after 10 seconds. | |
| disk | A path in `DISK_PATHS` is too full | 80 % |
| memory | RAM in use is too high | 90 % |
| cpu | The 5-minute load average is too high, as a share of the CPU cores | 90 % |
| backup | `last-success.txt` from the DB backup is too old | 30 hours |

It sends one email when a problem starts and a reminder every 6 hours while the problem lasts. It sends a **RECOVERED** email when the problem is fixed. It does not send an email every 5 minutes.

### Setup (one time, on the server)

```bash
cd /path/to/partnerwithgdc && git pull
```

**Usually nothing else to do.** The script reads from the app's own `.env`:
- `NEXT_PUBLIC_APP_URL`: it checks `<url>/api/health`.
- `SMTP_USER`: the Postmark token.
- `SMTP_FROM_EMAIL` and `SUPPORT_EMAIL`: the alert From and To.

To override something, for example the limits or more alert emails, run `sudo cp scripts/monitoring/monitor.env.example /etc/gesher/monitor.env` and uncomment the lines you need.

### Test once by hand

```bash
sudo bash scripts/monitoring/server-health.sh
sudo tail -n 20 /var/lib/gesher-monitor/monitor-$(date +%Y-%m).log
```

On the first run, `backup` is reported as a problem if no backup has run yet. This is expected: it shows that alerts work. You get one email. When the first backup runs, a RECOVERED email follows.

To force a test alert, set `DISK_WARN_PCT=1` in the config and run the script once. You get a "disk" PROBLEM email. Set it back to 80 and run it again. You get a RECOVERED email.

### Cron (every 5 minutes)

```bash
sudo crontab -e
```
```
*/5 * * * * bash /path/to/partnerwithgdc/scripts/monitoring/server-health.sh >/dev/null 2>&1
```

The full root crontab, with the backup line from `scripts/backup/README.md`:
```
0 6 * * * bash /path/to/partnerwithgdc/scripts/backup/db-backup.sh >/dev/null 2>&1
*/5 * * * * bash /path/to/partnerwithgdc/scripts/monitoring/server-health.sh >/dev/null 2>&1
```

---

## 3. Optional: AWS CloudWatch

This applies if the app runs on EC2. In the AWS console, go to EC2 → the instance → **Monitoring** tab, which shows CPU and network for free.

To get an alarm:
1. Go to CloudWatch → Alarms → Create alarm.
2. Choose metric EC2 → `CPUUtilization` for the instance.
3. Set the condition to greater than 90 % for 15 minutes.
4. Send it to an SNS topic, which emails you.

Also create an alarm on `StatusCheckFailed` greater than or equal to 1. It fires when AWS itself sees the server as broken.

CloudWatch does not see disk or RAM without the CloudWatch agent. `server-health.sh` already covers those, so the agent is not needed.
