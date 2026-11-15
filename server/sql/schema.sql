-- SafeAssembly schema. Paste into Supabase -> SQL Editor -> Run. Safe to run once on a fresh project.
-- Matches the dev plan (Step 1.1 / 1.2) with three small additions, marked ADDED.

create table events (id uuid primary key default gen_random_uuid(), name text, location text,
  start_time timestamptz, expected_size int, facts_json jsonb, status text default 'live');

create table zones (id text primary key, event_id uuid references events, name text,
  capacity_level int default 1, has_exit boolean default false, polygon_json jsonb);

create table volunteers (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  role text check (role in ('marshal','medic','legal_observer')), callsign text,
  zone_id text references zones, status text default 'free');

create table reports (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  zone_id text references zones, type text check (type in ('crowd','medical','blocked_exit','other')),
  level int check (level between 1 and 5), note text, created_at timestamptz default now());

create table signals (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  source text check (source in ('weather','transit','social')), payload_json jsonb,
  processed boolean default false, created_at timestamptz default now());

create table alerts (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  zone_id text, risk_type text, severity int, explanation text, status text default 'open',
  created_at timestamptz default now());

create table assignments (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  volunteer_id uuid references volunteers, zone_id text, instruction text, alert_id uuid references alerts,
  acknowledged boolean default false, created_at timestamptz default now(),
  kind text default 'move' check (kind in ('move','hold')));               -- ADDED: 'hold' = stay and hold the line

create table drafts (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  kind text check (kind in ('correction','announcement','escalation_911')), body_en text, body_fr text,
  reason text, source_text text, status text default 'pending', decided_at timestamptz,
  created_at timestamptz default now(),
  meta jsonb default '{}'::jsonb,                                            -- ADDED: verdict, harm, priority, shares
  alert_id uuid references alerts);                                          -- ADDED: links 911 drafts to their alert

create table agent_log (id uuid primary key default gen_random_uuid(), event_id uuid references events,
  agent text, action text, summary text, input_ref text, output_json jsonb,
  created_at timestamptz default now());

-- Realtime: every phone gets live inserts/updates/deletes on these tables.
alter publication supabase_realtime
  add table events, zones, reports, alerts, assignments, drafts, agent_log, volunteers, signals;

-- Row-level security (hackathon-safe version).
-- Phones may READ everything and INSERT reports / acknowledge assignments only.
-- Everything else is written by the server with the service-role key (which bypasses RLS).
do $$ declare t text; begin
  foreach t in array array['events','zones','volunteers','reports','signals','alerts',
                           'assignments','drafts','agent_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read all" on %I for select using (true)', t);
  end loop; end $$;
create policy "marshals insert reports" on reports for insert with check (true);
create policy "marshal ack" on assignments for update using (true) with check (true);
