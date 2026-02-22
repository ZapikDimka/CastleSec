#!/bin/bash
# Переходимо в папку проекту
cd /app/archive

# Ініціалізація Git
git init
git config user.email "archivist@castle.local"
git config user.name "Royal Archivist"

# --- ПІДКАЗКА ВСЕРЕДИНІ ПАПКИ .git ---
# Створюємо файл прямо в службовій папці
echo "Підказка: десь в цій папці раніше були важливі дані. Перевір історію комітів (git log)." > .git/info.txt

# 1. Початковий коміт
git add index.html
git commit -m "Initial commit: Archive frontend setup"

# 2. Коміт з прапором
echo "flag{g1t_h1st0ry_n3v3r_li3s}" > secret.txt
git add secret.txt
git commit -m "Draft: Added secret documents and access keys"

# 3. Видалення секрету (залишається в історії)
rm secret.txt
git add .
git commit -m "Security fix: Cleaned up the public archive"

# Оновлення метаданих для інструментів викачування
git update-server-info