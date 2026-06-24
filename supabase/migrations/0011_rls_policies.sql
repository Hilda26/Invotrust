-- Enable RLS on every tenant table and define access policies.
-- Standard pattern: a row is visible to a user if they belong to its org_id
-- (via is_org_member). Writes that change financial/decision state are
-- restricted to finance_reviewer/admin/owner via has_org_role.

-- organizations ---------------------------------------------------------
alter table organizations enable row level security;

create policy "org members can select organizations"
  on organizations for select
  using (is_org_member(id));

create policy "owners and admins can update organizations"
  on organizations for update
  using (has_org_role(id, array['owner', 'admin']))
  with check (has_org_role(id, array['owner', 'admin']));

-- No insert/delete policies: organizations are created via
-- create_organization_with_owner() and never deleted from the client.

-- organization_members ---------------------------------------------------
alter table organization_members enable row level security;

create policy "org members can select membership"
  on organization_members for select
  using (is_org_member(org_id));

create policy "owners and admins can manage membership"
  on organization_members for all
  using (has_org_role(org_id, array['owner', 'admin']))
  with check (has_org_role(org_id, array['owner', 'admin']));

-- user_wallets -------------------------------------------------------------
alter table user_wallets enable row level security;

create policy "users can select their own wallet"
  on user_wallets for select
  using (user_id = auth.uid());

-- No insert/update/delete policies: wallets are created and read by
-- Edge Functions using the service role, which bypasses RLS.

-- The private key and key version must never be readable by API clients,
-- even on a row the user owns.
revoke select (encrypted_private_key, key_encryption_version) on user_wallets from authenticated, anon;

alter view user_wallets_public set (security_invoker = on);
grant select on user_wallets_public to authenticated;

-- vendors ------------------------------------------------------------------
alter table vendors enable row level security;

create policy "org members can select vendors"
  on vendors for select
  using (is_org_member(org_id));

create policy "admins can manage vendors"
  on vendors for all
  using (has_org_role(org_id, array['owner', 'admin']))
  with check (has_org_role(org_id, array['owner', 'admin']));

-- vendor_reputation ----------------------------------------------------------
alter table vendor_reputation enable row level security;

create policy "org members can select vendor reputation"
  on vendor_reputation for select
  using (
    exists (
      select 1 from vendors
      where vendors.id = vendor_reputation.vendor_id
        and is_org_member(vendors.org_id)
    )
  );

-- No client write policies: vendor_reputation is recalculated by Edge
-- Functions (service role) after each invoice decision.

-- purchase_orders ------------------------------------------------------------
alter table purchase_orders enable row level security;

create policy "org members can select purchase orders"
  on purchase_orders for select
  using (is_org_member(org_id));

create policy "finance roles can manage purchase orders"
  on purchase_orders for all
  using (has_org_role(org_id, array['finance_reviewer', 'admin', 'owner']))
  with check (has_org_role(org_id, array['finance_reviewer', 'admin', 'owner']));

-- po_line_items ----------------------------------------------------------------
alter table po_line_items enable row level security;

create policy "org members can select po line items"
  on po_line_items for select
  using (
    exists (
      select 1 from purchase_orders
      where purchase_orders.id = po_line_items.po_id
        and is_org_member(purchase_orders.org_id)
    )
  );

create policy "finance roles can manage po line items"
  on po_line_items for all
  using (
    exists (
      select 1 from purchase_orders
      where purchase_orders.id = po_line_items.po_id
        and has_org_role(purchase_orders.org_id, array['finance_reviewer', 'admin', 'owner'])
    )
  )
  with check (
    exists (
      select 1 from purchase_orders
      where purchase_orders.id = po_line_items.po_id
        and has_org_role(purchase_orders.org_id, array['finance_reviewer', 'admin', 'owner'])
    )
  );

-- invoices ------------------------------------------------------------------
alter table invoices enable row level security;

create policy "org members can select invoices"
  on invoices for select
  using (is_org_member(org_id));

create policy "finance roles can insert invoices"
  on invoices for insert
  with check (has_org_role(org_id, array['finance_reviewer', 'admin', 'owner']));

create policy "finance roles can update invoices"
  on invoices for update
  using (has_org_role(org_id, array['finance_reviewer', 'admin', 'owner']))
  with check (has_org_role(org_id, array['finance_reviewer', 'admin', 'owner']));

-- invoice_line_items ---------------------------------------------------------
alter table invoice_line_items enable row level security;

create policy "org members can select invoice line items"
  on invoice_line_items for select
  using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_line_items.invoice_id
        and is_org_member(invoices.org_id)
    )
  );

create policy "finance roles can manage invoice line items"
  on invoice_line_items for all
  using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_line_items.invoice_id
        and has_org_role(invoices.org_id, array['finance_reviewer', 'admin', 'owner'])
    )
  )
  with check (
    exists (
      select 1 from invoices
      where invoices.id = invoice_line_items.invoice_id
        and has_org_role(invoices.org_id, array['finance_reviewer', 'admin', 'owner'])
    )
  );

-- invoice_analysis -------------------------------------------------------------
alter table invoice_analysis enable row level security;

create policy "org members can select invoice analysis"
  on invoice_analysis for select
  using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_analysis.invoice_id
        and is_org_member(invoices.org_id)
    )
  );

-- No client write policies: invoice_analysis is written by the
-- submit-invoice Edge Function (service role).

-- genlayer_validations -----------------------------------------------------------
alter table genlayer_validations enable row level security;

create policy "org members can select genlayer validations"
  on genlayer_validations for select
  using (
    exists (
      select 1 from invoices
      where invoices.id = genlayer_validations.invoice_id
        and is_org_member(invoices.org_id)
    )
  );

-- No client write policies: written only by submit-to-genlayer /
-- sync-genlayer-result (service role).

-- audit_logs -----------------------------------------------------------------------
alter table audit_logs enable row level security;

create policy "org members can select audit logs"
  on audit_logs for select
  using (is_org_member(org_id));

-- No insert/update/delete policies for authenticated users: audit_logs is
-- append-only and written exclusively by Edge Functions (service role).
