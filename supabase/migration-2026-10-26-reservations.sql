-- Migration du 26 octobre 2026 : réservation de créneaux avec un animateur (séance d'essai, individuelle, rattrapage),
-- planning, fiche animateur (matières, présentation). Rejouable sans risque. Une base neuve n'en a pas besoin : schema.sql contient tout.

alter table public.profiles add column if not exists subjects text;
alter table public.profiles add column if not exists bio text;

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  animateur_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null default 60,
  kind text not null default 'individuel' check (kind in ('essai','individuel','rattrapage')),
  subject text,
  capacity int not null default 1 check (capacity between 1 and 8),
  mode text not null default 'visio' check (mode in ('visio','presentiel')),
  meeting_url text,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  status text not null default 'confirme' check (status in ('confirme','annule')),
  note text,
  created_at timestamptz not null default now(),
  unique (slot_id, child_id)
);

-- Fiche publique des animateurs et du fondateur (nom, matières, présentation) : lisible par tous les connectés, sans e-mail ni téléphone
drop view if exists public.animateurs;
create view public.animateurs as
  select id, full_name, subjects, bio from public.profiles where role in ('animateur', 'admin');
grant select on public.animateurs to authenticated;

-- Places réservées par créneau (les parents ne voient pas les réservations des autres, mais voient le nombre)
create or replace function public.slot_counts() returns table (slot_id uuid, booked int)
language sql stable security definer set search_path = public as $$
  select slot_id, count(*)::int from public.bookings where status = 'confirme' group by slot_id
$$;
grant execute on function public.slot_counts() to authenticated;

create or replace function public.has_booking_with_me(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings b join public.slots s on s.id = b.slot_id where b.child_id = c and s.animateur_id = auth.uid() and b.status = 'confirme')
$$;

-- Un créneau passé ne se réserve pas ; un créneau complet non plus
create or replace function public.check_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; n int; st timestamptz;
begin
  select capacity, starts_at into cap, st from public.slots where id = new.slot_id;
  if st is null then raise exception 'Créneau introuvable'; end if;
  if new.status = 'confirme' and (tg_op = 'INSERT' or old.status <> 'confirme') then
    if st < now() then raise exception 'Ce créneau est passé'; end if;
    select count(*) into n from public.bookings where slot_id = new.slot_id and status = 'confirme' and id <> new.id;
    if n >= cap then raise exception 'Ce créneau est complet'; end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_check on public.bookings;
create trigger bookings_check before insert or update on public.bookings for each row execute function public.check_booking();

alter table public.slots enable row level security;
alter table public.bookings enable row level security;
drop policy if exists slots_read on public.slots;
create policy slots_read on public.slots for select to authenticated using (true);
drop policy if exists slots_write on public.slots;
create policy slots_write on public.slots for all to authenticated using (public.is_admin() or animateur_id = auth.uid()) with check (public.is_admin() or animateur_id = auth.uid());
drop policy if exists bookings_admin on public.bookings;
create policy bookings_admin on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists bookings_animateur on public.bookings;
create policy bookings_animateur on public.bookings for select to authenticated using (exists (select 1 from public.slots s where s.id = bookings.slot_id and s.animateur_id = auth.uid()));
drop policy if exists bookings_animateur_update on public.bookings;
create policy bookings_animateur_update on public.bookings for update to authenticated using (exists (select 1 from public.slots s where s.id = bookings.slot_id and s.animateur_id = auth.uid())) with check (exists (select 1 from public.slots s where s.id = bookings.slot_id and s.animateur_id = auth.uid()));
drop policy if exists bookings_parent on public.bookings;
create policy bookings_parent on public.bookings for select to authenticated using (public.is_parent_of_child(child_id));
drop policy if exists bookings_parent_insert on public.bookings;
create policy bookings_parent_insert on public.bookings for insert to authenticated with check (public.is_parent_of_child(child_id));
drop policy if exists bookings_parent_update on public.bookings;
create policy bookings_parent_update on public.bookings for update to authenticated using (public.is_parent_of_child(child_id)) with check (public.is_parent_of_child(child_id));

-- L'animateur voit l'enfant et la famille qui ont réservé chez lui
drop policy if exists children_animateur_select on public.children;
create policy children_animateur_select on public.children for select to authenticated using (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id) or public.has_booking_with_me(id));
drop policy if exists families_animateur on public.families;
create policy families_animateur on public.families for select to authenticated using (
  public.my_role() = 'animateur' and exists (select 1 from public.children c left join public.groups g on g.id = c.group_id or g.id = c.course_group_id where c.family_id = families.id and (g.animateur_id = auth.uid() or public.has_booking_with_me(c.id)))
);

grant select, insert, update, delete on public.slots, public.bookings to authenticated;
select 'migration réservations appliquée' as resultat;
