FROM debian:bookworm AS build

ENV DEBIAN_FRONTEND=noninteractive
ARG TTYD_REF=1.7.7

# deps for building ttyd
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates build-essential cmake pkg-config \
    libwebsockets-dev libjson-c-dev libssl-dev zlib1g-dev libuv1-dev \
 && rm -rf /var/lib/apt/lists/*

# build ttyd
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

# runtime deps (ВАЖЛИВО: evlib plugin для uv)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates login \
    coreutils findutils grep sed less procps \
    libwebsockets17 libwebsockets-evlib-uv \
    libjson-c5 libssl3 zlib1g libuv1 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/ttyd /usr/local/bin/ttyd

# --- 4 Knights (Officers), uniform naming ---
# Only ONE is vulnerable: sir_lancelot (leaked secret == actual system password)
RUN useradd -m -s /bin/bash sir_lancelot && echo "sir_lancelot:H0lyGrail_2026!lancelot" | chpasswd && \
    useradd -m -s /bin/bash sir_gawain    && echo "sir_gawain:rG9!e2V#c7K@p5Tz1M8nQ6hD" | chpasswd && \
    useradd -m -s /bin/bash sir_percival  && echo "sir_percival:xP4@N9!s7L#k2Vt6Q8mR1zH" | chpasswd && \
    useradd -m -s /bin/bash sir_galahad   && echo "sir_galahad:mT8#Q2!v9P@r6Kz1N7xH5sD" | chpasswd

# Hide /home listing (forces name knowledge from Task8)
RUN chmod 711 /home && \
    chmod 711 /home/sir_lancelot /home/sir_gawain /home/sir_percival /home/sir_galahad

# Histories look similar for all and are readable for all.
# But only Lancelot’s leaked credential is the real system password.
RUN printf "%s\n" \
  "cd /var/www/html" \
  "ls -la" \
  "curl -u sir_lancelot:H0lyGrail_2026!lancelot http://127.0.0.1/internal/health  # reused password (bad)" \
  "echo 'TODO: rotate creds after incident' >> /tmp/ops.log" \
  > /home/sir_lancelot/.bash_history \
 && chown sir_lancelot:sir_lancelot /home/sir_lancelot/.bash_history \
 && chmod 644 /home/sir_lancelot/.bash_history

RUN printf "%s\n" \
  "cd /var/www/html" \
  "ls -la" \
  "curl -u sir_gawain:tok_9f3c1a7b2e4d8c0a http://127.0.0.1/internal/health  # token, not system pass" \
  "echo 'shift report ok' >> /tmp/ops.log" \
  > /home/sir_gawain/.bash_history \
 && chown sir_gawain:sir_gawain /home/sir_gawain/.bash_history \
 && chmod 644 /home/sir_gawain/.bash_history

RUN printf "%s\n" \
  "cd /var/www/html" \
  "ls -la" \
  "curl -u sir_percival:tok_6b0e2f9a1c7d3e8f http://127.0.0.1/internal/health  # token, not system pass" \
  "echo 'inventory checked' >> /tmp/ops.log" \
  > /home/sir_percival/.bash_history \
 && chown sir_percival:sir_percival /home/sir_percival/.bash_history \
 && chmod 644 /home/sir_percival/.bash_history

RUN printf "%s\n" \
  "cd /var/www/html" \
  "ls -la" \
  "curl -u sir_galahad:tok_1d8a4c0f7b2e9a6c http://127.0.0.1/internal/health  # token, not system pass" \
  "echo 'patrol done' >> /tmp/ops.log" \
  > /home/sir_galahad/.bash_history \
 && chown sir_galahad:sir_galahad /home/sir_galahad/.bash_history \
 && chmod 644 /home/sir_galahad/.bash_history

# Artifact (only vulnerable knight can read)
RUN printf "%s\n" "CASTLESEC{T12_OFFICER_ARMOR_GRANTED}" > /home/sir_lancelot/OFFICER_ARMOR.flag \
 && chown sir_lancelot:sir_lancelot /home/sir_lancelot/OFFICER_ARMOR.flag \
 && chmod 640 /home/sir_lancelot/OFFICER_ARMOR.flag

# --- start as www-data ---
RUN usermod -s /bin/bash www-data && \
    mkdir -p /var/www && \
    chown -R www-data:www-data /var/www

# In-world hint note
RUN printf "%s\n" \
  "Записка Попередника:" \
  "  У замку є Джура-Хроніст — тихий слуга при кожному офіцері." \
  "  Він не пише в системні книги (/var/log), він шепоче в їхніх покоях." \
  "  Джура пам’ятає кожен рядок, який офіцер вимовив у темряві терміналу." \
  "  Шукай його записи там, де офіцери зберігають особисті речі." \
  > /var/www/note.txt \
 && chown www-data:www-data /var/www/note.txt \
 && chmod 644 /var/www/note.txt

COPY bashrc_wwwdata /var/www/.bashrc
RUN chown www-data:www-data /var/www/.bashrc

WORKDIR /var/www
USER www-data

EXPOSE 7681

CMD ["bash","-lc","exec /usr/local/bin/ttyd -i 0.0.0.0 -p 7681 -W /bin/bash -li"]