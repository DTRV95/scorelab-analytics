-- A segunda volta dos resultados passa a correr também quando faltou uma
-- competição, não só quando não veio nada.
--
-- O quadro levou esta correcção a 11 de Outubro; os resultados ficaram com a
-- versão antiga, e esta madrugada deu-se o caso que ela não apanha. Às 06:39
-- a marcação da semana foi buscada ao motor sem a Serie A — a fonte permite
-- dez pedidos por minuto, são onze competições, e a que fica de fora quando a
-- cache está fria é sempre a última a ser pedida. Ontem, 27 de Outubro, a
-- Serie A foi a **única** competição que jogou: três jogos, os três
-- acertados. O cartão de ontem, sem nenhum deles, disse "não se jogou nada".
--
-- A repetição das 06:44 existia precisamente para isto e não disparou, porque
-- olhava só para a hora do que estava guardado: havia uma marcação com cinco
-- minutos, logo estava fresca. Passa a olhar também para a lista de
-- competições em falta, como a do quadro já faz. Treze minutos depois, com as
-- outras dez já quentes na cache do motor e a não gastarem pedido nenhum, a
-- que faltou entra à primeira.

create or replace function public.results_refresh_fire()
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
    from public.board_snapshots where key = 'results:7';

  -- Fresca **e** completa. Uma marcação a que falta uma competição é uma
  -- marcação por acabar, por muito recente que seja, e nos dias em que só
  -- essa competição jogou é uma marcação vazia.
  if fresh is not null
     and fresh > now() - interval '6 hours'
     and coalesce(faltam, 0) = 0 then
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

revoke all on function public.results_refresh_fire() from public, anon, authenticated;
