# boleiros.app

Bolão da Copa 2026 entre amigos — Vue 3 + Supabase.

## Features

- Múltiplos bolões com link de convite
- Auth por bolão com username + senha pessoal; a senha compartilhada do bolão só libera o cadastro inicial
- Fase de grupos: 1º/2º de cada grupo + 8 melhores terceiros
- Mata-mata: palpites até 10 min antes do jogo
- Ranking com desempate (exatos → artilheiro)
- Painel superadmin para resultados

## Pontuação

| Aposta | Pontos |
|--------|--------|
| Posição correta (1º ou 2º) | 5 |
| Melhor terceiro correto | 5 |
| Resultado correto (mata-mata) | 5 |
| Placar exato (mata-mata) | +5 |

## Setup

### 1. Supabase

```bash
# Aplicar schema
supabase db push

# Ou manualmente:
# supabase/migrations/001_schema.sql
# supabase/seed/groups_teams.sql
```

### 2. Edge Functions

```bash
supabase functions deploy auth
supabase functions deploy pools
supabase functions deploy bets
supabase functions deploy admin
supabase functions deploy superadmin
```

Secrets necessários:
- `AUTH_SECRET` — string aleatória para JWT
- `SUPERADMIN_PASSWORD` — senha do painel secreto
- `SUPABASE_SERVICE_ROLE_KEY` — já configurado automaticamente

### 3. Frontend

```bash
cp .env.example .env
# Preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Landing |
| `/criar` | Criar bolão |
| `/b/:token` | Lobby / login |
| `/b/:token/grupos` | Apostas fase de grupos |
| `/b/:token/partidas` | Mata-mata |
| `/b/:token/ranking` | Ranking |
| `/b/:token/admin` | Admin do bolão |
| `/superadmin` | Painel secreto |

## Stack

- Vue 3 + Vite + TypeScript + Pinia + Vue Router
- Supabase PostgreSQL + Edge Functions
- Auth custom JWT (sem Supabase Auth)
