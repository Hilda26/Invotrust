-- Private bucket for uploaded invoice documents (PDF/PNG/JPG).
-- Files are stored at <org_id>/<invoice_id>/<filename> and accessed only via
-- short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values ('invoice-files', 'invoice-files', false)
on conflict (id) do nothing;

create policy "org members can read their org's invoice files"
  on storage.objects for select
  using (
    bucket_id = 'invoice-files'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "finance roles can upload invoice files"
  on storage.objects for insert
  with check (
    bucket_id = 'invoice-files'
    and has_org_role((storage.foldername(name))[1]::uuid, array['finance_reviewer', 'admin', 'owner'])
  );

create policy "finance roles can delete invoice files"
  on storage.objects for delete
  using (
    bucket_id = 'invoice-files'
    and has_org_role((storage.foldername(name))[1]::uuid, array['finance_reviewer', 'admin', 'owner'])
  );
