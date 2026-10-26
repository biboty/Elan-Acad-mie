-- Migration du 26 octobre 2026 : salle de classe en ligne (lien de visio, heure, notes partagées par séance).
alter table public.sessions add column if not exists start_time text;
alter table public.sessions add column if not exists meeting_url text;
alter table public.sessions add column if not exists notes text;
select 'migration visio appliquée' as resultat;
alter table public.groups add column if not exists meeting_url text;
