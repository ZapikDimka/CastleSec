const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 8080;

// Дозволяємо серверу розуміти JSON у тілі запитів (потрібно для перевірки прапора)
app.use(express.json());
app.use(express.static('public'));

// Правильний прапор для цього рівня
const CORRECT_FLAG = "FLAG{IDOR_KING_SECRET_2026}";

// API для отримання листів (вразливий до IDOR)
app.get('/api/mail', (req, res) => {
    const encodedId = req.query.id;

    if (!encodedId) {
        return res.status(400).json({ error: "Помилка: Відсутня печатка гінця." });
    }

    try {
        const buff = Buffer.from(encodedId, 'base64');
        const docId = buff.toString('utf-8');

        if (!/^\d+$/.test(docId)) {
            return res.status(400).json({ error: "Магія розвіялась: Невірний формат шифру." });
        }

        const filePath = path.join(__dirname, 'letters', `${docId}.txt`);

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(404).json({ error: "Лист згорів у каміні або його знищила інквізиція." });
            }
            res.json({ id: docId, content: data });
        });
    } catch (e) {
        return res.status(400).json({ error: "Критична помилка: Збій дешифрування." });
    }
});

// НОВИЙ API: Перевірка знайденого прапора
app.post('/api/verify', (req, res) => {
    const userFlag = req.body.flag;

    if (!userFlag) {
        return res.status(400).json({ success: false, message: "Ти не ввів ключ!" });
    }

    // Перевіряємо ключ (прибираємо зайві пробіли)
    if (userFlag.trim() === CORRECT_FLAG) {
        res.json({
            success: true,
            message: "Вражаюче! Ти здобув таємницю Короля. Рівень пройдено!"
        });
    } else {
        res.json({
            success: false,
            message: "Невірна печатка. Це не той ключ."
        });
    }
});

app.listen(PORT, () => {
    console.log(`🏰 Поштова Вежа працює на порту ${PORT}`);
});