FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# install static server + express for AI API
RUN npm install express serve-static

EXPOSE 8080

CMD ["node", "server.js"]
