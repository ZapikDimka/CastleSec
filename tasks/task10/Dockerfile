FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app
COPY src ./src
COPY public ./public

ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "src/server.js"]
