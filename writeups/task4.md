# Task4 “Glass House” — Writeup (порт 8080)

## Ціль
Знайти `SECRET_KEY` і пройти серверну перевірку через форму на головній сторінці (POST на `/api/verify-key`).

## 1) Розвідка з фронтенду
1. Відкрий `http://localhost:8080/`.
2. У коді сторінки видно, що “перевірка статусу” робить запит `fetch("/info")`. Це підказка на службовий endpoint `/info`.

## 2) Пошук “прихованих” шляхів через robots.txt
Перевір `http://localhost:8080/robots.txt`. Там вказані маршрути:
- `/status`
- `/info`

`robots.txt` не є захистом, тож ці маршрути можна відкрити напряму.

## 3) Витік SECRET_KEY
Варіант A (JSON):
- Відкрий `http://localhost:8080/info` і знайди в відповіді поле `SECRET_KEY`.

Варіант B (plain text):
- Відкрий `http://localhost:8080/status` і знайди рядок `SECRET_KEY=...`.

У цьому завданні `SECRET_KEY` задається через `docker-compose.yml` як флаг: `FLAG{ALWAYS_CHECK_HTML_COMMENTS}`.

## 4) Підтвердження ключа
### Через UI
Встав `SECRET_KEY` у поле і натисни “Перевірити” (фронт відправляє POST на `/api/verify-key`).

### Через curl (опціонально)
```bash
curl -s http://localhost:8080/status | grep SECRET_KEY

curl -s -X POST http://localhost:8080/api/verify-key \
  -H 'Content-Type: application/json' \
  -d '{"key":"FLAG{ALWAYS_CHECK_HTML_COMMENTS}"}'
```

Очікувано отримаєш `ok: true` (і `unlocked`, якщо це передбачено сервером).

## Результат
Флаг: **`FLAG{ALWAYS_CHECK_HTML_COMMENTS}`**
