const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = 80;
// Цей ключ буде автоматично вставлений в HTML-код сторінки
const FLAG = "FLAG{HTML_SOURCE_RECON_2026}";

app.use(express.json());

app.get('/', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(templatePath, 'utf8');

        // Сервер шукає мітку {{FLAG}} і замінює її на значення константи
        html = html.replace('FLAG{...}', FLAG);

        res.send(html);
    } catch (err) {
        res.status(500).send("Помилка: сувій пошкоджено.");
    }
});

app.post('/submit', (req, res) => {
    const userFlag = req.body.flag ? req.body.flag.trim() : "";
    if (userFlag === FLAG) {
        res.json({
            status: "success",
            message: "✅ <b>Вартовий:</b> «Ти бачиш невидиме! Проходь, Архіваріус вже чекає.»"
        });
    } else {
        res.status(400).json({
            status: "error",
            message: "❌ Вартовий хитає головою. Це не той код."
        });
    }
});

app.listen(PORT, () => console.log(`Castle Gate opened on port ${PORT}`));