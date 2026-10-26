-- Migration du 26 octobre 2026 : paiements des familles (saisis par l'administration), tarifs, solde par famille,
-- rémunération mensuelle des animateurs (ils voient leur solde, jamais ce que paient les familles). Rejouable sans risque.

-- Tarifs : ce que paie la famille par enfant, ce que reçoit l'animateur. Unité : par séance (groupes) ou par heure (créneaux).
create table if not exists public.rates (
  kind text primary key check (kind in ('atelier','cours','essai','individuel','rattrapage')),
  label text not null,
  unit text not null default 'seance' check (unit in ('seance','heure')),
  price_dh numeric(10,2) not null default 0,
  animateur_dh numeric(10,2) not null default 0,
  animateur_unit text not null default 'seance' check (animateur_unit in ('seance','enfant'))
);
insert into public.rates (kind, label, unit, price_dh, animateur_dh, animateur_unit) values
  ('atelier', 'Atelier (séance de 2 h)', 'seance', 225, 250, 'seance'),
  ('cours', 'Cours (séance de 1 h 30)', 'seance', 200, 200, 'seance'),
  ('essai', 'Séance d''essai', 'heure', 0, 0, 'enfant'),
  ('individuel', 'Séance individuelle', 'heure', 250, 125, 'enfant'),
  ('rattrapage', 'Rattrapage', 'heure', 250, 125, 'enfant')
on conflict (kind) do nothing;

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

alter table public.rates enable row level security;
alter table public.payments enable row level security;
drop policy if exists rates_read on public.rates;
create policy rates_read on public.rates for select to authenticated using (true);
drop policy if exists rates_admin on public.rates;
create policy rates_admin on public.rates for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists payments_parent on public.payments;
create policy payments_parent on public.payments for select to authenticated using (family_id = public.my_family());
grant select, insert, update, delete on public.rates, public.payments to authenticated;

-- Consommation d'une famille : chaque présence en groupe et chaque séance réservée passée, au tarif en vigueur.
create or replace function public.family_charges(fam uuid)
returns table (child_id uuid, first_name text, on_date date, label text, amount_dh numeric)
language sql stable security definer set search_path = public as $$
  select x.child_id, x.first_name, x.on_date, x.label, x.amount_dh from (
    select c.id as child_id, c.first_name, s.session_date as on_date,
           (case g.kind when 'cours' then 'Cours ' else 'Atelier ' end) || g.name as label,
           r.price_dh as amount_dh
    from public.attendance a
    join public.sessions s on s.id = a.session_id
    join public.groups g on g.id = s.group_id
    join public.children c on c.id = a.child_id
    join public.rates r on r.kind = g.kind
    where a.present and c.family_id = fam
    union all
    select c.id, c.first_name, (sl.starts_at at time zone 'Africa/Casablanca')::date,
           r.label || coalesce(' · ' || sl.subject, ''),
           round(r.price_dh * sl.duration_min / 60.0, 2)
    from public.bookings b
    join public.slots sl on sl.id = b.slot_id
    join public.children c on c.id = b.child_id
    join public.rates r on r.kind = sl.kind
    where b.status = 'confirme' and sl.starts_at < now() and c.family_id = fam
  ) x
  where public.is_admin() or fam = public.my_family()
  order by x.on_date desc
$$;
grant execute on function public.family_charges(uuid) to authenticated;

-- Solde de toutes les familles (administration) : payé, consommé, solde
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

-- Rémunération d'un animateur, ligne par ligne (lui-même ou l'administration) : séances de groupe animées, créneaux passés.
create or replace function public.animateur_earnings(who uuid)
returns table (month text, on_date date, label text, detail text, amount_dh numeric)
language sql stable security definer set search_path = public as $$
  select to_char(x.on_date, 'YYYY-MM') as month, x.on_date, x.label, x.detail, x.amount_dh from (
    select s.session_date as on_date,
           (case g.kind when 'cours' then 'Cours ' else 'Atelier ' end) || g.name as label,
           (select count(*) from public.attendance a where a.session_id = s.id and a.present)::text || ' présent(s)' as detail,
           (case r.animateur_unit when 'seance' then r.animateur_dh else r.animateur_dh * (select count(*) from public.attendance a where a.session_id = s.id and a.present) end) as amount_dh
    from public.sessions s
    join public.groups g on g.id = s.group_id
    join public.rates r on r.kind = g.kind
    where coalesce(s.animateur_id, g.animateur_id) = who
      and exists (select 1 from public.attendance a where a.session_id = s.id and a.present)
    union all
    select (sl.starts_at at time zone 'Africa/Casablanca')::date,
           r.label || coalesce(' · ' || sl.subject, ''),
           (select count(*) from public.bookings b where b.slot_id = sl.id and b.status = 'confirme')::text || ' enfant(s) · ' || sl.duration_min || ' min',
           (case r.animateur_unit when 'seance' then r.animateur_dh * sl.duration_min / 60.0 else r.animateur_dh * sl.duration_min / 60.0 * (select count(*) from public.bookings b where b.slot_id = sl.id and b.status = 'confirme') end)
    from public.slots sl
    join public.rates r on r.kind = sl.kind
    where sl.animateur_id = who and sl.starts_at < now()
      and exists (select 1 from public.bookings b where b.slot_id = sl.id and b.status = 'confirme')
  ) x
  where who = auth.uid() or public.is_admin()
  order by x.on_date desc
$$;
grant execute on function public.animateur_earnings(uuid) to authenticated;

select 'migration paiements appliquée' as resultat;
