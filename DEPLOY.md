# 🚀 Guia de Deploy — Melvi Condomínio

Sistema de gestão de condomínios em produção, online, com HTTPS, backups automáticos e renovação de certificados.

---

## 📋 Requisitos do servidor

### Sistema operativo
- **Ubuntu 22.04 LTS** (recomendado) ou **Debian 12**
- Acesso root via SSH

### Hardware
| Recurso | Mínimo | Recomendado |
|---|---|---|
| vCPU | 2 | 2–4 |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB | 40 GB SSD |
| Tráfego | 1 TB/mês | 2 TB/mês |

### Rede
- IP público fixo (IPv4)
- Portas abertas: **22 (SSH)**, **80 (HTTP)** e **443 (HTTPS)**

### Domínio
- Domínio registado (`exemplo.ao`)
- Acesso ao painel DNS para criar registos A

---

## 💰 Provedores recomendados

| Provedor | Plano | Preço/mês | Notas |
|---|---|---|---|
| **Hetzner Cloud** | CPX21 | €5–8 | Melhor custo-benefício na Europa |
| **DigitalOcean** | Basic Droplet | $12–24 | Mais simples para iniciantes |
| **Contabo** | Cloud VPS S | €5–10 | Mais barato, suporte limitado |
| **Vultr** | Regular Performance | $12–24 | Cobertura global |
| **AWS EC2** | t3.small | ~$15–20 | Integra-se com mais serviços AWS |
| **Google Cloud** | e2-small | ~$13–18 | Boa para escalar depois |

> 💡 Para começar com Angola/PT em mente, **Hetzner (Falkenstein)** ou **Contabo (Munique)** dão boa latência e custo baixo.

---

## 🗺️ Visão geral do deploy

```
Internet → :443 ┐
                ├─→ nginx (reverse proxy, SSL)
                │      │
Internet → :80 ┘       ├─→ frontend  (SPA estática + nginx interno)
                       ├─→ backend   (Node.js + Express, porta interna 4000)
                       │      │
                       │      └─→ postgres (porta interna 5432)
                       │
                       └─→ /uploads (volume persistente)

Certbot ──→ Let's Encrypt (HTTPS renovado automaticamente)
Cron    ──→ backup diário Postgres
```

---

## 📂 Estrutura de ficheiros

```
melvi-condominio/
├── .env                          (criar a partir de .env.example)
├── docker-compose.yml            (produção — com nginx + certbot)
├── docker-compose.dev.yml        (desenvolvimento local — sem nginx)
├── DEPLOY.md                     (este ficheiro)
├── README.md
├── backend/
│   ├── Dockerfile                (multi-stage, node:20-slim)
│   ├── prisma/                   (schema + seed)
│   └── src/                      (TypeScript)
├── frontend/
│   ├── Dockerfile                (Vite build + nginx)
│   ├── nginx.conf                (config interna do container)
│   └── src/                      (React + TS)
├── nginx/
│   ├── nginx.conf                (reverse proxy completo, COM HTTPS — template)
│   ├── nginx.http-only.conf      (config bootstrap, SEM HTTPS)
│   └── active.conf               (config activa — gerado pelos scripts)
└── scripts/
    ├── setup.sh                  (1ª vez no servidor)
    ├── deploy.sh                 (deploy / actualização)
    ├── ssl.sh                    (activar HTTPS Let's Encrypt)
    ├── backup.sh                 (backup Postgres)
    └── logs.sh                   (ver logs)
```

---

## 🚀 Passo a passo do primeiro deploy

### 1. Preparar o servidor (a partir do teu PC)

```bash
# Conectar via SSH (como root)
ssh root@IP_DO_SERVIDOR

# Actualizar pacotes
apt update && apt upgrade -y

# Criar utilizador não-root para o app (boa prática)
adduser melvi
usermod -aG sudo melvi

# Mudar para esse utilizador
su - melvi
```

### 2. Apontar o domínio

