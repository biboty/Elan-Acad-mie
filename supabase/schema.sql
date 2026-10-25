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

grant usage on schema public to anon, authenticated;
grant insert on public.waitlist to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.child_progress to authenticated;

-- ---------------------------------------------------------------- Premier administrateur
-- Crée d'abord ton compte dans l'application (bouton « Créer un compte ») avec cette adresse, puis exécute :
update public.profiles set role = 'admin' where lower(email) = lower('bibotyassine4@gmail.com');
