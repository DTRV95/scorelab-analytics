-- O quadro deixa de ser construído uma vez por noite e mais nada.
--
-- Até aqui, tudo acontecia entre as 00:05 e as 00:26 UTC. Se uma competição
-- ficava de fora e as duas voltas não a apanhavam, ficava de fora o dia
-- inteiro: não havia mais nada agendado até à noite seguinte, e a app não
-- tem outra forma de a ir buscar que não seja acordar o motor e esperar um
-- minuto e meio. Foi o que se passou com a espanhola, a francesa, a
-- Championship, a italiana e a Eredivisie.
--
-- Duas mudanças.
--
-- 1. Pares de três em três horas. O fire já não faz nada quando o quadro
--    guardado tem menos de seis horas e está completo, por isso isto não é
--    trabalho de três em três horas: é uma reconstrução a meio do dia, e uma
--    tentativa imediata sempre que falta alguma competição. Uma competição
--    que caia às dez da manhã está de volta antes do meio-dia, sem ninguém
--    ter de carregar em nada.
--
-- 2. O store deixa de trocar um quadro completo por um incompleto. Uma
--    reconstrução a meio do dia começa com o motor frio — onze competições
--    para dez pedidos por minuto — e é bem capaz de voltar com uma a menos.
--    Guardar isso seria estragar, à uma da tarde, um quadro que estava bom.
--    Agora é recusado enquanto o que está guardado for do próprio dia; o
--    fire seguinte encontra o quadro ainda incompleto, volta a pedir com as
--    outras dez já em cache, e essa já traz tudo.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-15.

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
  faltam_novo integer;
  faltam_atual integer;
  atual_em timestamptz;
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

  faltam_novo := jsonb_array_length(coalesce(body -> 'unavailable', '[]'::jsonb));

  select jsonb_array_length(coalesce(payload -> 'unavailable', '[]'::jsonb)),
         computed_at
    into faltam_atual, atual_em
    from public.board_snapshots where key = 'days:7';

  -- Completo nunca é trocado por incompleto enquanto o completo for do
  -- próprio dia. Passadas vinte horas já é outro dia de jogos, e aí um
  -- quadro a que falta uma competição vale mais do que um fora de prazo.
  if faltam_novo > 0
     and coalesce(faltam_atual, 1) = 0
     and atual_em > now() - interval '20 hours' then
    return 0;
  end if;

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

revoke all on function public.board_refresh_store() from public, anon, authenticated;

-- De três em três horas, encostados um ao outro: o motor não adormece entre
-- o pedido e a arrumação, nem entre a primeira volta e a segunda.
select cron.schedule('quadro-dia-pedir',     '5 3,6,9,12,15,18,21 * * *',
                     $$select public.board_refresh_fire()$$);
select cron.schedule('quadro-dia-guardar',   '13 3,6,9,12,15,18,21 * * *',
                     $$select public.board_refresh_store()$$);
select cron.schedule('quadro-dia-pedir-2',   '18 3,6,9,12,15,18,21 * * *',
                     $$select public.board_refresh_fire()$$);
select cron.schedule('quadro-dia-guardar-2', '26 3,6,9,12,15,18,21 * * *',
                     $$select public.board_refresh_store()$$);
