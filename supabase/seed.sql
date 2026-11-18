-- ============================================================================
-- Inventaria — DEMO SEED (portfolio instance only)
-- ============================================================================
-- This file populates a FRESH demo Supabase project with completely fictional
-- data: invented users, warehouses, products and ~26 invoices spread over the
-- last 10 days so the reports, history and movements pages look alive.
--
-- IT MUST NEVER BE RUN AGAINST THE REAL (CLIENT) DATABASE.
--
-- How to apply (demo project only):
--   supabase link --project-ref <demo-ref>
--   supabase db reset            -- runs migrations + this seed.sql locally,
--   or paste this file into the SQL Editor of the DEMO Supabase project.
--
-- Demo credentials (shown on the login page):
--   admin      / Demo1234!   (Administrador)
--   facturador / Demo1234!   (Facturador, assigned to 2 warehouses)
--   vendedor   / Demo1234!   (Vendedor — restricted role, to demo RBAC)
--
-- The script is guarded: running it twice does nothing the second time.
-- ============================================================================

do $$
declare
  v_admin_id     uuid := '11111111-1111-4111-8111-111111111111';
  v_invoicer_id  uuid := '22222222-2222-4222-8222-222222222222';
  v_seller_id    uuid := '33333333-3333-4333-8333-333333333333';
  v_wh           text[] := array['CENTRAL1', 'PLAYA1', 'NORTE1'];
  v_rate_by_day  numeric[] := array[
    122.50, 123.00, 123.00, 124.25, 125.00,
    126.40, 126.40, 127.80, 128.00, 129.60
  ];
  v_client_names text[] := array[
    'María Fernanda López', 'Jorge Luis Mendoza', 'Ana Silvia Torres',
    'Roberto Díaz Hernández', 'Carmen Melissa Roque', 'Yuniel Pérez Castaño',
    'Niurka González Acosta', 'Ernesto Blanco Ramírez', 'Daisy Fontanills Vega',
    'Alexis Cárdenas Mora', 'Olga Lidia Padrón', 'William Estrada Nápoles'
  ];
  v_client_cis text[] := array[
    '85031204567', '78051902314', '90012845123', '82113009876',
    '95040702345', '88072201234', '84021503456', '79090104567',
    '92061603210', '86101002789', '80122505432', '83080802876'
  ];
  v_transp_names text[] := array[
    'Luis Enrique Padrón', 'Rafael Amorín Delgado', 'Yoandri Balaguer Cruz'
  ];
  v_transp_cis text[] := array['81051607788', '79032406655', '90090901122'];
  v_transp_plates text[] := array['P123456', 'T560231', 'B042118'];

  v_codes       text[];
  v_n           integer;
  v_idx         integer;
  v_attempt     integer;
  v_i           integer;
  v_j           integer;
  v_day         integer;
  v_rate        numeric;
  v_wh_sel      text;
  v_wh_name     text;
  v_creator     uuid;
  v_creator_u   text;
  v_created     timestamptz;
  v_ref         text;
  v_inv_id      uuid;
  v_code        text;
  v_pname       text;
  v_base        numeric;
  v_stock       integer;
  v_qty         integer;
  v_unit        numeric;
  v_subtotal    numeric;
  v_total       numeric;
  v_lines       integer;
  v_payment     text;
