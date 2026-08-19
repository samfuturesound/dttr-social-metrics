create schema if not exists metrics;

create table metrics.brands (
  id bigint generated always as identity not null,
  metricool_blog_id text not null,
  name text not null,
  brand_type text not null,
  niche text,
  owner text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table metrics.labels_list (
  id bigint generated always as identity not null,
  name text not null,
  slug text not null,
  created_at timestamp with time zone default now() not null
);

create table metrics.brand_labels (
  brand_id bigint not null,
  label_id bigint not null
);

create table metrics.raw_snapshots (
  id bigint generated always as identity not null,
  brand_id bigint not null,
  network text not null,
  content_type text not null,
  external_id text not null,
  captured_on date not null,
  payload jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table metrics.brand_shares (
  id bigint generated always as identity not null,
  brand_id bigint not null,
  token text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  label text,
  created_by text,
  created_at timestamp with time zone default now() not null,
  expires_on date,
  revoked boolean default false not null
);

create table metrics.label_shares (
  id bigint generated always as identity not null,
  label text not null,
  token text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  note text,
  created_at timestamp with time zone default now() not null,
  expires_on date,
  revoked boolean default false not null
);

create table metrics.post_notes (
  id bigint generated always as identity not null,
  external_id text not null,
  note text not null,
  author text,
  created_at timestamp with time zone default now() not null
);

create table metrics.post_interventions (
  id bigint generated always as identity not null,
  external_id text not null,
  kind text not null,
  started_on date not null,
  ended_on date,
  spend numeric,
  currency text default 'GBP'::text,
  notes text,
  created_by text,
  created_at timestamp with time zone default now() not null
);

create table metrics.streaming_captures (
  id bigint generated always as identity not null,
  track_name text not null,
  captured_on date not null,
  period_label text default '28d'::text not null,
  streams bigint,
  listeners bigint,
  saves bigint,
  playlist_adds bigint,
  src_library bigint,
  src_external bigint,
  src_search bigint,
  src_queue bigint,
  src_algorithmic bigint,
  src_editorial bigint,
  source text default 'spotify_for_artists'::text not null,
  screenshot_url text,
  raw_extract jsonb,
  triggered_by_external_id text,
  created_at timestamp with time zone default now() not null
);

create table metrics.alert_recipients (
  id bigint generated always as identity not null,
  email text not null,
  name text,
  alerts boolean default true not null,
  digest boolean default true not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);

create table metrics.ai_queries (
  id bigint generated always as identity not null,
  asked_at timestamp with time zone default now() not null,
  question text not null,
  brand_filter text,
  answer text,
  tokens_in integer,
  tokens_out integer,
  error text
);

create table metrics.debug_log (
  id bigint generated always as identity not null,
  created_at timestamp with time zone default now() not null,
  note text,
  payload jsonb
);

create table metrics.digest_sends (
  iso_year integer not null,
  iso_week integer not null,
  sent_at timestamp with time zone default now() not null
);

alter table metrics.ai_queries add constraint ai_queries_pkey PRIMARY KEY (id);
alter table metrics.alert_recipients add constraint alert_recipients_pkey PRIMARY KEY (id);
alter table metrics.brand_labels add constraint brand_labels_pkey PRIMARY KEY (brand_id, label_id);
alter table metrics.brand_shares add constraint brand_shares_pkey PRIMARY KEY (id);
alter table metrics.brands add constraint brands_pkey PRIMARY KEY (id);
alter table metrics.debug_log add constraint debug_log_pkey PRIMARY KEY (id);
alter table metrics.digest_sends add constraint digest_sends_pkey PRIMARY KEY (iso_year, iso_week);
alter table metrics.label_shares add constraint label_shares_pkey PRIMARY KEY (id);
alter table metrics.labels_list add constraint labels_list_pkey PRIMARY KEY (id);
alter table metrics.post_interventions add constraint post_interventions_pkey PRIMARY KEY (id);
alter table metrics.post_notes add constraint post_notes_pkey PRIMARY KEY (id);
alter table metrics.raw_snapshots add constraint raw_snapshots_pkey PRIMARY KEY (id);
alter table metrics.streaming_captures add constraint streaming_captures_pkey PRIMARY KEY (id);

alter table metrics.alert_recipients add constraint alert_recipients_email_key UNIQUE (email);
alter table metrics.brand_shares add constraint brand_shares_token_key UNIQUE (token);
alter table metrics.brands add constraint brands_metricool_blog_id_key UNIQUE (metricool_blog_id);
alter table metrics.label_shares add constraint label_shares_token_key UNIQUE (token);
alter table metrics.labels_list add constraint labels_list_name_key UNIQUE (name);
alter table metrics.labels_list add constraint labels_list_slug_key UNIQUE (slug);
alter table metrics.raw_snapshots add constraint raw_snapshots_brand_id_network_content_type_external_id_cap_key UNIQUE (brand_id, network, content_type, external_id, captured_on);

alter table metrics.brands add constraint brands_brand_type_check CHECK ((brand_type = ANY (ARRAY['artist'::text, 'theme'::text])));
alter table metrics.post_interventions add constraint post_interventions_kind_check CHECK ((kind = ANY (ARRAY['meta_ads'::text, 'tiktok_ads'::text, 'clipping'::text, 'other'::text])));

alter table metrics.brand_labels add constraint brand_labels_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES metrics.brands(id) ON DELETE CASCADE;
alter table metrics.brand_labels add constraint brand_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES metrics.labels_list(id) ON DELETE CASCADE;
alter table metrics.brand_shares add constraint brand_shares_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES metrics.brands(id) ON DELETE CASCADE;
alter table metrics.raw_snapshots add constraint raw_snapshots_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES metrics.brands(id) ON DELETE CASCADE;

CREATE INDEX brand_shares_token_idx ON metrics.brand_shares USING btree (token);
CREATE INDEX label_shares_token_idx ON metrics.label_shares USING btree (token);
CREATE INDEX post_interventions_ext_idx ON metrics.post_interventions USING btree (external_id, started_on);
CREATE INDEX raw_snapshots_lookup_idx ON metrics.raw_snapshots USING btree (brand_id, network, content_type, captured_on DESC);
CREATE INDEX raw_snapshots_payload_idx ON metrics.raw_snapshots USING gin (payload);