No painel DNS do teu domínio, cria **dois registos A**:

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `@` | IP do servidor | 300 |
| A | `www` | IP do servidor | 300 |

Espera a propagação (5 min – 24 h). Verifica com:
```bash
dig +short melvi.exemplo.ao
```
Deve devolver o IP do servidor.

### 3. Copiar o código para o servidor

#### Opção A — via Git (recomendado)
```bash
git clone https://github.com/SEU_USER/melvi-condominio.git
cd melvi-condominio
```

#### Opção B — via SCP (sem git)
No teu **PC local** (Windows com WSL ou PowerShell):
```powershell
# Comprimir local
tar -czf melvi.tar.gz --exclude=node_modules --exclude=.env --exclude=dist melvi-condominio/
# Copiar para o servidor
scp melvi.tar.gz melvi@IP_SERVIDOR:~/
```
No **servidor**:
```bash
tar -xzf melvi.tar.gz
cd melvi-condominio
```

### 4. Setup inicial do servidor

```bash
bash scripts/setup.sh
```

Este script vai:
1. Instalar Docker e Docker Compose (se faltarem)
2. Criar a estrutura de pastas (`nginx/`, `backups/`, `logs/`)
3. Copiar `nginx/nginx.http-only.conf` para `nginx/active.conf`
4. Copiar `.env.example` → `.env` e **parar** para ti preencheres

> Se o script disser "logout/login para aplicar grupo docker", **sai do SSH e volta a entrar** antes de continuar.

### 5. Preencher o `.env`

```bash
nano .env
```

Valores a definir (gera secrets com `openssl rand -base64 32`):

```env
DOMAIN=melvi.exemplo.ao
ADMIN_EMAIL=admin@exemplo.ao
DB_NAME=melvi
DB_USER=melvi
DB_PASSWORD=<gera com openssl>
JWT_ACCESS_SECRET=<gera com openssl rand -base64 64>
JWT_REFRESH_SECRET=<gera com openssl rand -base64 64>
QR_HMAC_SECRET=<gera com openssl rand -base64 32>
MAX_UPLOAD_MB=8
```

