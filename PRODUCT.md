# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hoje a ScoreLab tem dois utilizadores reais: o David e o Valdemar (Vilagreen),
dois apostadores que se conhecem e que seguem os mesmos desafios. Usam-na quase
sempre no telemóvel, muitas vezes com o jogo prestes a começar: escolhem um jogo
do quadro ou registam um à mão, fecham o boletim, e no dia seguinte marcam se
entrou ou não.

O produto está a ser feito para crescer para além dos dois — mais utilizadores
no futuro é intenção confirmada, não hipótese. Nada deve ser construído de
maneira que só funcione porque são duas pessoas que se conhecem (por exemplo,
convites, estados vazios e comparações entre pessoas têm de aguentar gente que
chega de novo).

## Product Purpose

A ScoreLab calcula a probabilidade de cada mercado de um jogo a partir de dados
de resultados, mostra um quadro diário com o que considera mais provável, e
guarda o que cada pessoa apostou para depois dizer, com números, o que acertou.
Em paralelo corre desafios por níveis, com banca, em que cada nível fecha com
uma aposta.

Sucesso é o utilizador apostar melhor e menos: menos boletins, escolhidos com
mais razão, com a banca sob controlo — e conseguir ver no próprio registo se
isso está mesmo a acontecer.

## Positioning

Duas coisas ao mesmo tempo, e é a junção que nenhum vizinho copia de forma
honesta:

1. **Quadro próprio, sem odds da casa.** As probabilidades saem de um modelo
   próprio alimentado por dados de jogos (football-data.org), não das odds das
   casas de apostas. O modelo é calibrado contra o seu próprio histórico e a
   taxa de acerto mostrada é medida, não prometida.
2. **O travão é o produto.** Níveis, banca e análises existem para apostar com
   disciplina. O modelo é o meio; o que a aplicação quer é que se aposte melhor,
   não mais.

## Operating Context

- Usada no telemóvel, em momentos curtos: ver o quadro do dia, fechar um nível,
  marcar um resultado.
- Fluxo típico: **Quadro** (`/probability`) → escolher jogo ou inserir à mão →
  boletim → **Desafio** (`/desafios/:planId`) fecha o nível → no dia seguinte
  marca-se ganho/perdido → **Análises** (`/dashboard/analises`) mostra o
  acumulado.
- Apostas fora dos desafios vivem em `/apostas` (apostas soltas) e entram nas
  Análises.
- Outras áreas: `/dashboard` (início), `/ligas`, `/bankroll`, `/accuracy`,
  `/match/:fixtureId`, `/desafios/:planId/analise`, `/model-lab` (só dono).
- Desafios são partilhados por convite: uma pessoa convida, a outra aceita, e a
  página mostra quem já entrou.

## Capabilities and Constraints

- **Frente:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui +
  framer-motion, alojada na Vercel. Dados e autenticação no Supabase (projeto
  `umivnhrhesibqccecaek`).
- **Motor:** serviço FastAPI + numpy no Render
  (`https://scorelab-api-olja.onrender.com`). É plano gratuito: adormece ao fim
  de ~15 minutos parado e a primeira chamada depois disso demora. A interface
  tem de aguentar isso — quadro guardado em cache local, botão de atualizar e
  puxar-para-atualizar existem por causa disto.
- **Dados:** football-data.org, limitado a 10 pedidos por minuto. A chave vive
  **só** na variável de ambiente `FOOTBALL_DATA_KEY` do Render; nunca no
  repositório, nunca na Vercel, nunca no código da frente.
- **Quadro diário:** gerado e guardado no Supabase por tarefas pg_cron
  (`quadro-*`, `resultados-*`); a aplicação lê o guardado e só chama o motor
  quando é preciso.
- **Idioma:** toda a interface, mensagens e termos estão em português de
  Portugal (facto do código hoje; o utilizador não o declarou como regra
  fechada).
- **Testes:** `npm run typecheck` e `npx vitest run` (cerca de 690 testes) à
  frente; `pytest` no `backend/`. Não há CI.
- **Por decidir:** se o Início e as sugestões do compositor passam a contar
  também as apostas soltas, como já fazem as Análises.

## Brand Commitments

Nome: **ScoreLab**. A voz da aplicação é direta, em português, sem linguagem de
casa de apostas e sem promessas de ganho.

## Evidence on Hand

- Registo real de apostas das duas pessoas no Supabase — é a base das Análises e
  da taxa de acerto; não há dados de exemplo nem contas fictícias.
- Medições feitas neste projeto e guardadas em código: calibração global
  (intercepto −0,1346, declive 0,6427) e desvio por mercado em
  `backend/model.py` (`MARKET_CALIBRATION`), vindos de um backtest de 692 jogos
  em 9 ligas. Depois da correção, a taxa de acerto medida na mesma quinzena
  passou de 60,8% para 71,4%.
- `scorelab-league-params.csv` com parâmetros por liga.
- **Não existe**, e não deve ser inventado: qualquer testemunho, número de
  utilizadores, caso de estudo, preço ou comparação com outra aplicação.

## Product Principles

1. **Telemóvel primeiro.** O ecrã pequeno manda; o computador é o caso
   secundário. (Confirmado pelo utilizador.)
2. **Nunca inventar números.** Percentagens, taxas de acerto e histórico só
   mostram o que foi medido no registo real. Sem valores de enfeite, sem
   exemplos a fazer de verdadeiros. (Confirmado pelo utilizador.)
3. **O modelo responde por si.** O que a aplicação afirma sobre a sua própria
   precisão tem de ser verificável no histórico, e corrigido quando a medição
   diz o contrário.
4. **Melhor, não mais.** As funcionalidades servem quem aposta com critério;
   nada deve transformar-se num incentivo a registar mais boletins.
5. **Construir para quem chega depois.** Mesmo com dois utilizadores, o que se
   constrói tem de fazer sentido para um terceiro que abre a aplicação pela
   primeira vez.

## Accessibility & Inclusion

Nenhum requisito específico foi estabelecido pelo utilizador. O código já segue
hábitos de base (rótulos `aria-label` nos controlos, respeito por
`prefers-reduced-motion` nas animações) e esses devem manter-se.
