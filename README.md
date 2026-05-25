# 🏢 Melvi Condomínio

Plataforma completa de gestão de condomínios — três perfis (Administrador, Condómino, Porteiro), acessos por QR Code, alertas de pânico em tempo real, ocorrências, comunicados, financeiro e mais.

> **Stack:** React + TypeScript + Vite + TailwindCSS · Node.js + Express + Prisma + PostgreSQL · Socket.io · JWT

---

## ✨ Funcionalidades principais

- **3 perfis com dashboards distintos**: Administrador, Condómino, Porteiro
- **Autenticação JWT** com refresh tokens (access 15 min, refresh 7 dias)
- **Botão de Pânico** com modal de confirmação em 2 passos. Emite via Socket.io para porteiro + administração com:
  - 🔊 Alarme sonoro (Web Audio API, sem ficheiro externo)
  - 🚨 Banner pulsante vermelho fixo no topo
  - 📲 Notificação push do browser
- **Scanner QR** pela câmara do dispositivo (`@zxing/browser`) com validação por HMAC
- **QR Codes assinados** com HMAC-SHA256 e geração de imagem PNG
- **Tempo real** via Socket.io para alertas, acessos e ocorrências
- **CRUDs** para ocorrências, residentes, dependentes, viaturas, funcionários domésticos, comunicados
- **Estatísticas** no dashboard admin (Recharts): ocorrências por categoria, entradas por dia
- **Upload de imagens** com compressão automática (Sharp)
- **Rate limiting** nas rotas de autenticação
- **Validação** com Zod em todas as rotas
- **Headers de segurança** com Helmet

---

## 🚀 Quickstart (com Docker)

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Node.js 20+ (apenas para correr o frontend em modo dev — a API e a base de dados correm no Docker)
- npm 10+

### 1. Subir Postgres + Backend (Docker)

```bash
cd condohub
docker compose up --build
```

Na primeira execução:
- O Postgres é criado e inicializado
- O backend corre `prisma migrate deploy` e o `seed` automaticamente
- A API fica disponível em `http://localhost:4000`
- Healthcheck: `http://localhost:4000/health`

### 2. Correr o frontend (numa segunda janela)

```bash
cd frontend
npm install
npm run dev
```

Aceder a **http://localhost:5173**

---

## 🔑 Credenciais de demonstração

| Perfil | Email | Senha |
|---|---|---|
| **Administrador** | `admin@morabeza.ao` | `Admin@123` |
| **Condómino** | `residente1@morabeza.ao` | `Residente@123` |
| **Condómino** | `residente2@morabeza.ao` | `Residente@123` |
| **Condómino** | `residente3@morabeza.ao` | `Residente@123` |
| **Porteiro** | `porteiro@morabeza.ao` | `Porteiro@123` |

---

## 🧪 Teste do botão de pânico end-to-end

1. Abre `http://localhost:5173` em **três janelas/perfis**:
   - Janela A — login como `residente1@morabeza.ao`
   - Janela B — login como `porteiro@morabeza.ao`
   - Janela C — login como `admin@morabeza.ao`
2. Na janela A (residente), clica no botão vermelho de pânico
3. Escreve uma descrição (mínimo 10 caracteres) e confirma em 2 passos
4. Janelas B e C devem mostrar imediatamente um **banner vermelho pulsante** no topo + tocar alarme
5. O porteiro carrega em **"CONFIRMAR RECEBIMENTO"** — o residente vê o estado mudar para "Confirmado"

---

## 🧪 Teste do scanner QR

1. Login como residente em A → menu **Acessos QR** → cria um novo acesso (Visitante)
2. Clica em **"Ver QR"** — aparece o código grande
3. Login como porteiro em B → **Controlo de Acesso** → **ESCANEAR QR CODE**
4. Aponta a câmara para o QR da janela A (ou usa um leitor físico)
5. O sistema valida (HMAC), regista a entrada e notifica o residente

---

## 📁 Estrutura do projeto