Guarda (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 6. Deploy inicial (sem SSL ainda)

```bash
bash scripts/deploy.sh
```

O script vai:
1. Construir as imagens (backend + frontend + nginx)
2. Subir todos os serviços
3. Aplicar o schema Prisma (`prisma db push`)
4. Correr o **seed inicial** (só na primeira vez — verifica se a tabela User está vazia)
5. Confirmar que o backend responde

No final deves ver:
```
🌐 Sistema em HTTP: http://melvi.exemplo.ao

Para activar HTTPS:  bash scripts/ssl.sh
```

Confirma no browser: `http://melvi.exemplo.ao` deve mostrar a página de login.

### 7. Activar HTTPS

```bash
bash scripts/ssl.sh
```

O script vai:
1. Verificar que o nginx em HTTP responde via domínio
2. Pedir certificado Let's Encrypt para `DOMAIN` + `www.DOMAIN`
3. Substituir `nginx/active.conf` pela versão HTTPS (sed do `${DOMAIN}`)
4. Reload do nginx
5. Configurar cron para renovação automática (todos os dias às 03h)

Confirma no browser: `https://melvi.exemplo.ao` deve abrir com cadeado verde.

### 8. Configurar backups automáticos

```bash
crontab -e
```

Adiciona esta linha (backup diário às 03h, log em `logs/backup.log`):
```cron
0 3 * * * cd /home/melvi/melvi-condominio && bash scripts/backup.sh >> logs/backup.log 2>&1
```

Por defeito mantém os **últimos 14 backups** e apaga ficheiros com mais de **30 dias**. Edita `scripts/backup.sh` para ajustar.

### 9. Primeiro acesso

Vai a `https://melvi.exemplo.ao` e faz login com as credenciais do seed:

| Perfil | Email | Senha |
|---|---|---|
| **Admin** | `admin@morabeza.ao` | `Admin@123` |
| **Residente** | `residente1@morabeza.ao` | `Residente@123` |
| **Porteiro** | `porteiro@morabeza.ao` | `Porteiro@123` |

> 🚨 **MUDA estas senhas imediatamente** após o primeiro login (Perfil → Alterar senha).

### 10. Criar o Super Administrador da plataforma

O **Super Administrador** é o staff da Melvi — está **acima de todos os condomínios e organizações**
e tem acesso ao módulo **Sistema** (gestão de utilizadores, permissões e papéis).

> 🔐 **Sem senha fixa.** O super admin nunca é criado com palavra-passe hardcoded. Corres o comando
> abaixo **uma vez**, após o deploy, indicando o email. Se omitires a senha, é gerada uma senha forte
> e impressa **uma única vez** no terminal — guarda-a de imediato.

```bash
# Dentro da pasta do projecto, no servidor:
docker compose exec -e SUPERADMIN_EMAIL=admin@exemplo.pt backend npm run seed:superadmin
```

Variáveis de ambiente aceites pelo comando:

| Variável | Obrigatória | Default | Notas |
|---|---|---|---|
| `SUPERADMIN_EMAIL` | ✅ | — | Email do super admin |
| `SUPERADMIN_NAME` | — | `Super Administrador` | Nome a apresentar |
| `SUPERADMIN_PASSWORD` | — | _gerada aleatoriamente_ | Mínimo 8 caracteres. Se omitida, é gerada e impressa uma vez |

O comando é **idempotente**:
- Se o email **não existir**, cria um novo `SUPER_ADMIN` activo.
- Se o email **já existir**, garante `role=SUPER_ADMIN` + `isActive=true` (reactiva se necessário),
  mas **não** altera a palavra-passe existente.

Para definires tu próprio a senha (em vez da gerada):
```bash
docker compose exec \
  -e SUPERADMIN_EMAIL=admin@exemplo.pt \
  -e SUPERADMIN_PASSWORD='UmaSenhaForte!2026' \
  backend npm run seed:superadmin
```

> 🚨 Depois do primeiro acesso, altera a senha em **Perfil → mudar palavra-passe**. Garante sempre que
> existe **pelo menos um super admin activo** — o sistema bloqueia a remoção/desactivação do último.

---

## 🌐 Deploy só-HTTP por IP (sem domínio / sem SSL)

Se ainda **não tens domínio nem SSL** e acedes pelo IP (ex.: `http://77.42.28.190`), define no `.env`:

```env
CORS_ORIGIN=http://77.42.28.190
APP_PUBLIC_URL=http://77.42.28.190
```

- `CORS_ORIGIN` — origem permitida pelo backend (caso contrário assume `https://${DOMAIN}`).
- `APP_PUBLIC_URL` — base usada para construir **links absolutos** enviados ao utilizador, como o
  **link de recuperação de senha**. Se não definido, segue o `CORS_ORIGIN`. Mantém-no igual ao endereço
  por onde os utilizadores realmente acedem, senão os links de reset apontam para o sítio errado.

Salta os passos 2 (DNS) e 7 (HTTPS) acima. Quando tiveres domínio, remove estas duas linhas do `.env`
e corre `bash scripts/ssl.sh`.

---

## 🔑 Recuperação de senha (sem email)

O sistema **não envia emails**. A recuperação de senha é feita por um administrador que **gera um link**:

1. O admin (ou super admin) abre **Sistema → Utilizadores**, encontra o utilizador e clica em
   **"Gerar link de recuperação"**.
2. É apresentado um link único (válido **60 minutos**, **uso único**). O admin copia-o e entrega-o ao
   utilizador pelo canal habitual (WhatsApp, presencialmente, etc.).
3. O utilizador abre o link, escolhe uma nova senha; as sessões anteriores são terminadas.

O link usa o `APP_PUBLIC_URL` como base — por isso é importante que esteja correcto (ver secção acima).

---

## 🛠️ Comandos úteis

```bash
# Ver estado dos serviços
docker compose ps

# Ver logs em tempo real
bash scripts/logs.sh           # todos
bash scripts/logs.sh backend   # só backend
bash scripts/logs.sh postgres  # só base de dados

# Reiniciar um serviço
docker compose restart backend

# Parar tudo
docker compose down

# Parar + apagar volumes (CUIDADO: apaga base de dados!)
docker compose down -v

# Actualizar para nova versão (após git pull)
bash scripts/deploy.sh

# Backup manual
bash scripts/backup.sh

# Restaurar backup
gunzip -c backups/melvi_20250101_030000.sql.gz | \
  docker compose exec -T postgres psql -U melvi -d melvi

# Forçar renovação SSL
docker compose run --rm --entrypoint "" certbot certbot renew

# Aceder à base de dados (psql)
docker compose exec postgres psql -U melvi -d melvi

# Aceder à shell do backend
docker compose exec backend sh
```

---

## 🔄 Actualizar para nova versão

No servidor:
```bash
cd ~/melvi-condominio
git pull           # ou copia novos ficheiros
bash scripts/deploy.sh
```

O `deploy.sh` é seguro de correr múltiplas vezes:
- Recompila imagens
- Aplica novo schema Prisma (`db push`, sem perda de dados)
- **NÃO** corre seed se já há utilizadores
- Reinicia containers sem perder uploads ou base de dados

---

## 🐛 Troubleshooting

### `502 Bad Gateway` no browser
O backend ou frontend não está a responder. Verifica:
```bash
docker compose ps                   # algum não está "running"?
bash scripts/logs.sh backend        # erros no backend?
```

### Certbot falha com `unauthorized` ou `connection refused`
- DNS ainda não propagou. Confirma com `dig +short DOMAIN`.
- Firewall bloqueia porta 80. `sudo ufw status` e abre com `sudo ufw allow 80/tcp`.

### Backend não arranca, `Can't reach database`
Postgres pode estar a inicializar. Espera 30s e tenta `docker compose restart backend`.

### Upload de imagem falha com `413 Request Entity Too Large`
O `nginx/nginx.conf` permite 50 MB. Se for ficheiro maior, edita `client_max_body_size`.

### Reset completo (apaga tudo)
```bash
docker compose down -v       # apaga base de dados + uploads + certs
rm -rf nginx/active.conf backups/
bash scripts/setup.sh
bash scripts/deploy.sh
bash scripts/ssl.sh
```

### Trocar de servidor
1. **Backup** no antigo: `bash scripts/backup.sh`
2. Copia para o novo: `scp backups/melvi_*.sql.gz user@novo:~`
3. No novo: setup + deploy normal
4. Restaurar: `gunzip -c melvi_*.sql.gz | docker compose exec -T postgres psql -U melvi -d melvi`
5. Aponta o DNS para o novo IP
6. Activa SSL no novo servidor

---

## 🔒 Boas práticas de segurança

- ✅ **NUNCA** committar `.env` ao git (já está no `.gitignore`)
- ✅ Mudar todas as senhas do seed após primeiro login
- ✅ Usar SSH com chave (não password): `ssh-copy-id user@servidor` e depois desactivar password auth
- ✅ Activar UFW: `sudo ufw enable` (já feito pelo `setup.sh`)
- ✅ Actualizar o servidor mensalmente: `sudo apt update && sudo apt upgrade -y`
- ✅ Verificar backups regularmente (testar restauro num ambiente staging)
- ✅ Monitorizar uptime com serviço externo (UptimeRobot, Better Uptime — endpoint `/api/health`)

---

## 📞 Onde recorrer

- Logs detalhados: `docker compose logs --tail=500 SERVIÇO`
- Estado de saúde: `https://DOMAIN/api/health` deve retornar `{"status":"ok"}`
- Documentação Prisma: https://www.prisma.io/docs
- Docker Compose: https://docs.docker.com/compose/

---

**Pronto. Bom deploy! 🚀**
