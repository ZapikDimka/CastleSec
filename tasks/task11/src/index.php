<?php
// src/index.php

$message = "";
$status_class = "";

$flag_message = "";
$flag_status_class = "";

// --- Uploads dir ---
$target_dir = __DIR__ . "/uploads/";
if (!file_exists($target_dir)) {
    mkdir($target_dir, 0777, true);
}

function safe_filename(string $name): string {
    $name = basename($name);
    $name = preg_replace('/[^a-zA-Z0-9._-]/', '_', $name);
    return $name ?: "module.sh";
}

// --- Flag check ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['flag_value'])) {
    $user_flag = trim((string)$_POST['flag_value']);
    $real_flag = "";

    if (file_exists("/secret_flag.txt")) {
        $real_flag = trim((string)@file_get_contents("/secret_flag.txt"));
    }

    if ($user_flag === "" || $real_flag === "") {
        $flag_status_class = "error";
        $flag_message = "[ПОМИЛКА] Неможливо перевірити флаг або флаг порожній.";
    } else {
        if (function_exists('hash_equals')) {
            $ok = hash_equals($real_flag, $user_flag);
        } else {
            $ok = ($real_flag === $user_flag);
        }

        if ($ok) {
            $flag_status_class = "success";
            $flag_message = "[УСПІХ] Флаг правильний. Рівень пройдено!";
        } else {
            $flag_status_class = "error";
            $flag_message = "[НЕВІРНО] Флаг неправильний. Спробуй ще.";
        }
    }
}

// --- Upload .sh ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['script_file'])) {
    $original = $_FILES['script_file']['name'] ?? '';
    $filename = safe_filename($original);
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    if ($ext !== "sh") {
        $status_class = "error";
        $message = "[ВІДМОВА] Система приймає лише бойові модулі (.sh)!";
    } else {
        $tmp = $_FILES['script_file']['tmp_name'] ?? '';
        $target_file = $target_dir . $filename;

        if ($tmp && is_uploaded_file($tmp) && move_uploaded_file($tmp, $target_file)) {
            chmod($target_file, 0755);
            $status_class = "success";
            $message = "[АКТИВАЦІЯ] Модуль '{$filename}' підключено.";
        } else {
            $status_class = "error";
            $message = "[ПОМИЛКА] Не вдалося завантажити модуль.";
        }
    }
}

// --- Latest uploaded .sh ---
$latest_file = "";
$latest_mtime = 0;
$files = @scandir($target_dir) ?: [];

