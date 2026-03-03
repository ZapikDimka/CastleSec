#!/usr/bin/env bash
set -euo pipefail

# cron (root)
 /usr/sbin/cron

# flag-check API (localhost only; needs root to read /root/IRON_CROWN.flag)
python3 /opt/flagcheck.py &

# ttyd as officer (localhost only; proxied by nginx)
su -s /bin/bash -c '/usr/local/bin/ttyd -i 127.0.0.1 -p 7681 -W /bin/bash -li' sir_lancelot &

# nginx in foreground
mkdir -p /run/nginx
exec nginx -g 'daemon off;'