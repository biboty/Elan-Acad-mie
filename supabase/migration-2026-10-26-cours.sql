-- Migration du 26 octobre 2026 : groupes de cours (mathématiques, physique), classe de l'enfant, progression par type.
-- À exécuter une fois sur une base créée avant cette date. Une base neuve n'en a pas besoin : schema.sql contient déjà tout.

alter table public.groups add column if not exists kind text not null default 'atelier';
alter table public.groups drop constraint if exists groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('atelier','cours'));
alter table public.groups drop constraint if exists groups_level_check;
alter table public.groups add constraint groups_level_check check (level in ('explorateurs','batisseurs','argumentateurs','decideurs','college','lycee'));
alter table public.children add column if not exists course_group_id uuid references public.groups(id) on delete set null;
alter table public.children add column if not exists course_sessions_planned int not null default 30;
alter table public.children add column if not exists school_class text;

create or replace function public.is_animateur_of_child(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.children ch join public.groups g on g.id = ch.group_id or g.id = ch.course_group_id where ch.id = c and g.animateur_id = auth.uid())
$$;

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
grant select on public.child_progress to authenticated;

drop policy if exists families_animateur on public.families;
create policy families_animateur on public.families for select to authenticated using (
  public.my_role() = 'animateur' and exists (select 1 from public.children c join public.groups g on g.id = c.group_id or g.id = c.course_group_id where c.family_id = families.id and g.animateur_id = auth.uid())
);
drop policy if exists groups_parent on public.groups;
create policy groups_parent on public.groups for select to authenticated using (
  exists (select 1 from public.children c where (c.group_id = groups.id or c.course_group_id = groups.id) and c.family_id = public.my_family())
);
drop policy if exists children_animateur_select on public.children;
drop policy if exists children_animateur_update on public.children;
create policy children_animateur_select on public.children for select to authenticated using (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id));
create policy children_animateur_update on public.children for update to authenticated using (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id)) with check (public.is_animateur_of_group(group_id) or public.is_animateur_of_group(course_group_id));
drop policy if exists sessions_parent on public.sessions;
create policy sessions_parent on public.sessions for select to authenticated using (
  exists (select 1 from public.children c where (c.group_id = sessions.group_id or c.course_group_id = sessions.group_id) and c.family_id = public.my_family())
);

select 'migration cours appliquée' as resultat, (select count(*) from pg_policies where schemaname = 'public') as policies;
