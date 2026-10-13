-- Os trabalhos da noite passam a correr encostados uns aos outros.
--
-- O motor é um serviço gratuito que adormece ao fim de quinze minutos sem
-- pedidos, e a cache das épocas vive dentro do processo. O retry do quadro
-- corria quarenta minutos depois do primeiro pedido e vinte e cinco depois
-- do último trabalho — ou seja, com o motor já adormecido e a cache
-- perdida. Recomeçava do frio, voltava a ser onze competições para dez
-- pedidos por minuto, e voltava a deixar uma ou duas de fora.
--
-- A 13/10 deixou de fora a Liga dos Campeões num dia de Champions, que é
-- precisamente o dia em que ninguém quer abrir a app e não a ver lá.
--
-- Agora nenhum intervalo passa de oito minutos: o motor nunca adormece
-- entre o primeiro pedido e o último, a segunda volta encontra as dez
-- competições que passaram já em cache, e a que ficou de fora é o único
-- pedido que falta fazer.
--
--   05  pedir o quadro          31  pedir os resultados
--   13  guardar                 39  guardar
--   18  pedir outra vez         44  pedir outra vez
--   26  guardar                 52  guardar
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-13.

select cron.schedule('quadro-pedir',        '5 0 * * *',  $$select public.board_refresh_fire()$$);
select cron.schedule('quadro-guardar',      '13 0 * * *', $$select public.board_refresh_store()$$);
select cron.schedule('quadro-pedir-2',      '18 0 * * *', $$select public.board_refresh_fire()$$);
select cron.schedule('quadro-guardar-2',    '26 0 * * *', $$select public.board_refresh_store()$$);
select cron.schedule('resultados-pedir',    '31 0 * * *', $$select public.results_refresh_fire()$$);
select cron.schedule('resultados-guardar',  '39 0 * * *', $$select public.results_refresh_store()$$);
select cron.schedule('resultados-pedir-2',  '44 0 * * *', $$select public.results_refresh_fire()$$);
select cron.schedule('resultados-guardar-2','52 0 * * *', $$select public.results_refresh_store()$$);
