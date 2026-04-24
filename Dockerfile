FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 🔥 BUILD FRONTEND (IMPORTANT FIX)
RUN npm run build

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