```
condohub/
├── docker-compose.yml          # Postgres + Backend
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma       # Todos os modelos
│   │   └── seed.ts             # Seed com Condomínio Morabeza
│   └── src/
│       ├── server.ts
│       ├── app.ts
│       ├── config.ts
│       ├── prisma.ts
│       ├── sockets/index.ts    # Socket.io + autenticação
│       ├── middleware/
│       │   ├── auth.ts         # JWT + role-based authorization
│       │   ├── validate.ts     # Zod validation
│       │   ├── upload.ts       # Multer memory storage
│       │   └── error.ts
│       ├── utils/
│       │   ├── jwt.ts
│       │   ├── password.ts     # Bcrypt (12 rounds)
│       │   ├── qr.ts           # HMAC sign + PNG generation
│       │   └── image.ts        # Sharp compression
│       └── routes/
│           ├── auth.ts         (login, refresh, logout, me, change-password)
│           ├── users.ts
│           ├── units.ts
│           ├── dependents.ts
│           ├── domesticEmployees.ts
│           ├── vehicles.ts
│           ├── qrCodes.ts      (criar, listar, imagem PNG, validar)
│           ├── accessLogs.ts
│           ├── occurrences.ts
│           ├── panicAlerts.ts  (trigger, ack, resolve)
│           ├── announcements.ts
│           ├── commonAreas.ts
│           ├── reservations.ts
│           ├── financial.ts
│           ├── packages.ts
│           ├── notifications.ts
│           ├── condominium.ts  (stats do dashboard admin)
│           └── uploads.ts
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx             # Router com rotas por role
        ├── index.css
        ├── lib/
        │   ├── api.ts          # Axios + refresh token automático
        │   └── utils.ts
        ├── contexts/
        │   ├── AuthContext.tsx # Persistência em localStorage
        │   └── SocketContext.tsx  # Reconexão automática
        ├── components/
        │   ├── ui/             # Botão, Card, Dialog, Badge, Input (shadcn-style)
        │   ├── layout/
        │   │   ├── Sidebar.tsx
        │   │   ├── AdminLayout.tsx
        │   │   ├── ResidentLayout.tsx
        │   │   └── DoormanLayout.tsx
        │   ├── ProtectedRoute.tsx
        │   ├── PanicButton.tsx        # Botão + modal 2 passos
        │   ├── PanicAlertListener.tsx # Banner + alarme sonoro
        │   └── QRScanner.tsx          # @zxing/browser
        └── pages/
            ├── Login.tsx
            ├── Stub.tsx               # Placeholder de páginas em construção
            ├── admin/      (Dashboard, Residents, Occurrences, PanicAlerts, Announcements)
            ├── resident/   (Dashboard, Occurrences, AccessCodes, Dependents, Employees, Vehicles, Info)
            └── doorman/    (Dashboard com scanner + entrada manual)
```

---

## ⚙️ Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://melvi:melvi_dev_pwd@localhost:5432/melvi` | URL do Postgres |
| `PORT` | `4000` | Porta HTTP |
| `JWT_ACCESS_SECRET` | (obrigatório) | Segredo HS256 do access token |
| `JWT_REFRESH_SECRET` | (obrigatório) | Segredo HS256 do refresh token |
| `JWT_ACCESS_TTL` | `15m` | Tempo de vida do access token |
| `JWT_REFRESH_TTL` | `7d` | Tempo de vida do refresh token |
| `QR_HMAC_SECRET` | (obrigatório) | Segredo HMAC para assinar QR codes |
| `CORS_ORIGIN` | `http://localhost:5173` | Lista CSV de origens permitidas |
| `UPLOAD_DIR` | `./uploads` | Diretório de uploads |
| `MAX_UPLOAD_MB` | `8` | Tamanho máximo por ficheiro |

### Frontend (`frontend/.env`)

| Variável | Default | Descrição |
|---|---|---|
| `VITE_API_URL` | _(vazio — usa proxy do Vite)_ | URL completa da API. Deixar vazio em dev. |
| `VITE_SOCKET_URL` | _(vazio — usa proxy do Vite)_ | URL do Socket.io. Deixar vazio em dev. |

---

## 🛠️ Setup local sem Docker (avançado)

Se preferires correr tudo localmente sem Docker:

```bash
# 1. Postgres (precisas instalar separadamente)
createdb melvi
# Atualiza backend/.env com a tua DATABASE_URL

# 2. Backend
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev   # porta 4000

# 3. Frontend (noutra janela)
cd frontend
npm install
npm run dev   # porta 5173
```

---

## 🧰 Scripts úteis

### Backend
```bash
npm run dev              # tsx watch
npm run build            # compile TypeScript
npm run prisma:studio    # Prisma Studio
npm run prisma:migrate   # nova migration
npm run db:seed          # repopular DB
```

### Frontend
```bash
npm run dev              # Vite dev server
npm run build            # build production
npm run preview          # preview da build
```

