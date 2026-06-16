-- Run this in your Supabase SQL Editor (https://supabase.com → SQL Editor)
-- This creates the two tables needed for Kula Vruksham

-- Families table
create table families (
  id text primary key,
  name text not null,
  language text default 'english',
  created_at timestamp with time zone default now()
);

-- Persons table
create table persons (
  id text primary key,
  family_id text references families(id) on delete cascade,
  name text not null,
  clan text default '',
  gender text default 'M',
  status text default 'alive',
  generation integer default 0,
  parent_id text,
  spouse_id text,
  location text default '',
  native_place text default '',
  gotra text default '',
  languages text[] default '{}',
  occupation jsonb default '{"role":"","company":""}',
  education jsonb default '[]',
  profiles jsonb default '{"linkedin":"","facebook":"","instagram":"","whatsapp":""}',
  phone text default '',
  address text default '',
  role text default '',
  notes text default '',
  verified boolean default false,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security but allow public access (no auth needed)
alter table families enable row level security;
alter table persons enable row level security;

-- Allow anyone to read and write (shared family tool, no login)
create policy "Public read families" on families for select using (true);
create policy "Public insert families" on families for insert with check (true);
create policy "Public update families" on families for update using (true);
create policy "Public delete families" on families for delete using (true);

create policy "Public read persons" on persons for select using (true);
create policy "Public insert persons" on persons for insert with check (true);
create policy "Public update persons" on persons for update using (true);
create policy "Public delete persons" on persons for delete using (true);

-- Index for fast family lookups
create index idx_persons_family on persons(family_id);
create index idx_persons_parent on persons(parent_id);

-- Migration: add language column to existing databases
-- Run this if your families table already exists:
-- alter table families add column if not exists language text default 'english';

-- ── Migration 2026-06-15: attribution + knowledge referrals ──
-- Run these in Supabase SQL Editor if tables already exist:

-- ALTER TABLE persons ADD COLUMN added_by text DEFAULT '';
-- ALTER TABLE persons ADD COLUMN last_edited_by text DEFAULT '';

-- CREATE TABLE referrals (
--   id text PRIMARY KEY,
--   family_id text REFERENCES families(id) ON DELETE CASCADE,
--   source_person_id text NOT NULL,
--   target_person_id text NOT NULL,
--   note text DEFAULT '',
--   added_by text DEFAULT '',
--   created_at timestamp with time zone DEFAULT now()
-- );
-- ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read referrals" ON referrals FOR SELECT USING (true);
-- CREATE POLICY "Public insert referrals" ON referrals FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Public update referrals" ON referrals FOR UPDATE USING (true);
-- CREATE POLICY "Public delete referrals" ON referrals FOR DELETE USING (true);
-- CREATE INDEX idx_referrals_family ON referrals(family_id);
-- CREATE INDEX idx_referrals_target ON referrals(target_person_id);

-- ── Migration 2026-06-15: birth year and death year ──
-- ALTER TABLE persons ADD COLUMN birth_year integer;
-- ALTER TABLE persons ADD COLUMN death_year integer;

-- ── Migration 2026-06-15: family historian ──
-- ALTER TABLE families ADD COLUMN historian text DEFAULT '';
-- ALTER TABLE families ADD COLUMN historian_name text DEFAULT '';
