-- ============================================================================
-- Élan Académie — base de données de l'application (Supabase / PostgreSQL)
-- À coller tel quel dans Supabase : SQL Editor > New query > Run.
-- Peut être rejoué sans risque (les objets existants sont remplacés).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Tables
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  phone text,
  email text,
  quartier text,
  status text not null default 'liste_attente' check (status in ('liste_attente','essai_planifie','inscrit','parti')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'atelier' check (kind in ('atelier','cours')),
  level text not null check (level in ('explorateurs','batisseurs','argumentateurs','decideurs','college','lycee')),
  day text,
  start_time text,
  meeting_url text,
  animateur_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  first_name text not null,
  age int check (age between 5 and 20),
  level text check (level in ('explorateurs','batisseurs','argumentateurs','decideurs')),
  group_id uuid references public.groups(id) on delete set null,
  sessions_planned int not null default 32,
  course_group_id uuid references public.groups(id) on delete set null,
  course_sessions_planned int not null default 30,
  school_class text,
  status text not null default 'inscrit' check (status in ('essai','inscrit','parti')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'parent' check (role in ('admin','animateur','parent')),
  full_name text,
  phone text,
  email text,
  family_id uuid references public.families(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  session_date date not null,
  start_time text,
  meeting_url text,
  notes text,
  animateur_id uuid references auth.users(id) on delete set null,
  summary text,
  created_at timestamptz not null default now(),
  unique (group_id, session_date)
);

create table if not exists public.attendance (
  session_id uuid not null references public.sessions(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  present boolean not null default true,
  note text,
  primary key (session_id, child_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null,
  term text,
  status text not null default 'en_cours' check (status in ('en_cours','presente')),
  demo_date date,
  link text,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  body text not null,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, month)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  name text not null,
  awarded_at date not null default current_date
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pro_name text,
  job text,
  meeting_at timestamptz,
  mode text not null default 'visio' check (mode in ('visio','presentiel')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_attendance (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  primary key (meeting_id, child_id)
);

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  parent text not null,
  phone text not null,
  email text,
  child text,
  age int,
  interest text,
  quartier text,
  source text,
  message text,
  page text,
  status text not null default 'nouveau' check (status in ('nouveau','contacte','essai_planifie','inscrit','sans_suite')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- Mises à jour d'une base existante (sans effet sur une base neuve)
alter table public.groups add column if not exists kind text not null default 'atelier';
alter table public.groups drop constraint if exists groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('atelier','cours'));
alter table public.groups drop constraint if exists groups_level_check;
alter table public.groups add constraint groups_level_check check (level in ('explorateurs','batisseurs','argumentateurs','decideurs','college','lycee'));
alter table public.children add column if not exists course_group_id uuid references public.groups(id) on delete set null;
alter table public.children add column if not exists course_sessions_planned int not null default 30;
alter table public.children add column if not exists school_class text;
alter table public.groups add column if not exists meeting_url text;
alter table public.sessions add column if not exists start_time text;
alter table public.sessions add column if not exists meeting_url text;
alter table public.sessions add column if not exists notes text;

-- ---------------------------------------------------------------- Fonctions d'aide (rôle de l'utilisateur connecté)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_animateur_of_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select animateur_id = auth.uid() from public.groups where id = g), false)
$$;

create or replace function public.is_animateur_of_child(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.children ch join public.groups g on g.id = ch.group_id or g.id = ch.course_group_id where ch.id = c and g.animateur_id = auth.uid())
$$;

create or replace function public.is_parent_of_child(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ch.family_id = public.my_family() from public.children ch where ch.id = c), false)
$$;

-- ---------------------------------------------------------------- Création automatique du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, family_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'parent',
    (select id from public.families f where f.email is not null and lower(f.email) = lower(new.email) limit 1)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Un utilisateur ne peut pas changer lui-même son rôle ni sa famille
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Depuis l'application, seul un administrateur peut changer un rôle ; depuis l'éditeur SQL (pas d'utilisateur connecté), tout est permis.
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.family_id := old.family_id;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before update on public.profiles
for each row execute procedure public.protect_profile_fields();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists monthly_reports_touch on public.monthly_reports;
create trigger monthly_reports_touch before update on public.monthly_reports
for each row execute procedure public.touch_updated_at();

-- ---------------------------------------------------------------- Vue de progression (séances faites / restantes)
drop view if exists public.child_progress;
create view public.child_progress with (security_invoker = true) as
select
  c.id as child_id,
  c.sessions_planned,
  c.course_sessions_planned,
  (count(*) filter (where a.present and g.kind = 'atelier'))::int as sessions_done,
  (count(*) filter (where a.present is false and g.kind = 'atelier'))::int as sessions_missed,
  greatest(c.sessions_planned - (count(*) filter (where a.present and g.kind = 'atelier')), 0)::int as sessions_remaining,
  (count(*) filter (where a.present and g.kind = 'cours'))::int as course_done,
  (count(*) filter (where a.present is false and g.kind = 'cours'))::int as course_missed,
  greatest(c.course_sessions_planned - (count(*) filter (where a.present and g.kind = 'cours')), 0)::int as course_remaining,
  max(s.session_date) as last_session,
  (select max(month) from public.monthly_reports r where r.child_id = c.id) as last_report_month
from public.children c
left join public.attendance a on a.child_id = c.id
left join public.sessions s on s.id = a.session_id
left join public.groups g on g.id = s.group_id
group by c.id, c.sessions_planned, c.course_sessions_planned;

-- ---------------------------------------------------------------- Sécurité par ligne (RLS)
alter table public.families enable row level security;
alter table public.groups enable row level security;
alter table public.children enable row level security;
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.projects enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.badges enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_attendance enable row level security;
alter table public.waitlist enable row level security;

-- On repart de zéro sur les politiques pour pouvoir rejouer le script
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- families
create policy families_admin on public.families for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy families_parent on public.families for select to authenticated using (id = public.my_family());
create policy families_animateur on public.families for select to authenticated using (
  public.my_role() = 'animateur' and exists (select 1 from public.children c join public.groups g on g.id = c.group_id or g.id = c.course_group_id where c.family_id = families.id and g.animateur_id = auth.uid())
);

-- groups
create policy groups_admin on public.groups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy groups_animateur on public.groups for select to authenticated using (animateur_id = auth.uid());
create policy groups_parent on public.groups for select to authenticated using (
  exists (select 1 from public.children c where (c.group_id = groups.id or c.course_group_id = groups.id) and c.family_id = public.my_family())
);

-- children
create policy children_admin on public.children for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy children_animateur_select on public.children for select to authenticated using (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id));
create policy children_animateur_update on public.children for update to authenticated using (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id)) with check (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id));
create policy children_parent on public.children for select to authenticated using (family_id = public.my_family());

