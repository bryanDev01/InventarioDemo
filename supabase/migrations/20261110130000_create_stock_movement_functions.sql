/* RF-7: manual stock movements.
   Every function is a single transaction that locks the affected
   warehouse_products rows, so stock can never go negative. */

create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_product_code_idx on public.stock_movements (product_code);

/* Name comparison for transfers (D-7): case-insensitive, accents and
   repeated spaces ignored, matching how the app compares product names. */
create function public.normalize_product_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(btrim(coalesce(p_name, ''))),
      'áàäâãéèëêíìïîóòöôõúùüûñç',
      'aaaaaeeeeiiiiooooouuuunc'
    ),
    '\s+', ' ', 'g'
  )
$$;

create function public.register_stock_entry(
  p_warehouse_id text,
  p_code text,
  p_quantity integer,
  p_observation text,
  p_user_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_stock integer;
  v_new_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if not exists (
    select 1 from public.warehouses
    where id = p_warehouse_id and not is_archived
  ) then
    raise exception 'WAREHOUSE_NOT_FOUND';
  end if;

  select stock into v_stock
    from public.warehouse_products
    where warehouse_id = p_warehouse_id
      and product_code = p_code
      and deleted_at is null
    for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  v_new_stock := v_stock + p_quantity;

  update public.warehouse_products
    set stock = v_new_stock
    where warehouse_id = p_warehouse_id and product_code = p_code;

  insert into public.stock_movements (
    warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by
  ) values (
    p_warehouse_id, p_code, 'entry', p_quantity, v_new_stock, nullif(btrim(p_observation), ''), p_user_id
  );

  return v_new_stock;
end;
$$;

create function public.register_stock_exit(
  p_warehouse_id text,
  p_code text,
  p_quantity integer,
  p_observation text,
  p_user_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_stock integer;
  v_new_stock integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if not exists (
    select 1 from public.warehouses
    where id = p_warehouse_id and not is_archived
  ) then
    raise exception 'WAREHOUSE_NOT_FOUND';
  end if;

  select stock into v_stock
    from public.warehouse_products
    where warehouse_id = p_warehouse_id
      and product_code = p_code
      and deleted_at is null
    for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_stock < p_quantity then
    raise exception 'STOCK_INSUFFICIENT';
  end if;

  v_new_stock := v_stock - p_quantity;

  update public.warehouse_products
    set stock = v_new_stock
    where warehouse_id = p_warehouse_id and product_code = p_code;

  insert into public.stock_movements (
    warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by
  ) values (
    p_warehouse_id, p_code, 'exit', -p_quantity, v_new_stock, nullif(btrim(p_observation), ''), p_user_id
  );

  return v_new_stock;
end;
$$;

create function public.transfer_stock(
  p_origin_id text,
  p_destination_id text,
  p_code text,
  p_quantity integer,
  p_observation text,
  p_user_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_origin_name text;
  v_origin_stock integer;
  v_origin_price numeric;
  v_origin_stock_after integer;
  v_origin_label text;
  v_destination_label text;
  v_normalized_name text;
  v_destination_code text;
  v_destination_stock_after integer;
  v_observation text := nullif(btrim(p_observation), '');
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if p_origin_id = p_destination_id then
    raise exception 'SAME_WAREHOUSE';
  end if;

  /* Serialize transfers for the same pair of warehouses in a stable order
     so two opposite transfers cannot deadlock. */
  perform pg_advisory_xact_lock(
    hashtext('transfer:' || least(p_origin_id, p_destination_id) || ':' || greatest(p_origin_id, p_destination_id))
  );

  select name into v_origin_label
    from public.warehouses
    where id = p_origin_id and not is_archived;
  if not found then
    raise exception 'WAREHOUSE_NOT_FOUND';
  end if;

  select name into v_destination_label
    from public.warehouses
    where id = p_destination_id and not is_archived;
  if not found then
    raise exception 'WAREHOUSE_NOT_FOUND';
  end if;

  select wp.stock, wp.base_price_usd, p.name
    into v_origin_stock, v_origin_price, v_origin_name
    from public.warehouse_products wp
    join public.products p on p.code = wp.product_code
    where wp.warehouse_id = p_origin_id
      and wp.product_code = p_code
      and wp.deleted_at is null
    for update of wp;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_origin_stock < p_quantity then
    raise exception 'STOCK_INSUFFICIENT';
  end if;

  v_normalized_name := public.normalize_product_name(v_origin_name);

  /* RF-7.4.1: the destination product is looked up by name. If it exists,
     stock is added and its price is kept. */
  select wp.product_code into v_destination_code
    from public.warehouse_products wp
    join public.products p on p.code = wp.product_code
    where wp.warehouse_id = p_destination_id
      and wp.deleted_at is null
      and public.normalize_product_name(p.name) = v_normalized_name
    order by wp.product_code
    limit 1
    for update of wp;

  if found then
    update public.warehouse_products
      set stock = stock + p_quantity
      where warehouse_id = p_destination_id and product_code = v_destination_code
      returning stock into v_destination_stock_after;
  else
    /* D-7: the destination product keeps the origin code. If it was
       removed from that warehouse, it is reactivated with the moved stock. */
    v_destination_code := p_code;
    v_destination_stock_after := p_quantity;

    if exists (
      select 1 from public.warehouse_products
      where warehouse_id = p_destination_id and product_code = p_code
    ) then
      update public.warehouse_products
        set stock = v_destination_stock_after,
            base_price_usd = v_origin_price,
            deleted_at = null
        where warehouse_id = p_destination_id and product_code = p_code;
    else
      insert into public.warehouse_products (warehouse_id, product_code, base_price_usd, stock)
      values (p_destination_id, p_code, v_origin_price, p_quantity);
    end if;
  end if;

  v_origin_stock_after := v_origin_stock - p_quantity;

  update public.warehouse_products
    set stock = v_origin_stock_after
    where warehouse_id = p_origin_id and product_code = p_code;

  insert into public.stock_movements (
    warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by
  ) values
    (
      p_origin_id, p_code, 'transfer', -p_quantity, v_origin_stock_after,
      concat_ws(' · ', 'Traslado a ' || v_destination_label, v_observation), p_user_id
    ),
    (
      p_destination_id, v_destination_code, 'transfer', p_quantity, v_destination_stock_after,
      concat_ws(' · ', 'Traslado desde ' || v_origin_label, v_observation), p_user_id
    );

  return v_destination_code;
end;
$$;

revoke execute on function public.normalize_product_name(text) from public, anon, authenticated;
revoke execute on function public.register_stock_entry(text, text, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.register_stock_exit(text, text, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.transfer_stock(text, text, text, integer, text, uuid) from public, anon, authenticated;
