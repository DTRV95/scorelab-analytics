-- A segunda volta da noite passa a correr também quando o quadro veio
-- incompleto, não só quando não veio de todo.
--
-- São onze competições ligadas e a fonte de dados permite dez pedidos por
-- minuto, por isso um quadro construído com a cache fria é sempre um pedido
-- acima da linha — e a competição que fica de fora é a que ordena em último,
-- a Serie A, todos os dias, enquanto os jogos dela se jogavam.
--
-- O motor passa a esperar pelo minuto (BOARD_SLOT_WAIT) e a rodar a ordem das
-- competições, que é a correcção de fundo. Esta é a rede por baixo: às 00:45,
-- com as outras dez já em cache e a não gastarem pedido nenhum, a que faltou
-- entra à primeira.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-11.

create or replace function public.board_refresh_fire()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net
as $fn$
declare
  fresh timestamptz;
  faltam integer;
  rid bigint;
begin
  select computed_at,
         jsonb_array_length(coalesce(payload -> 'unavailable', '[]'::jsonb))
    into fresh, faltam
    from public.board_snapshots where key = 'days:7';

  if fresh is not null
     and fresh > now() - interval '6 hours'
     and coalesce(faltam, 0) = 0 then
    return null;
  end if;

  select net.http_get(
    'https://scorelab-api-olja.onrender.com/data/probability-board?days=7',
    timeout_milliseconds => 170000
  ) into rid;

  insert into public.board_refresh_runs(id, key) values (rid, 'days:7');
  return rid;
end
$fn$;

revoke all on function public.board_refresh_fire() from public, anon, authenticated;
