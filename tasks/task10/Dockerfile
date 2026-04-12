FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src
COPY public ./public

# jail root
RUN mkdir -p /tower && chown -R node:node /tower

ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "src/server.js"]