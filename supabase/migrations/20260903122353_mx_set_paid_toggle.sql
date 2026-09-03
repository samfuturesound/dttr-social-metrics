-- The point of marking a post is to stop paid reach setting the organic
-- baseline. Campaign dates and spend were never needed for that, and
-- collecting them made the control look like a media-buying record.
--
-- post_interventions.kind and .started_on are both NOT NULL, so the detail
-- was coming from the schema rather than the UI. This adds a plain 'paid'
-- kind and a single toggle that fills started_on from the post's own
-- publish date, so the frontend collects nothing.
--
-- mx_add_intervention / mx_remove_intervention are left in place. They still
-- work and are the way back in if spend tracking is ever wanted.

alter table metrics.post_interventions
  drop constraint post_interventions_kind_check;

alter table metrics.post_interventions
  add constraint post_interventions_kind_check
  check (kind = any (array['paid','meta_ads','tiktok_ads','clipping','other']));

-- Idempotent toggle. Returns the resulting state, so the caller never has to
-- reason about what was already there.
create or replace function public.mx_set_paid(p_external_id text, p_paid boolean)
returns boolean
language plpgsql security definer set search_path = metrics, public as $$
declare
  v_published date;
begin
  if p_paid then
    select min(published_at)::date into v_published
    from metrics.post_detail where external_id = p_external_id;

    if v_published is null then
      raise exception 'unknown post %', p_external_id using errcode = 'no_data_found';
    end if;

    insert into metrics.post_interventions (external_id, kind, started_on, created_by)
    select p_external_id, 'paid', v_published, auth.jwt() ->> 'email'
    where not exists (
      select 1 from metrics.post_interventions
      where external_id = p_external_id and kind = 'paid'
    );
  else
    delete from metrics.post_interventions
    where external_id = p_external_id and kind = 'paid';
  end if;

  return exists (
    select 1 from metrics.post_interventions
    where external_id = p_external_id and kind = 'paid'
  );
end;
$$;

comment on function public.mx_set_paid(text, boolean) is
  'Single-click paid marker. Idempotent, returns resulting state. started_on is filled from the post publish date; no dates or spend are collected.';

revoke execute on function public.mx_set_paid(text, boolean) from public;
grant execute on function public.mx_set_paid(text, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';