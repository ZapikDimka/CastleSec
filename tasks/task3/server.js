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
    res.cookie('market_session', FLAG, { maxAge: 900000, httpOnly: false });

    // 2. Отримуємо пошуковий запит
    const searchQuery = req.query.search || '';

    // Читаємо базовий HTML файл
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

    // 3. ВРАЗЛИВІСТЬ: Вставляємо запит користувача прямо в HTML без санітизації!
    // Якщо користувач введе <script>...</script>, він виконається.
    const resultsHTML = searchQuery
        ? `<div class="alert-box">Торговець кричить: "Хто шукав <b>${searchQuery}</b>?!"</div>`
        : '';

    // Замінюємо плейсхолдер у HTML на наш "отруєний" контент
    const finalHtml = html.replace('{{SEARCH_RESULTS}}', resultsHTML);

    res.send(finalHtml);
});

// Маршрут для перевірки прапора (валідація проходження)
app.post('/verify', (req, res) => {
    const { flag } = req.body;
    if (flag === FLAG) {
        res.json({ success: true, message: "Вітаємо! Ти успішно 'отруїв' сторінку і вкрав печиво!" });
    } else {
        res.json({ success: false, message: "Невірний прапор. Спробуй ще раз." });
    }
});

app.listen(PORT, () => {
    console.log(`[Task 3] Market is open at http://localhost:${PORT}`);
});