---

## 📡 Endpoints REST principais

> Todos os endpoints (excepto `/auth/login` e `/auth/refresh`) requerem header `Authorization: Bearer <token>`.

| Grupo | Endpoint | Permissão |
|---|---|---|
| **Auth** | `POST /api/auth/login` | público |
| | `POST /api/auth/refresh` | público |
| | `POST /api/auth/logout` | público |
| | `GET /api/auth/me` | autenticado |
| **Pânico** | `POST /api/panic-alerts` | RESIDENT |
| | `PUT /api/panic-alerts/:id/acknowledge` | DOORMAN, ADMIN |
| | `PUT /api/panic-alerts/:id/resolve` | ADMIN |
| **QR Codes** | `POST /api/qr-codes` | RESIDENT |
| | `GET /api/qr-codes/:id/image` | dono ou ADMIN/DOORMAN |
| | `POST /api/qr-codes/validate` | DOORMAN, ADMIN |
| **Ocorrências** | `GET/POST /api/occurrences` | todos (filtrado por role) |
| | `POST /api/occurrences/:id/response` | ADMIN |
| **Acessos** | `GET /api/access-logs` | todos (filtrado por role) |
| | `POST /api/access-logs` | DOORMAN, ADMIN |
| **Outros** | `users`, `units`, `announcements`, `common-areas`, `reservations`, `financial`, `packages`, `notifications`, `dependents`, `vehicles`, `domestic-employees` | varia |

---

## 📡 Eventos Socket.io

### Cliente → Servidor
- `authenticate(token)` — autenticar a conexão
- `join:role(role)` — entrar na sala do perfil
- `join:unit(unitId)` — entrar na sala da unidade

### Servidor → Cliente
- `panic:alert` → `role:DOORMAN` + `role:ADMIN`
- `panic:acknowledged` → `user:<residentId>`
- `panic:resolved` → `user:<residentId>`
- `panic:updated` → admins + porteiros
- `access:new` → admins + porteiros
- `occurrence:new` → admins
- `occurrence:updated` → residente criador
- `announcement:new` → residentes
- `package:new` → residente da unidade

---

## 🔐 Segurança

- ✅ Bcrypt (12 rounds) para hash de senhas
- ✅ JWT HS256 com access + refresh tokens
- ✅ Refresh tokens guardados na DB para revogação
- ✅ Rate limiting (5 tentativas / 15 min) nas rotas de auth
- ✅ Helmet com headers de segurança
- ✅ Validação Zod em todos os bodies/queries
- ✅ Autorização role-based em todas as rotas sensíveis
- ✅ QR Codes assinados com HMAC-SHA256 (não falsificáveis)
- ✅ Verificação de propriedade em recursos de residentes

---

## 🚧 Âmbito desta primeira versão (MVP)

**Totalmente funcional:**
- Autenticação completa (3 perfis)
- Botão de Pânico end-to-end em tempo real (com som, banner pulsante e push)
- Scanner QR pelo porteiro + validação HMAC + registo de acesso
- Geração e visualização de QR Codes (PNG)
- CRUD de ocorrências (residente cria, admin responde)
- CRUD de residentes (admin)
- CRUDs simples de dependentes, viaturas, funcionários domésticos
- Comunicados (admin publica → residentes recebem em tempo real)
- Dashboards com estatísticas (admin) e KPIs (residente)
- Página de informações com contactos de emergência (residente)

**Endpoints prontos no backend, UI ainda como _stub_** (planos para próxima sessão):
- Áreas comuns + reservas (UI completa)
- Financeiro completo com gráficos (UI completa)
- Encomendas (UI completa)
- Configurações do condomínio (UI completa)
- Gestão detalhada de unidades

---

## 📝 Notas técnicas

- **Som do alarme** é gerado via **Web Audio API** (oscilador com efeito sirene), sem dependência de ficheiros externos
- **Notificações push** do browser pedidas no primeiro carregamento de admin/porteiro
- **Refresh token** é renovado automaticamente em 401 (interceptor do axios)
- **Reconexão** do Socket.io é automática (até 5s de delay, infinitas tentativas)
- **Vite proxy** redireciona `/api` e `/socket.io` para `localhost:4000` em dev — produção deve servir frontend (estático) e backend em domínios coordenados ou via reverse proxy

---

## 📄 Licença

Demonstração / projeto educativo. Adapta livremente.
