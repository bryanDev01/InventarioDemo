create or replace function public.process_invoice(
  p_request_id uuid,
  p_warehouse_id text,
  p_user_id uuid,
  p_username text,
  p_rate numeric,
  p_client_name text,
  p_client_ci text,
  p_transporter_name text,
  p_transporter_ci text,
  p_vehicle_plate text,
  p_payment_method text,
  p_lines jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_existing_id uuid;
  v_warehouse_name text;
  v_archived boolean;
  v_line jsonb;
  v_row record;
  v_code text;
  v_quantity integer;
  v_base numeric;
  v_stock integer;
  v_product_name text;
  v_unit numeric;
  v_subtotal numeric;
  v_total_cup numeric := 0;
  v_checked jsonb := '[]'::jsonb;
  v_codes text[] := '{}';
  v_reference text;
  v_invoice_id uuid;
  v_new_stock integer;
  v_attempt integer := 0;
begin
  select id into v_existing_id from public.invoices where request_id = p_request_id;
  if found then
    return v_existing_id;
  end if;

  select name, is_archived into v_warehouse_name, v_archived
    from public.warehouses where id = p_warehouse_id;
  if not found or v_archived then
    raise exception 'WAREHOUSE_NOT_FOUND';
  end if;

  for v_line in
    select value from jsonb_array_elements(p_lines) as value order by value->>'code'
  loop
    v_code := v_line->>'code';
    v_quantity := (v_line->>'quantity')::integer;

    if v_code = any(v_codes) then
      raise exception 'DUPLICATE_LINE:%', v_code;
    end if;
    v_codes := array_append(v_codes, v_code);

    select wp.base_price_usd, wp.stock, p.name
      into v_base, v_stock, v_product_name
      from public.warehouse_products wp
      join public.products p on p.code = wp.product_code
      where wp.warehouse_id = p_warehouse_id
        and wp.product_code = v_code
        and wp.deleted_at is null
      for update of wp;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_code;
    end if;
    if v_quantity > v_stock then
      raise exception 'STOCK_INSUFFICIENT:%', v_code;
    end if;

    v_unit := round(v_base * p_rate, 2);
    v_subtotal := v_unit * v_quantity;
    v_total_cup := v_total_cup + v_subtotal;

    v_checked := v_checked || jsonb_build_array(jsonb_build_object(
      'code', v_code,
      'name', v_product_name,
      'base_price_usd', v_base,
      'unit_price_cup', v_unit,
      'quantity', v_quantity,
      'subtotal_cup', v_subtotal,
      'subtotal_usd', round(v_subtotal / p_rate, 2)
    ));
  end loop;

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'POS_' || extract(epoch from clock_timestamp())::bigint || '_' || lpad(floor(random() * 1000)::integer::text, 3, '0');
    exit when not exists (select 1 from public.invoices where reference = v_reference);
    if v_attempt >= 10 then
      raise exception 'REFERENCE_GENERATION_FAILED';
    end if;
  end loop;

  insert into public.invoices (
    request_id, reference, warehouse_id, warehouse_name, created_by, created_by_username,
    rate, client_name, client_ci, transporter_name, transporter_ci, vehicle_plate,
    payment_method, total_cup, total_usd, status
  ) values (
    p_request_id, v_reference, p_warehouse_id, v_warehouse_name, p_user_id, p_username,
    p_rate, p_client_name, p_client_ci, nullif(p_transporter_name, ''), nullif(p_transporter_ci, ''), nullif(p_vehicle_plate, ''),
    p_payment_method, v_total_cup, round(v_total_cup / p_rate, 2), 'valid'
  )
  returning id into v_invoice_id;

  for v_row in
    select value, ordinality from jsonb_array_elements(v_checked) with ordinality as t(value, ordinality)
  loop
    insert into public.invoice_lines (
      invoice_id, line_number, product_code, product_name, base_price_usd,
      unit_price_cup, quantity, subtotal_cup, subtotal_usd
    ) values (
      v_invoice_id,
      v_row.ordinality::integer,
      v_row.value->>'code',
      v_row.value->>'name',
      (v_row.value->>'base_price_usd')::numeric,
      (v_row.value->>'unit_price_cup')::numeric,
      (v_row.value->>'quantity')::integer,
      (v_row.value->>'subtotal_cup')::numeric,
      (v_row.value->>'subtotal_usd')::numeric
    );

    update public.warehouse_products
      set stock = stock - (v_row.value->>'quantity')::integer
      where warehouse_id = p_warehouse_id and product_code = v_row.value->>'code'
      returning stock into v_new_stock;

    insert into public.stock_movements (
      warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by
    ) values (
      p_warehouse_id, v_row.value->>'code', 'invoice_exit', -((v_row.value->>'quantity')::integer),
      v_new_stock, v_reference, p_user_id
    );
  end loop;

  return v_invoice_id;
end;
$$;
