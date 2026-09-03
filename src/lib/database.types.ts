// Generated from the pvyyaiaaqikvilukcqva schema. Do not edit by hand.
//
// Regenerate after any migration that changes a view or function signature:
//   supabase gen types typescript --project-id pvyyaiaaqikvilukcqva
// (or the generate_typescript_types MCP tool, which is how this was produced —
// there is no Supabase CLI on this machine.)
//
// The client is not yet parameterised with `Database`; doing that would retype
// every `.from(...).select("*")` in data.ts at once, since view columns all come
// back nullable. What this file is used for today is pinning the RPC return
// shapes that data.ts maps by hand — see TrendRpcRow in data.ts, which is what
// caught paid_excluded being appended to the share trend functions.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      mx_account_scores: {
        Row: {
          avg_multiple: number | null
          best_multiple: number | null
          brand_name: string | null
          brand_type: string | null
          labels: string[] | null
          owner: string | null
          posts: number | null
          total_score: number | null
          total_views: number | null
        }
        Relationships: []
      }
      mx_ai_queries: {
        Row: {
          asked_at: string | null
          brand_filter: string | null
          error: string | null
          id: number | null
          question: string | null
        }
        Insert: {
          asked_at?: string | null
          brand_filter?: string | null
          error?: string | null
          id?: number | null
          question?: string | null
        }
        Update: {
          asked_at?: string | null
          brand_filter?: string | null
          error?: string | null
          id?: number | null
          question?: string | null
        }
        Relationships: []
      }
      mx_alert_recipient_list: {
        Row: {
          alert_emails: string | null
          digest_emails: string | null
        }
        Relationships: []
      }
      mx_alert_recipients: {
        Row: {
          active: boolean | null
          alerts: boolean | null
          created_at: string | null
          digest: boolean | null
          email: string | null
          id: number | null
          name: string | null
        }
        Insert: {
          active?: boolean | null
          alerts?: boolean | null
          created_at?: string | null
          digest?: boolean | null
          email?: string | null
          id?: number | null
          name?: string | null
        }
        Update: {
          active?: boolean | null
          alerts?: boolean | null
          created_at?: string | null
          digest?: boolean | null
          email?: string | null
          id?: number | null
          name?: string | null
        }
        Relationships: []
      }
      mx_alerts: {
        Row: {
          age_days: number | null
          brand_id: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          captured_now: string | null
          captured_prev: string | null
          content_type: string | null
          external_id: string | null
          growth_since_last_pct: number | null
          is_reescalation: boolean | null
          labels: string[] | null
          last_sent_on: string | null
          median_views: number | null
          multiple_prev: number | null
          network: string | null
          permalink: string | null
          published_at: string | null
          reason: string | null
          thumbnail_url: string | null
          views_at_last_send: number | null
          views_gained: number | null
          views_multiple: number | null
          views_now: number | null
          views_pct_change: number | null
          views_prev: number | null
        }
        Relationships: []
      }
      mx_best: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          comments: number | null
          content_type: string | null
          engagement_pct: number | null
          external_id: string | null
          is_assisted: boolean | null
          labels: string[] | null
          likes: number | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          sample_size: number | null
          saves: number | null
          shares: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_brand_platform_ranks: {
        Row: {
          brand_id: number | null
          brand_name: string | null
          brand_type: string | null
          completion_available: number | null
          content_type: string | null
          labels: string[] | null
          last_post: string | null
          median_completion_pct: number | null
          median_engagement_rate: number | null
          median_views: number | null
          network: string | null
          posts: number | null
          rank_completion_all: number | null
          rank_completion_type: number | null
          rank_eng_all: number | null
          rank_eng_type: number | null
          rank_views_all: number | null
          rank_views_type: number | null
          total_completion_all: number | null
          total_completion_type: number | null
          total_eng_all: number | null
          total_eng_type: number | null
          total_views_all: number | null
          total_views_type: number | null
          views: number | null
        }
        Relationships: []
      }
      mx_brand_platform_summary: {
        Row: {
          brand_id: number | null
          brand_name: string | null
          brand_type: string | null
          completion_available: number | null
          content_type: string | null
          labels: string[] | null
          last_post: string | null
          median_completion_pct: number | null
          median_engagement_rate: number | null
          median_views: number | null
          network: string | null
          posts: number | null
          views: number | null
        }
        Relationships: []
      }
      mx_brand_skip_rates: {
        Row: {
          brand_name: string | null
          content_type: string | null
          median_skip_rate: number | null
          network: string | null
          reels_counted: number | null
        }
        Relationships: []
      }
      mx_brand_summary: {
        Row: {
          active: boolean | null
          brand_id: number | null
          brand_name: string | null
          brand_type: string | null
          first_post: string | null
          labels: string[] | null
          last_post: string | null
          median_completion_pct: number | null
          median_engagement_rate: number | null
          median_views: number | null
          metricool_blog_id: string | null
          niche: string | null
          owner: string | null
          posts_3m: number | null
          posts_all_time: number | null
          views_3m: number | null
          views_all_time: number | null
        }
        Relationships: []
      }
      mx_brands: {
        Row: {
          active: boolean | null
          brand_type: string | null
          id: number | null
          labels: string[] | null
          metricool_blog_id: string | null
          name: string | null
          niche: string | null
          owner: string | null
        }
        Relationships: []
      }
      mx_breakout_candidates: {
        Row: {
          age_days: number | null
          brand_id: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          captured_now: string | null
          captured_prev: string | null
          content_type: string | null
          external_id: string | null
          labels: string[] | null
          median_views: number | null
          multiple_prev: number | null
          network: string | null
          permalink: string | null
          published_at: string | null
          thumbnail_url: string | null
          views_gained: number | null
          views_multiple: number | null
          views_now: number | null
          views_pct_change: number | null
          views_prev: number | null
        }
        Relationships: []
      }
      mx_digest: {
        Row: {
          above_baseline_14d: number | null
          last_pull: string | null
          live_alerts: number | null
          posts_14d: number | null
          views_14d: number | null
        }
        Relationships: []
      }
      mx_digest_leading: {
        Row: {
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          content_type: string | null
          median_views: number | null
          network: string | null
          permalink: string | null
          published: string | null
          skip_rate: number | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_flagged: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          content_type: string | null
          engagement_pct: number | null
          engagements: number | null
          external_id: string | null
          is_assisted: boolean | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          sample_size: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_flagged_interim: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          content_type: string | null
          engagement_pct: number | null
          external_id: string | null
          is_assisted: boolean | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          sample_size: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_interventions: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          ended_on: string | null
          external_id: string | null
          id: number | null
          kind: string | null
          notes: string | null
          spend: number | null
          started_on: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          ended_on?: string | null
          external_id?: string | null
          id?: number | null
          kind?: string | null
          notes?: string | null
          spend?: number | null
          started_on?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          ended_on?: string | null
          external_id?: string | null
          id?: number | null
          kind?: string | null
          notes?: string | null
          spend?: number | null
          started_on?: string | null
        }
        Relationships: []
      }
      mx_labels: {
        Row: {
          active_brands: number | null
          artist_brands: number | null
          brands: number | null
          label_id: number | null
          name: string | null
          slug: string | null
          theme_brands: number | null
        }
        Relationships: []
      }
      mx_leaderboard: {
        Row: {
          growth_multiple: number | null
          month: string | null
          owner: string | null
        }
        Relationships: []
      }
      mx_leading: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          comments: number | null
          content_type: string | null
          engagement_pct: number | null
          external_id: string | null
          is_assisted: boolean | null
          labels: string[] | null
          likes: number | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          sample_size: number | null
          saves: number | null
          shares: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_movers: {
        Row: {
          age_days: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          captured_now: string | null
          captured_prev: string | null
          content_type: string | null
          external_id: string | null
          labels: string[] | null
          network: string | null
          permalink: string | null
          published_at: string | null
          thumbnail_url: string | null
          views_gained: number | null
          views_now: number | null
          views_pct_change: number | null
          views_prev: number | null
        }
        Relationships: []
      }
      mx_notes: {
        Row: {
          author: string | null
          created_at: string | null
          external_id: string | null
          id: number | null
          note: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: number | null
          note?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: number | null
          note?: string | null
        }
        Relationships: []
      }
      mx_period: {
        Row: {
          period_days: number | null
          period_end: string | null
          period_start: string | null
        }
        Relationships: []
      }
      mx_post_detail: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          comments: number | null
          completion_pct: number | null
          content_type: string | null
          duration_seconds: number | null
          engagement_multiple: number | null
          engagement_pct: number | null
          engagement_rate: number | null
          external_id: string | null
          follows: number | null
          is_assisted: boolean | null
          labels: string[] | null
          likes: number | null
          median_completion_pct: number | null
          median_engagement_rate: number | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          reach: number | null
          sample_size: number | null
          saves: number | null
          shares: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
          weighted_engagement: number | null
        }
        Relationships: []
      }
      mx_recent: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          comments: number | null
          content_type: string | null
          engagement_pct: number | null
          external_id: string | null
          is_assisted: boolean | null
          labels: string[] | null
          likes: number | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          rn: number | null
          sample_size: number | null
          saves: number | null
          shares: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_recent_breakouts: {
        Row: {
          brand_name: string | null
          caption: string | null
          content_type: string | null
          external_id: string | null
          first_sent_on: string | null
          last_sent_on: string | null
          median_views: number | null
          network: string | null
          permalink: string | null
          published_at: string | null
          send_count: number | null
          views_at_last_send: number | null
          views_multiple: number | null
          views_now: number | null
          views_since_last_send: number | null
        }
        Relationships: []
      }
      mx_skip_roster: {
        Row: {
          best_skip_rate: number | null
          reels_counted: number | null
          roster_median: number | null
          worst_skip_rate: number | null
        }
        Relationships: []
      }
      mx_snapshots: {
        Row: {
          age_days: number | null
          avg_watch_seconds: number | null
          brand_id: number | null
          caption: string | null
          captured_on: string | null
          comments: number | null
          content_type: string | null
          duration_seconds: number | null
          engagement_pct: number | null
          engagements: number | null
          external_id: string | null
          follows: number | null
          id: number | null
          likes: number | null
          network: string | null
          permalink: string | null
          published_at: string | null
          reach: number | null
          reposts: number | null
          saves: number | null
          shares: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
        }
        Insert: {
          age_days?: never
          avg_watch_seconds?: never
          brand_id?: number | null
          caption?: never
          captured_on?: string | null
          comments?: never
          content_type?: string | null
          duration_seconds?: never
          engagement_pct?: never
          engagements?: never
          external_id?: string | null
          follows?: never
          id?: number | null
          likes?: never
          network?: string | null
          permalink?: never
          published_at?: never
          reach?: never
          reposts?: never
          saves?: never
          shares?: never
          skip_rate?: never
          thumbnail_url?: never
          views?: never
        }
        Update: {
          age_days?: never
          avg_watch_seconds?: never
          brand_id?: number | null
          caption?: never
          captured_on?: string | null
          comments?: never
          content_type?: string | null
          duration_seconds?: never
          engagement_pct?: never
          engagements?: never
          external_id?: string | null
          follows?: never
          id?: number | null
          likes?: never
          network?: string | null
          permalink?: never
          published_at?: never
          reach?: never
          reposts?: never
          saves?: never
          shares?: never
          skip_rate?: never
          thumbnail_url?: never
          views?: never
        }
        Relationships: []
      }
      mx_streaming: {
        Row: {
          active_streams: number | null
          captured_on: string | null
          created_at: string | null
          id: number | null
          listeners: number | null
          pct_active: number | null
          period_label: string | null
          playlist_adds: number | null
          programmed_streams: number | null
          raw_extract: Json | null
          save_rate: number | null
          saves: number | null
          screenshot_url: string | null
          source: string | null
          src_algorithmic: number | null
          src_editorial: number | null
          src_external: number | null
          src_library: number | null
          src_queue: number | null
          src_search: number | null
          streams: number | null
          track_name: string | null
          triggered_by_external_id: string | null
        }
        Insert: {
          active_streams?: never
          captured_on?: string | null
          created_at?: string | null
          id?: number | null
          listeners?: number | null
          pct_active?: never
          period_label?: string | null
          playlist_adds?: number | null
          programmed_streams?: never
          raw_extract?: Json | null
          save_rate?: never
          saves?: number | null
          screenshot_url?: string | null
          source?: string | null
          src_algorithmic?: number | null
          src_editorial?: number | null
          src_external?: number | null
          src_library?: number | null
          src_queue?: number | null
          src_search?: number | null
          streams?: number | null
          track_name?: string | null
          triggered_by_external_id?: string | null
        }
        Update: {
          active_streams?: never
          captured_on?: string | null
          created_at?: string | null
          id?: number | null
          listeners?: number | null
          pct_active?: never
          period_label?: string | null
          playlist_adds?: number | null
          programmed_streams?: never
          raw_extract?: Json | null
          save_rate?: never
          saves?: number | null
          screenshot_url?: string | null
          source?: string | null
          src_algorithmic?: number | null
          src_editorial?: number | null
          src_external?: number | null
          src_library?: number | null
          src_queue?: number | null
          src_search?: number | null
          streams?: number | null
          track_name?: string | null
          triggered_by_external_id?: string | null
        }
        Relationships: []
      }
      mx_top_views: {
        Row: {
          age_days: number | null
          assist_kinds: string | null
          assisted_from: string | null
          avg_watch_seconds: number | null
          brand_name: string | null
          brand_type: string | null
          caption: string | null
          comments: number | null
          content_type: string | null
          engagement_pct: number | null
          external_id: string | null
          is_assisted: boolean | null
          labels: string[] | null
          likes: number | null
          median_views: number | null
          network: string | null
          owner: string | null
          permalink: string | null
          published_at: string | null
          sample_size: number | null
          saves: number | null
          shares: number | null
          skip_rate: number | null
          thumbnail_url: string | null
          views: number | null
          views_multiple: number | null
        }
        Relationships: []
      }
      mx_trend: {
        Row: {
          brand_id: number | null
          brand_name: string | null
          brand_type: string | null
          content_type: string | null
          growth_multiple: number | null
          labels: string[] | null
          median_engagement_rate: number | null
          median_views: number | null
          month: string | null
          network: string | null
          paid_excluded: number | null
          posts: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      mx_add_brand: {
        Args: {
          p_brand_type: string
          p_metricool_blog_id: string
          p_name: string
          p_niche?: string
          p_owner?: string
        }
        Returns: number
      }
      mx_add_intervention: {
        Args: {
          p_created_by?: string
          p_ended_on?: string
          p_external_id: string
          p_kind: string
          p_notes?: string
          p_spend?: number
          p_started_on: string
        }
        Returns: number
      }
      mx_add_label: { Args: { p_name: string }; Returns: number }
      mx_add_note: {
        Args: { p_author?: string; p_external_id: string; p_note: string }
        Returns: number
      }
      mx_add_streaming_capture: { Args: { p_payload: Json }; Returns: number }
      mx_ai_context: {
        Args: { p_brand?: string; p_days?: number }
        Returns: Json
      }
      mx_alert_claim: { Args: never; Returns: Json }
      mx_alert_payload: { Args: never; Returns: Json }
      mx_assert_internal: { Args: never; Returns: undefined }
      mx_create_label_share: {
        Args: { p_expires_on?: string; p_label: string; p_note?: string }
        Returns: string
      }
      mx_create_share: {
        Args: { p_brand_id: number; p_expires_on?: string; p_label?: string }
        Returns: string
      }
      mx_debug: {
        Args: { p_note: string; p_payload: Json }
        Returns: undefined
      }
      mx_digest_claim: { Args: never; Returns: Json }
      mx_digest_payload: { Args: never; Returns: Json }
      mx_ingest: {
        Args: {
          p_body: Json
          p_brand_id: number
          p_captured_on: string
          p_content_type: string
          p_network: string
        }
        Returns: number
      }
      mx_is_digest_week: { Args: never; Returns: boolean }
      mx_is_internal: { Args: never; Returns: boolean }
      mx_label_share_name: { Args: { p_token: string }; Returns: string }
      mx_label_share_posts: {
        Args: { p_token: string }
        Returns: {
          age_days: number
          brand_name: string
          caption: string
          comments: number
          completion_pct: number
          content_type: string
          engagement_multiple: number
          engagement_rate: number
          external_id: string
          likes: number
          median_views: number
          network: string
          permalink: string
          published_at: string
          saves: number
          shares: number
          skip_rate: number
          thumbnail_url: string
          views: number
          views_multiple: number
        }[]
      }
      mx_label_share_summary: {
        Args: { p_token: string }
        Returns: {
          brand_name: string
          content_type: string
          last_post: string
          median_completion_pct: number
          median_engagement_rate: number
          median_views: number
          network: string
          posts: number
          views: number
        }[]
      }
      mx_label_share_trend: {
        Args: { p_token: string }
        Returns: {
          brand_name: string
          content_type: string
          growth_multiple: number
          median_engagement_rate: number
          median_views: number
          month: string
          network: string
          paid_excluded: number
          posts: number
        }[]
      }
      mx_list_label_shares: {
        Args: never
        Returns: {
          created_at: string
          expires_on: string
          id: number
          label: string
          note: string
          revoked: boolean
          token: string
        }[]
      }
      mx_list_shares: {
        Args: never
        Returns: {
          brand_id: number
          brand_name: string
          created_at: string
          expires_on: string
          id: number
          label: string
          revoked: boolean
          token: string
        }[]
      }
      mx_log_ai_query: {
        Args: {
          p_answer: string
          p_brand: string
          p_error?: string
          p_question: string
          p_tokens_in?: number
          p_tokens_out?: number
        }
        Returns: number
      }
      mx_network_label: { Args: { p_network: string }; Returns: string }
      mx_refresh_derived: { Args: never; Returns: string }
      mx_remove_intervention: { Args: { p_id: number }; Returns: undefined }
      mx_revoke_label_share: { Args: { p_id: number }; Returns: undefined }
      mx_revoke_share: { Args: { p_id: number }; Returns: undefined }
      mx_secure_metrics_views: { Args: never; Returns: string }
      mx_set_brand_active: {
        Args: { p_active: boolean; p_brand_id: number }
        Returns: undefined
      }
      mx_set_brand_label: {
        Args: { p_brand_id: number; p_label_name: string; p_on: boolean }
        Returns: undefined
      }
      mx_set_paid: {
        Args: { p_external_id: string; p_paid: boolean }
        Returns: boolean
      }
      mx_set_recipient: {
        Args: {
          p_active?: boolean
          p_alerts?: boolean
          p_digest?: boolean
          p_email: string
          p_name?: string
        }
        Returns: number
      }
      mx_share_brand_id: { Args: { p_token: string }; Returns: number }
      mx_share_posts: {
        Args: { p_token: string }
        Returns: {
          age_days: number
          brand_name: string
          caption: string
          comments: number
          completion_pct: number
          content_type: string
          engagement_multiple: number
          engagement_rate: number
          external_id: string
          likes: number
          median_views: number
          network: string
          permalink: string
          published_at: string
          saves: number
          shares: number
          skip_rate: number
          thumbnail_url: string
          views: number
          views_multiple: number
        }[]
      }
      mx_share_summary: {
        Args: { p_token: string }
        Returns: {
          brand_name: string
          content_type: string
          last_post: string
          median_completion_pct: number
          median_engagement_rate: number
          median_views: number
          network: string
          posts: number
          views: number
        }[]
      }
      mx_share_trend: {
        Args: { p_token: string }
        Returns: {
          content_type: string
          growth_multiple: number
          median_engagement_rate: number
          median_views: number
          month: string
          network: string
          paid_excluded: number
          posts: number
        }[]
      }
      mx_upsert_snapshot: {
        Args: {
          p_brand_id: number
          p_captured_on: string
          p_content_type: string
          p_external_id: string
          p_network: string
          p_payload: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
