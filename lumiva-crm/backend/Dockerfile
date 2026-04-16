FROM node:20-alpine

RUN apk add --no-cache font-dejavu

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV UPLOADS_ROOT=/app/uploads
RUN mkdir -p /app/uploads

CMD ["node", "dist/main.js"]
