# ───────────────────────────────────────────────────────────────
# Melvi Condomínio — Backend (production multi-stage build)
# Base: node:20-slim (Debian-based, evita problemas de OpenSSL com Prisma)
# ───────────────────────────────────────────────────────────────

# ── Stage 1: deps ──────────────────────────────────────────────
# Instala TODAS as dependências (incluindo dev) para o build
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --include=dev

# ── Stage 2: builder ───────────────────────────────────────────
# Gera o cliente Prisma e compila TypeScript → dist/
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────
# Imagem final — só com o necessário para correr em produção
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# OpenSSL para o Prisma engine + curl para healthcheck
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Copiar artefactos do build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Pasta de uploads (vai ser montada como volume)
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Usuário não-root (boa prática)
USER node

EXPOSE 4000

# Healthcheck nativo do Docker — usado pelo nginx/orquestrador
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/health || exit 1

# Entry-point: aplica schema (db push sem perdas) + arranca servidor
# NOTAS:
#  - `tsc -p tsconfig.json` (rootDir=".") emite dist/src/server.js
#  - `prisma db push` SEM --accept-data-loss: se houver risco de perder dados, falha em segurança.
#    Para schemas destrutivos em produção, primeiro cria migrações com `prisma migrate dev` em dev,
#    commita-as, e troca este CMD por `prisma migrate deploy`.
#  - SEED NÃO corre automaticamente em produção (o seed actual é destrutivo — apaga dados).
#    O seed inicial é executado pelo deploy.sh apenas na primeira instalação.
CMD sh -c "npx prisma db push --skip-generate && node dist/src/server.js"
