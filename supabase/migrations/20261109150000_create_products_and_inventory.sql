alter table public.warehouses
  add column is_archived boolean not null default false,
  add column archived_at timestamptz;

drop policy warehouses_select_assigned on public.warehouses;

create policy warehouses_select_assigned
  on public.warehouses
  for select
  to authenticated
  using (
    not is_archived
    and exists (
      select 1
      from public.user_warehouses uw
      where uw.warehouse_id = warehouses.id
        and uw.user_id = (select auth.uid())
    )
  );

create table public.products (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint products_code_format check (code ~ '^[A-Z0-9-]{1,30}$'),
  constraint products_name_not_blank check (btrim(name) <> '')
);

create table public.warehouse_products (
  warehouse_id text not null references public.warehouses (id) on delete restrict,
  product_code text not null references public.products (code) on delete restrict,
  base_price_usd numeric(12, 2) not null,
  stock integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (warehouse_id, product_code),
  constraint warehouse_products_price_positive check (base_price_usd > 0),
  constraint warehouse_products_stock_not_negative check (stock >= 0)
);

create index warehouse_products_product_code_idx on public.warehouse_products (product_code);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id text not null references public.warehouses (id) on delete restrict,
  product_code text not null references public.products (code) on delete restrict,
  movement_type text not null,
  quantity integer not null,
  stock_after integer not null,
  observation text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_type_valid check (movement_type in ('entry', 'exit', 'transfer', 'adjustment', 'invoice_exit')),
  constraint stock_movements_quantity_not_zero check (quantity <> 0),
  constraint stock_movements_stock_after_not_negative check (stock_after >= 0)
);

create index stock_movements_warehouse_created_idx on public.stock_movements (warehouse_id, created_at desc);

alter table public.products enable row level security;
alter table public.warehouse_products enable row level security;
alter table public.stock_movements enable row level security;

create policy products_select_admin
  on public.products
  for select
  to authenticated
  using ((select public.is_admin()));

create policy warehouse_products_select_admin
  on public.warehouse_products
  for select
  to authenticated
  using ((select public.is_admin()));

create policy stock_movements_select_admin
  on public.stock_movements
  for select
  to authenticated
  using ((select public.is_admin()));

create function public.register_product(
  p_warehouse_id text,
  p_code text,
  p_name text,
  p_base_price numeric,
  p_stock integer,
  p_user_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_code text := p_code;
  v_existing_name text;
  v_old_stock integer;
begin
  perform pg_advisory_xact_lock(hashtext('products_code_sequence'));

  if v_code is null then
    select 'PRD-' || lpad((coalesce(max(substring(code from 5)::integer), 0) + 1)::text, 6, '0')
      into v_code
      from public.products
      where code ~ '^PRD-[0-9]{6}$';
  end if;

  select name into v_existing_name from public.products where code = v_code;
  if v_existing_name is null then
    insert into public.products (code, name) values (v_code, p_name);
  elsif lower(btrim(v_existing_name)) <> lower(btrim(p_name)) then
    raise exception 'NAME_MISMATCH';
  end if;

  perform 1
    from public.warehouse_products
    where warehouse_id = p_warehouse_id and product_code = v_code and deleted_at is null;
  if found then
    raise exception 'DUPLICATE_IN_WAREHOUSE';
  end if;

  select stock into v_old_stock
    from public.warehouse_products
    where warehouse_id = p_warehouse_id and product_code = v_code;

  insert into public.warehouse_products (warehouse_id, product_code, base_price_usd, stock, deleted_at)
  values (p_warehouse_id, v_code, p_base_price, p_stock, null)
  on conflict (warehouse_id, product_code)
  do update set base_price_usd = excluded.base_price_usd, stock = excluded.stock, deleted_at = null;

  if v_old_stock is null then
    if p_stock > 0 then
      insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
      values (p_warehouse_id, v_code, 'entry', p_stock, p_stock, 'Stock inicial', p_user_id);
    end if;
  elsif p_stock <> v_old_stock then
    insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
    values (p_warehouse_id, v_code, 'adjustment', p_stock - v_old_stock, p_stock, 'Reactivado en el inventario', p_user_id);
  end if;

  return v_code;
end;
$$;

create function public.set_warehouse_stock(
  p_warehouse_id text,
  p_code text,
  p_new_stock integer,
  p_user_id uuid,
  p_observation text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_old_stock integer;
begin
  if p_new_stock < 0 then
    raise exception 'NEGATIVE_STOCK';
  end if;

  select stock into v_old_stock
    from public.warehouse_products
    where warehouse_id = p_warehouse_id and product_code = p_code and deleted_at is null
    for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if p_new_stock <> v_old_stock then
    update public.warehouse_products
      set stock = p_new_stock
      where warehouse_id = p_warehouse_id and product_code = p_code;
    insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
    values (p_warehouse_id, p_code, 'adjustment', p_new_stock - v_old_stock, p_new_stock, p_observation, p_user_id);
  end if;

  return p_new_stock;
end;
$$;

revoke execute on function public.register_product(text, text, text, numeric, integer, uuid) from public, anon, authenticated;
revoke execute on function public.set_warehouse_stock(text, text, integer, uuid, text) from public, anon, authenticated;
