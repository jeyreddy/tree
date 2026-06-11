-- Run this in your Supabase SQL Editor (https://supabase.com → SQL Editor)
-- This creates the two tables needed for Kula Vruksham

-- Families table
create table families (
  id text primary key,
  name text not null,
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
