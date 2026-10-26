-- Migration du 26 octobre 2026 (soir) : catalogue de prestations avec tarif par enfant, facturation des rencontres
-- métiers, et recrutement des animateurs (test en trois étapes : QCM, vidéo de présentation, vidéo de situation).
-- Rejouable sans risque. Remplace la table « rates » du matin par le catalogue.

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

drop table if exists public.rates;

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

select 'migration catalogue et recrutement appliquée' as resultat;