-- sessions
create policy sessions_admin on public.sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sessions_animateur on public.sessions for all to authenticated using (public.is_animateur_of_group(group_id)) with check (public.is_animateur_of_group(group_id));
create policy sessions_parent on public.sessions for select to authenticated using (
  exists (select 1 from public.children c where (c.group_id = sessions.group_id or c.course_group_id = sessions.group_id) and c.family_id = public.my_family())
);

-- attendance
create policy attendance_admin on public.attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy attendance_animateur on public.attendance for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = attendance.session_id and public.is_animateur_of_group(s.group_id)))
  with check (exists (select 1 from public.sessions s where s.id = attendance.session_id and public.is_animateur_of_group(s.group_id)));
create policy attendance_parent on public.attendance for select to authenticated using (public.is_parent_of_child(child_id));

-- projects
create policy projects_admin on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy projects_animateur on public.projects for all to authenticated using (public.is_animateur_of_child(child_id)) with check (public.is_animateur_of_child(child_id));
create policy projects_parent on public.projects for select to authenticated using (public.is_parent_of_child(child_id));

-- monthly_reports
create policy reports_admin on public.monthly_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reports_animateur on public.monthly_reports for all to authenticated using (public.is_animateur_of_child(child_id)) with check (public.is_animateur_of_child(child_id));
create policy reports_parent on public.monthly_reports for select to authenticated using (public.is_parent_of_child(child_id));

-- badges
create policy badges_admin on public.badges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy badges_animateur on public.badges for all to authenticated using (public.is_animateur_of_child(child_id)) with check (public.is_animateur_of_child(child_id));
create policy badges_parent on public.badges for select to authenticated using (public.is_parent_of_child(child_id));

