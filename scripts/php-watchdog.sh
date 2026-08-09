#!/bin/sh
# Watchdog: PHP-FPM has been observed entering a state where authenticated
# requests silently fail with an empty-body 500 (no app-level log at all),
# requiring a manual 'docker compose restart php' to recover. Root cause not
# confirmed. Observed BOTH as a total outage (every route fails) and as a
# selective outage (some routes fail, others — including the original single
# canary this script used — stay healthy). Checking only one endpoint missed
# a real incident on 2026-08-09, so this now checks a representative spread
# across different controllers/modules and treats ANY of them returning a
# non-401 as unhealthy (all of these correctly return 401 Unauthenticated
# when hit with no session — no credentials needed for this check).
#
# Deployed on the production host as /home/sadcpf-nexus/php-watchdog.sh,
# registered via `crontab -e`:
#   * * * * * /bin/sh /home/sadcpf-nexus/php-watchdog.sh
# This copy in the repo is for version control / reference only — deploying
# an updated version means copying it to the server path above and (if the
# endpoint list changed) re-testing manually before trusting cron with it.
LOGFILE=/home/sadcpf-nexus/logs/php-watchdog.log
COOLDOWN_FILE=/home/sadcpf-nexus/logs/.php-watchdog-last-restart
COOLDOWN_SECONDS=300
APP_DIR=/home/sadcpf-nexus/htdocs/nexus.sadcpf.org/app

ENDPOINTS="/api/v1/access/effective /api/v1/access/navigation /api/v1/auth/me /api/v1/notifications/unread-count /api/v1/travel/requests /api/v1/programmes /api/v1/budget/lines /api/v1/hr/timesheets"

UNHEALTHY=""
for path in $ENDPOINTS; do
    STATUS=$(docker exec sadcpf_nginx curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Host: nexus-api.sadcpf.org' "http://localhost${path}" 2>/dev/null)
    if [ "$STATUS" != "401" ]; then
        UNHEALTHY="${UNHEALTHY}${path}=${STATUS} "
    fi
done

if [ -z "$UNHEALTHY" ]; then
    exit 0
fi

NOW=$(date +%s)
LAST=0
if [ -f "$COOLDOWN_FILE" ]; then
    LAST=$(cat "$COOLDOWN_FILE")
fi
ELAPSED=$((NOW - LAST))

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC'): unhealthy - $UNHEALTHY" >> "$LOGFILE"

if [ "$ELAPSED" -lt "$COOLDOWN_SECONDS" ]; then
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC'): within cooldown (${ELAPSED}s since last restart), skipping" >> "$LOGFILE"
    exit 0
fi

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC'): restarting php" >> "$LOGFILE"
cd "$APP_DIR" && docker compose restart php >> "$LOGFILE" 2>&1
echo "$NOW" > "$COOLDOWN_FILE"
