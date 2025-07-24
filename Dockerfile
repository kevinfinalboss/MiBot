FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src/ ./src/

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY config.yaml ./

USER node

EXPOSE 3000

CMD ["npm", "run", "prod"]