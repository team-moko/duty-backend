# syntax=docker/dockerfile:1.7

# ── Builder stage: 전체 의존성 설치 후 TypeScript 컴파일 ────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.test.json ./
COPY src ./src
RUN npm run build


# ── Runtime stage: 프로덕션 의존성만 + 빌드 산출물 ─────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8000 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 8000

# 비-root 사용자로 실행 (node:alpine 이미지에 미리 만들어진 node 유저 사용)
USER node

CMD ["node", "dist/main.js"]