foreach ($files as $file) {
    if ($file === '.' || $file === '..') continue;
    if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) !== 'sh') continue;

    $mtime = @filemtime($target_dir . $file) ?: 0;
    if ($mtime > $latest_mtime) {
        $latest_mtime = $mtime;
        $latest_file = $file;
    }
}
?>
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Інженерний Термінал Замку</title>
    <style>
        :root { --bg:#0d1117; --card:#161b22; --border:#30363d; --green:#3fb950; --blue:#58a6ff; --red:#f85149; --yellow:#e3b341; }
        body { background:var(--bg); color:#c9d1d9; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
               padding:20px; display:flex; flex-direction:column; align-items:center; }
        .grid { display:grid; grid-template-columns: 1fr 340px; gap:20px; width:100%; max-width:1100px; }
        .panel { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,.45); }
        h1 { font-size:1.05em; margin:0 0 12px 0; color:var(--blue); border-bottom:1px solid var(--border); padding-bottom:10px; }
        h2 { font-size:.95em; margin:0 0 10px 0; color:var(--yellow); }
        .status-success { color:var(--green); font-weight:bold; margin-bottom:14px; }
        .status-error { color:var(--red); font-weight:bold; margin-bottom:14px; }

        #console {
            background:#000;
            color:var(--green);
            border:1px solid var(--border);
            padding:14px;
            height:360px;
            overflow:auto;
            font-size:13px;
            white-space:pre-wrap;
            line-height:1.35;
        }
        .input-line { display:flex; gap:10px; background:#000; border:1px solid var(--border); border-top:none; padding:10px; align-items:center; }
        .prompt { color:var(--blue); font-weight:bold; }
        #cmd-in { background:none; border:none; color:#fff; width:100%; outline:none; font:inherit; }
        button { background:var(--green); color:#fff; border:none; padding:6px 14px; cursor:pointer; font-weight:bold; border-radius:4px; }
        input[type="file"] { color:#c9d1d9; }
        a { color:var(--blue); }

        .note { font-size:.85em; color:#c9d1d9; line-height:1.55; }
        .small { font-size:.75em; color:#8b949e; }
        .divider { border-top:1px dashed var(--border); padding-top:14px; margin-top:14px; }
        .hidden { display:none; }

        .flagbox input[type="text"] {
            width: 100%;
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: #0b0f14;
            color: #fff;
            font: inherit;
            outline: none;
        }
        .flagbox button { width: 100%; margin-top: 10px; }
        .flag-help { margin-top: 8px; }
    </style>
</head>
<body>

<div class="grid">
    <div class="panel">
        <h1>ЦЕНТРАЛЬНИЙ ВУЗОЛ УПРАВЛІННЯ</h1>

        <?php if ($message): ?>
            <div class="<?php echo $status_class === 'success' ? 'status-success' : 'status-error'; ?>">
                > <?php echo htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
            </div>
        <?php endif; ?>

        <form action="index.php" method="POST" enctype="multipart/form-data" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <input type="file" name="script_file" required>
            <button type="submit">АКТИВУВАТИ МОДУЛЬ</button>
        </form>

        <div id="terminal-ui" class="<?php echo $latest_file ? '' : 'hidden'; ?>" style="margin-top:18px;">
            <div class="small">
                АКТИВНИЙ ОБРОБНИК:
                <span style="color:var(--yellow);"><?php echo htmlspecialchars($latest_file, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?></span>
            </div>

            <div id="console">[З'ЄДНАННЯ ВСТАНОВЛЕНО]
(це реальний Linux усередині контейнера; термінал показує відповідь CGI-модуля)
</div>

            <div class="input-line">
                <span class="prompt">$</span>
                <input type="text" id="cmd-in" autocomplete="off" spellcheck="false" placeholder="введіть команду...">
            </div>
        </div>

        <div id="no-module" class="<?php echo $latest_file ? 'hidden' : ''; ?>" style="margin-top:18px;">
            <div class="note">
                Щоб відкрити термінал, завантажте модуль <b>.sh</b> (він буде виконуватись як CGI у <b>/uploads</b>).
            </div>
        </div>
    </div>

    <div class="panel">
        <h1 style="color:var(--yellow);">ПАНЕЛЬ РІВНЯ</h1>

        <h2>База знань</h2>
        <div class="note">
            Термінал працює через CGI: браузер надсилає команду в URL, а ваш модуль у <b>/uploads</b> її обробляє.
        </div>

        <div class="divider small">
            Дослідіть директорію <a href="uploads/" target="_blank">/uploads</a> — там є креслення та нотатки інженерів.
        </div>

        <div class="divider flagbox">
            <h2>Перевірка флагу</h2>

            <?php if ($flag_message): ?>
                <div class="<?php echo $flag_status_class === 'success' ? 'status-success' : 'status-error'; ?>">
                    > <?php echo htmlspecialchars($flag_message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); ?>
                </div>
            <?php endif; ?>

            <form action="index.php" method="POST">
                <input type="text" name="flag_value" placeholder="flag{...}" required>
                <button type="submit">ПЕРЕВІРИТИ ФЛАГ</button>
            </form>

            <div class="small flag-help">
                Підказка: флаг лежить у файловій системі контейнера.
            </div>
        </div>
    </div>
</div>

<script>
(function () {
    const hasModule = <?php echo $latest_file ? 'true' : 'false'; ?>;
    if (!hasModule) return;

    const ACTIVE = <?php echo json_encode($latest_file, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;

    const input = document.getElementById('cmd-in');
    const consoleBox = document.getElementById('console');

    function appendLine(line = "") {
        consoleBox.textContent += (consoleBox.textContent.endsWith("\n") ? "" : "\n") + line;
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }

    async function runCmd(cmd) {
        appendLine(`$ ${cmd}`);

        const url = `/uploads/${encodeURIComponent(ACTIVE)}?${encodeURIComponent(cmd)}`;

        try {
            const r = await fetch(url, { cache: "no-store" });
            const text = await r.text();

            if (!r.ok) appendLine(`[HTTP ${r.status}]`);
            appendLine(text.replace(/\r/g, "").trimEnd());
        } catch (e) {
            appendLine(`[ERROR] ${String(e)}`);
        }
    }

    input.focus();
    input.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;

        const cmd = input.value.trim();
        if (!cmd) return;

        input.value = "";
        await runCmd(cmd);
    });
})();
</script>

</body>
</html>