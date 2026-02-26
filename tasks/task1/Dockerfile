FROM node:18-alpine

WORKDIR /app

# Копіюємо конфіг і встановлюємо бібліотеки
COPY package.json ./
RUN npm install

# Копіюємо решту файлів (server.js та index.html)
COPY . .

EXPOSE 80

CMD ["node", "server.js"]