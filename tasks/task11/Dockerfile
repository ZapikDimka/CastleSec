# Dockerfile
FROM php:8.0-apache

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Реалістичний "linux server" набір базових утиліт
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash coreutils procps iproute2 net-tools curl ca-certificates \
    findutils grep sed gawk file \
 && rm -rf /var/lib/apt/lists/*

# CGI
RUN a2enmod cgi

# --- ВАЖЛИВО: Apache має слухати 8080 (бо ports: 8080:8080) ---
RUN sed -ri 's/Listen 80/Listen 8080/g' /etc/apache2/ports.conf \
 && sed -ri 's/<VirtualHost \*:80>/<VirtualHost *:8080>/g' /etc/apache2/sites-available/000-default.conf \
 && printf "ServerName localhost\n" > /etc/apache2/conf-available/servername.conf \
 && a2enconf servername

# Директорія для модулів
RUN mkdir -p /var/www/html/uploads

# Підказки
RUN { \
    echo 'АРХІТЕКТУРНА МАГІСТРАЛЬ ДАНИХ ЗАМКУ:'; \
    echo '[Браузер] -> [/uploads/<module>.sh?cmd] -> [Apache CGI] -> [QUERY_STRING] -> [Ваш .sh модуль] -> [Bash]'; \
    echo ''; \
    echo 'УВАГА: браузер кодує пробіли як %20. Якщо виконувати QUERY_STRING "як є" — Bash сприймає %20 як частину імені.'; \
    echo 'Потрібно розкодувати строку перед виконанням.'; \
} > /var/www/html/uploads/architect_blueprint.txt

RUN { \
    echo 'СЕРВЕРНИЙ ІНСТРУМЕНТАРІЙ:'; \
    echo 'У контейнері є PHP.'; \
    echo 'Функція urldecode($string) допоможе розкодувати QUERY_STRING.'; \
    echo 'Приклад: php -r "echo urldecode(getenv(\"QUERY_STRING\"));"'; \
} > /var/www/html/uploads/php_interp.txt

RUN { \
    echo '#!/bin/bash'; \
    echo 'echo "Content-Type: text/plain"'; \
    echo 'echo ""'; \
    echo '# Команда "$QUERY_STRING" не спрацювала, бо пробіли стали %20.'; \
    echo '# Перед виконанням потрібно розкодувати строку.'; \
} > /var/www/html/uploads/legacy_test.sh.bak

# Apache: CGI дозволений лише у /uploads і лише для *.sh
RUN { \
    echo '<Directory /var/www/html/uploads>'; \
    echo '    Options +ExecCGI +Indexes'; \
    echo '    <FilesMatch "\.sh$">'; \
    echo '        SetHandler cgi-script'; \
    echo '    </FilesMatch>'; \
    echo '    AddDefaultCharset UTF-8'; \
    echo '    Require all granted'; \
    echo '</Directory>'; \
} > /etc/apache2/conf-available/uploads-cgi.conf

RUN a2enconf uploads-cgi

# Права
RUN chown -R www-data:www-data /var/www/html/uploads

# Додаток
COPY src/ /var/www/html/

# Флаг
RUN echo "flag{c4stle_g4tes_0p3ned_by_b4sh_cg1}" > /secret_flag.txt

EXPOSE 8080