begin
  if exists (select 1 from public.warehouses where id = 'CENTRAL1') then
    raise notice 'Inventaria demo seed: already applied, skipping.';
    return;
  end if;

  -- =========================================================================
  -- 1. Auth users (fictional). Password for all three: Demo1234!
  --    Emails are the internal username-style addresses the app derives from
  --    the username at login (<username>@inventaria.invalid). They are never
  --    shown in the UI and nothing is ever sent to them.
  --
  --    NOTE: auth.users is GoTrue's private table. Beyond the obvious
  --    columns, Auth expects instance_id + non-NULL '' token columns and
  --    jsonb metadata; anything else makes logins fail with 500. These
  --    values mirror exactly what the Auth Admin API writes (verified by
  --    comparing against a probe user created through the API).
  -- =========================================================================
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    instance_id, confirmation_token, recovery_token, email_change,
    email_change_token_new, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (v_admin_id, 'authenticated', 'authenticated', 'admin@inventaria.invalid',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf', 10)),
      now(),
      '00000000-0000-0000-0000-000000000000', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"email_verified":true}'::jsonb,
      now() - interval '60 days', now() - interval '60 days'),
    (v_invoicer_id, 'authenticated', 'authenticated', 'facturador@inventaria.invalid',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf', 10)),
      now(),
      '00000000-0000-0000-0000-000000000000', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"email_verified":true}'::jsonb,
      now() - interval '45 days', now() - interval '45 days'),
    (v_seller_id, 'authenticated', 'authenticated', 'vendedor@inventaria.invalid',
      extensions.crypt('Demo1234!', extensions.gen_salt('bf', 10)),
      now(),
      '00000000-0000-0000-0000-000000000000', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"email_verified":true}'::jsonb,
      now() - interval '20 days', now() - interval '20 days');

  insert into public.profiles (id, username, role, is_active) values
    (v_admin_id,    'admin',      'admin',    true),
    (v_invoicer_id, 'facturador', 'invoicer', true),
    (v_seller_id,   'vendedor',   'seller',   true);

  -- =========================================================================
  -- 2. Warehouses + staff assignment (fictional distribution company)
  -- =========================================================================
  insert into public.warehouses (id, name, location) values
    ('CENTRAL1', 'Almacén Central', 'La Habana'),
    ('PLAYA1',   'Almacén Playa',   'La Habana'),
    ('NORTE1',   'Almacén Norte',   'Matanzas');

  insert into public.user_warehouses (user_id, warehouse_id) values
    (v_invoicer_id, 'CENTRAL1'),
    (v_invoicer_id, 'PLAYA1');

  -- =========================================================================
  -- 3. Product catalog. Mixed code styles on purpose: generated PRD-XXXXXX
  --    plus hand-typed codes that keep their zeros (rule RF: codes are text).
  --    The PRD sequence stops at 000012 so new products continue at 000013.
  -- =========================================================================
  insert into public.products (code, name) values
    ('PRD-000001', 'Arroz grano largo 25 lb'),
    ('PRD-000002', 'Frijol negro 1 lb'),
    ('PRD-000003', 'Aceite vegetal 5 L'),
    ('PRD-000004', 'Azúcar refinada 50 kg'),
    ('PRD-000005', 'Pasta alimenticia 1 lb'),
    ('PRD-000006', 'Pollo congelado 1 kg'),
    ('PRD-000007', 'Leche en polvo entera 900 g'),
    ('PRD-000008', 'Harina de trigo 1 kg'),
    ('PRD-000009', 'Café tostado molido 1 lb'),
    ('PRD-000010', 'Detergente en polvo 4 kg'),
    ('PRD-000011', 'Atún enlatado 140 g'),
    ('PRD-000012', 'Jabón de tocador'),
    ('GAL-0007',   'Galletas surtidas 400 g'),
    ('JAM-0680',   'Mermelada de guayaba 680 g');

  -- Each warehouse-product is its own record: own stock AND own price.
  insert into public.warehouse_products (warehouse_id, product_code, base_price_usd, stock) values
    ('CENTRAL1', 'PRD-000001', 18.50, 240),
    ('CENTRAL1', 'PRD-000002',  1.10, 380),
    ('CENTRAL1', 'PRD-000003',  9.75, 150),
    ('CENTRAL1', 'PRD-000004', 28.00,  90),
    ('CENTRAL1', 'PRD-000005',  0.95, 320),
    ('CENTRAL1', 'PRD-000006',  4.20, 120),
    ('CENTRAL1', 'PRD-000007',  5.60, 200),
    ('CENTRAL1', 'PRD-000008',  1.30, 260),
    ('CENTRAL1', 'PRD-000009',  6.40, 140),
    ('CENTRAL1', 'PRD-000010',  7.85, 110),
    ('CENTRAL1', 'PRD-000011',  1.85, 300),
    ('CENTRAL1', 'PRD-000012',  0.75, 420),
    ('CENTRAL1', 'GAL-0007',    2.10, 180),
    ('CENTRAL1', 'JAM-0680',    2.95,  95),
    ('PLAYA1',   'PRD-000001', 18.90, 160),
    ('PLAYA1',   'PRD-000002',  1.15, 240),
    ('PLAYA1',   'PRD-000003',  9.90, 100),
    ('PLAYA1',   'PRD-000005',  0.99, 210),
    ('PLAYA1',   'PRD-000007',  5.85, 130),
    ('PLAYA1',   'PRD-000008',  1.35, 175),
    ('PLAYA1',   'PRD-000009',  6.55,  90),
    ('PLAYA1',   'PRD-000011',  1.90, 230),
    ('PLAYA1',   'GAL-0007',    2.25, 120),
    ('NORTE1',   'PRD-000001', 18.25, 110),
    ('NORTE1',   'PRD-000002',  1.05, 190),
    ('NORTE1',   'PRD-000004', 27.50,  60),
    ('NORTE1',   'PRD-000006',  4.05,  95),
    ('NORTE1',   'PRD-000010',  7.60,  75),
    ('NORTE1',   'PRD-000012',  0.70, 260),
    ('NORTE1',   'JAM-0680',    2.80,  65);

  -- Opening inventory movements so the Movements page has history.
  insert into public.stock_movements
    (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by, created_at)
  select wp.warehouse_id, wp.product_code, 'entry', wp.stock, wp.stock,
         'Carga inicial de inventario (demo)', v_admin_id,
         now() - interval '30 days'
    from public.warehouse_products wp;

  -- =========================================================================
  -- 4. Invoices: 26 sales over the last 10 days, mirroring exactly what the
  --    process_invoice() function does: line snapshot with per-line rounding,
  --    stock decrease, invoice_exit movement, totals in CUP and USD.
  --    created_at is relative to now(), so the report is always "alive".
  -- =========================================================================
  for v_i in 1..26 loop
    v_day    := (v_i * 3) % 10;
    v_rate   := v_rate_by_day[v_day + 1];
    v_wh_sel := v_wh[v_i % 3 + 1];
    select name into v_wh_name from public.warehouses where id = v_wh_sel;

    if v_i % 7 = 0 then
      v_creator := v_admin_id; v_creator_u := 'admin';
    else
      v_creator := v_invoicer_id; v_creator_u := 'facturador';
    end if;

    v_created := now() - make_interval(
      days => v_day, hours => 1 + (v_i % 9), mins => (v_i * 23) % 60);
    v_ref := 'POS_' || floor(extract(epoch from v_created))::text || '_' ||
             lpad(((v_i * 137) % 900 + 100)::text, 3, '0');
    v_payment := case when v_i % 4 = 0 then 'transfer' else 'cash' end;

    insert into public.invoices (
      request_id, reference, warehouse_id, warehouse_name,
      created_by, created_by_username, rate,
      client_name, client_ci,
      transporter_name, transporter_ci, vehicle_plate,
      payment_method, total_cup, total_usd, status, created_at
    ) values (
      gen_random_uuid(), v_ref, v_wh_sel, v_wh_name,
      v_creator, v_creator_u, v_rate,
      v_client_names[v_i % 12 + 1], v_client_cis[v_i % 12 + 1],
      case when v_i % 3 = 0 then v_transp_names[v_i % 3 + 1] end,
      case when v_i % 3 = 0 then v_transp_cis[v_i % 3 + 1] end,
      case when v_i % 3 = 0 then v_transp_plates[v_i % 3 + 1] end,
      v_payment, 0, 0, 'valid', v_created
    ) returning id into v_inv_id;

    select array_agg(product_code order by product_code) into v_codes
      from public.warehouse_products
      where warehouse_id = v_wh_sel and deleted_at is null;
    v_n := cardinality(v_codes);
    v_total := 0;
    v_lines := 0;

    for v_j in 1..(2 + v_i % 3) loop
      v_qty := 1 + ((v_i * 7 + v_j * 3) % 4);  -- 1..4 units
      v_idx := (v_i + v_j) % v_n;
      v_code := null;

      for v_attempt in 0..v_n - 1 loop
        v_code := v_codes[((v_idx + v_attempt) % v_n) + 1];
        select wp.base_price_usd, wp.stock, p.name
          into v_base, v_stock, v_pname
          from public.warehouse_products wp
          join public.products p on p.code = wp.product_code
          where wp.warehouse_id = v_wh_sel and wp.product_code = v_code;
        if v_stock >= v_qty then
          exit;
        end if;
        v_code := null;
      end loop;

      if v_code is null then
        continue;  -- warehouse nearly empty, skip this line
      end if;

      -- Same math as process_invoice(): round(base * rate, 2) per unit.
      v_unit := round(v_base * v_rate, 2);
      v_subtotal := v_unit * v_qty;
      v_total := v_total + v_subtotal;

      insert into public.invoice_lines (
        invoice_id, line_number, product_code, product_name,
        base_price_usd, unit_price_cup, quantity, subtotal_cup, subtotal_usd
      ) values (
        v_inv_id, v_lines + 1, v_code, v_pname,
        v_base, v_unit, v_qty, v_subtotal, round(v_subtotal / v_rate, 2)
      );

      update public.warehouse_products
        set stock = stock - v_qty
        where warehouse_id = v_wh_sel and product_code = v_code
        returning stock into v_stock;

      insert into public.stock_movements (
        warehouse_id, product_code, movement_type, quantity,
        stock_after, observation, created_by, created_at
      ) values (
        v_wh_sel, v_code, 'invoice_exit', -v_qty, v_stock,
        'Salida por venta ' || v_ref, v_creator, v_created
      );

      v_lines := v_lines + 1;
    end loop;

    if v_lines = 0 then
      delete from public.invoices where id = v_inv_id;
    else
      update public.invoices
        set total_cup = v_total, total_usd = round(v_total / v_rate, 2)
        where id = v_inv_id;
    end if;
  end loop;

  -- =========================================================================
  -- 5. Extra variety: one edited invoice (audit trail), a transfer between
  --    warehouses and a shrinkage adjustment.
  -- =========================================================================
  update public.invoices
    set status = 'modified',
        modified_at = created_at + interval '3 hours'
    where reference = (
      select i.reference from public.invoices i
      where i.status = 'valid'
      order by i.created_at desc offset 3 limit 1
    )
    returning id, reference into v_inv_id, v_ref;

  insert into public.invoice_audits (invoice_id, action, user_id, username, detail, created_at)
  select v_inv_id, 'modified', v_admin_id, 'admin',
         'Se corrigió el método de pago y una cantidad (datos de demostración).',
         created_at + interval '3 hours'
    from public.invoices where id = v_inv_id;

  -- Transfer of 25 units of black beans: CENTRAL1 -> PLAYA1
  update public.warehouse_products set stock = stock - 25
    where warehouse_id = 'CENTRAL1' and product_code = 'PRD-000002'
    returning stock into v_stock;
  insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by, created_at)
  values ('CENTRAL1', 'PRD-000002', 'transfer', -25, v_stock, 'Traslado a Almacén Playa (demo)', v_admin_id, now() - interval '6 days');

  update public.warehouse_products set stock = stock + 25
    where warehouse_id = 'PLAYA1' and product_code = 'PRD-000002'
    returning stock into v_stock;
  insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by, created_at)
  values ('PLAYA1', 'PRD-000002', 'transfer', 25, v_stock, 'Traslado desde Almacén Central (demo)', v_admin_id, now() - interval '6 days');

  -- Adjustment: 3 units of chicken lost to spoilage at CENTRAL1
  update public.warehouse_products set stock = stock - 3
    where warehouse_id = 'CENTRAL1' and product_code = 'PRD-000006'
    returning stock into v_stock;
  insert into public.stock_movements (warehouse_id, product_code, movement_type, quantity, stock_after, observation, created_by, created_at)
  values ('CENTRAL1', 'PRD-000006', 'adjustment', -3, v_stock, 'Ajuste por merma (demo)', v_admin_id, now() - interval '2 days');

  raise notice 'Inventaria demo seed: done.';
end;
$$;
