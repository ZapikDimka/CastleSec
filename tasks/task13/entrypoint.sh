#!/usr/bin/env bash
set -e

# start cron as root
/usr/sbin/cron

# run web terminal as officer
exec su -s /bin/bash -c "/usr/local/bin/ttyd -i 0.0.0.0 -p 7681 -W /bin/bash -li" sir_lancelot