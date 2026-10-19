-- O registo do que o modelo disse, que deixa de se apagar todas as semanas.
--
-- O quadro marcado vive numa linha só, `board_snapshots` com a chave
-- 'results:7', substituída de três em três horas. Cada passagem mede os
-- últimos sete dias e deita fora a anterior. Esta semana foram 1185
-- medições — quinze mercados em setenta e nove jogos — e na próxima
-- segunda-feira não existe nenhuma delas.
--
-- E não se recuperam. Refazer a previsão de um jogo exige a época como
-- estava antes daquele jogo, que é exactamente o que deixa de haver assim
-- que ele entra nela. O que se perde aqui perde-se para sempre.
--
-- Isto importa porque a pergunta que a aplicação quer responder — "em que
-- mercados é que o modelo é de confiança?" — não se responde com uma
-- semana. Esta semana deu onze empates em setenta e nove jogos, 13,9%
-- quando o futebol dá uns 25%, e lida sozinha diria que o modelo promete
-- empates a mais. Diz isso de uma semana de futebol invulgar, e a
-- calibração que já está no motor, medida sobre uma época inteira, tem o
-- empate quase ao centro. Com dez semanas a diferença entre as duas coisas
-- vê-se; com uma, não.
--
-- Uma linha por jogo e mercado, que é a medição. Guardada uma vez: a
-- previsão é sempre feita a partir de antes do apito, por isso voltar a
-- marcá-la daria o mesmo, e `do nothing` poupa a escrita.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-19.

create table if not exists public.model_record (
  fixture_id bigint not null,
  mercado text not null,
  league text not null,
  kickoff timestamptz,
  -- O que o modelo disse, já calibrado: é o número que esteve no ecrã.
  said_pct numeric(5,2) not null,
  landed boolean not null,
  scored_at timestamptz not null default now(),
  primary key (fixture_id, mercado)
);

create index if not exists model_record_kickoff on public.model_record (kickoff);

alter table public.model_record enable row level security;

-- Lê-se como o quadro se lê: são previsões sobre jogos públicos e o
-- resultado deles. Ninguém escreve por aqui — não há política de escrita,
-- e quem escreve é a função abaixo, que corre como dona.
drop policy if exists model_record_read on public.model_record;
create policy model_record_read on public.model_record
  for select using (true);

revoke insert, update, delete on public.model_record from anon, authenticated;

-- Passa o quadro marcado que está guardado para o registo que não se apaga.
create or replace function public.model_record_keep()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  novos integer;
begin
  with linhas as (
    select (j->>'fixture_id')::bigint as fixture_id,
           mk->>'mercado' as mercado,
           coalesce(j->>'league', '?') as league,
           nullif(j->>'kickoff', '')::timestamptz as kickoff,
           (mk->>'probabilidade_pct')::numeric as said_pct,
           (mk->>'landed')::boolean as landed
      from public.board_snapshots s,
           jsonb_array_elements(s.payload -> 'matches') j,
           jsonb_array_elements(j -> 'mercados') mk
     where s.key = 'results:7'
  )
  insert into public.model_record
    (fixture_id, mercado, league, kickoff, said_pct, landed)
  select fixture_id, mercado, league, kickoff, said_pct, landed
    from linhas
   where fixture_id is not null
  on conflict (fixture_id, mercado) do nothing;

  get diagnostics novos = row_count;
  return novos;
end
$$;

-- O que o registo inteiro diz de cada mercado.
--
-- `said_pct` é a média do que o modelo prometeu e `hit_pct` o que
-- aconteceu; a diferença entre os dois é a única coisa aqui que é uma
-- opinião sobre o modelo, e só começa a valer alguma coisa com umas
-- centenas de jogos — por isso `n` vem sempre ao lado e nunca escondido.
create or replace function public.model_record_markets()
returns table (
  mercado text,
  n bigint,
  said_pct numeric,
  hit_pct numeric,
  bias_pp numeric
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.mercado,
         count(*) as n,
         round(avg(r.said_pct), 1) as said_pct,
         round(100.0 * count(*) filter (where r.landed) / count(*), 1) as hit_pct,
         round(
           100.0 * count(*) filter (where r.landed) / count(*) - avg(r.said_pct),
           1
         ) as bias_pp
    from public.model_record r
   group by r.mercado
   order by count(*) desc, r.mercado;
$$;

grant execute on function public.model_record_markets() to anon, authenticated;

-- Guardar o quadro marcado passa a alimentar o registo, no mesmo gesto.
-- Um cron à parte era mais uma coisa para desalinhar: o registo só muda
-- quando o quadro marcado muda, por isso é aqui que pertence.
create or replace function public.results_refresh_store()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'net'
as $$
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

  perform public.model_record_keep();

  return n;
end
$$;