-- meetings (rencontres métiers) : visibles par tous les connectés, gérées par l'admin
create policy meetings_admin on public.meetings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy meetings_read on public.meetings for select to authenticated using (true);
create policy meeting_att_admin on public.meeting_attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy meeting_att_parent on public.meeting_attendance for select to authenticated using (public.is_parent_of_child(child_id));
create policy meeting_att_animateur on public.meeting_attendance for select to authenticated using (public.is_animateur_of_child(child_id));

-- waitlist : le site public (clé anon) peut seulement ajouter ; l'admin voit et modifie
create policy waitlist_insert_anon on public.waitlist for insert to anon, authenticated with check (true);
create policy waitlist_admin on public.waitlist for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- Réservations de créneaux avec un animateur, planning, fiche animateur
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
  status text not null default 'confirme' check (status in ('confirme','annule','absent')),
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

-- ---------------------------------------------------------------- Paiements des familles
-- Paiements reçus (espèces, virement, chèque), saisis par l'administration
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  amount_dh numeric(10,2) not null check (amount_dh <> 0),
  paid_at date not null default current_date,
  method text not null default 'especes' check (method in ('especes','virement','cheque','autre')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Une réservation peut être marquée « absent » : ni facturée à la famille, ni payée à l'animateur
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in ('confirme','annule','absent'));

alter table public.payments enable row level security;
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists payments_parent on public.payments;
create policy payments_parent on public.payments for select to authenticated using (family_id = public.my_family());
grant select, insert, update, delete on public.payments to authenticated;

-- ---------------------------------------------------------------- Catalogue des prestations
create table if not exists public.catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'heure' check (unit in ('heure','seance')),
  price_dh numeric(10,2) not null default 0,
  animateur_dh numeric(10,2) not null default 0,
  animateur_unit text not null default 'enfant' check (animateur_unit in ('seance','enfant')),
  kind_default text unique check (kind_default in ('atelier','cours','essai','individuel','rattrapage','rencontre')),
  active boolean not null default true,
  sort int not null default 100
);
insert into public.catalog (name, unit, price_dh, animateur_dh, animateur_unit, kind_default, sort) values
  ('Atelier robotique et sciences (séance de 2 h)', 'seance', 225, 250, 'seance', 'atelier', 10),
  ('Cours en petit groupe (séance de 1 h 30)', 'seance', 200, 200, 'seance', 'cours', 20),
  ('Séance d''essai', 'heure', 0, 0, 'enfant', 'essai', 30),
  ('Séance individuelle', 'heure', 250, 125, 'enfant', 'individuel', 40),
  ('Rattrapage', 'heure', 250, 125, 'enfant', 'rattrapage', 50),
  ('Mathématiques', 'heure', 250, 125, 'enfant', null, 60),
  ('Physique-chimie', 'heure', 250, 125, 'enfant', null, 70),
  ('Robotique et programmation', 'heure', 250, 125, 'enfant', null, 80),
  ('Prise de parole et argumentation', 'heure', 200, 100, 'enfant', null, 90),
  ('Rencontre métiers', 'seance', 150, 0, 'seance', 'rencontre', 100),
  ('Bilan d''orientation', 'seance', 2500, 0, 'seance', null, 110)
on conflict (name) do nothing;

-- Tarif négocié par enfant et par prestation (vide = tarif du catalogue)
create table if not exists public.child_prices (
  child_id uuid not null references public.children(id) on delete cascade,
  catalog_id uuid not null references public.catalog(id) on delete cascade,
  price_dh numeric(10,2) not null,
  note text,
  primary key (child_id, catalog_id)
);
alter table public.groups add column if not exists catalog_id uuid references public.catalog(id) on delete set null;
alter table public.groups add column if not exists duration_min int not null default 120;
alter table public.slots add column if not exists catalog_id uuid references public.catalog(id) on delete set null;
alter table public.meetings add column if not exists catalog_id uuid references public.catalog(id) on delete set null;
alter table public.meetings add column if not exists billable boolean not null default false;

alter table public.catalog enable row level security;
alter table public.child_prices enable row level security;
drop policy if exists catalog_read on public.catalog;
create policy catalog_read on public.catalog for select to authenticated using (true);
drop policy if exists catalog_admin on public.catalog;
create policy catalog_admin on public.catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists child_prices_admin on public.child_prices;
create policy child_prices_admin on public.child_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists child_prices_parent on public.child_prices;
create policy child_prices_parent on public.child_prices for select to authenticated using (public.is_parent_of_child(child_id));
grant select, insert, update, delete on public.catalog, public.child_prices to authenticated;

