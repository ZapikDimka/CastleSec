const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dictionaryPath = path.join(__dirname, 'public', 'dictionary.txt');
let words = [];

try {
    const fileContent = fs.readFileSync(dictionaryPath, 'utf8');
    words = fileContent.split('\n')
        .map(word => word.trim())
        .filter(word => word.length > 0);
} catch (error) {
    console.error("❌ Помилка: Не вдалося прочитати файл dictionary.txt!");
    process.exit(1);
}

if (words.length === 0) {
    console.error("❌ Помилка: Словник dictionary.txt порожній!");
    process.exit(1);
}

const SECRET_WORD = words[Math.floor(Math.random() * words.length)];
const CORRECT_FLAG = "CTF{X_F0RW4RD3D_F0R_M4ST3R}"; // Наш переможний прапорець

console.log(`[СТАТУС] Завантажено слів: ${words.length}`);
console.log(`[СЕКРЕТ] Випадкове кодове слово: "${SECRET_WORD}"`);

const loginAttempts = {};
const MAX_ATTEMPTS = 3;

// Ендпоінт для підбору пароля
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    // ВРАЗЛИВІСТЬ: Читаємо IP із заголовка, який можна підробити
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!loginAttempts[clientIp]) {
        loginAttempts[clientIp] = 0;
    }

    if (loginAttempts[clientIp] >= MAX_ATTEMPTS) {
        return res.status(429).json({
            error: `Охоронець заблокував вхід для ${clientIp}! Забагато помилок.`
        });
    }

    if (password === SECRET_WORD) {
        loginAttempts[clientIp] = 0;
        return res.json({
            success: true,
            message: "Охоронець похмуро киває і пропускає вас. На столі лежить записка:",
            flag: CORRECT_FLAG
        });
    } else {
        loginAttempts[clientIp]++;
        const attemptsLeft = MAX_ATTEMPTS - loginAttempts[clientIp];
        return res.status(401).json({
            error: "Невірне слово! Охоронець хапається за кийок.",
            attemptsLeft: attemptsLeft
        });
    }
});

// НОВИЙ Ендпоінт для перевірки прапорця
app.post('/api/submit-flag', (req, res) => {
    const { flag } = req.body;

    if (flag === CORRECT_FLAG) {
        return res.json({ success: true, message: "🎉 Вітаємо! Ви успішно обдурили Вартового-Педанта та вирішили завдання!" });
    } else {
        return res.status(400).json({ error: "❌ Невірний прапорець. Шукайте далі!" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🛡️ Охоронець-Педант чергує на порту ${PORT}`);
});