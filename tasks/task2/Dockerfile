FROM node:18-slim
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install
COPY src/ ./archive/
COPY setup_git.sh .
RUN chmod +x setup_git.sh && ./setup_git.sh
COPY app.js .
EXPOSE 80
CMD ["node", "app.js"]