-- Prestation applicable : celle choisie, sinon celle par défaut du type
create or replace function public.catalog_for(cat uuid, kind text) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(cat, (select id from public.catalog where kind_default = kind limit 1))
$$;
-- Prix pour un enfant : tarif négocié, sinon catalogue
create or replace function public.price_for(child uuid, cat uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select cp.price_dh from public.child_prices cp where cp.child_id = child and cp.catalog_id = cat),
                  (select c.price_dh from public.catalog c where c.id = cat), 0)
$$;

-- Consommation d'une famille (admin ou le parent) : présences en groupe, séances réservées passées, rencontres facturables
create or replace function public.family_charges(fam uuid)
returns table (child_id uuid, first_name text, on_date date, label text, amount_dh numeric)
language sql stable security definer set search_path = public as $$
  select x.child_id, x.first_name, x.on_date, x.label, x.amount_dh from (
    select c.id as child_id, c.first_name, s.session_date as on_date, k.name as label,
           public.price_for(c.id, k.id) * (case k.unit when 'heure' then g.duration_min / 60.0 else 1 end) as amount_dh
    from public.attendance a
    join public.sessions s on s.id = a.session_id
    join public.groups g on g.id = s.group_id
    join public.children c on c.id = a.child_id
    join public.catalog k on k.id = public.catalog_for(g.catalog_id, g.kind)
    where a.present and c.family_id = fam
    union all
    select c.id, c.first_name, (sl.starts_at at time zone 'Africa/Casablanca')::date, k.name || coalesce(' · ' || nullif(sl.subject, k.name), ''),
           public.price_for(c.id, k.id) * (case k.unit when 'heure' then sl.duration_min / 60.0 else 1 end)
    from public.bookings b
    join public.slots sl on sl.id = b.slot_id
    join public.children c on c.id = b.child_id
    join public.catalog k on k.id = public.catalog_for(sl.catalog_id, sl.kind)
    where b.status = 'confirme' and sl.starts_at < now() and c.family_id = fam
    union all
    select c.id, c.first_name, (m.meeting_at at time zone 'Africa/Casablanca')::date, k.name || ' · ' || m.title,
           public.price_for(c.id, k.id)
    from public.meeting_attendance ma
    join public.meetings m on m.id = ma.meeting_id
    join public.children c on c.id = ma.child_id
    join public.catalog k on k.id = public.catalog_for(m.catalog_id, 'rencontre')
    where m.billable and m.meeting_at < now() and c.family_id = fam
  ) x
  where public.is_admin() or fam = public.my_family()
  order by x.on_date desc
$$;
grant execute on function public.family_charges(uuid) to authenticated;

create or replace function public.family_balances()
returns table (family_id uuid, parent_name text, paid_dh numeric, charged_dh numeric, balance_dh numeric)
language sql stable security definer set search_path = public as $$
  select f.id, f.parent_name,
         coalesce((select sum(p.amount_dh) from public.payments p where p.family_id = f.id), 0),
         coalesce((select sum(fc.amount_dh) from public.family_charges(f.id) fc), 0),
         coalesce((select sum(p.amount_dh) from public.payments p where p.family_id = f.id), 0) - coalesce((select sum(fc.amount_dh) from public.family_charges(f.id) fc), 0)
  from public.families f
  where public.is_admin()
  order by f.parent_name
$$;
grant execute on function public.family_balances() to authenticated;

