# Decisões e Pressupostos — App de Finanças & Património

Documento de pressupostos assumidos durante a construção, conforme pedido. Sempre que
a especificação não foi explícita, escolhi uma opção sensata e registei-a aqui.

## Nota sobre a especificação recebida

O pedido chegou com **apenas a Secção 1 (Contexto e objetivo)**; as secções seguintes
(requisitos detalhados, preferências técnicas, ecrãs, etc.) foram truncadas antes de
chegarem. Seguindo a instrução explícita de *"assumir uma opção sensata, documentar o
pressuposto e prosseguir sem parar"*, construí uma aplicação completa que cobre tudo o
que a Secção 1 descreve. Se as secções em falta trouxerem requisitos adicionais, são
fáceis de acomodar sobre esta base.

## Arquitetura e stack

- **Aplicação separada** dentro deste repositório, na pasta `financas/`. O repositório já
  continha a app "Melvi Condomínio" (`backend/`, `frontend/`); a app de finanças é
  independente e não toca nesses diretórios.
- **Stack** alinhada com o resto do repo: backend Express + TypeScript + Prisma; frontend
  React 18 + Vite + TailwindCSS + React Query.
- **Base de dados: SQLite** (via Prisma), em vez de PostgreSQL. Motivo: é uma app privada
  para um casal, sem necessidade de infraestrutura; o ficheiro `dev.db` corre em qualquer
  máquina sem servidor de BD. O ambiente de execução também não tinha Postgres/Docker
  disponível. Migrar para Postgres no futuro é trivial (mudar o `datasource` no
  `schema.prisma`).

## Modelo de dados

- **Titular (`Member`)**: cada cônjuge é um `Member` do tipo `PERSON`; o "casal" é um
  `Member` do tipo `JOINT` ("Conjunto"). Lançamentos, contas, ativos e passivos referenciam
  um titular. A consolidação do agregado é a soma de todos os titulares.
- **Moeda base = AOA (Kwanza)**. Cada `Currency` guarda `rateToBase` = quantos Kwanzas vale
  1 unidade dessa moeda. AOA tem `rateToBase = 1`. Toda a consolidação (património, fluxos)
  é convertida para AOA com a taxa **atual** guardada na moeda.
  - Pressuposto: guardamos apenas a taxa de câmbio **corrente** (sem histórico de taxas).
    Relatórios passados são reavaliados à taxa atual. Suficiente para gestão familiar; um
    histórico de taxas pode ser acrescentado depois.
- **Contas (`Account`)**: bancárias/dinheiro/investimento, cada uma numa moeda. O **saldo**
  é calculado a partir do saldo inicial + lançamentos (não é um campo editável).
- **Lançamentos (`Transaction`)**: `INCOME`, `EXPENSE` ou `TRANSFER`.
  - Pressuposto: receitas/despesas são registadas **na moeda da conta**. O cálculo de saldo
    assume isto.
  - Transferências podem ser **entre moedas**: a conta de origem perde `amount` (moeda de
    origem) e a de destino recebe `toAmount` (moeda de destino); se `toAmount` ficar vazio,
    assume-se igual a `amount`.
- **Património**:
  - **Ativos (`Asset`)**: imóveis, viaturas, investimentos, outros. Cada um com um valor
    atual/avaliado introduzido manualmente.
  - **Passivos (`Liability`)**: créditos/empréstimos com saldo devedor; podem ser **ligados
    a um ativo** (ex.: crédito habitação ligado ao imóvel).
  - **Imóvel financiado**: registado como um `Asset` (valor avaliado) + um `Liability`
    (saldo devedor) ligado a ele. O ecrã mostra o valor líquido (avaliado − dívida).
  - **Para evitar dupla contagem**: as contas líquidas (saldos) entram no balanço pelos
    saldos das `Account`. A tabela `Asset` destina-se a património *fora* das contas
    (imóveis, viaturas, investimentos não transacionais). Não registar a mesma poupança
    como conta **e** como ativo.
- **Balanço patrimonial**: `Património líquido = (saldos de contas + valor de ativos) −
  passivos`, tudo em AOA, com discriminação por titular e consolidado.

## Outras decisões

- **Valores monetários em `Float`**. SQLite/Prisma não traz o conforto de `Decimal` em
  todos os cenários; para entrada manual numa app familiar, `Float` é suficiente e os
  valores são arredondados na apresentação (2 casas). Documentado como compromisso conhecido.
- **Enums como `String` validadas por Zod**. O conector SQLite do Prisma não suporta enums
  nativos; os valores permitidos são validados em runtime por Zod nas rotas.
- **Autenticação**: JWT simples (sem refresh token). Login com email/palavra-passe; o seed
  cria dois utilizadores (um por cônjuge). Adequado a uma app privada de 2 utilizadores.
- **Sem multi-tenant**: a app assume um único agregado familiar.
- **Idioma**: interface em Português (pt-PT), formatação de moeda e datas em pt-PT.
- **Dados de exemplo**: o seed cria moedas, categorias, 3 contas, alguns lançamentos e
  exemplos de património para o painel não aparecer vazio na primeira utilização. As taxas
  de câmbio do seed são **aproximadas** — devem ser acertadas em *Definições*.

## Credenciais iniciais (seed)

- `brunomouralima@gmail.com` / `familia123` (titular "Bruno")
- `esposa@familia.local` / `familia123` (titular "Esposa")

A palavra-passe do seed vem de `SEED_PASSWORD` no `.env`. **Trocar em produção.**
