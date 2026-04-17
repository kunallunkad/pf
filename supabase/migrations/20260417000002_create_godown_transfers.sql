create table if not exists godown_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  transfer_date date not null,
  from_godown_id uuid references godowns(id),
  from_godown_name text not null default '',
  to_godown_id uuid references godowns(id),
  to_godown_name text not null default '',
  reason text,
  notes text,
  status text not null default 'completed',
  total_items integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists godown_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid references godown_transfers(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  unit text not null default 'pcs',
  quantity numeric not null default 0,
  created_at timestamptz default now()
);

alter table godown_transfers enable row level security;
alter table godown_transfer_items enable row level security;

create policy "Allow all for authenticated" on godown_transfers for all to authenticated using (true) with check (true);
create policy "Allow all for authenticated" on godown_transfer_items for all to authenticated using (true) with check (true);
