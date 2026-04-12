const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// Секретний прапор, який користувач має знайти через XSS
const FLAG = 'FLAG{xss_m4st3r_javascr1pt}';

app.use(express.static('public', { index: false }));
app.use(express.json());
app.use(cookieParser());

// Головний маршрут
app.get('/', (req, res) => {
    // 1. Встановлюємо вразливе Cookie (httpOnly: false дозволяє JS читати його)
    // У реальному житті secure cookie мають httpOnly: true
    res.cookie('mirror_session', FLAG, { maxAge: 900000, httpOnly: false });

    // 2. Отримуємо запит, який «віддзеркалюємо»
    const searchQuery = req.query.search || '';

    // Читаємо базовий HTML файл
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

    // 3. ВРАЗЛИВІСТЬ: Вставляємо ввід користувача прямо в HTML без санітизації!
    // Якщо користувач введе <script>...</script>, він виконається.
    const resultsHTML = searchQuery
        ? `<div class="alert-box">Дзеркало показує: «<b>${searchQuery}</b>»</div>`
        : '';

    // Замінюємо плейсхолдер у HTML на наш «віддзеркалений» контент
    const finalHtml = html.replace('{{SEARCH_RESULTS}}', resultsHTML);

    res.send(finalHtml);
});

// Маршрут для перевірки прапора (валідація проходження)
app.post('/verify', (req, res) => {
    const { flag } = req.body;
    if (flag === FLAG) {
        res.json({ success: true, message: 'Вітаємо! Ти змусив дзеркало видати секрет і дістав ключ з Cookie.' });
    } else {
        res.json({ success: false, message: 'Невірний прапор. Спробуй ще раз.' });
    }
});

app.listen(PORT, () => {
    console.log(`[Task 3] Mirror Workshop is open at http://localhost:${PORT}`);
});