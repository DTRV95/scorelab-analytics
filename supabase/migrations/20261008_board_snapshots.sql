-- O quadro de probabilidades calculado de madrugada, guardado na base de dados.
--
-- O motor de análise dorme quando ninguém o usa (plano gratuito do Render) e
-- demora quase um minuto a acordar, mais outro tanto a percorrer as
-- competições. Abrir a página dos Jogos era esperar por isso — todos os dias,
-- por um quadro que é igual para toda a gente e que muda uma vez por dia.
--
-- Agora um trabalho agendado pede o quadro de madrugada e guarda-o aqui. A
-- aplicação lê esta linha: um pedido a um serviço que nunca está a dormir.
-- O motor só é chamado quando não há quadro nenhum guardado, ou quando
-- alguém carrega em atualizar e quer mesmo dizer isso.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-08.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- O quadro em si. Uma linha por janela de dias pedida ('days:7').
create table if not exists public.board_snapshots (
  key text primary key,
  payload jsonb not null,
  matches integer not null default 0,
  computed_at timestamptz not null default now()
);

alter table public.board_snapshots enable row level security;

-- Qualquer pessoa pode ler: são as probabilidades dos jogos, que já aparecem
-- na página pública a quem nem conta tem. Ninguém escreve por aqui — não há
-- política de escrita, e os privilégios de escrita estão retirados.
drop policy if exists board_snapshots_read on public.board_snapshots;
create policy board_snapshots_read on public.board_snapshots
  for select using (true);

revoke insert, update, delete, truncate, references, trigger
  on public.board_snapshots from anon, authenticated;

-- Que pedidos foram feitos, e qual deles já foi guardado.
create table if not exists public.board_refresh_runs (
  id bigint primary key,
  fired_at timestamptz not null default now(),
  stored_at timestamptz,
  status integer,
  matches integer
);

alter table public.board_refresh_runs enable row level security;
revoke all on public.board_refresh_runs from anon, authenticated;

-- Pede o quadro ao motor. Assíncrono: o pg_net devolve um número de pedido e
-- a resposta chega mais tarde, que é o que o segundo trabalho vai buscar.
create or replace function public.board_refresh_fire()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  fresh timestamptz;
  rid bigint;
begin
  -- Nada a fazer se o quadro da noite ainda é novo: a segunda tentativa da
  -- noite existe para quando a primeira falhou, não para gastar duas vezes
  -- os dez pedidos por minuto que a fonte permite.
  select computed_at into fresh from public.board_snapshots where key = 'days:7';
  if fresh is not null and fresh > now() - interval '6 hours' then
    return null;
  end if;

  select net.http_get(
    'https://scorelab-api-olja.onrender.com/data/probability-board?days=7',
    timeout_milliseconds => 170000
  ) into rid;

  insert into public.board_refresh_runs(id) values (rid);
  return rid;
end
$fn$;

-- Guarda a resposta que entretanto chegou.
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
   where stored_at is null
   order by fired_at desc limit 1;
  if run is null then return 0; end if;

  select * into res from net._http_response where id = run.id;
  if res is null then return 0; end if;

  update public.board_refresh_runs set status = res.status_code where id = run.id;
  if res.status_code <> 200 or res.content is null then return 0; end if;

  body := res.content::jsonb;
  n := jsonb_array_length(coalesce(body -> 'matches', '[]'::jsonb));

  -- Um quadro vazio não é melhoria nenhuma sobre o de ontem. As competições
  -- param uma semana de cada vez, e a fonte deixa cair uma ou outra quando o
  -- limite por minuto aperta; nenhuma das duas é razão para deitar fora jogos
  -- que ainda estão por jogar.
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

-- Funções do schema public são chamáveis pela API. Estas não: pedir o quadro
-- gasta pedidos à fonte, e isso não pode estar à mão de qualquer um.
revoke all on function public.board_refresh_fire() from public, anon, authenticated;
revoke all on function public.board_refresh_store() from public, anon, authenticated;

-- De madrugada (UTC, que em Lisboa é meia-noite no inverno e uma da manhã no
-- verão). O segundo par é a repetição de quem falhou à primeira — e não faz
-- nada quando a primeira correu bem.
select cron.schedule('quadro-pedir',    '5 0 * * *',  $$select public.board_refresh_fire()$$);
select cron.schedule('quadro-guardar',  '15 0 * * *', $$select public.board_refresh_store()$$);
select cron.schedule('quadro-pedir-2',  '45 0 * * *', $$select public.board_refresh_fire()$$);
select cron.schedule('quadro-guardar-2','55 0 * * *', $$select public.board_refresh_store()$$);
