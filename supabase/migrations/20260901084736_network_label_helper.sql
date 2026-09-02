-- initcap() renders 'tiktok' as 'Tiktok' and 'youtube' as 'Youtube'. Small thing,
-- but it is in the subject-adjacent part of an email that goes to the label.

create or replace function public.mx_network_label(p_network text)
returns text
language sql
immutable
as $function$
  select case lower(coalesce(p_network,''))
    when 'tiktok'    then 'TikTok'
    when 'youtube'   then 'YouTube'
    when 'instagram' then 'Instagram'
    when 'facebook'  then 'Facebook'
    when 'linkedin'  then 'LinkedIn'
    when 'threads'   then 'Threads'
    when 'x'         then 'X'
    when 'twitter'   then 'X'
    else initcap(coalesce(p_network,''))
  end;
$function$;
