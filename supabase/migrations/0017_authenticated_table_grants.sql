-- Grant authenticated role the table-level privileges needed for RLS to
-- function. auto_expose_new_tables = false means no table gets automatic
-- grants; this migration makes them explicit.
--
-- Write grants mirror what the RLS policies permit:
--   - organization_members: owners/admins can insert/update/delete (all)
--   - organizations: owners/admins can update
--   - vendors/purchase_orders/po_line_items: finance roles can manage
--   - invoices/invoice_line_items: finance roles can insert/update
--   - audit_logs: append-only via Edge Functions (service_role only)
--   - invoice_analysis/genlayer_validations: service_role only (no client writes)

grant select on public.organizations to authenticated;
grant update on public.organizations to authenticated;

grant select, insert, update, delete on public.organization_members to authenticated;

grant select on public.vendors to authenticated;
grant insert, update, delete on public.vendors to authenticated;

grant select on public.vendor_reputation to authenticated;

grant select on public.purchase_orders to authenticated;
grant insert, update, delete on public.purchase_orders to authenticated;

grant select on public.po_line_items to authenticated;
grant insert, update, delete on public.po_line_items to authenticated;

grant select on public.invoices to authenticated;
grant insert, update on public.invoices to authenticated;

grant select on public.invoice_line_items to authenticated;
grant insert, update, delete on public.invoice_line_items to authenticated;

grant select on public.invoice_analysis to authenticated;

grant select on public.genlayer_validations to authenticated;

grant select on public.audit_logs to authenticated;
