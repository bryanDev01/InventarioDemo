create or replace function public.register_product(
  p_warehouse_id text,
  p_code text default null,
  p_name text default null,
  p_base_price numeric default null,
  p_stock integer default null,
  p_user_id uuid default null
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

create or replace function public.set_warehouse_stock(
  p_warehouse_id text,
  p_code text,
  p_new_stock integer,
  p_user_id uuid default null,
  p_observation text default null
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
