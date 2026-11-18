create table public.warehouses (
  id text primary key,
  name text not null,
  location text,
  created_at timestamptz not null default now(),
  constraint warehouses_id_format check (id ~ '^[A-Z]{1,8}[0-9]+$'),
  constraint warehouses_name_not_blank check (btrim(name) <> '')
);

create unique index warehouses_name_key on public.warehouses (lower(btrim(name)));

create table public.user_warehouses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  warehouse_id text not null references public.warehouses (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, warehouse_id)
);

create index user_warehouses_warehouse_id_idx on public.user_warehouses (warehouse_id);

alter table public.warehouses enable row level security;
alter table public.user_warehouses enable row level security;

create policy warehouses_select_admin
  on public.warehouses
  for select
  to authenticated
  using ((select public.is_admin()));

create policy warehouses_select_assigned
  on public.warehouses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_warehouses uw
      where uw.warehouse_id = warehouses.id
        and uw.user_id = (select auth.uid())
    )
  );

create policy user_warehouses_select_own
  on public.user_warehouses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_warehouses_select_admin
  on public.user_warehouses
  for select
  to authenticated
  using ((select public.is_admin()));
