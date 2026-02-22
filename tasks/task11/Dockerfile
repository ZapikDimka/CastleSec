FROM php:8.0-apache

# Форсуємо UTF-8 для правильного відображення української мови у файлах
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Встановлюємо bash та інструменти
RUN apt-get update && apt-get install -y bash netcat-traditional && rm -rf /var/lib/apt/lists/*

# Вмикаємо CGI та створюємо структуру
RUN a2enmod cgi && mkdir -p /var/www/html/uploads

# --- ПІДКАЗКА 1: Схема магістралі ---
RUN { \
    echo 'АРХІТЕКТУРНА МАГІСТРАЛЬ ДАНИХ ЗАМКУ:'; \
    echo '[Браузер URL?cmd] -> [Apache Gateway] -> [Змінна QUERY_STRING] -> [Ваш .sh скрипт] -> [Bash]'; \
    echo ''; \
    echo 'УВАГА: Gateway кодує пробіли як %20. Bash бачить %20 як частину імені команди і видає "Not Found".'; \
    echo 'Для успіху потрібно розкодувати строку перед виконанням.'; \
} > /var/www/html/uploads/architect_blueprint.txt

# --- ПІДКАЗКА 2: Нотатка про PHP ---
RUN { \
    echo 'СЕРВЕРНИЙ ІНСТРУМЕНТАРІЙ:'; \
    echo 'PHP 8.0 встановлено для системних потреб.'; \
    echo 'Функція urldecode($string) — це ключ до розуміння QUERY_STRING.'; \
    echo 'Виклик з консолі: php -r "echo urldecode(getenv(\"QUERY_STRING\"));"'; \
} > /var/www/html/uploads/php_interp.txt

# --- ПІДКАЗКА 3: Зламаний приклад ---
RUN { \
    echo '#!/bin/bash'; \
    echo 'echo "Content-Type: text/plain"'; \
    echo 'echo ""'; \
    echo '# ЛОГ СТАРОЇ ПОМИЛКИ:'; \
    echo '# Команда "$QUERY_STRING" не спрацювала, бо пробіли стали %20.'; \
    echo '# Треба було використати щось на кшталт eval $(розкодована_команда)'; \
} > /var/www/html/uploads/legacy_test.sh.bak

# --- Налаштування Apache (Безпечний синтаксис + Форсування UTF-8) ---
RUN { \
    echo '<Directory /var/www/html/uploads>'; \
    echo '    Options +ExecCGI +Indexes'; \
    echo '    # Виконуємо ТІЛЬКИ файли, що точно закінчуються на .sh'; \
    echo '    <FilesMatch "\.sh$">'; \
    echo '        SetHandler cgi-script'; \
    echo '    </FilesMatch>'; \
    echo '    # Вказуємо браузеру правильне кодування тексту'; \
    echo '    AddDefaultCharset UTF-8'; \
    echo '    Require all granted'; \
    echo '</Directory>'; \
} > /etc/apache2/conf-available/uploads-cgi.conf

RUN a2enconf uploads-cgi

# Права та прапорець (студенти бачитимуть файли одразу після знаходження папки)
RUN chown -R www-data:www-data /var/www/html/uploads
COPY src/ /var/www/html/
RUN echo "flag{c4stle_g4tes_0p3ned_by_b4sh_cg1}" > /secret_flag.txt

EXPOSE 80