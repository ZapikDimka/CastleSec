FROM debian:bookworm AS build

ENV DEBIAN_FRONTEND=noninteractive
ARG TTYD_REF=1.7.7

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates build-essential cmake pkg-config \
    libwebsockets-dev libjson-c-dev libssl-dev zlib1g-dev libuv1-dev \
 && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  mkdir -p /out; \
  if git clone --depth 1 --branch "${TTYD_REF}" https://github.com/tsl0922/ttyd.git /src; then :; \
  elif git clone --depth 1 --branch "v${TTYD_REF}" https://github.com/tsl0922/ttyd.git /src; then :; \
  else git clone --depth 1 https://github.com/tsl0922/ttyd.git /src; fi; \
  cmake -S /src -B /src/build; \
  cmake --build /src/build -j"$(nproc)"; \
  install -m 755 /src/build/ttyd /out/ttyd


FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates login cron \
    coreutils findutils grep sed less procps \
    libwebsockets17 libwebsockets-evlib-uv \
    libjson-c5 libssl3 zlib1g libuv1 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/ttyd /usr/local/bin/ttyd

# Officer user
RUN useradd -m -s /bin/bash sir_lancelot

# Group for clock mechanism access
RUN groupadd -r clock && usermod -aG clock sir_lancelot

# Root flag (Crown)
RUN printf "%s\n" "CASTLESEC{T13_IRON_KING_CROWN_ROOT}" > /root/IRON_CROWN.flag \
 && chmod 600 /root/IRON_CROWN.flag

# Vulnerable clock mechanism script (editable by officer via group)
RUN mkdir -p /opt/clocktower && \
    printf "%s\n" \
      "#!/usr/bin/env bash" \
      "echo \"[clock] winding mechanism: \$(date -u +%F_%T)\"" \
      "echo \"[clock] gears engaged\"" \
      > /opt/clocktower/winder.sh && \
    chown root:clock /opt/clocktower/winder.sh && \
    chmod 775 /opt/clocktower/winder.sh

# Root runner (cron executes this as root) — FIX: tick must be computed at runtime
RUN printf "%s\n" \
  "#!/usr/bin/env bash" \
  "set -e" \
  "echo \"[king] tick \$(date -u +%F_%T)\"" \
  "bash /opt/clocktower/winder.sh" \
  > /usr/local/bin/king_winder && \
  chmod 755 /usr/local/bin/king_winder && \
  chown root:root /usr/local/bin/king_winder

# Cron job: every minute as root
RUN printf "%s\n" \
  "SHELL=/bin/bash" \
  "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  "* * * * * root /usr/local/bin/king_winder >> /var/log/king_winder.log 2>&1" \
  > /etc/cron.d/king_winder && \
  chmod 0644 /etc/cron.d/king_winder

RUN touch /var/log/king_winder.log && chmod 0644 /var/log/king_winder.log

# In-world hint note (copied as separate file below)
COPY tower_note.txt /home/sir_lancelot/tower_note.txt
RUN chown sir_lancelot:sir_lancelot /home/sir_lancelot/tower_note.txt && \
    chmod 0644 /home/sir_lancelot/tower_note.txt

# Officer shell banner
COPY bashrc_officer /home/sir_lancelot/.bashrc
RUN chown sir_lancelot:sir_lancelot /home/sir_lancelot/.bashrc

RUN printf "%s\n" \
  'if [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc"; fi' \
  > /home/sir_lancelot/.bash_profile && \
  chown sir_lancelot:sir_lancelot /home/sir_lancelot/.bash_profile

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh

EXPOSE 7681
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]