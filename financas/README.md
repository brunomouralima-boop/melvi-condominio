# 💰 Finanças & Património Familiar

Aplicação privada de controlo de finanças pessoais e gestão de património para um casal.
Regista receitas/despesas em **múltiplas moedas** e **várias contas/bancos**, mantém um
inventário de **património** (imóveis, viaturas, investimentos, créditos) e calcula
automaticamente o **balanço patrimonial** (ativos − passivos = património líquido), por
titular e consolidado para o agregado.

> **Stack:** React + TypeScript + Vite + TailwindCSS · Node.js + Express + Prisma + SQLite · JWT
>
> Esta app é independente da app "Melvi Condomínio" presente na raiz do repositório.
> Pressupostos de desenho documentados em [`DECISIONS.md`](./DECISIONS.md).

## ✨ Funcionalidades

- **Lançamentos**: receitas, despesas e transferências (inclui transferências entre moedas).
- **Multi-moeda**: Kwanza (AOA) como base + USD, EUR, BRL e quaisquer outras; taxas de
  câmbio editáveis. Toda a consolidação é apresentada em AOA.
- **Multi-conta**: contas à ordem, poupança, dinheiro, investimento, carteiras — cada uma
  na sua moeda, com saldo calculado a partir dos lançamentos.
- **Por titular**: cada lançamento/conta/ativo pertence a um cônjuge ou ao "Conjunto"
  (casal); relatórios discriminam por titular e consolidam o agregado.
- **Património**: inventário de ativos (imóveis avaliados, viaturas, investimentos) e
  passivos (créditos), com imóveis financiados a mostrar valor líquido (avaliado − dívida).
- **Painel**: património líquido, ativos/passivos, receitas vs despesas (6 meses), despesas
  por categoria, saldos de contas e balanço por titular.

## 🚀 Como executar (desenvolvimento)

Pré-requisitos: **Node.js 20+** e **npm**. Não é preciso base de dados externa (usa SQLite).

### 1. Backend (API)

```bash
cd financas/backend
cp .env.example .env          # ajuste JWT_SECRET / SEED_PASSWORD se quiser
npm install
npm run setup                 # cria a BD SQLite, gera o cliente Prisma e popula com seed
npm run dev                   # API em http://localhost:4100
```

### 2. Frontend (web)

Noutro terminal:

```bash
cd financas/frontend
npm install
npm run dev                   # app em http://localhost:5173 (proxy /api -> :4100)
```

Abra **http://localhost:5173** e entre com as credenciais do seed:

| Email | Palavra-passe |
|-------|---------------|
| `brunomouralima@gmail.com` | `familia123` |
| `esposa@familia.local` | `familia123` |

> Troque a palavra-passe e o `JWT_SECRET` antes de qualquer utilização real.

## 📂 Estrutura

```
financas/
├── backend/                  # API Express + Prisma (SQLite)
│   ├── prisma/
│   │   ├── schema.prisma     # modelo de dados
│   │   └── seed.ts           # dados iniciais
│   └── src/
│       ├── routes/           # auth, members, currencies, accounts,
│       │                     # categories, transactions, assets,
│       │                     # liabilities, reports
│       ├── middleware/       # auth (JWT), validação (Zod), erros
│       └── utils/            # jwt, password, conversão de moeda, saldos
└── frontend/                 # SPA React + Vite + Tailwind
    └── src/
        ├── pages/            # Login, Dashboard, Lançamentos, Contas,
        │                     # Categorias, Património, Definições
        ├── components/       # Layout, UI primitives
        └── lib/              # api (axios), tipos, formatação, queries
```

## 🔌 API (resumo)

Todas as rotas (exceto `/auth/login`) requerem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Autenticação |
| GET | `/api/auth/me` | Utilizador atual |
| GET/POST/PUT | `/api/members` | Titulares |
| GET/POST · PUT `/:code/rate` | `/api/currencies` | Moedas e taxas de câmbio |
| GET/POST/PUT/DELETE | `/api/accounts` | Contas (com saldo calculado) |
| GET/POST/PUT/DELETE | `/api/categories` | Categorias |
| GET/POST/PUT/DELETE | `/api/transactions` | Lançamentos (com filtros) |
| GET/POST/PUT/DELETE | `/api/assets` | Ativos |
| GET/POST/PUT/DELETE | `/api/liabilities` | Passivos |
| GET | `/api/reports/networth` | Balanço patrimonial (por titular + total) |
| GET | `/api/reports/cashflow` | Fluxo de caixa do período |
| GET | `/api/reports/monthly` | Série mensal de receitas/despesas |

## 🔒 Notas de segurança

- Defina um `JWT_SECRET` forte e troque as palavras-passe do seed.
- A app não tem multi-tenant: destina-se a um único agregado.
- Para produção, considere migrar o `datasource` do Prisma para PostgreSQL.