-- Rémunération d'un animateur (lui-même ou l'admin) : part du catalogue, jamais le prix payé par la famille
create or replace function public.animateur_earnings(who uuid)
returns table (month text, on_date date, label text, detail text, amount_dh numeric)
language sql stable security definer set search_path = public as $$
  select to_char(x.on_date, 'YYYY-MM') as month, x.on_date, x.label, x.detail, x.amount_dh from (
    select s.session_date as on_date, k.name || ' · ' || g.name as label,
           (select count(*) from public.attendance a where a.session_id = s.id and a.present)::text || ' présent(s)' as detail,
           k.animateur_dh * (case k.unit when 'heure' then g.duration_min / 60.0 else 1 end)
             * (case k.animateur_unit when 'enfant' then (select count(*) from public.attendance a where a.session_id = s.id and a.present) else 1 end) as amount_dh
    from public.sessions s
    join public.groups g on g.id = s.group_id
    join public.catalog k on k.id = public.catalog_for(g.catalog_id, g.kind)
    where coalesce(s.animateur_id, g.animateur_id) = who
      and exists (select 1 from public.attendance a where a.session_id = s.id and a.present)
    union all
    select (sl.starts_at at time zone 'Africa/Casablanca')::date, k.name || coalesce(' · ' || nullif(sl.subject, k.name), ''),
           (select count(*) from public.bookings b where b.slot_id = sl.id and b.status = 'confirme')::text || ' enfant(s) · ' || sl.duration_min || ' min',
           k.animateur_dh * (case k.unit when 'heure' then sl.duration_min / 60.0 else 1 end)
             * (case k.animateur_unit when 'enfant' then (select count(*) from public.bookings b where b.slot_id = sl.id and b.status = 'confirme') else 1 end)
    from public.slots sl
    join public.catalog k on k.id = public.catalog_for(sl.catalog_id, sl.kind)
    where sl.animateur_id = who and sl.starts_at < now()
      and exists (select 1 from public.bookings b where b.slot_id = sl.id and b.status = 'confirme')
  ) x
  where who = auth.uid() or public.is_admin()
  order by x.on_date desc
$$;
grant execute on function public.animateur_earnings(uuid) to authenticated;


