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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_type: string
          banner_url: string | null
          body: string
          created_at: string
          created_by: string
          display_frequency: string
          expires_at: string | null
          id: string
          is_active: boolean
          schedule_at: string | null
          target_ids: string[] | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          banner_url?: string | null
          body?: string
          created_at?: string
          created_by: string
          display_frequency?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          schedule_at?: string | null
          target_ids?: string[] | null
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          banner_url?: string | null
          body?: string
          created_at?: string
          created_by?: string
          display_frequency?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          schedule_at?: string | null
          target_ids?: string[] | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      balance_history: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          description?: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_history_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_due_dates: {
        Row: {
          created_at: string
          day_of_month: number
          grace_days: number
          id: string
          is_active: boolean
          label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_month: number
          grace_days?: number
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_month?: number
          grace_days?: number
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      challenge_attempts: {
        Row: {
          challenge_id: string
          created_at: string
          credits_spent: number
          credits_won: number
          id: string
          metadata: Json | null
          result_label: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          credits_spent: number
          credits_won?: number
          id?: string
          metadata?: Json | null
          result_label?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          credits_spent?: number
          credits_won?: number
          id?: string
          metadata?: Json | null
          result_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "credit_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          banner_url: string | null
          body: string | null
          click_count: number | null
          content_type: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          redirect_url: string | null
          sort_order: number | null
          starts_at: string | null
          subtitle: string | null
          target_audience: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          body?: string | null
          click_count?: number | null
          content_type?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          redirect_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          target_audience?: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          body?: string | null
          click_count?: number | null
          content_type?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          redirect_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_challenges: {
        Row: {
          challenge_type: string
          cost_credits: number
          created_at: string
          daily_limit: number
          description: string
          icon: string
          id: string
          is_active: boolean
          min_level: string
          name: string
          probabilities: Json
          turbo_duration_minutes: number | null
          turbo_multiplier: number | null
          updated_at: string
        }
        Insert: {
          challenge_type: string
          cost_credits?: number
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          min_level?: string
          name: string
          probabilities?: Json
          turbo_duration_minutes?: number | null
          turbo_multiplier?: number | null
          updated_at?: string
        }
        Update: {
          challenge_type?: string
          cost_credits?: number
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          min_level?: string
          name?: string
          probabilities?: Json
          turbo_duration_minutes?: number | null
          turbo_multiplier?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          bonus_credits: number
          created_at: string
          credits: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_promotions: {
        Row: {
          bonus_percentage: number
          created_at: string
          description: string
          ends_at: string
          id: string
          is_active: boolean
          starts_at: string
          title: string
        }
        Insert: {
          bonus_percentage?: number
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title: string
        }
        Update: {
          bonus_percentage?: number
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          admin_id: string | null
          bonus_amount: number
          confirmed_at: string | null
          created_at: string
          credits_amount: number
          id: string
          package_id: string
          pix_code: string | null
          pix_location: string | null
          pix_qrcode: string | null
          pix_txid: string | null
          price: number
          status: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          bonus_amount?: number
          confirmed_at?: string | null
          created_at?: string
          credits_amount: number
          id?: string
          package_id: string
          pix_code?: string | null
          pix_location?: string | null
          pix_qrcode?: string | null
          pix_txid?: string | null
          price: number
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          bonus_amount?: number
          confirmed_at?: string | null
          created_at?: string
          credits_amount?: number
          id?: string
          package_id?: string
          pix_code?: string | null
          pix_location?: string | null
          pix_qrcode?: string | null
          pix_txid?: string | null
          price?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_rankings: {
        Row: {
          bonus_awarded: number | null
          created_at: string
          id: string
          month_year: string
          rank_position: number | null
          total_credits_used: number
          total_credits_won: number
          total_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_awarded?: number | null
          created_at?: string
          id?: string
          month_year: string
          rank_position?: number | null
          total_credits_used?: number
          total_credits_won?: number
          total_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_awarded?: number | null
          created_at?: string
          id?: string
          month_year?: string
          rank_position?: number | null
          total_credits_used?: number
          total_credits_won?: number
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_rankings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_settings: {
        Row: {
          daily_purchase_limit: number
          id: string
          level_thresholds: Json
          updated_at: string
          vip_threshold: number
        }
        Insert: {
          daily_purchase_limit?: number
          id?: string
          level_thresholds?: Json
          updated_at?: string
          vip_threshold?: number
        }
        Update: {
          daily_purchase_limit?: number
          id?: string
          level_thresholds?: Json
          updated_at?: string
          vip_threshold?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_variables: {
        Row: {
          created_at: string
          default_value: string
          id: string
          is_active: boolean
          label: string
          updated_at: string
          var_key: string
        }
        Insert: {
          created_at?: string
          default_value?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          var_key: string
        }
        Update: {
          created_at?: string
          default_value?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          var_key?: string
        }
        Relationships: []
      }
      game_memory_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          pairs_found: number | null
          reward_amount: number | null
          user_id: string
          won: boolean | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          pairs_found?: number | null
          reward_amount?: number | null
          user_id: string
          won?: boolean | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          pairs_found?: number | null
          reward_amount?: number | null
          user_id?: string
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "game_memory_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_memory_settings: {
        Row: {
          cost_per_game: number
          daily_limit: number | null
          id: string
          is_active: boolean | null
          memorize_seconds: number | null
          min_time_seconds: number | null
          reward_amount: number | null
          time_limit_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          cost_per_game?: number
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          memorize_seconds?: number | null
          min_time_seconds?: number | null
          reward_amount?: number | null
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_per_game?: number
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          memorize_seconds?: number | null
          min_time_seconds?: number | null
          reward_amount?: number | null
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      game_overrides: {
        Row: {
          challenge_type: string
          created_at: string
          created_by: string
          forced_result: Json
          id: string
          is_active: boolean
          notes: string | null
          user_id: string
          uses_remaining: number
        }
        Insert: {
          challenge_type?: string
          created_at?: string
          created_by: string
          forced_result?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          user_id: string
          uses_remaining?: number
        }
        Update: {
          challenge_type?: string
          created_at?: string
          created_by?: string
          forced_result?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          user_id?: string
          uses_remaining?: number
        }
        Relationships: []
      }
      iptv_cancellation_requests: {
        Row: {
          admin_id: string | null
          admin_notes: string
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_notes?: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          admin_notes?: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iptv_cancellation_requests_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_cancellation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_payments: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          id: string
          months: number
          notes: string | null
          payment_date: string
          payment_method: string
          period_end: string
          period_start: string
          pix_copia_cola: string | null
          pix_location: string | null
          pix_txid: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          id?: string
          months?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end: string
          period_start: string
          pix_copia_cola?: string | null
          pix_location?: string | null
          pix_txid?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          months?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end?: string
          period_start?: string
          pix_copia_cola?: string | null
          pix_location?: string | null
          pix_txid?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iptv_payments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_scheduled_rates: {
        Row: {
          applied: boolean
          applied_at: string | null
          created_at: string
          created_by: string
          effective_date: string
          id: string
          new_monthly_value: number
          notes: string | null
          user_id: string
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          created_at?: string
          created_by: string
          effective_date: string
          id?: string
          new_monthly_value: number
          notes?: string | null
          user_id: string
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          created_at?: string
          created_by?: string
          effective_date?: string
          id?: string
          new_monthly_value?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iptv_scheduled_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_servers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      iptv_trust_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          requested_at: string
          status: string
          trust_expires_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          status?: string
          trust_expires_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          status?: string
          trust_expires_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iptv_trust_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iptv_trust_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_tv_apps: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      login_logs: {
        Row: {
          browser: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          logged_in_at: string
          os: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          os?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          os?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mission_completions: {
        Row: {
          completed_at: string
          id: string
          mission_id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          mission_id: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          mission_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string
          description: string
          frequency: string
          id: string
          is_active: boolean
          link: string | null
          mission_type: string
          reward_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean
          link?: string | null
          mission_type?: string
          reward_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean
          link?: string | null
          mission_type?: string
          reward_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          body_template: string
          click_url: string
          conditions: Json
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          title_template: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          body_template: string
          click_url?: string
          conditions?: Json
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          title_template: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          click_url?: string
          conditions?: Json
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          title_template?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_views: {
        Row: {
          id: string
          notification_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          notification_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          notification_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_views_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "scheduled_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          app_description: string
          app_favicon_url: string | null
          app_logo_url: string | null
          app_name: string
          app_short_name: string
          id: string
          min_withdrawal: number
          monthly_limit: number
          referral_value: number
          renewal_discount_3m_percent: number
          renewal_discount_6m_percent: number
          updated_at: string
        }
        Insert: {
          app_description?: string
          app_favicon_url?: string | null
          app_logo_url?: string | null
          app_name?: string
          app_short_name?: string
          id?: string
          min_withdrawal?: number
          monthly_limit?: number
          referral_value?: number
          renewal_discount_3m_percent?: number
          renewal_discount_6m_percent?: number
          updated_at?: string
        }
        Update: {
          app_description?: string
          app_favicon_url?: string | null
          app_logo_url?: string | null
          app_name?: string
          app_short_name?: string
          id?: string
          min_withdrawal?: number
          monthly_limit?: number
          referral_value?: number
          renewal_discount_3m_percent?: number
          renewal_discount_6m_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string
          admin_notes_urgent: boolean
          balance: number
          balance_frozen: boolean
          billing_cycle_started_at: string | null
          billing_due_date_id: string | null
          billing_first_cycle_paid: boolean
          billing_first_cycle_prorated_amount: number | null
          billing_grace_days_override: number | null
          billing_proportional_enabled: boolean
          created_at: string
          credit_purchases_blocked: boolean
          credits: number
          daily_credits_purchased: number
          daily_purchase_date: string | null
          id: string
          iptv_app: string
          iptv_client_code: string
          iptv_connections: number
          iptv_due_day: number
          iptv_expiry: string | null
          iptv_monthly_value: number
          iptv_password: string
          iptv_server: string
          iptv_status: string
          iptv_status_before_event: string | null
          iptv_tv_app: string
          iptv_user: string
          level_points: number
          name: string
          pix_key: string | null
          referral_code: string
          referred_by: string | null
          status: string
          total_earned: number
          updated_at: string
          user_level: string
          username: string
          vip_badge: boolean
        }
        Insert: {
          admin_notes?: string
          admin_notes_urgent?: boolean
          balance?: number
          balance_frozen?: boolean
          billing_cycle_started_at?: string | null
          billing_due_date_id?: string | null
          billing_first_cycle_paid?: boolean
          billing_first_cycle_prorated_amount?: number | null
          billing_grace_days_override?: number | null
          billing_proportional_enabled?: boolean
          created_at?: string
          credit_purchases_blocked?: boolean
          credits?: number
          daily_credits_purchased?: number
          daily_purchase_date?: string | null
          id: string
          iptv_app?: string
          iptv_client_code?: string
          iptv_connections?: number
          iptv_due_day?: number
          iptv_expiry?: string | null
          iptv_monthly_value?: number
          iptv_password?: string
          iptv_server?: string
          iptv_status?: string
          iptv_status_before_event?: string | null
          iptv_tv_app?: string
          iptv_user?: string
          level_points?: number
          name?: string
          pix_key?: string | null
          referral_code: string
          referred_by?: string | null
          status?: string
          total_earned?: number
          updated_at?: string
          user_level?: string
          username: string
          vip_badge?: boolean
        }
        Update: {
          admin_notes?: string
          admin_notes_urgent?: boolean
          balance?: number
          balance_frozen?: boolean
          billing_cycle_started_at?: string | null
          billing_due_date_id?: string | null
          billing_first_cycle_paid?: boolean
          billing_first_cycle_prorated_amount?: number | null
          billing_grace_days_override?: number | null
          billing_proportional_enabled?: boolean
          created_at?: string
          credit_purchases_blocked?: boolean
          credits?: number
          daily_credits_purchased?: number
          daily_purchase_date?: string | null
          id?: string
          iptv_app?: string
          iptv_client_code?: string
          iptv_connections?: number
          iptv_due_day?: number
          iptv_expiry?: string | null
          iptv_monthly_value?: number
          iptv_password?: string
          iptv_server?: string
          iptv_status?: string
          iptv_status_before_event?: string | null
          iptv_tv_app?: string
          iptv_user?: string
          level_points?: number
          name?: string
          pix_key?: string | null
          referral_code?: string
          referred_by?: string | null
          status?: string
          total_earned?: number
          updated_at?: string
          user_level?: string
          username?: string
          vip_badge?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_billing_due_date_id_fkey"
            columns: ["billing_due_date_id"]
            isOneToOne: false
            referencedRelation: "billing_due_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string
          failed_count: number | null
          icon: string | null
          id: string
          sent_by: string
          sent_count: number | null
          target_ids: string[] | null
          target_type: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          failed_count?: number | null
          icon?: string | null
          id?: string
          sent_by: string
          sent_count?: number | null
          target_ids?: string[] | null
          target_type?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          failed_count?: number | null
          icon?: string | null
          id?: string
          sent_by?: string
          sent_count?: number | null
          target_ids?: string[] | null
          target_type?: string
          title?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_vapid_keys: {
        Row: {
          created_at: string
          id: string
          private_key: string
          public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          private_key: string
          public_key: string
        }
        Update: {
          created_at?: string
          id?: string
          private_key?: string
          public_key?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_payment_id: string | null
          created_at: string
          first_payment_id: string | null
          id: string
          notes: string | null
          referred_id: string
          referrer_id: string
          reward_amount: number
          reward_months: number
          reward_type: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          bonus_payment_id?: string | null
          created_at?: string
          first_payment_id?: string | null
          id?: string
          notes?: string | null
          referred_id: string
          referrer_id: string
          reward_amount?: number
          reward_months?: number
          reward_type?: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          bonus_payment_id?: string | null
          created_at?: string
          first_payment_id?: string | null
          id?: string
          notes?: string | null
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          reward_months?: number
          reward_type?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_bonus_payment_id_fkey"
            columns: ["bonus_payment_id"]
            isOneToOne: false
            referencedRelation: "iptv_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_first_payment_id_fkey"
            columns: ["first_payment_id"]
            isOneToOne: false
            referencedRelation: "iptv_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          body_template: string
          click_action: string
          click_banner_id: string | null
          click_text_body: string | null
          click_text_title: string | null
          created_at: string
          created_by: string
          failed_count: number | null
          id: string
          is_active: boolean
          schedule_at: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          target_ids: string[] | null
          target_type: string
          title_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          click_action?: string
          click_banner_id?: string | null
          click_text_body?: string | null
          click_text_title?: string | null
          created_at?: string
          created_by: string
          failed_count?: number | null
          id?: string
          is_active?: boolean
          schedule_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          target_ids?: string[] | null
          target_type?: string
          title_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          click_action?: string
          click_banner_id?: string | null
          click_text_body?: string | null
          click_text_title?: string | null
          created_at?: string
          created_by?: string
          failed_count?: number | null
          id?: string
          is_active?: boolean
          schedule_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          target_ids?: string[] | null
          target_type?: string
          title_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_click_banner_id_fkey"
            columns: ["click_banner_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      support_settings: {
        Row: {
          assist_plus_provider: string
          blessed_player_provider: string
          id: string
          support_name: string
          support_phone: string
          support_photo_url: string | null
          updated_at: string
          whatsapp_link: string
        }
        Insert: {
          assist_plus_provider?: string
          blessed_player_provider?: string
          id?: string
          support_name?: string
          support_phone?: string
          support_photo_url?: string | null
          updated_at?: string
          whatsapp_link?: string
        }
        Update: {
          assist_plus_provider?: string
          blessed_player_provider?: string
          id?: string
          support_name?: string
          support_phone?: string
          support_photo_url?: string | null
          updated_at?: string
          whatsapp_link?: string
        }
        Relationships: []
      }
      tv_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      tv_programs: {
        Row: {
          category: string
          channel_id: string
          created_at: string
          description: string | null
          end_time: string
          id: string
          is_active: boolean
          is_highlight: boolean
          name: string
          program_date: string
          start_time: string
          thumbnail_url: string | null
        }
        Insert: {
          category?: string
          channel_id: string
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          is_highlight?: boolean
          name: string
          program_date: string
          start_time: string
          thumbnail_url?: string | null
        }
        Update: {
          category?: string
          channel_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          is_highlight?: boolean
          name?: string
          program_date?: string
          start_time?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tv_programs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          id: string
          pix_key: string
          processed_at: string | null
          receipt_url: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          id?: string
          pix_key: string
          processed_at?: string | null
          receipt_url?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          id?: string
          pix_key?: string
          processed_at?: string | null
          receipt_url?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_apply_billing_due_date_to_user: {
        Args: { p_billing_due_date_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_referrer_by_code: {
        Args: { p_referral_code: string; p_user_id: string }
        Returns: Json
      }
      auto_block_overdue_clients: { Args: never; Returns: number }
      billing_cycle_base_date: { Args: { p_user_id: string }; Returns: string }
      billing_days_in_month: {
        Args: { p_month: number; p_year: number }
        Returns: number
      }
      billing_make_date: {
        Args: { p_day: number; p_month: number; p_year: number }
        Returns: string
      }
      billing_next_due_date: {
        Args: { p_day: number; p_from: string }
        Returns: string
      }
      billing_prorated_amount: {
        Args: {
          p_due_day: number
          p_monthly_total: number
          p_start_date: string
        }
        Returns: number
      }
      format_wmc_referral_code: { Args: { p_seq: number }; Returns: string }
      generate_wmc_referral_code: { Args: never; Returns: string }
      get_my_referrals_with_names: {
        Args: never
        Returns: {
          bonus_payment_id: string
          created_at: string
          first_payment_id: string
          id: string
          notes: string
          referred_id: string
          referred_iptv_user: string
          referred_name: string
          referred_username: string
          referrer_id: string
          reward_amount: number
          reward_months: number
          reward_type: string
          rewarded_at: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_bitz_code: { Args: never; Returns: string }
      resolve_login_identifier: {
        Args: { p_identifier: string }
        Returns: {
          login_email: string
        }[]
      }
      wmc_referral_suffix: { Args: { p_group: number }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "client"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client"],
    },
  },
} as const
