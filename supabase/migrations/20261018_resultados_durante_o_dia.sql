-- Os resultados deixam de esperar pela madrugada.
--
-- O quadro já era pedido de três em três horas (quadro-dia-*), mas os
-- resultados continuavam a ser marcados uma vez por noite, às 00:31. Isso
-- chegava para o separador de ontem e não chega para a linha de cada jogo
-- dizer se entrou: um jogo das 15:00 só ficava marcado passada mais de meia
-- noite, e durante todo o serão a página mostrava a previsão como se ainda
-- estivesse por decidir.
--
-- As mesmas quatro funções, nas mesmas horas em que o quadro já acorda o
-- motor, com os minutos a que a noite já corria: pedir aos :31 e :44, guardar
-- aos :39 e :52. A segunda volta é para quando a primeira falhou e não faz
-- nada quando correu bem — o store só olha para pedidos ainda por guardar.
--
-- O guarda do n = 0 continua a valer: uma semana sem um único jogo marcado é
-- quase sempre a fonte a não responder a tempo, e não substitui o que lá está.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-18.

select cron.schedule(
  'resultados-dia-pedir',
  '31 3,6,9,12,15,18,21 * * *',
  $$select public.results_refresh_fire()$$
);

select cron.schedule(
  'resultados-dia-guardar',
  '39 3,6,9,12,15,18,21 * * *',
  $$select public.results_refresh_store()$$
);

select cron.schedule(
  'resultados-dia-pedir-2',
  '44 3,6,9,12,15,18,21 * * *',
  $$select public.results_refresh_fire()$$
);

select cron.schedule(
  'resultados-dia-guardar-2',
  '52 3,6,9,12,15,18,21 * * *',
  $$select public.results_refresh_store()$$
);
