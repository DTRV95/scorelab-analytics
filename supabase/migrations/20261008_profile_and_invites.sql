-- O perfil de cada conta, e um convite que se consegue ler antes de aceitar.
--
-- Aplicado no projecto umivnhrhesibqccecaek a 2026-10-08.

-- 1. O convite diz o que é o desafio.
--
-- Quem é convidado ainda não é membro, por isso o RLS não o deixa ler a linha
-- do plano: o convite era um nome e mais nada, e dizer que sim era a única
-- maneira de descobrir para o que se estava a entrar. Continua security
-- definer e continua a devolver só os convites dirigidos a quem pergunta.
drop function if exists public.my_pending_plan_invites();

create function public.my_pending_plan_invites()
returns table(
  plan_id uuid,
  plan_name text,
  invited_by_name text,
  created_at timestamptz,
  starting_bankroll numeric,
  target numeric,
  days integer,
  template_key text,
  players integer
)
language sql
security definer
set search_path to 'public'
as $fn$
  select
    i.plan_id,
    pl.name::text,
    coalesce(nullif(trim(pr.display_name), ''), split_part(u.email, '@', 1))::text,
    i.created_at,
    pl.starting_bankroll,
    pl.target,
    pl.days,
    pl.template_key::text,
    (select count(*)::integer from public.plan_members m where m.plan_id = i.plan_id)
  from public.plan_invites i
  join public.plans pl on pl.id = i.plan_id
  join auth.users u on u.id = i.invited_by
  left join public.profiles pr on pr.id = i.invited_by
  where i.invited_user_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$fn$;

grant execute on function public.my_pending_plan_invites() to authenticated;

-- 2. O perfil de quem está ligado.
--
-- O nome vem da tabela profiles e, quando lá não está, da parte do email
-- antes do @ — nunca em branco.
create or replace function public.my_profile()
returns table(id uuid, display_name text, email text, joined_at timestamptz)
language sql
security definer
set search_path = public
as $fn$
  select u.id,
         coalesce(nullif(btrim(pr.display_name), ''), split_part(u.email, '@', 1))::text,
         u.email::text,
         u.created_at
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where u.id = auth.uid();
$fn$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- 3. Mudar o nome muda-o em todo o lado.
--
-- Cada desafio guarda a sua própria cópia do nome de quem lá está. Sem este
-- segundo update, mudar o nome mudava-o em lado nenhum que alguém veja.
create or replace function public.set_display_name(new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  clean text := nullif(btrim(new_name), '');
begin
  if clean is null then
    raise exception 'O nome não pode ficar vazio.';
  end if;
  if length(clean) > 40 then
    clean := left(clean, 40);
  end if;

  insert into public.profiles (id, display_name, updated_at)
  values (auth.uid(), clean, now())
  on conflict (id) do update
    set display_name = excluded.display_name, updated_at = now();

  update public.plan_members
     set display_name = clean
   where user_id = auth.uid();

  return clean;
end
$fn$;

revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
