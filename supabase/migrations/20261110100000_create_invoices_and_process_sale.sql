create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  reference text not null unique,
  warehouse_id text not null references public.warehouses (id) on delete restrict,
  warehouse_name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_by_username text not null,
  rate numeric(12, 2) not null,
  client_name text not null,
  client_ci text not null,
  transporter_name text,
  transporter_ci text,
  vehicle_plate text,
  payment_method text not null,
  total_cup numeric(14, 2) not null,
  total_usd numeric(14, 2) not null,
  status text not null default 'valid',
  created_at timestamptz not null default now(),
  constraint invoices_rate_positive check (rate > 0),
  constraint invoices_payment_method_valid check (payment_method in ('cash', 'transfer')),
  constraint invoices_status_valid check (status in ('valid', 'modified', 'deleted')),
  constraint invoices_client_ci_format check (client_ci ~ '^[0-9]{11}$'),
  constraint invoices_reference_format check (reference ~ '^POS_[0-9]+_[0-9]{3}$')
);

create index invoices_created_at_idx on public.invoices (created_at desc);
create index invoices_created_by_idx on public.invoices (created_by);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_number integer not null,
  product_code text not null,
  product_name text not null,
  base_price_usd numeric(12, 2) not null,
  unit_price_cup numeric(14, 2) not null,
  quantity integer not null,
  subtotal_cup numeric(14, 2) not null,
  subtotal_usd numeric(14, 2) not null,
  constraint invoice_lines_quantity_positive check (quantity > 0)
);

create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

create policy invoices_select_admin
  on public.invoices
  for select
  to authenticated
  using ((select public.is_admin()));

create policy invoices_select_own
  on public.invoices
  for select
  to authenticated
  using ((select auth.uid()) = created_by);

create policy invoice_lines_select_admin
  on public.invoice_lines
  for select
  to authenticated
  using ((select public.is_admin()));

create policy invoice_lines_select_own
  on public.invoice_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_lines.invoice_id
        and i.created_by = (select auth.uid())
    )
  );

create function public.process_invoice(
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
      'subtotal_usd', round(v_subtotal / p_rate, 2),
      'stock', v_stock
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

  for v_line in
    select value, ordinality from jsonb_array_elements(v_checked) with ordinality as t(value, ordinality)
  loop
    insert into public.invoice_lines (
      invoice_id, line_number, product_code, product_name, base_price_usd,
      unit_price_cup, quantity, subtotal_cup, subtotal_usd
    ) values (
      v_invoice_id,
      (v_line.ordinality)::integer,
      v_line.value->>'code',
      v_line.value->>'name',
      (v_line.value->>'base_price_usd')::numeric,
      (v_line.value->>'unit_price_cup')::numeric,
      (v_line.value->>'quantity')::integer,
      (v_line.value->>'subtotal_cup')::numeric,
      (v_line.value->>'subtotal_usd')::numeric
    );

    update public.warehouse_products
      set stock = stock - (v_line.value->>'quantity')::integer
      where warehouse_id = p_warehouse_id and product_code = v_line.value->>'code'
      returning stock into v_new_stock;

    insert into public.stock_movements (
      warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by
    ) values (
      p_warehouse_id, v_line.value->>'code', 'invoice_exit', -((v_line.value->>'quantity')::integer),
      v_new_stock, v_reference, p_user_id
    );
  end loop;

  return v_invoice_id;
end;
$$;

revoke execute on function public.process_invoice(uuid, text, uuid, text, numeric, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
