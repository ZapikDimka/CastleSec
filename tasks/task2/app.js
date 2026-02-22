const express = require('express');
const path = require('path');
const axios = require('axios');
const serveIndex = require('serve-index'); // Додано тут

const app = express();
const PORT = 80;
const CORRECT_FLAG = "flag{g1t_h1st0ry_n3v3r_li3s}";
const GAME_ENGINE_URL = "http://game_engine:5000/task_complete";

app.use(express.json());

// ВРАЗЛИВІСТЬ: Робимо папку .git видимою
const gitPath = path.join(__dirname, 'archive/.git');

// Це дозволяє скачувати файли
app.use('/.git', express.static(gitPath, { dotfiles: 'allow' }));

// ЦЕ ДОДАЄ СПИСОК ФАЙЛІВ (Autoindex), щоб у браузері не було "Cannot GET"
app.use('/.git', serveIndex(gitPath, { icons: true, hidden: true }));

app.use(express.static(path.join(__dirname, 'archive')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'archive/index.html'));
});

app.post('/submit', async (req, res) => {
    const { flag } = req.body;
    if (flag === CORRECT_FLAG) {
        try {
            await axios.post(GAME_ENGINE_URL, { task: "task2", status: "solved" }, { timeout: 2000 });
        } catch (error) {
            console.log("Game engine offline.");
        }
        return res.json({ success: true, message: "Вітаємо! Ви відновили секретну історію Замку." });
    }
    res.json({ success: false, message: "Невірно. Шукайте глибше в архівах..." });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});