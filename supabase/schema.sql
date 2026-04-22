-- Atlas of Living Mythologies — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists myth_nodes (
  id          text primary key,
  label       text not null,
  type        text not null check (type in ('deity','hero','artifact','realm','event')),
  era         text not null,
  summary     text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists myth_edges (
  id          text primary key,
  source      text not null references myth_nodes(id) on delete cascade,
  target      text not null references myth_nodes(id) on delete cascade,
  relation    text not null,
  weight      integer not null default 1 check (weight between 1 and 5),
  created_at  timestamptz not null default now()
);

-- ─── Row-Level Security ─────────────────────────────────────────────────────

alter table myth_nodes enable row level security;
alter table myth_edges enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on table myth_nodes to anon, authenticated;
grant select, insert on table myth_edges to anon, authenticated;

-- Public read access (anon key can read, no auth required)
drop policy if exists "Public read nodes" on myth_nodes;
create policy "Public read nodes"
  on myth_nodes for select
  using (true);

drop policy if exists "Public read edges" on myth_edges;
create policy "Public read edges"
  on myth_edges for select
  using (true);

-- Public insert access (anon key can insert)
drop policy if exists "Public insert nodes" on myth_nodes;
create policy "Public insert nodes"
  on myth_nodes for insert
  with check (true);

drop policy if exists "Public insert edges" on myth_edges;
create policy "Public insert edges"
  on myth_edges for insert
  with check (true);

-- ─── Seed data ──────────────────────────────────────────────────────────────

insert into myth_nodes (id, label, type, era, summary) values
  ('n-aetherion',    'Aetherion',           'deity',    'Dawn Age',    'A storm-forger deity said to tune thunder into prophecies.'),
  ('n-sylvar',       'Sylvar of Reed',       'hero',     'Bronze Tide', 'A navigator-hero who crossed a sea that shifted each moon.'),
  ('n-lumen-vein',   'Lumen Vein',           'artifact', 'Dawn Age',    'Crystal spindle that stores memory as songs.'),
  ('n-ember-gate',   'Ember Gate',           'realm',    'Iron Bloom',  'Volcanic citadel where oaths are measured in ash.'),
  ('n-night-harvest','Night Harvest',        'event',    'Iron Bloom',  'A nine-day eclipse during which stars fell into rivers.'),
  ('n-mirea',        'Mirea Threadkeeper',   'hero',     'Glass Epoch', 'Archivist who weaves biographies into ceremonial cloth.')
on conflict (id) do nothing;

insert into myth_edges (id, source, target, relation, weight) values
  ('e-1', 'n-aetherion',     'n-lumen-vein',    'forged',     4),
  ('e-2', 'n-sylvar',        'n-lumen-vein',    'sought',     3),
  ('e-3', 'n-sylvar',        'n-ember-gate',    'entered',    2),
  ('e-4', 'n-night-harvest', 'n-ember-gate',    'reshaped',   5),
  ('e-5', 'n-mirea',         'n-night-harvest', 'documented', 3),
  ('e-6', 'n-aetherion',     'n-sylvar',        'anointed',   2)
on conflict (id) do nothing;
