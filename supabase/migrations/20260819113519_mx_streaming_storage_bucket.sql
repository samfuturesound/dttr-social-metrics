insert into storage.buckets (id, name, public)
values ('mx-streaming', 'mx-streaming', false)
on conflict (id) do nothing;

drop policy if exists mx_streaming_authenticated_select on storage.objects;
create policy mx_streaming_authenticated_select on storage.objects
  for select to authenticated
  using ((bucket_id = 'mx-streaming'::text) AND public.mx_is_internal());

drop policy if exists mx_streaming_authenticated_insert on storage.objects;
create policy mx_streaming_authenticated_insert on storage.objects
  for insert to authenticated
  with check ((bucket_id = 'mx-streaming'::text) AND public.mx_is_internal());
