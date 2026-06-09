# boleiros.app

Bolão da Copa 2026 entre amigos, família e empresa, sem planilha, print perdido ou conta feita na mão.

O **boleiros.app** centraliza a criação do bolão, o convite dos participantes, os palpites da fase de grupos, as apostas do mata-mata e o ranking automático em um só lugar.

**Acesse:** [boleiros.app](https://boleiros-app-puce.vercel.app/)

## Como Funciona

1. Crie um bolão informando o nome da disputa, uma senha de convite e o seu usuário.
2. Receba um link único do bolão para compartilhar com amigos.
3. Cada participante entra pelo link, cria seu usuário e registra o palpite de artilheiro.
4. Todo mundo preenche os palpites dos grupos e, depois, os placares do mata-mata.
5. O ranking é atualizado automaticamente conforme os resultados são lançados.

## Features

- **Criação rápida de bolões:** cada bolão tem nome, participantes próprios e link de convite.
- **Convite por link:** basta mandar o link do bolão no WhatsApp, Slack, email ou onde o grupo estiver.
- **Entrada protegida:** a senha do bolão libera o cadastro inicial, e cada jogador usa sua própria senha para voltar depois.
- **Palpites da fase de grupos:** escolha o 1º e 2º colocado de cada grupo, além dos 8 melhores terceiros.
- **Apostas no mata-mata:** registre placares jogo a jogo até 10 minutos antes da partida.
- **Ranking automático:** acompanhe pontos, acertos, placares exatos e posição de cada participante.
- **Critérios de desempate:** empates são resolvidos por placares exatos e, depois, pelo artilheiro correto.
- **Admin do bolão:** área para gerenciar informações e acompanhar a disputa do grupo.
- **Painel superadmin:** fluxo separado para cadastrar resultados e operar a competição.

## Experiência do Participante

A ideia é que o bolão seja simples para quem organiza e divertido para quem joga.

Quem cria o bolão não precisa montar planilha, calcular pontuação ou pedir print no grupo. O organizador cria a disputa, copia o link e chama o pessoal. Quem recebe o convite entra no bolão, escolhe um username, define sua senha pessoal e já consegue palpitar.

Durante a Copa, cada participante acompanha o próprio desempenho pelo ranking, vê quem está liderando e confere onde ganhou pontos: grupos, mata-mata, placares exatos e artilheiro.

## Pontuação

- **5 pontos** por acertar uma posição correta na fase de grupos: 1º, 2º ou terceiro classificado.
- **5 pontos** por acertar o resultado de uma partida do mata-mata.
- **+5 pontos extras** por cravar o placar exato no mata-mata.
- Em caso de empate no total, o ranking considera mais placares exatos e depois o artilheiro correto.

## Rotas Principais

- `/` - landing page do app.
- `/criar` - criação de um novo bolão.
- `/b/:token` - lobby, login e cadastro por convite.
- `/b/:token/grupos` - palpites da fase de grupos.
- `/b/:token/partidas` - apostas do mata-mata.
- `/b/:token/ranking` - ranking do bolão.
- `/b/:token/admin` - administração do bolão.
- `/superadmin` - painel operacional da plataforma.

## Stack

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- Supabase PostgreSQL
- Supabase Edge Functions
- Auth custom com JWT

## Desenvolvimento Local

```bash
npm install
cp .env.example .env
npm run dev
```

Para rodar o projeto completo, preencha as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` e mantenha o schema/funções do Supabase sincronizados com a pasta `supabase/`.
