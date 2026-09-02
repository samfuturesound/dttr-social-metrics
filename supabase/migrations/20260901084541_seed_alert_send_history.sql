-- Seed the send history with posts that are already over both marks and have
-- already been emailed about under the old logic. Without this, every current
-- candidate would be treated as brand new and fire once more tomorrow.
-- Recorded at today's view count, so each one now needs +50% to speak again.

insert into metrics.alert_sends
  (external_id, network, content_type, brand_id, views_at_send, multiple_at_send, sent_on)
select external_id, network, content_type, brand_id, views_now, views_multiple, current_date
from metrics.breakout_candidates
on conflict (external_id, network, content_type, sent_on) do nothing;
