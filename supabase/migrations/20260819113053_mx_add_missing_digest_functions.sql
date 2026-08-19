CREATE OR REPLACE FUNCTION public.mx_is_digest_week()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select (extract(week from current_date)::int % 2) = 0;
$function$;

CREATE OR REPLACE FUNCTION public.mx_digest_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'metrics', 'public'
AS $function$
declare
  claimed boolean := false;
  y int := extract(isoyear from current_date)::int;
  w int := extract(week from current_date)::int;
  payload jsonb;
begin
  -- only even ISO weeks are digest weeks
  if (w % 2) <> 0 then
    return jsonb_build_object('should_send', false, 'reason', 'not a digest week');
  end if;

  insert into metrics.digest_sends (iso_year, iso_week)
  values (y, w)
  on conflict (iso_year, iso_week) do nothing;

  get diagnostics claimed = row_count;

  if not claimed then
    return jsonb_build_object('should_send', false, 'reason', 'already sent this week');
  end if;

  payload := public.mx_digest_payload();
  return payload || jsonb_build_object(
    'should_send', ((payload->>'post_count')::int > 0),
    'reason', case when (payload->>'post_count')::int > 0
                   then 'sending' else 'no posts in period' end);
end; $function$;
