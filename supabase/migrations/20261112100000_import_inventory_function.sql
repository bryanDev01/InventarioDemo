create function public.import_inventory(
  p_warehouse_id text,
  p_user_id uuid,
  p_rows jsonb
)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_code text;
  v_name text;
  v_existing_name text;
  v_name_mode text;
  v_stock_mode text;
  v_price_mode text;
  v_base_price numeric;
  v_file_stock integer;
  v_old_stock integer;
  v_new_stock integer;
  v_old_price numeric;
  v_existing public.warehouse_products%rowtype;
  v_sequence bigint;
  v_codes text[] := array[]::text[];
  v_seen_codes text[] := array[]::text[];
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 2000 then
    raise exception 'IMPORT_ROW_INVALID';
  end if;

  if not exists (
    select 1 from public.warehouses
    where id = p_warehouse_id and not is_archived
  ) then
    raise exception 'WAREHOUSE_NOT_FOUND';
  end if;

  -- Shares the product-code lock with register_product, and locks catalog creation for this batch.
  perform pg_advisory_xact_lock(hashtext('products_code_sequence'));

  for v_row in
    select value
    from jsonb_array_elements(p_rows) as rows(value)
    order by coalesce(value->>'code', ''), coalesce(value->>'name', '')
  loop
    v_stock_mode := coalesce(v_row->>'stock_mode', 'replace');
    if v_stock_mode = 'skip' then
      continue;
    end if;
    if v_stock_mode not in ('replace', 'add') then
      raise exception 'IMPORT_ROW_INVALID';
    end if;

    v_name_mode := coalesce(v_row->>'name_mode', 'keep');
    v_price_mode := coalesce(v_row->>'price_mode', 'import');
    v_name := nullif(btrim(v_row->>'name'), '');
    v_code := nullif(upper(btrim(v_row->>'code')), '');

    if v_name_mode not in ('keep', 'rename', 'new_code') or v_price_mode not in ('import', 'keep') then
      raise exception 'IMPORT_ROW_INVALID';
    end if;

    if v_name_mode = 'new_code' then
      v_code := null;
    end if;

    if v_code is null then
      if v_name is null then
        raise exception 'IMPORT_ROW_INVALID';
      end if;
      select coalesce(max(substring(code from 5)::bigint), 0) + 1
        into v_sequence
        from public.products
        where code ~ '^PRD-[0-9]{6,}$';
      v_code := 'PRD-' || lpad(v_sequence::text, 6, '0');
    elsif v_code !~ '^[A-Z0-9-]{1,30}$' then
      raise exception 'IMPORT_ROW_INVALID';
    end if;

    if v_code = any(v_seen_codes) then
      raise exception 'IMPORT_DUPLICATE_CODE';
    end if;
    v_seen_codes := array_append(v_seen_codes, v_code);

    if v_name is null or length(v_name) > 160 or
       coalesce(v_row->>'base_price_usd', '') = '' or
       coalesce(v_row->>'stock', '') = '' then
      raise exception 'IMPORT_ROW_INVALID';
    end if;

    v_base_price := (v_row->>'base_price_usd')::numeric;
    v_file_stock := (v_row->>'stock')::integer;
    if v_base_price <= 0 or v_file_stock < 0 then
      raise exception 'IMPORT_ROW_INVALID';
    end if;

    select name into v_existing_name from public.products where code = v_code for update;
    if found then
      if v_name_mode = 'rename' then
        update public.products set name = v_name where code = v_code;
      elsif v_name_mode = 'keep' then
        v_name := v_existing_name;
      end if;
    else
      if v_name_mode = 'rename' then
        raise exception 'IMPORT_ROW_INVALID';
      end if;
      insert into public.products (code, name) values (v_code, v_name);
    end if;

    select * into v_existing
      from public.warehouse_products
      where warehouse_id = p_warehouse_id and product_code = v_code
      for update;

    if found then
      if v_price_mode = 'keep' then
        v_base_price := v_existing.base_price_usd;
      end if;
      if v_stock_mode = 'add' then
        v_new_stock := v_existing.stock + v_file_stock;
      else
        v_new_stock := v_file_stock;
      end if;
      v_old_stock := v_existing.stock;

      update public.warehouse_products
        set base_price_usd = v_base_price,
            stock = v_new_stock,
            deleted_at = null
        where warehouse_id = p_warehouse_id and product_code = v_code;

      if v_stock_mode = 'add' and v_file_stock > 0 then
        insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
        values (p_warehouse_id, v_code, 'entry', v_file_stock, v_new_stock, 'Importación de inventario', p_user_id);
      elsif v_stock_mode = 'replace' and v_new_stock <> v_old_stock then
        insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
        values (p_warehouse_id, v_code, 'adjustment', v_new_stock - v_old_stock, v_new_stock, 'Importación de inventario', p_user_id);
      end if;
    else
      if v_price_mode = 'keep' then
        raise exception 'IMPORT_ROW_INVALID';
      end if;
      if v_stock_mode = 'add' then
        v_new_stock := v_file_stock;
      else
        v_new_stock := v_file_stock;
      end if;

      insert into public.warehouse_products (warehouse_id, product_code, base_price_usd, stock, deleted_at)
      values (p_warehouse_id, v_code, v_base_price, v_new_stock, null);

      if v_new_stock > 0 then
        insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
        values (p_warehouse_id, v_code, 'entry', v_new_stock, v_new_stock, 'Importación de inventario', p_user_id);
      end if;
    end if;

    v_codes := array_append(v_codes, v_code);
  end loop;

  return v_codes;
end;
$$;

revoke all on function public.import_inventory(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_inventory(text, uuid, jsonb) to service_role;
