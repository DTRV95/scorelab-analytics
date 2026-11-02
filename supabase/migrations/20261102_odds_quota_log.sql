-- O saldo das odds, escrito num sítio que sobrevive ao motor.
--
-- A pergunta "a cache está a resultar?" não tinha resposta, e não tinha
-- por um motivo que é um defeito: o contador do saldo (`odds_api._meter`)
-- vive na memória do motor, e o motor dorme entre visitas e acorda sem
-- memória. Lê-se o que a última chamada deixou lá e mais nada — nunca
-- "quantas foram ontem", que é a única pergunta que interessa.
--
-- A 2 de Novembro, por exemplo: 38 de 500 gastas, e a tabela `odds_day`
-- só explicava 12 delas. As outras 26 não se podem atribuir a nada,
-- porque ninguém as apontou quando aconteceram.
--
-- Isto aponta-as. Três leituras por dia do `/data/sources`, que é o
-- endereço que diz o saldo **sem gastar saldo** — a lista de desportos
-- é gratuita e o contador vem do cabeçalho da última chamada de preço.
-- Em uma semana há uma curva; em um mês há uma resposta.
--
-- POR APLICAR no projecto umivnhrhesibqccecaek: a aplicação ficou à
-- espera de aprovação e não chegou a correr.

create table if not exists public.odds_quota (
  at timestamptz primary key default now(),
  -- O dia em Lisboa, para a conta por dia não partir a meio da noite.
  day date not null default (now() at time zone 'Europe/Lisbon')::date,
  used integer,
  remaining integer,
  -- O que a fonte cobrou pela última listagem. Duas, com uma região e
  -- dois mercados; se um dia for outro número, foi porque algo mudou.
  last_cost integer,
  ok boolean
);

alter table public.odds_quota enable row level security;

-- Qualquer pessoa autenticada pode ler: é o saldo de uma conta partilhada
-- por dois, e saber quanto falta não é um segredo de ninguém. Ninguém
-- escreve por aqui — escreve o trabalho agendado, que corre como dono.
drop policy if exists odds_quota_read on public.odds_quota;
create policy odds_quota_read on public.odds_quota
  for select to authenticated using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.odds_quota from anon, authenticated;

create index if not exists odds_quota_by_day on public.odds_quota (day, at);

-- Pede o estado das fontes. Assíncrono, como os outros: o pg_net devolve
-- um número de pedido e a resposta chega mais tarde.
create or replace function public.odds_quota_fire()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  rid bigint;
begin
  select net.http_get(
    'https://scorelab-api-olja.onrender.com/data/sources',
    timeout_milliseconds => 170000
  ) into rid;

  insert into public.board_refresh_runs(id, key) values (rid, 'odds-quota');
  return rid;
end
$fn$;

-- Guarda a leitura que entretanto chegou.
create or replace function public.odds_quota_store()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  run record;
  res record;
  saldo jsonb;
begin
  select * into run from public.board_refresh_runs
   where stored_at is null and key = 'odds-quota'
   order by fired_at desc limit 1;
  if run is null then return 0; end if;

  select * into res from net._http_response where id = run.id;
  if res is null then return 0; end if;

  update public.board_refresh_runs set status = res.status_code where id = run.id;
  if res.status_code <> 200 or res.content is null then return 0; end if;

  saldo := res.content::jsonb -> 'odds' -> 'quota';

  -- Sem leitura nenhuma é porque o motor acordou agora e ainda não
  -- pediu preço nenhum. Não é zero gasto, é não saber — e escrever um
  -- zero aqui era inventar uma descida.
  if saldo is null or saldo ->> 'used' is null then
    update public.board_refresh_runs set stored_at = now() where id = run.id;
    return 0;
  end if;

  insert into public.odds_quota(at, used, remaining, last_cost, ok)
  values (
    now(),
    (saldo ->> 'used')::integer,
    (saldo ->> 'remaining')::integer,
    (saldo ->> 'last_cost')::integer,
    coalesce((saldo ->> 'ok')::boolean, true)
  )
  on conflict (at) do nothing;

  update public.board_refresh_runs set stored_at = now() where id = run.id;
  return 1;
end
$fn$;

revoke all on function public.odds_quota_fire() from public, anon, authenticated;
revoke all on function public.odds_quota_store() from public, anon, authenticated;

-- Três vezes por dia: de manhã cedo, à hora de almoço e à noite depois
-- dos jogos da tarde. Chega para uma curva e não acorda o motor de
-- propósito mais vezes do que as visitas já o acordam.
select cron.schedule('odds-saldo-pedir-1',   '7 7 * * *',  $$select public.odds_quota_fire()$$);
select cron.schedule('odds-saldo-guardar-1', '17 7 * * *', $$select public.odds_quota_store()$$);
select cron.schedule('odds-saldo-pedir-2',   '7 14 * * *',  $$select public.odds_quota_fire()$$);
select cron.schedule('odds-saldo-guardar-2', '17 14 * * *', $$select public.odds_quota_store()$$);
select cron.schedule('odds-saldo-pedir-3',   '7 23 * * *',  $$select public.odds_quota_fire()$$);
select cron.schedule('odds-saldo-guardar-3', '17 23 * * *', $$select public.odds_quota_store()$$);
