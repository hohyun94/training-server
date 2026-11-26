# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

RUN mkdir -p /data/uploads
ENV UPLOAD_DIR=/data/uploads

EXPOSE 8080

# Coolify 등 오케스트레이터가 컨테이너 상태를 판별할 수 있도록 헬스체크 제공
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-8080}/api/public/health" || exit 1

CMD ["node", "dist/index.js"]
