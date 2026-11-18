alter table public.invoices
  add column modified_at timestamptz,
  add column deleted_at timestamptz;

create table public.invoice_audits (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  action text not null,
  user_id uuid references public.profiles (id) on delete set null,
  username text not null,
  detail text not null,
  created_at timestamptz not null default now(),
  constraint invoice_audits_action_valid check (action in ('modified', 'deleted'))
);

create index invoice_audits_invoice_idx on public.invoice_audits (invoice_id, created_at desc);

alter table public.invoice_audits enable row level security;

create policy invoice_audits_select_admin
  on public.invoice_audits
  for select
  to authenticated
  using ((select public.is_admin()));

create function public.update_invoice(
  p_invoice_id uuid,
  p_user_id uuid,
  p_username text,
  p_lines jsonb,
  p_client_name text,
  p_client_ci text,
  p_transporter_name text,
  p_transporter_ci text,
  p_vehicle_plate text,
  p_payment_method text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
  v_line public.invoice_lines%rowtype;
  v_row jsonb;
  v_new integer;
  v_diff integer;
  v_stock integer;
  v_total numeric := 0;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found or v_inv.status = 'deleted' then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if (select count(*) from jsonb_array_elements(p_lines)) <>
     (select count(*) from public.invoice_lines where invoice_id = p_invoice_id)
     or (select count(distinct value->>'code') from jsonb_array_elements(p_lines) as value) <>
     (select count(*) from jsonb_array_elements(p_lines)) then
    raise exception 'INVALID_LINES';
  end if;

  for v_row in select value from jsonb_array_elements(p_lines) as value order by value->>'code' loop
    select * into v_line from public.invoice_lines
      where invoice_id = p_invoice_id and product_code = v_row->>'code';
    if not found then
      raise exception 'INVALID_LINES';
    end if;

    v_new := (v_row->>'quantity')::integer;
    if v_new < 1 then
      raise exception 'INVALID_LINES';
    end if;
    v_diff := v_new - v_line.quantity;

    if v_diff <> 0 then
      select stock into v_stock from public.warehouse_products
        where warehouse_id = v_inv.warehouse_id and product_code = v_line.product_code
        for update;
      if not found then
        raise exception 'PRODUCT_UNAVAILABLE:%', v_line.product_code;
      end if;
      if v_diff > v_stock then
        raise exception 'STOCK_INSUFFICIENT:%', v_line.product_code;
      end if;

      update public.warehouse_products
        set stock = stock - v_diff
        where warehouse_id = v_inv.warehouse_id and product_code = v_line.product_code;

      insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
      values (v_inv.warehouse_id, v_line.product_code, 'adjustment', -v_diff, v_stock - v_diff,
              'Modificación de factura ' || v_inv.reference, p_user_id);
    end if;

    update public.invoice_lines
      set quantity = v_new,
          subtotal_cup = v_line.unit_price_cup * v_new,
          subtotal_usd = round(v_line.unit_price_cup * v_new / v_inv.rate, 2)
      where id = v_line.id;

    v_total := v_total + v_line.unit_price_cup * v_new;
  end loop;

  update public.invoices
    set client_name = p_client_name,
        client_ci = p_client_ci,
        transporter_name = nullif(p_transporter_name, ''),
        transporter_ci = nullif(p_transporter_ci, ''),
        vehicle_plate = nullif(p_vehicle_plate, ''),
        payment_method = p_payment_method,
        total_cup = v_total,
        total_usd = round(v_total / v_inv.rate, 2),
        status = 'modified',
        modified_at = now()
    where id = p_invoice_id;

  insert into public.invoice_audits (invoice_id, action, user_id, username, detail)
  values (p_invoice_id, 'modified', p_user_id, p_username, 'Cantidades y datos del cliente modificados');

  return p_invoice_id;
end;
$$;

create function public.delete_invoice(
  p_invoice_id uuid,
  p_user_id uuid,
  p_username text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
  v_line record;
  v_new_stock integer;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found or v_inv.status = 'deleted' then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  for v_line in
    select product_code, quantity from public.invoice_lines where invoice_id = p_invoice_id order by line_number
  loop
    update public.warehouse_products
      set stock = stock + v_line.quantity
      where warehouse_id = v_inv.warehouse_id and product_code = v_line.product_code
      returning stock into v_new_stock;

    insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by)
    values (v_inv.warehouse_id, v_line.product_code, 'adjustment', v_line.quantity, v_new_stock,
            'Factura eliminada ' || v_inv.reference, p_user_id);
  end loop;

  update public.invoices
    set status = 'deleted', deleted_at = now()
    where id = p_invoice_id;

  insert into public.invoice_audits (invoice_id, action, user_id, username, detail)
  values (p_invoice_id, 'deleted', p_user_id, p_username, 'Factura eliminada y stock devuelto');

  return p_invoice_id;
end;
$$;

revoke execute on function public.update_invoice(uuid, uuid, text, jsonb, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.delete_invoice(uuid, uuid, text) from public, anon, authenticated;
