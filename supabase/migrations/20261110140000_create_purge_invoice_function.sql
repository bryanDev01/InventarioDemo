create function public.purge_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;
  if v_inv.status <> 'deleted' then
    raise exception 'INVOICE_NOT_DELETED';
  end if;

  -- These movements cancel each other out, so removing them keeps the ledger
  -- balanced while leaving the current stock untouched.
  delete from public.stock_movements
    where warehouse_id = v_inv.warehouse_id
      and movement_type in ('invoice_exit', 'adjustment')
      and observation in (
        v_inv.reference,
        'Factura eliminada ' || v_inv.reference,
        'Modificación de factura ' || v_inv.reference
      );

  delete from public.invoices where id = p_invoice_id;

  return p_invoice_id;
end;
$$;

revoke execute on function public.purge_invoice(uuid) from public, anon, authenticated;
