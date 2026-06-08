# ───────────────────────────────────────────────────────────────
# Melvi Condomínio — Frontend (Vite build + Nginx serve)
# ───────────────────────────────────────────────────────────────

# ── Stage 1: builder ──────────────────────────────────────────
# Compila o Vite com a URL da API injectada via build arg
FROM node:20-alpine AS builder
WORKDIR /app

# Build args injectados pelo docker-compose
ARG VITE_API_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────
# Nginx alpine para servir os ficheiros estáticos
FROM nginx:alpine AS runner

# Copiar build do Vite (saída padrão: dist/)
COPY --from=builder /app/dist /usr/share/nginx/html

# Substituir a config default do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Healthcheck para o orquestrador saber se está vivo
# (o wget do busybox/alpine não suporta --spider; usar -O /dev/null)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
