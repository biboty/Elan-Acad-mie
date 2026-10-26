-- Migration du 26 octobre 2026 (nuit) : sauvegarde (date de la dernière), rappels, devoirs visibles par les familles,
-- documents signés par famille. Rejouable sans risque.
alter table public.profiles add column if not exists last_backup_at timestamptz;
alter table public.sessions add column if not exists homework text;
alter table public.slots add column if not exists homework text;
alter table public.families add column if not exists doc_protocol_at date;
alter table public.families add column if not exists doc_photo_at date;
alter table public.families add column if not exists doc_photo_refused boolean not null default false;
alter table public.families add column if not exists doc_rules_at date;

-- Devoirs faits : coché par la famille (ref_id = séance de groupe ou créneau réservé)
create table if not exists public.homework_done (
  ref_id uuid not null,
  child_id uuid not null references public.children(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (ref_id, child_id)
);
alter table public.homework_done enable row level security;
drop policy if exists homework_done_admin on public.homework_done;
create policy homework_done_admin on public.homework_done for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists homework_done_parent on public.homework_done;
create policy homework_done_parent on public.homework_done for all to authenticated using (public.is_parent_of_child(child_id)) with check (public.is_parent_of_child(child_id));
drop policy if exists homework_done_animateur on public.homework_done;
create policy homework_done_animateur on public.homework_done for select to authenticated using (public.is_animateur_of_child(child_id));
grant select, insert, update, delete on public.homework_done to authenticated;

select 'migration rappels, devoirs et documents appliquée' as resultat;