-- ---------------------------------------------------------------- Recrutement des animateurs : test en trois étapes
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  level text not null default 'tous' check (level in ('college','lycee','tous')),
  question text not null,
  options jsonb not null,
  correct int not null check (correct between 0 and 3),
  explanation text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_situations (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  level text not null default 'tous' check (level in ('college','lycee','tous')),
  title text not null,
  statement text not null,
  expected text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  subject text not null,
  level text not null,
  experience text,
  status text not null default 'en_cours' check (status in ('en_cours','a_evaluer','retenu','refuse')),
  quiz_total int,
  quiz_score int,
  quiz_answers jsonb,
  situation_id uuid references public.quiz_situations(id) on delete set null,
  video1_path text, video1_link text,
  video2_path text, video2_link text,
  admin_note text,
  decided_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.quiz_questions enable row level security;
alter table public.quiz_situations enable row level security;
alter table public.candidates enable row level security;
drop policy if exists quiz_q_admin on public.quiz_questions;
create policy quiz_q_admin on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists quiz_s_admin on public.quiz_situations;
create policy quiz_s_admin on public.quiz_situations for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists candidates_admin on public.candidates;
create policy candidates_admin on public.candidates for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.quiz_questions, public.quiz_situations, public.candidates to authenticated;

-- Le candidat n'a pas de compte : il avance avec un jeton, par des fonctions qui ne montrent jamais les bonnes réponses
create or replace function public.candidate_start(p_name text, p_email text, p_phone text, p_subject text, p_level text, p_experience text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then raise exception 'Nom et e-mail obligatoires'; end if;
  if (select count(*) from public.candidates where created_at > now() - interval '1 hour') > 50 then raise exception 'Trop de candidatures en ce moment, réessayez plus tard'; end if;
  insert into public.candidates (full_name, email, phone, subject, level, experience)
  values (trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), p_subject, p_level, nullif(trim(p_experience), ''))
  returning token into t;
  return t;
end $$;
grant execute on function public.candidate_start(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.candidate_quiz(p_token uuid)
returns table (id uuid, question text, options jsonb)
language sql stable security definer set search_path = public as $$
  select q.id, q.question, q.options
  from public.quiz_questions q
  join public.candidates c on c.token = p_token
  where q.active and q.subject = c.subject and (q.level = c.level or q.level = 'tous')
  order by random()
  limit 10
$$;
grant execute on function public.candidate_quiz(uuid) to anon, authenticated;

create or replace function public.candidate_quiz_submit(p_token uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare total int := 0; score int := 0; r record;
begin
  if not exists (select 1 from public.candidates where token = p_token and status = 'en_cours') then raise exception 'Candidature introuvable'; end if;
  for r in select (a->>'id')::uuid as qid, (a->>'answer')::int as ans from jsonb_array_elements(p_answers) a loop
    total := total + 1;
    if exists (select 1 from public.quiz_questions q where q.id = r.qid and q.correct = r.ans) then score := score + 1; end if;
  end loop;
  update public.candidates set quiz_total = total, quiz_score = score, quiz_answers = p_answers where token = p_token;
  return jsonb_build_object('score', score, 'total', total);
end $$;
grant execute on function public.candidate_quiz_submit(uuid, jsonb) to anon, authenticated;

create or replace function public.candidate_situation(p_token uuid)
returns table (id uuid, title text, statement text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare c record; sid uuid;
begin
  select * into c from public.candidates ca where ca.token = p_token;
  if c.id is null then raise exception 'Candidature introuvable'; end if;
  sid := c.situation_id;
  if sid is null then
    select s.id into sid from public.quiz_situations s where s.active and s.subject = c.subject and (s.level = c.level or s.level = 'tous') order by (s.level = c.level) desc, random() limit 1;
    update public.candidates ca set situation_id = sid where ca.id = c.id;
  end if;
  return query select s.id, s.title, s.statement from public.quiz_situations s where s.id = sid;
end $$;
grant execute on function public.candidate_situation(uuid) to anon, authenticated;

create or replace function public.candidate_video(p_token uuid, p_step int, p_path text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_step = 1 then update public.candidates set video1_path = nullif(p_path, ''), video1_link = nullif(p_link, '') where token = p_token and status = 'en_cours';
  else update public.candidates set video2_path = nullif(p_path, ''), video2_link = nullif(p_link, '') where token = p_token and status = 'en_cours'; end if;
end $$;
grant execute on function public.candidate_video(uuid, int, text, text) to anon, authenticated;

create or replace function public.candidate_finish(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update public.candidates set status = 'a_evaluer', submitted_at = now() where token = p_token and status = 'en_cours'
$$;
grant execute on function public.candidate_finish(uuid) to anon, authenticated;

-- Vidéos des candidats : bucket privé, dépôt anonyme limité (80 Mo, vidéo), lecture par l'administration seulement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidatures', 'candidatures', false, 83886080, array['video/webm','video/mp4','video/quicktime','video/x-matroska'])
on conflict (id) do update set public = false, file_size_limit = 83886080, allowed_mime_types = array['video/webm','video/mp4','video/quicktime','video/x-matroska'];
drop policy if exists candidatures_upload on storage.objects;
create policy candidatures_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'candidatures');
drop policy if exists candidatures_admin_read on storage.objects;
create policy candidatures_admin_read on storage.objects for select to authenticated using (bucket_id = 'candidatures' and public.is_admin());
drop policy if exists candidatures_admin_delete on storage.objects;
create policy candidatures_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'candidatures' and public.is_admin());

-- Questions et situations de départ (à compléter dans l'application, onglet Recrutement)
insert into public.quiz_questions (subject, level, question, options, correct, explanation)
select * from (values
  ('Mathématiques', 'college', 'Résoudre 3x − 7 = 11.', '["x = 6","x = 4","x = −6","x = 18"]'::jsonb, 0, '3x = 18 donc x = 6.'),
  ('Mathématiques', 'college', 'Le PGCD de 36 et 48 est :', '["6","12","24","144"]'::jsonb, 1, '36 = 12 × 3 et 48 = 12 × 4.'),
  ('Mathématiques', 'college', 'Développer (x + 3)².', '["x² + 9","x² + 6x + 9","x² + 3x + 9","2x + 6"]'::jsonb, 1, 'Identité remarquable : a² + 2ab + b².'),
  ('Mathématiques', 'college', 'Un triangle a des côtés de 5, 12 et 13 cm. Il est :', '["rectangle","équilatéral","isocèle non rectangle","impossible à construire"]'::jsonb, 0, '5² + 12² = 169 = 13² (réciproque de Pythagore).'),
  ('Mathématiques', 'college', '15 % de 240 font :', '["24","36","15","48"]'::jsonb, 1, '240 × 0,15 = 36.'),
  ('Mathématiques', 'college', 'La médiane de la série 3 ; 7 ; 8 ; 12 ; 20 est :', '["7","8","10","12"]'::jsonb, 1, 'Valeur centrale d''une série ordonnée de 5 valeurs.'),
  ('Mathématiques', 'lycee', 'La dérivée de f(x) = x³ − 2x est :', '["3x² − 2","3x²","x² − 2","3x² − 2x"]'::jsonb, 0, 'Dérivée terme à terme.'),
  ('Mathématiques', 'lycee', 'Les solutions de x² − 5x + 6 = 0 sont :', '["2 et 3","−2 et −3","1 et 6","−1 et 6"]'::jsonb, 0, 'Somme 5, produit 6.'),
  ('Mathématiques', 'lycee', 'La limite en +∞ de (2x² + 1)/(x² − 3) vaut :', '["0","1","2","+∞"]'::jsonb, 2, 'Rapport des termes de plus haut degré.'),
  ('Mathématiques', 'lycee', 'On lance deux fois une pièce équilibrée. La probabilité d''obtenir deux fois pile est :', '["1/2","1/3","1/4","1/8"]'::jsonb, 2, '(1/2) × (1/2).'),
  ('Mathématiques', 'lycee', 'Suite géométrique : u(n+1) = 3·u(n) et u(0) = 2. Alors u(3) vaut :', '["18","54","27","6"]'::jsonb, 1, 'u(3) = 2 × 3³ = 54.'),
  ('Mathématiques', 'lycee', 'ln(e²) vaut :', '["e","2","2e","1"]'::jsonb, 1, 'ln et exp sont réciproques.'),
  ('Physique-chimie', 'college', 'L''unité de l''intensité du courant électrique est :', '["le volt","l''ohm","l''ampère","le watt"]'::jsonb, 2, 'Le volt mesure la tension, l''ohm la résistance.'),
  ('Physique-chimie', 'college', 'La masse volumique de l''eau liquide vaut environ :', '["1 g/cm³","10 g/cm³","0,1 g/cm³","100 g/cm³"]'::jsonb, 0, '1 kg par litre.'),
  ('Physique-chimie', 'college', 'La loi d''Ohm s''écrit :', '["U = R × I","U = R / I","I = U × R","R = U × I"]'::jsonb, 0, 'Tension = résistance × intensité.'),
  ('Physique-chimie', 'college', 'La formule chimique de l''eau est :', '["HO","H₂O","H₂O₂","OH₂"]'::jsonb, 1, 'Deux atomes d''hydrogène, un d''oxygène.'),
  ('Physique-chimie', 'college', 'Un coureur parcourt 100 m en 20 s. Sa vitesse moyenne est :', '["2 m/s","5 m/s","20 m/s","2 000 m/s"]'::jsonb, 1, 'v = d / t.'),
  ('Physique-chimie', 'college', 'Un objet flotte dans un liquide si :', '["sa masse est faible","sa masse volumique est inférieure à celle du liquide","son volume est petit","il est creux, quelle que soit sa masse"]'::jsonb, 1, 'Comparaison des masses volumiques.'),
  ('Physique-chimie', 'lycee', 'La deuxième loi de Newton s''écrit :', '["ΣF = m × a","ΣF = m / a","ΣF = m × v","ΣF = a / m"]'::jsonb, 0, 'Somme des forces = masse × accélération.'),
  ('Physique-chimie', 'lycee', 'L''énergie cinétique d''un solide en translation vaut :', '["m × v","½ m v²","m v²","½ m v"]'::jsonb, 1, 'Ec = ½ m v².'),
  ('Physique-chimie', 'lycee', 'Le pH d''une solution d''acide chlorhydrique à 10⁻³ mol/L est :', '["1","3","7","11"]'::jsonb, 1, 'Acide fort : pH = −log(c).'),
  ('Physique-chimie', 'lycee', 'Une onde de période 2 ms a pour fréquence :', '["2 Hz","50 Hz","500 Hz","2 000 Hz"]'::jsonb, 2, 'f = 1 / T = 1 / 0,002 s.'),
  ('Physique-chimie', 'lycee', 'Quantité de matière dans 36 g d''eau (M = 18 g/mol) :', '["0,5 mol","1 mol","2 mol","18 mol"]'::jsonb, 2, 'n = m / M.'),
  ('Physique-chimie', 'lycee', 'En chute libre (sans frottement), l''accélération d''un objet :', '["dépend de sa masse","vaut g ≈ 9,8 m/s² quelle que soit sa masse","est nulle","dépend de sa forme"]'::jsonb, 1, 'Seul le poids agit : a = g.'),
  ('Robotique et programmation', 'tous', 'Une boucle « répéter tant que » sert à :', '["exécuter des instructions tant qu''une condition est vraie","exécuter une instruction une seule fois","arrêter le programme","déclarer une variable"]'::jsonb, 0, 'Boucle conditionnelle.'),
  ('Robotique et programmation', 'tous', 'Un capteur de distance à ultrasons mesure :', '["la lumière réfléchie","le temps aller-retour d''une onde sonore","la température de l''obstacle","le poids de l''obstacle"]'::jsonb, 1, 'Distance = vitesse du son × temps / 2.'),
  ('Robotique et programmation', 'tous', 'Ce qui distingue un servomoteur d''un moteur à courant continu simple :', '["il tourne plus vite","il peut se positionner à un angle donné","il n''a pas besoin d''alimentation","il ne peut pas tourner"]'::jsonb, 1, 'Asservissement en position.'),
  ('Robotique et programmation', 'tous', 'Sur Arduino, digitalWrite(13, HIGH) :', '["lit la broche 13","met la broche 13 à l''état haut (5 V)","éteint la carte","déclare la broche 13 en entrée"]'::jsonb, 1, 'Sortie numérique à l''état haut.'),
  ('Robotique et programmation', 'tous', 'Pour alimenter une LED sur une sortie 5 V, on ajoute :', '["un condensateur en parallèle","une résistance en série pour limiter le courant","rien, la LED se régule seule","un second fil de masse"]'::jsonb, 1, 'Sans résistance, la LED grille.'),
  ('Robotique et programmation', 'tous', 'Dans un algorithme, une variable sert à :', '["mémoriser une valeur qui peut changer","afficher du texte","répéter une action","arrêter le programme"]'::jsonb, 0, 'Une case mémoire nommée.')
) as v(subject, level, question, options, correct, explanation)
where not exists (select 1 from public.quiz_questions);

insert into public.quiz_situations (subject, level, title, statement, expected)
select * from (values
  ('Mathématiques', 'college', 'Deux copies à corriger', 'Un élève de 3e écrit : « (x + 2)² = x² + 4 ». Plus loin, pour résoudre 2x + 6 = 10, il écrit : « x = 10 − 6 × 2 = −2 ». Repérez les erreurs et expliquez-les à l''oral comme vous le feriez face à lui.', 'Oubli du double produit : (x + 2)² = x² + 4x + 4. Erreur de priorité : 2x = 4 donc x = 2 (on isole avant de diviser).'),
  ('Mathématiques', 'lycee', 'Dérivée et équation', 'Un élève de 1re dérive f(x) = x·eˣ et obtient f''(x) = eˣ. Pour résoudre x² = 9, il répond « x = 3 ». Repérez les erreurs et expliquez-les à l''oral.', 'Dérivée d''un produit : f''(x) = eˣ + x·eˣ = (x + 1)eˣ. Deux solutions : 3 et −3.'),
  ('Physique-chimie', 'college', 'Vitesse et chute', 'Un élève de 4e calcule la vitesse d''une voiture qui parcourt 150 km en 2 h 30 : « v = 150 / 2,30 = 65,2 km/h ». Il affirme aussi qu''« un objet de 1 kg tombe deux fois plus vite qu''un objet de 500 g ». Repérez les erreurs et expliquez-les.', '2 h 30 = 2,5 h, donc 60 km/h. En l''absence de frottements, la chute ne dépend pas de la masse.'),
  ('Physique-chimie', 'lycee', 'Force et énergie', 'Un élève de Terminale écrit pour un mobile de 2 kg soumis à une force résultante de 10 N : « a = F × m = 20 m/s² ». Il écrit ensuite « Ec = m·v² ». Repérez les erreurs et expliquez-les.', 'a = F / m = 5 m/s². Ec = ½ m v².'),
  ('Robotique et programmation', 'tous', 'Le robot fonce dans le mur', 'Un élève veut que son robot avance et s''arrête à 10 cm d''un mur. Il programme : « si distance < 10 alors avancer, sinon s''arrêter ». Le robot fonce dans le mur. Expliquez ce qui ne va pas et comment vous l''amèneriez à corriger.', 'Condition inversée : avancer tant que distance > 10, s''arrêter sinon ; le test doit être répété dans une boucle, pas évalué une seule fois.')
) as v(subject, level, title, statement, expected)
where not exists (select 1 from public.quiz_situations);

grant usage on schema public to anon, authenticated;
grant insert on public.waitlist to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.child_progress to authenticated;

-- ---------------------------------------------------------------- Premier administrateur
-- Crée d'abord ton compte dans Authentication > Users > Add user avec cette adresse, puis exécute :
update public.profiles set role = 'admin' where lower(email) = lower('bibotyassine4@gmail.com');
