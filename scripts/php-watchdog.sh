#!/bin/sh
# Watchdog: PHP-FPM has been observed entering a state where authenticated
# requests silently fail with an empty-body 500 (no app-level log at all),
# requiring a manual 'docker compose restart php' to recover. Root cause not
# confirmed.
#
# Two things learned the hard way from real incidents:
#  1. The failure can be SELECTIVE across endpoints (some routes 500, others
#     stay healthy) — checking only one canary endpoint missed a real
#     incident on 2026-08-09.
#  2. The failure can be PER-WORKER, not global — with pm.max_children=5,
#     if only some workers are in the bad state, a single synthetic request
#     to each endpoint can get luckily routed to a healthy worker and see
#     nothing wrong, while real concurrent user traffic keeps hitting
#     broken ones. A sustained 6-minute real-user outage on 2026-08-09
#     produced zero hits in the synthetic multi-endpoint check for this
#     exact reason.
#
# So detection is now primarily LOG-BASED: scan nginx's actual access log
# for the real failure signature (empty-body 500 on an /api/v1/* route) in
# the last ~90 seconds. This observes real traffic directly instead of
# hoping a synthetic probe happens to hit the same broken worker a real
# user just did. The synthetic multi-endpoint check is kept as a fallback
# for quiet periods with no real traffic to observe.
#
# Deployed on the production host as /home/sadcpf-nexus/php-watchdog.sh,
# registered via `crontab -e`:
#   * * * * * /bin/sh /home/sadcpf-nexus/php-watchdog.sh
# This copy in the repo is for version control / reference only — deploying
# an updated version means copying it to the server path above and
# re-testing manually before trusting cron with it.
LOGFILE=/home/sadcpf-nexus/logs/php-watchdog.log
COOLDOWN_FILE=/home/sadcpf-nexus/logs/.php-watchdog-last-restart
# Was 300s. On 2026-08-09, a restart at 13:21:33 fixed one incident, but a
# DIFFERENT failure (all 8 probes returning 403 "Access denied.", a symptom
# never seen before or traced to app code) started within ~90s and was
# correctly detected at 13:23:02/13:24:02/13:25:03 — but the cooldown from
# the FIRST restart blocked all three, leaving it broken for several minutes
# with the watchdog aware of it and unable to act. 300s made sense for
# preventing restart-thrashing on one *persistent* failure; it was too long
# once it started blocking legitimate fixes for *distinct* new failures
# arriving shortly after an unrelated one.
COOLDOWN_SECONDS=120
APP_DIR=/home/sadcpf-nexus/htdocs/nexus.sadcpf.org/app

# --- Primary signal: real 500s on /api/v1/* in nginx's log in the last 90s ---
RECENT_API_500S=$(docker logs sadcpf_nginx --since 90s 2>&1 | grep -E '/api/v1/.*" 500 5 ' | wc -l | tr -d ' ')

REASON=""
if [ "$RECENT_API_500S" -ge 2 ] 2>/dev/null; then
    REASON="log-based: ${RECENT_API_500S} empty-body 500s on /api/v1/* in the last 90s"
fi

# --- Fallback signal: synthetic multi-endpoint probe (catches quiet-period total outages) ---
if [ -z "$REASON" ]; then
    ENDPOINTS="/api/v1/access/effective /api/v1/access/navigation /api/v1/auth/me /api/v1/notifications/unread-count /api/v1/travel/requests /api/v1/programmes /api/v1/budget/lines /api/v1/hr/timesheets"
    UNHEALTHY=""
    for path in $ENDPOINTS; do
        STATUS=$(docker exec sadcpf_nginx curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Host: nexus-api.sadcpf.org' "http://localhost${path}" 2>/dev/null)
        if [ "$STATUS" != "401" ]; then
            UNHEALTHY="${UNHEALTHY}${path}=${STATUS} "
        fi
    done
    if [ -n "$UNHEALTHY" ]; then
        REASON="probe-based: $UNHEALTHY"
    fi
fi

if [ -z "$REASON" ]; then
    exit 0
fi

NOW=$(date +%s)
LAST=0
if [ -f "$COOLDOWN_FILE" ]; then
    LAST=$(cat "$COOLDOWN_FILE")
fi
ELAPSED=$((NOW - LAST))

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC'): unhealthy - $REASON" >> "$LOGFILE"

if [ "$ELAPSED" -lt "$COOLDOWN_SECONDS" ]; then
    echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC'): within cooldown (${ELAPSED}s since last restart), skipping" >> "$LOGFILE"
    exit 0
fi

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC'): restarting php" >> "$LOGFILE"
cd "$APP_DIR" && docker compose restart php >> "$LOGFILE" 2>&1
echo "$NOW" > "$COOLDOWN_FILE"
