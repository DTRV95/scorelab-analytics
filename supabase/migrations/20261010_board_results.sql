-- O quadro de probabilidades, depois dos jogos jogados.
--
-- A página dos Jogos dizia o que ia acontecer e no dia seguinte já tinha
-- passado à semana seguinte: não havia em lado nenhum forma de ver se alguma
-- coisa daquilo se confirmou. O motor sabe responder a isso (/data/board-results
-- volta a prever cada jogo já jogado a partir da liga como estava antes do
-- apito e marca o mercado que destacou contra o resultado), mas é um serviço
-- que dorme e demora quase um minuto a acordar.
--
-- Por isso é pedido de madrugada, logo a seguir ao quadro, e guardado na mesma
-- tabela com a chave 'results:7'. A aplicação lê essa linha.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-10.

-- Cada pedido passa a dizer o que foi buscar. Sem isto, o trabalho que guarda
-- o quadro apanharia a resposta dos resultados e gravava-a como se fosse o
-- quadro — são os dois http_get sem nome na mesma fila.
alter table public.board_refresh_runs
  add column if not exists key text not null default 'days:7';

-- O de sempre, agora a olhar só para os pedidos do quadro.
create or replace function public.board_refresh_store()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  run record;
  res record;
  body jsonb;
  n integer;
begin
  select * into run from public.board_refresh_runs
   where stored_at is null and key = 'days:7'
   order by fired_at desc limit 1;
  if run is null then return 0; end if;

  select * into res from net._http_response where id = run.id;
  if res is null then return 0; end if;

  update public.board_refresh_runs set status = res.status_code where id = run.id;
  if res.status_code <> 200 or res.content is null then return 0; end if;

  body := res.content::jsonb;
  n := jsonb_array_length(coalesce(body -> 'matches', '[]'::jsonb));

  if n = 0 then return 0; end if;

  insert into public.board_snapshots(key, payload, matches, computed_at)
  values ('days:7', body, n, now())
  on conflict (key) do update
    set payload = excluded.payload,
        matches = excluded.matches,
        computed_at = excluded.computed_at;

  update public.board_refresh_runs
     set stored_at = now(), matches = n
   where id = run.id;

  return n;
end
$fn$;

-- Pede ao motor como correram os últimos sete dias.
create or replace function public.results_refresh_fire()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  fresh timestamptz;
  rid bigint;
begin
  select computed_at into fresh from public.board_snapshots where key = 'results:7';
  if fresh is not null and fresh > now() - interval '6 hours' then
    return null;
  end if;

  select net.http_get(
    'https://scorelab-api-olja.onrender.com/data/board-results?days=7',
    timeout_milliseconds => 170000
  ) into rid;

  insert into public.board_refresh_runs(id, key) values (rid, 'results:7');
  return rid;
end
$fn$;

create or replace function public.results_refresh_store()
returns integer
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  run record;
  res record;
  body jsonb;
  n integer;
begin
  select * into run from public.board_refresh_runs
   where stored_at is null and key = 'results:7'
   order by fired_at desc limit 1;
  if run is null then return 0; end if;

  select * into res from net._http_response where id = run.id;
  if res is null then return 0; end if;

  update public.board_refresh_runs set status = res.status_code where id = run.id;
  if res.status_code <> 200 or res.content is null then return 0; end if;

  body := res.content::jsonb;
  n := jsonb_array_length(coalesce(body -> 'matches', '[]'::jsonb));

  -- Uma semana sem um único jogo marcado não é melhoria nenhuma sobre a de
  -- ontem: é quase sempre a fonte a não responder a tempo.
  if n = 0 then return 0; end if;

  insert into public.board_snapshots(key, payload, matches, computed_at)
  values ('results:7', body, n, now())
  on conflict (key) do update
    set payload = excluded.payload,
        matches = excluded.matches,
        computed_at = excluded.computed_at;

  update public.board_refresh_runs
     set stored_at = now(), matches = n
   where id = run.id;

  return n;
end
$fn$;

revoke all on function public.results_refresh_fire() from public, anon, authenticated;
revoke all on function public.results_refresh_store() from public, anon, authenticated;

-- A seguir ao quadro, com o motor já acordado por ele. A segunda volta é para
-- quando a primeira falhou, e não faz nada quando correu bem.
select cron.schedule('resultados-pedir',    '20 0 * * *', $$select public.results_refresh_fire()$$);
select cron.schedule('resultados-guardar',  '30 0 * * *', $$select public.results_refresh_store()$$);
select cron.schedule('resultados-pedir-2',  '50 0 * * *', $$select public.results_refresh_fire()$$);
select cron.schedule('resultados-guardar-2','58 0 * * *', $$select public.results_refresh_store()$$);
