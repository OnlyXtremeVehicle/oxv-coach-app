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
      admin_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "admin_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_progression_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          included_metrics: Json
          last_viewed_at: string | null
          revoked_at: string | null
          share_scope: string
          share_token: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          included_metrics?: Json
          last_viewed_at?: string | null
          revoked_at?: string | null
          share_scope: string
          share_token: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          included_metrics?: Json
          last_viewed_at?: string | null
          revoked_at?: string | null
          share_scope?: string
          share_token?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_progression_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "app_progression_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "app_progression_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_segment_analyses: {
        Row: {
          algo_version: string
          apex_speed_kmh: number | null
          avg_lateral_error_m: number | null
          avg_speed_kmh: number | null
          computed_at: string
          duration_seconds: number | null
          end_progress: number | null
          entry_speed_kmh: number | null
          exit_speed_kmh: number | null
          id: string
          kind: string | null
          margin_percent: number | null
          margin_zone: string | null
          max_g_accel: number | null
          max_g_braking: number | null
          max_g_lateral: number | null
          max_lateral_error_m: number | null
          max_speed_kmh: number | null
          min_speed_kmh: number | null
          sample_count: number | null
          segment_index: number
          segment_name: string | null
          start_progress: number | null
          telemetry_session_id: string
          user_id: string
        }
        Insert: {
          algo_version?: string
          apex_speed_kmh?: number | null
          avg_lateral_error_m?: number | null
          avg_speed_kmh?: number | null
          computed_at?: string
          duration_seconds?: number | null
          end_progress?: number | null
          entry_speed_kmh?: number | null
          exit_speed_kmh?: number | null
          id?: string
          kind?: string | null
          margin_percent?: number | null
          margin_zone?: string | null
          max_g_accel?: number | null
          max_g_braking?: number | null
          max_g_lateral?: number | null
          max_lateral_error_m?: number | null
          max_speed_kmh?: number | null
          min_speed_kmh?: number | null
          sample_count?: number | null
          segment_index: number
          segment_name?: string | null
          start_progress?: number | null
          telemetry_session_id: string
          user_id: string
        }
        Update: {
          algo_version?: string
          apex_speed_kmh?: number | null
          avg_lateral_error_m?: number | null
          avg_speed_kmh?: number | null
          computed_at?: string
          duration_seconds?: number | null
          end_progress?: number | null
          entry_speed_kmh?: number | null
          exit_speed_kmh?: number | null
          id?: string
          kind?: string | null
          margin_percent?: number | null
          margin_zone?: string | null
          max_g_accel?: number | null
          max_g_braking?: number | null
          max_g_lateral?: number | null
          max_lateral_error_m?: number | null
          max_speed_kmh?: number | null
          min_speed_kmh?: number | null
          sample_count?: number | null
          segment_index?: number
          segment_name?: string | null
          start_progress?: number | null
          telemetry_session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_segment_analyses_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "app_segment_analyses_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_segment_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "app_segment_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "app_segment_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_session_analyses: {
        Row: {
          algo_version: string
          computed_at: string
          debrief_generated_at: string | null
          debrief_text: string | null
          id: string
          margin_breakdown: Json | null
          margin_global: number | null
          margin_pilot: number | null
          margin_vehicle: number | null
          margin_zone: string | null
          next_focus_corner_index: number | null
          next_focus_phrase: string | null
          pact_accepted_at: string | null
          pact_version: string | null
          telemetry_session_id: string
          user_id: string
        }
        Insert: {
          algo_version?: string
          computed_at?: string
          debrief_generated_at?: string | null
          debrief_text?: string | null
          id?: string
          margin_breakdown?: Json | null
          margin_global?: number | null
          margin_pilot?: number | null
          margin_vehicle?: number | null
          margin_zone?: string | null
          next_focus_corner_index?: number | null
          next_focus_phrase?: string | null
          pact_accepted_at?: string | null
          pact_version?: string | null
          telemetry_session_id: string
          user_id: string
        }
        Update: {
          algo_version?: string
          computed_at?: string
          debrief_generated_at?: string | null
          debrief_text?: string | null
          id?: string
          margin_breakdown?: Json | null
          margin_global?: number | null
          margin_pilot?: number | null
          margin_vehicle?: number | null
          margin_zone?: string | null
          next_focus_corner_index?: number | null
          next_focus_phrase?: string | null
          pact_accepted_at?: string | null
          pact_version?: string | null
          telemetry_session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_session_analyses_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: true
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "app_session_analyses_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: true
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_session_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "app_session_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "app_session_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          billing_enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          billing_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          billing_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          body: string
          category: string
          created_at: string
          cta_label: string | null
          cta_page: string | null
          date: string
          date_label: string | null
          featured: boolean
          id: string
          lead: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          cta_label?: string | null
          cta_page?: string | null
          date?: string
          date_label?: string | null
          featured?: boolean
          id: string
          lead: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          cta_label?: string | null
          cta_page?: string | null
          date?: string
          date_label?: string | null
          featured?: boolean
          id?: string
          lead?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      circuit_services: {
        Row: {
          address: string | null
          circuit_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          is_premium: boolean
          is_published: boolean
          kind: string
          lat: number | null
          lon: number | null
          media: Json
          name: string
          organizer: string | null
          owner_id: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          circuit_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          kind: string
          lat?: number | null
          lon?: number | null
          media?: Json
          name: string
          organizer?: string | null
          owner_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          circuit_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_premium?: boolean
          is_published?: boolean
          kind?: string
          lat?: number | null
          lon?: number | null
          media?: Json
          name?: string
          organizer?: string | null
          owner_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circuit_services_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      circuits: {
        Row: {
          bbox_max_lat: number | null
          bbox_max_lon: number | null
          bbox_min_lat: number | null
          bbox_min_lon: number | null
          best_lap_seconds: number | null
          centerline_latlon: Json | null
          city: string | null
          corners: Json | null
          corners_computed_at: string | null
          corners_engine_version: string | null
          created_at: string
          description: string | null
          finish_line_heading: number | null
          finish_line_lat: number
          finish_line_lon: number
          finish_line_radius_m: number | null
          id: string
          is_default: boolean | null
          is_official: boolean | null
          length_km: number | null
          name: string
          official_name: string | null
          region: string | null
          review_status: string
          total_sessions: number | null
          track_svg_path: string | null
          turns_count: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bbox_max_lat?: number | null
          bbox_max_lon?: number | null
          bbox_min_lat?: number | null
          bbox_min_lon?: number | null
          best_lap_seconds?: number | null
          centerline_latlon?: Json | null
          city?: string | null
          corners?: Json | null
          corners_computed_at?: string | null
          corners_engine_version?: string | null
          created_at?: string
          description?: string | null
          finish_line_heading?: number | null
          finish_line_lat: number
          finish_line_lon: number
          finish_line_radius_m?: number | null
          id?: string
          is_default?: boolean | null
          is_official?: boolean | null
          length_km?: number | null
          name: string
          official_name?: string | null
          region?: string | null
          review_status?: string
          total_sessions?: number | null
          track_svg_path?: string | null
          turns_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bbox_max_lat?: number | null
          bbox_max_lon?: number | null
          bbox_min_lat?: number | null
          bbox_min_lon?: number | null
          best_lap_seconds?: number | null
          centerline_latlon?: Json | null
          city?: string | null
          corners?: Json | null
          corners_computed_at?: string | null
          corners_engine_version?: string | null
          created_at?: string
          description?: string | null
          finish_line_heading?: number | null
          finish_line_lat?: number
          finish_line_lon?: number
          finish_line_radius_m?: number | null
          id?: string
          is_default?: boolean | null
          is_official?: boolean | null
          length_km?: number | null
          name?: string
          official_name?: string | null
          region?: string | null
          review_status?: string
          total_sessions?: number | null
          track_svg_path?: string | null
          turns_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circuits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "circuits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "circuits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_annotation_template: {
        Row: {
          body: string
          coach_id: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          body: string
          coach_id: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          body?: string
          coach_id?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_annotation_template_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_annotation_template_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_annotation_template_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_annotations: {
        Row: {
          audio_url: string | null
          body: string
          coach_id: string
          corner_index: number
          created_at: string
          deleted_at: string | null
          id: string
          lap_index: number | null
          marker_s_norm: number | null
          pilot_id: string
          telemetry_session_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          audio_url?: string | null
          body: string
          coach_id: string
          corner_index: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          lap_index?: number | null
          marker_s_norm?: number | null
          pilot_id: string
          telemetry_session_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          audio_url?: string | null
          body?: string
          coach_id?: string
          corner_index?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          lap_index?: number | null
          marker_s_norm?: number | null
          pilot_id?: string
          telemetry_session_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_annotations_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "coach_annotations_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          capacity: number
          circuit_name: string
          coach_id: string
          created_at: string
          ends_at: string | null
          id: string
          notes: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          circuit_name?: string
          coach_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          circuit_name?: string
          coach_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_corner_reference: {
        Row: {
          braking_point_m: number | null
          circuit_id: string
          coach_id: string
          corner_index: number
          created_at: string
          id: string
          target_speed_kmh: number | null
          trajectory_note: string | null
          updated_at: string
        }
        Insert: {
          braking_point_m?: number | null
          circuit_id: string
          coach_id: string
          corner_index: number
          created_at?: string
          id?: string
          target_speed_kmh?: number | null
          trajectory_note?: string | null
          updated_at?: string
        }
        Update: {
          braking_point_m?: number | null
          circuit_id?: string
          coach_id?: string
          corner_index?: number
          created_at?: string
          id?: string
          target_speed_kmh?: number | null
          trajectory_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_corner_reference_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_corner_reference_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_corner_reference_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_corner_reference_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_objective_events: {
        Row: {
          coach_id: string
          created_at: string
          from_status: string | null
          id: string
          kind: string
          objective_id: string
          pilot_id: string
          to_status: string | null
          value_at: number | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          kind: string
          objective_id: string
          pilot_id: string
          to_status?: string | null
          value_at?: number | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          kind?: string
          objective_id?: string
          pilot_id?: string
          to_status?: string | null
          value_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_objective_events_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "coach_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_objectives: {
        Row: {
          achieved_at: string | null
          baseline_value: number | null
          circuit_id: string | null
          coach_id: string
          corner_index: number | null
          created_at: string
          detail: string | null
          id: string
          metric: Database["public"]["Enums"]["objective_metric"]
          pilot_id: string
          priority: number
          status: Database["public"]["Enums"]["objective_status"]
          target_direction: Database["public"]["Enums"]["objective_direction"]
          target_value: number | null
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          baseline_value?: number | null
          circuit_id?: string | null
          coach_id: string
          corner_index?: number | null
          created_at?: string
          detail?: string | null
          id?: string
          metric?: Database["public"]["Enums"]["objective_metric"]
          pilot_id: string
          priority?: number
          status?: Database["public"]["Enums"]["objective_status"]
          target_direction?: Database["public"]["Enums"]["objective_direction"]
          target_value?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          baseline_value?: number | null
          circuit_id?: string | null
          coach_id?: string
          corner_index?: number | null
          created_at?: string
          detail?: string | null
          id?: string
          metric?: Database["public"]["Enums"]["objective_metric"]
          pilot_id?: string
          priority?: number
          status?: Database["public"]["Enums"]["objective_status"]
          target_direction?: Database["public"]["Enums"]["objective_direction"]
          target_value?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_objectives_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_objectives_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_objectives_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_objectives_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_objectives_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_objectives_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_objectives_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_permissions: {
        Row: {
          can_manage_own_sessions: boolean
          can_view_business_dashboard: boolean
          can_view_pilots: boolean
          granted_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_own_sessions?: boolean
          can_view_business_dashboard?: boolean
          can_view_pilots?: boolean
          granted_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_own_sessions?: boolean
          can_view_business_dashboard?: boolean
          can_view_pilots?: boolean
          granted_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_pilot_highlight: {
        Row: {
          coach_id: string
          created_at: string
          highlight_corner_indexes: number[]
          id: string
          note: string | null
          pilot_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          highlight_corner_indexes?: number[]
          id?: string
          note?: string | null
          pilot_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          highlight_corner_indexes?: number[]
          id?: string
          note?: string | null
          pilot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_pilot_highlight_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_pilot_highlight_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_pilot_highlight_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_pilot_highlight_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_pilot_highlight_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_pilot_highlight_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_pilots: {
        Row: {
          active: boolean
          affiliation_price_eur: number | null
          coach_consent_at: string | null
          coach_id: string
          created_at: string
          created_by: string | null
          id: string
          initiated_by: Database["public"]["Enums"]["affiliation_initiator"]
          level: Database["public"]["Enums"]["coach_access_level"]
          notes: string | null
          pilot_consent_at: string | null
          pilot_id: string
          status: Database["public"]["Enums"]["affiliation_status"]
        }
        Insert: {
          active?: boolean
          affiliation_price_eur?: number | null
          coach_consent_at?: string | null
          coach_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          initiated_by?: Database["public"]["Enums"]["affiliation_initiator"]
          level?: Database["public"]["Enums"]["coach_access_level"]
          notes?: string | null
          pilot_consent_at?: string | null
          pilot_id: string
          status?: Database["public"]["Enums"]["affiliation_status"]
        }
        Update: {
          active?: boolean
          affiliation_price_eur?: number | null
          coach_consent_at?: string | null
          coach_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          initiated_by?: Database["public"]["Enums"]["affiliation_initiator"]
          level?: Database["public"]["Enums"]["coach_access_level"]
          notes?: string | null
          pilot_consent_at?: string | null
          pilot_id?: string
          status?: Database["public"]["Enums"]["affiliation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "coach_pilots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_pilots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_pilots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_pilots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_pilots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_pilots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_pilots_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_pilots_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_pilots_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          bio: string | null
          circuits: string[]
          coach_id: string
          created_at: string
          headline: string | null
          instagram_url: string | null
          is_published: boolean
          media: Json
          palmares: string | null
          photo_url: string | null
          season_price_eur: number | null
          socials: Json
          specialties: string[]
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          bio?: string | null
          circuits?: string[]
          coach_id: string
          created_at?: string
          headline?: string | null
          instagram_url?: string | null
          is_published?: boolean
          media?: Json
          palmares?: string | null
          photo_url?: string | null
          season_price_eur?: number | null
          socials?: Json
          specialties?: string[]
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          bio?: string | null
          circuits?: string[]
          coach_id?: string
          created_at?: string
          headline?: string | null
          instagram_url?: string | null
          is_published?: boolean
          media?: Json
          palmares?: string | null
          photo_url?: string | null
          season_price_eur?: number | null
          socials?: Json
          specialties?: string[]
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reading_weights: {
        Row: {
          coach_id: string
          note: string | null
          updated_at: string
          w_pilot: number
          w_regularity: number
          w_smoothness: number
          w_vehicle: number
        }
        Insert: {
          coach_id: string
          note?: string | null
          updated_at?: string
          w_pilot?: number
          w_regularity?: number
          w_smoothness?: number
          w_vehicle?: number
        }
        Update: {
          coach_id?: string
          note?: string | null
          updated_at?: string
          w_pilot?: number
          w_regularity?: number
          w_smoothness?: number
          w_vehicle?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_reading_weights_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_reading_weights_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_reading_weights_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reviews: {
        Row: {
          booking_id: string | null
          coach_id: string
          comment: string | null
          created_at: string
          id: string
          pilot_first_name: string | null
          pilot_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          coach_id: string
          comment?: string | null
          created_at?: string
          id?: string
          pilot_first_name?: string | null
          pilot_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          coach_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          pilot_first_name?: string | null
          pilot_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "coaching_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_reviews_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_reviews_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_roulages: {
        Row: {
          circuit_name: string
          coach_id: string
          created_at: string
          ends_at: string | null
          id: string
          location: string | null
          max_pilots: number | null
          notes: string | null
          price_per_pilot: number | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          circuit_name?: string
          coach_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          max_pilots?: number | null
          notes?: string | null
          price_per_pilot?: number | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          circuit_name?: string
          coach_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          max_pilots?: number | null
          notes?: string | null
          price_per_pilot?: number | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_roulages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_roulages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_roulages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_session_context: {
        Row: {
          coach_id: string
          created_at: string
          equipment: string | null
          id: string
          objective: string | null
          pilot_id: string
          pilot_level: string | null
          session_id: string
          updated_at: string
          weather_note: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          equipment?: string | null
          id?: string
          objective?: string | null
          pilot_id: string
          pilot_level?: string | null
          session_id: string
          updated_at?: string
          weather_note?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          equipment?: string | null
          id?: string
          objective?: string | null
          pilot_id?: string
          pilot_level?: string | null
          session_id?: string
          updated_at?: string
          weather_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_session_context_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_session_context_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_session_context_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_session_context_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coach_session_context_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coach_session_context_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_session_context_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "coach_session_context_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_bookings: {
        Row: {
          availability_id: string | null
          cancelled_at: string | null
          circuit_name: string | null
          coach_id: string
          completed_at: string | null
          created_at: string
          id: string
          message: string | null
          pilot_first_name: string | null
          pilot_id: string
          requested_starts_at: string | null
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          availability_id?: string | null
          cancelled_at?: string | null
          circuit_name?: string | null
          coach_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          pilot_first_name?: string | null
          pilot_id: string
          requested_starts_at?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          availability_id?: string | null
          cancelled_at?: string | null
          circuit_name?: string | null
          coach_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          pilot_first_name?: string | null
          pilot_id?: string
          requested_starts_at?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_bookings_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coaching_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_bookings_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coaching_bookings_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "coaching_bookings_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          ip_address: unknown
          last_name: string
          message: string
          metadata: Json | null
          phone: string | null
          read_at: string | null
          read_by: string | null
          replied_at: string | null
          source: string | null
          status: string | null
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          ip_address?: unknown
          last_name: string
          message: string
          metadata?: Json | null
          phone?: string | null
          read_at?: string | null
          read_by?: string | null
          replied_at?: string | null
          source?: string | null
          status?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          ip_address?: unknown
          last_name?: string
          message?: string
          metadata?: Json | null
          phone?: string | null
          read_at?: string | null
          read_by?: string | null
          replied_at?: string | null
          source?: string | null
          status?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contact_messages_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "contact_messages_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_leads: {
        Row: {
          company: string
          contact_name: string
          contact_role: string | null
          created_at: string
          day_format: string | null
          email: string
          guests: string | null
          id: string
          message: string | null
          phone: string | null
          sector: string | null
          status: string
          target_date: string | null
        }
        Insert: {
          company: string
          contact_name: string
          contact_role?: string | null
          created_at?: string
          day_format?: string | null
          email: string
          guests?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          sector?: string | null
          status?: string
          target_date?: string | null
        }
        Update: {
          company?: string
          contact_name?: string
          contact_role?: string | null
          created_at?: string
          day_format?: string | null
          email?: string
          guests?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          sector?: string | null
          status?: string
          target_date?: string | null
        }
        Relationships: []
      }
      data_quality_reports: {
        Row: {
          created_at: string
          id: string
          message: string | null
          owner_admin_id: string | null
          session_id: string
          severity: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          owner_admin_id?: string | null
          session_id: string
          severity?: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          owner_admin_id?: string | null
          session_id?: string
          severity?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_reports_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "data_quality_reports_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "data_quality_reports_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "data_quality_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_inscription: {
        Row: {
          admin_note: string | null
          birth_date: string | null
          bpjeps: string | null
          city: string | null
          coaching_pilots: string | null
          coaching_pitch: string | null
          coaching_tracks: string | null
          coaching_years: string | null
          company_name: string | null
          company_role: string | null
          company_siret: string | null
          company_website: string | null
          consent_cgv: boolean
          consent_contact: boolean
          consent_rgpd: boolean
          created_at: string
          created_user_id: string | null
          email: string
          ffsa_category: string | null
          ffsa_number: string | null
          first_name: string
          id: string
          last_name: string
          motivation: string | null
          phone: string
          pro_status: string | null
          rc_pro: string | null
          referral: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          statut: Database["public"]["Enums"]["oxv_demande_statut"]
          track_experience: string | null
          type_demande: Database["public"]["Enums"]["oxv_demande_type"]
          vehicle_brand: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: number | null
        }
        Insert: {
          admin_note?: string | null
          birth_date?: string | null
          bpjeps?: string | null
          city?: string | null
          coaching_pilots?: string | null
          coaching_pitch?: string | null
          coaching_tracks?: string | null
          coaching_years?: string | null
          company_name?: string | null
          company_role?: string | null
          company_siret?: string | null
          company_website?: string | null
          consent_cgv?: boolean
          consent_contact?: boolean
          consent_rgpd?: boolean
          created_at?: string
          created_user_id?: string | null
          email: string
          ffsa_category?: string | null
          ffsa_number?: string | null
          first_name: string
          id?: string
          last_name: string
          motivation?: string | null
          phone: string
          pro_status?: string | null
          rc_pro?: string | null
          referral?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statut?: Database["public"]["Enums"]["oxv_demande_statut"]
          track_experience?: string | null
          type_demande: Database["public"]["Enums"]["oxv_demande_type"]
          vehicle_brand?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
        }
        Update: {
          admin_note?: string | null
          birth_date?: string | null
          bpjeps?: string | null
          city?: string | null
          coaching_pilots?: string | null
          coaching_pitch?: string | null
          coaching_tracks?: string | null
          coaching_years?: string | null
          company_name?: string | null
          company_role?: string | null
          company_siret?: string | null
          company_website?: string | null
          consent_cgv?: boolean
          consent_contact?: boolean
          consent_rgpd?: boolean
          created_at?: string
          created_user_id?: string | null
          email?: string
          ffsa_category?: string | null
          ffsa_number?: string | null
          first_name?: string
          id?: string
          last_name?: string
          motivation?: string | null
          phone?: string
          pro_status?: string | null
          rc_pro?: string | null
          referral?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          statut?: Database["public"]["Enums"]["oxv_demande_statut"]
          track_experience?: string | null
          type_demande?: Database["public"]["Enums"]["oxv_demande_type"]
          vehicle_brand?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_inscription_created_user_id_fkey"
            columns: ["created_user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "demandes_inscription_created_user_id_fkey"
            columns: ["created_user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "demandes_inscription_created_user_id_fkey"
            columns: ["created_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_inscription_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "demandes_inscription_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "demandes_inscription_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      device_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          device_id: string
          event_id: string | null
          id: string
          pilot_id: string | null
          session_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          device_id: string
          event_id?: string | null
          id?: string
          pilot_id?: string | null
          session_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          device_id?: string
          event_id?: string | null
          id?: string
          pilot_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "device_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "device_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "device_assignments_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "device_assignments_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "device_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          battery_status: string | null
          created_at: string
          health_status: string
          id: string
          label: string
          notes: string | null
          serial: string | null
          type: string
          updated_at: string
        }
        Insert: {
          battery_status?: string | null
          created_at?: string
          health_status?: string
          id?: string
          label: string
          notes?: string | null
          serial?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          battery_status?: string | null
          created_at?: string
          health_status?: string
          id?: string
          label?: string
          notes?: string | null
          serial?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          document_type: Database["public"]["Enums"]["document_type_enum"]
          file_name: string | null
          file_size_kb: number | null
          file_url: string
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["document_status_enum"] | null
          uploaded_at: string | null
          user_id: string
          validated_at: string | null
          validated_by: string | null
          validity_end: string | null
          validity_start: string | null
        }
        Insert: {
          document_type: Database["public"]["Enums"]["document_type_enum"]
          file_name?: string | null
          file_size_kb?: number | null
          file_url: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status_enum"] | null
          uploaded_at?: string | null
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          validity_end?: string | null
          validity_start?: string | null
        }
        Update: {
          document_type?: Database["public"]["Enums"]["document_type_enum"]
          file_name?: string | null
          file_size_kb?: number | null
          file_url?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status_enum"] | null
          uploaded_at?: string | null
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validity_end?: string | null
          validity_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          challenger_id: string
          challenger_lap_number: number | null
          challenger_lap_s: number | null
          challenger_session_id: string | null
          circuit_id: string
          created_at: string
          id: string
          message: string | null
          opponent_id: string | null
          opponent_lap_number: number | null
          opponent_lap_s: number | null
          opponent_session_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["duel_status"]
          updated_at: string
        }
        Insert: {
          challenger_id: string
          challenger_lap_number?: number | null
          challenger_lap_s?: number | null
          challenger_session_id?: string | null
          circuit_id: string
          created_at?: string
          id?: string
          message?: string | null
          opponent_id?: string | null
          opponent_lap_number?: number | null
          opponent_lap_s?: number | null
          opponent_session_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          updated_at?: string
        }
        Update: {
          challenger_id?: string
          challenger_lap_number?: number | null
          challenger_lap_s?: number | null
          challenger_session_id?: string | null
          circuit_id?: string
          created_at?: string
          id?: string
          message?: string | null
          opponent_id?: string | null
          opponent_lap_number?: number | null
          opponent_lap_s?: number | null
          opponent_session_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["duel_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duels_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "duels_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "duels_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_challenger_session_id_fkey"
            columns: ["challenger_session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "duels_challenger_session_id_fkey"
            columns: ["challenger_session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "duels_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "duels_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_opponent_session_id_fkey"
            columns: ["opponent_session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "duels_opponent_session_id_fkey"
            columns: ["opponent_session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          bounce_reason: string | null
          delivered_at: string | null
          email_type: string
          id: string
          metadata: Json | null
          opened_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status_enum"] | null
          subject: string | null
          template_used: string | null
          user_id: string | null
        }
        Insert: {
          bounce_reason?: string | null
          delivered_at?: string | null
          email_type: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status_enum"] | null
          subject?: string | null
          template_used?: string | null
          user_id?: string | null
        }
        Update: {
          bounce_reason?: string | null
          delivered_at?: string | null
          email_type?: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status_enum"] | null
          subject?: string | null
          template_used?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_partners: {
        Row: {
          created_at: string
          event_id: string
          id: string
          partner_id: string
          status: Database["public"]["Enums"]["event_partner_status"]
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          partner_id: string
          status?: Database["public"]["Enums"]["event_partner_status"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          partner_id?: string
          status?: Database["public"]["Enums"]["event_partner_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          event_id: string
          id: string
          pilot_id: string
          status: Database["public"]["Enums"]["event_registration_status"]
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          pilot_id: string
          status?: Database["public"]["Enums"]["event_registration_status"]
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          pilot_id?: string
          status?: Database["public"]["Enums"]["event_registration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "event_registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "event_registrations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "event_registrations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          briefing_at: string | null
          created_at: string
          created_by: string | null
          current_pilots: number
          description: string | null
          ends_at: string
          event_type: string
          id: string
          internal_notes: string | null
          location_address: string | null
          location_coordinates: unknown
          location_name: string
          max_pilots: number
          name: string
          pricing: Json
          slug: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          briefing_at?: string | null
          created_at?: string
          created_by?: string | null
          current_pilots?: number
          description?: string | null
          ends_at: string
          event_type?: string
          id?: string
          internal_notes?: string | null
          location_address?: string | null
          location_coordinates?: unknown
          location_name: string
          max_pilots?: number
          name: string
          pricing?: Json
          slug: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          briefing_at?: string | null
          created_at?: string
          created_by?: string | null
          current_pilots?: number
          description?: string | null
          ends_at?: string
          event_type?: string
          id?: string
          internal_notes?: string | null
          location_address?: string | null
          location_coordinates?: unknown
          location_name?: string
          max_pilots?: number
          name?: string
          pricing?: Json
          slug?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      heritage_packs: {
        Row: {
          id: string
          price_total: number
          purchased_at: string | null
          sessions_total: number
          sessions_used: number
          status:
            | Database["public"]["Enums"]["heritage_pack_status_enum"]
            | null
          user_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          id?: string
          price_total?: number
          purchased_at?: string | null
          sessions_total?: number
          sessions_used?: number
          status?:
            | Database["public"]["Enums"]["heritage_pack_status_enum"]
            | null
          user_id: string
          valid_from: string
          valid_until: string
        }
        Update: {
          id?: string
          price_total?: number
          purchased_at?: string | null
          sessions_total?: number
          sessions_used?: number
          status?:
            | Database["public"]["Enums"]["heritage_pack_status_enum"]
            | null
          user_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "heritage_packs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "heritage_packs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "heritage_packs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      laps: {
        Row: {
          avg_speed_kmh: number | null
          created_at: string
          distance_meters: number | null
          duration_seconds: number
          end_lat: number | null
          end_lon: number | null
          ended_at: string
          id: string
          is_best_lap: boolean | null
          is_inlap: boolean | null
          is_outlap: boolean | null
          lap_number: number
          max_g_accel: number | null
          max_g_braking: number | null
          max_g_lateral: number | null
          max_speed_kmh: number | null
          session_id: string
          start_lat: number | null
          start_lon: number | null
          started_at: string
        }
        Insert: {
          avg_speed_kmh?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds: number
          end_lat?: number | null
          end_lon?: number | null
          ended_at: string
          id?: string
          is_best_lap?: boolean | null
          is_inlap?: boolean | null
          is_outlap?: boolean | null
          lap_number: number
          max_g_accel?: number | null
          max_g_braking?: number | null
          max_g_lateral?: number | null
          max_speed_kmh?: number | null
          session_id: string
          start_lat?: number | null
          start_lon?: number | null
          started_at: string
        }
        Update: {
          avg_speed_kmh?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number
          end_lat?: number | null
          end_lon?: number | null
          ended_at?: string
          id?: string
          is_best_lap?: boolean | null
          is_inlap?: boolean | null
          is_outlap?: boolean | null
          lap_number?: number
          max_g_accel?: number | null
          max_g_braking?: number | null
          max_g_lateral?: number | null
          max_speed_kmh?: number | null
          session_id?: string
          start_lat?: number | null
          start_lon?: number | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "laps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lodgings: {
        Row: {
          address: string | null
          booking_url: string | null
          circuit_id: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          distance_to_circuit_km: number | null
          id: string
          is_premium: boolean | null
          is_published: boolean | null
          lat: number | null
          lodging_type: string | null
          lon: number | null
          media: Json
          name: string
          owner_id: string | null
          price_range: string | null
          region: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          address?: string | null
          booking_url?: string | null
          circuit_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          distance_to_circuit_km?: number | null
          id?: string
          is_premium?: boolean | null
          is_published?: boolean | null
          lat?: number | null
          lodging_type?: string | null
          lon?: number | null
          media?: Json
          name: string
          owner_id?: string | null
          price_range?: string | null
          region?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          address?: string | null
          booking_url?: string | null
          circuit_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          distance_to_circuit_km?: number | null
          id?: string
          is_premium?: boolean | null
          is_published?: boolean | null
          lat?: number | null
          lodging_type?: string | null
          lon?: number | null
          media?: Json
          name?: string
          owner_id?: string | null
          price_range?: string | null
          region?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lodgings_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          description: string | null
          file_size_kb: number | null
          file_url: string
          id: string
          media_type: Database["public"]["Enums"]["media_type_enum"]
          original_filename: string | null
          published_at: string | null
          session_id: string
          title: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          user_id: string | null
          visible_to_user: boolean | null
        }
        Insert: {
          description?: string | null
          file_size_kb?: number | null
          file_url: string
          id?: string
          media_type: Database["public"]["Enums"]["media_type_enum"]
          original_filename?: string | null
          published_at?: string | null
          session_id: string
          title?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          user_id?: string | null
          visible_to_user?: boolean | null
        }
        Update: {
          description?: string | null
          file_size_kb?: number | null
          file_url?: string
          id?: string
          media_type?: Database["public"]["Enums"]["media_type_enum"]
          original_filename?: string | null
          published_at?: string | null
          session_id?: string
          title?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          user_id?: string | null
          visible_to_user?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notif_throttle_log: {
        Row: {
          id: number
          notif_type: string
          recipient_user_id: string
          sent_at: string
          source_user_id: string
        }
        Insert: {
          id?: number
          notif_type: string
          recipient_user_id: string
          sent_at?: string
          source_user_id: string
        }
        Update: {
          id?: number
          notif_type?: string
          recipient_user_id?: string
          sent_at?: string
          source_user_id?: string
        }
        Relationships: []
      }
      partner_accounts: {
        Row: {
          contact_email: string | null
          contact_policy: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          logo_url: string | null
          profile_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_policy?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          logo_url?: string | null
          profile_id: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_policy?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          logo_url?: string | null
          profile_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partner_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "partner_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_leads: {
        Row: {
          channel: string
          consent_at: string
          consent_contact: boolean
          created_at: string
          event_id: string | null
          id: string
          notes: string | null
          offer_id: string | null
          partner_id: string
          pilot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          consent_at?: string
          consent_contact?: boolean
          created_at?: string
          event_id?: string | null
          id?: string
          notes?: string | null
          offer_id?: string | null
          partner_id: string
          pilot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          consent_at?: string
          consent_contact?: boolean
          created_at?: string
          event_id?: string | null
          id?: string
          notes?: string | null
          offer_id?: string | null
          partner_id?: string
          pilot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_leads_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "partner_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_leads_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "partner_leads_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "partner_leads_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_offers: {
        Row: {
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          partner_id: string
          price_eur: number | null
          quota: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          partner_id: string
          price_eur?: number | null
          quota?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          partner_id?: string
          price_eur?: number | null
          quota?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_offers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          circuit_id: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_official_partner: boolean | null
          is_premium: boolean | null
          is_published: boolean | null
          lat: number | null
          logo_url: string | null
          lon: number | null
          media: Json
          name: string
          owner_id: string | null
          partner_type: string | null
          region: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          address?: string | null
          circuit_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_official_partner?: boolean | null
          is_premium?: boolean | null
          is_published?: boolean | null
          lat?: number | null
          logo_url?: string | null
          lon?: number | null
          media?: Json
          name: string
          owner_id?: string | null
          partner_type?: string | null
          region?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          address?: string | null
          circuit_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_official_partner?: boolean | null
          is_premium?: boolean | null
          is_published?: boolean | null
          lat?: number | null
          logo_url?: string | null
          lon?: number | null
          media?: Json
          name?: string
          owner_id?: string | null
          partner_type?: string | null
          region?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          heritage_pack_id: string | null
          id: string
          invoice_pdf_url: string | null
          invoice_url: string | null
          metadata: Json | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          reference: string | null
          refund_amount: number | null
          refunded_at: string | null
          registration_id: string | null
          status: Database["public"]["Enums"]["payment_status_enum"] | null
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          heritage_pack_id?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          reference?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          registration_id?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"] | null
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          heritage_pack_id?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          reference?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          registration_id?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"] | null
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_heritage_pack_id_fkey"
            columns: ["heritage_pack_id"]
            isOneToOne: false
            referencedRelation: "heritage_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["registration_id"]
          },
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_friendships: {
        Row: {
          id: string
          initiator_id: string
          pilot_a: string
          pilot_b: string
          requested_at: string
          responded_at: string | null
          status: string
        }
        Insert: {
          id?: string
          initiator_id: string
          pilot_a: string
          pilot_b: string
          requested_at?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          initiator_id?: string
          pilot_a?: string
          pilot_b?: string
          requested_at?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_friendships_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pilot_friendships_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "pilot_friendships_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_friendships_pilot_a_fkey"
            columns: ["pilot_a"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pilot_friendships_pilot_a_fkey"
            columns: ["pilot_a"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "pilot_friendships_pilot_a_fkey"
            columns: ["pilot_a"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_friendships_pilot_b_fkey"
            columns: ["pilot_b"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pilot_friendships_pilot_b_fkey"
            columns: ["pilot_b"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "pilot_friendships_pilot_b_fkey"
            columns: ["pilot_b"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_goal_events: {
        Row: {
          created_at: string
          from_status: string | null
          goal_id: string
          id: string
          kind: string
          to_status: string | null
          user_id: string
          value_at: number | null
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          goal_id: string
          id?: string
          kind: string
          to_status?: string | null
          user_id: string
          value_at?: number | null
        }
        Update: {
          created_at?: string
          from_status?: string | null
          goal_id?: string
          id?: string
          kind?: string
          to_status?: string | null
          user_id?: string
          value_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_goal_events_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "pilot_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_goals: {
        Row: {
          baseline_value: number | null
          body: string
          circuit_id: string | null
          corner_index: number | null
          created_at: string
          detail: string | null
          evaluated_at: string | null
          evaluated_session_id: string | null
          id: string
          metric: Database["public"]["Enums"]["objective_metric"]
          priority: number
          status: string
          target_direction: Database["public"]["Enums"]["objective_direction"]
          target_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_value?: number | null
          body: string
          circuit_id?: string | null
          corner_index?: number | null
          created_at?: string
          detail?: string | null
          evaluated_at?: string | null
          evaluated_session_id?: string | null
          id?: string
          metric?: Database["public"]["Enums"]["objective_metric"]
          priority?: number
          status?: string
          target_direction?: Database["public"]["Enums"]["objective_direction"]
          target_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_value?: number | null
          body?: string
          circuit_id?: string | null
          corner_index?: number | null
          created_at?: string
          detail?: string | null
          evaluated_at?: string | null
          evaluated_session_id?: string | null
          id?: string
          metric?: Database["public"]["Enums"]["objective_metric"]
          priority?: number
          status?: string
          target_direction?: Database["public"]["Enums"]["objective_direction"]
          target_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilot_goals_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_goals_evaluated_session_id_fkey"
            columns: ["evaluated_session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "pilot_goals_evaluated_session_id_fkey"
            columns: ["evaluated_session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_sheets: {
        Row: {
          created_at: string
          experience_years: number | null
          focus: string | null
          level: string | null
          pilot_id: string
          updated_at: string
          vehicles_note: string | null
        }
        Insert: {
          created_at?: string
          experience_years?: number | null
          focus?: string | null
          level?: string | null
          pilot_id: string
          updated_at?: string
          vehicles_note?: string | null
        }
        Update: {
          created_at?: string
          experience_years?: number | null
          focus?: string | null
          level?: string | null
          pilot_id?: string
          updated_at?: string
          vehicles_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_sheets_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: true
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pilot_sheets_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: true
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "pilot_sheets_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ping_rsvps: {
        Row: {
          created_at: string
          ping_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ping_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          ping_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ping_rsvps_ping_id_fkey"
            columns: ["ping_id"]
            isOneToOne: false
            referencedRelation: "social_pings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ping_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ping_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "ping_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing: {
        Row: {
          active: boolean | null
          created_at: string | null
          format: string
          id: string
          offer_key: string
          price_first_session_cents: number
          price_subsequent_cents: number
          season: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          format: string
          id?: string
          offer_key: string
          price_first_session_cents: number
          price_subsequent_cents: number
          season: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          format?: string
          id?: string
          offer_key?: string
          price_first_session_cents?: number
          price_subsequent_cents?: number
          season?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          attended_at: string | null
          balance_paid_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmation_email_sent_at: string | null
          created_at: string | null
          deposit_paid_at: string | null
          heritage_pack_id: string | null
          id: string
          insurance_option:
            | Database["public"]["Enums"]["insurance_option_enum"]
            | null
          notes: string | null
          offer_type: Database["public"]["Enums"]["offer_type_enum"]
          price_deposit: number
          price_total: number
          refund_amount: number | null
          reminder_j7_sent_at: string | null
          session_id: string
          slot_choice: string | null
          status: Database["public"]["Enums"]["registration_status_enum"] | null
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          attended_at?: string | null
          balance_paid_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          deposit_paid_at?: string | null
          heritage_pack_id?: string | null
          id?: string
          insurance_option?:
            | Database["public"]["Enums"]["insurance_option_enum"]
            | null
          notes?: string | null
          offer_type: Database["public"]["Enums"]["offer_type_enum"]
          price_deposit: number
          price_total: number
          refund_amount?: number | null
          reminder_j7_sent_at?: string | null
          session_id: string
          slot_choice?: string | null
          status?:
            | Database["public"]["Enums"]["registration_status_enum"]
            | null
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          attended_at?: string | null
          balance_paid_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          deposit_paid_at?: string | null
          heritage_pack_id?: string | null
          id?: string
          insurance_option?:
            | Database["public"]["Enums"]["insurance_option_enum"]
            | null
          notes?: string | null
          offer_type?: Database["public"]["Enums"]["offer_type_enum"]
          price_deposit?: number
          price_total?: number
          refund_amount?: number | null
          reminder_j7_sent_at?: string | null
          session_id?: string
          slot_choice?: string | null
          status?:
            | Database["public"]["Enums"]["registration_status_enum"]
            | null
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "registrations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_heritage_pack_id_fkey"
            columns: ["heritage_pack_id"]
            isOneToOne: false
            referencedRelation: "heritage_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      resend_events: {
        Row: {
          dispatch_id: string | null
          event_type: string
          id: string
          occurred_at: string
          processed_at: string
          raw_payload: Json
          resend_email_id: string
        }
        Insert: {
          dispatch_id?: string | null
          event_type: string
          id?: string
          occurred_at: string
          processed_at?: string
          raw_payload: Json
          resend_email_id: string
        }
        Update: {
          dispatch_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          processed_at?: string
          raw_payload?: Json
          resend_email_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resend_events_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resend_events_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "ritual_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          circuit_id: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          cuisine_type: string | null
          description: string | null
          distance_to_circuit_km: number | null
          id: string
          is_premium: boolean | null
          is_published: boolean | null
          lat: number | null
          lon: number | null
          media: Json
          name: string
          owner_id: string | null
          price_range: string | null
          region: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          address?: string | null
          circuit_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine_type?: string | null
          description?: string | null
          distance_to_circuit_km?: number | null
          id?: string
          is_premium?: boolean | null
          is_published?: boolean | null
          lat?: number | null
          lon?: number | null
          media?: Json
          name: string
          owner_id?: string | null
          price_range?: string | null
          region?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          address?: string | null
          circuit_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          cuisine_type?: string | null
          description?: string | null
          distance_to_circuit_km?: number | null
          id?: string
          is_premium?: boolean | null
          is_published?: boolean | null
          lat?: number | null
          lon?: number | null
          media?: Json
          name?: string
          owner_id?: string | null
          price_range?: string | null
          region?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_dispatches: {
        Row: {
          attempt_count: number
          audio_duration_sec: number | null
          audio_storage_path: string | null
          bounce_reason: string | null
          bounced_at: string | null
          clicked_at: string | null
          clicked_count: number
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          elevenlabs_chars: number | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          openai_tokens_used: number | null
          opened_at: string | null
          opened_count: number
          payload: Json | null
          registration_id: string
          resend_message_id: string | null
          ritual_type: Database["public"]["Enums"]["ritual_type_enum"]
          scheduled_for: string
          sent_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["ritual_status_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          audio_duration_sec?: number | null
          audio_storage_path?: string | null
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          clicked_count?: number
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          elevenlabs_chars?: number | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          openai_tokens_used?: number | null
          opened_at?: string | null
          opened_count?: number
          payload?: Json | null
          registration_id: string
          resend_message_id?: string | null
          ritual_type: Database["public"]["Enums"]["ritual_type_enum"]
          scheduled_for: string
          sent_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["ritual_status_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          audio_duration_sec?: number | null
          audio_storage_path?: string | null
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          clicked_count?: number
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          elevenlabs_chars?: number | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          openai_tokens_used?: number | null
          opened_at?: string | null
          opened_count?: number
          payload?: Json | null
          registration_id?: string
          resend_message_id?: string | null
          ritual_type?: Database["public"]["Enums"]["ritual_type_enum"]
          scheduled_for?: string
          sent_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["ritual_status_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritual_dispatches_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["registration_id"]
          },
          {
            foreignKeyName: "ritual_dispatches_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritual_dispatches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "ritual_dispatches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritual_dispatches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritual_dispatches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ritual_dispatches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "ritual_dispatches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roulage_invitations: {
        Row: {
          id: string
          invited_at: string
          pilot_id: string
          responded_at: string | null
          roulage_id: string
          status: string
        }
        Insert: {
          id?: string
          invited_at?: string
          pilot_id: string
          responded_at?: string | null
          roulage_id: string
          status?: string
        }
        Update: {
          id?: string
          invited_at?: string
          pilot_id?: string
          responded_at?: string | null
          roulage_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "roulage_invitations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "roulage_invitations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "roulage_invitations_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roulage_invitations_roulage_id_fkey"
            columns: ["roulage_id"]
            isOneToOne: false
            referencedRelation: "coach_roulages"
            referencedColumns: ["id"]
          },
        ]
      }
      scenic_routes: {
        Row: {
          ascent_m: number | null
          certified_at: string | null
          certified_by: string | null
          created_at: string
          curviness: string | null
          distance_km: number | null
          geometry: Json | null
          id: string
          name: string
          pois: Json | null
          provider: string | null
          review_notes: string | null
          sinuosity: number | null
          start_lat: number
          start_lon: number
          status: Database["public"]["Enums"]["scenic_route_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ascent_m?: number | null
          certified_at?: string | null
          certified_by?: string | null
          created_at?: string
          curviness?: string | null
          distance_km?: number | null
          geometry?: Json | null
          id?: string
          name: string
          pois?: Json | null
          provider?: string | null
          review_notes?: string | null
          sinuosity?: number | null
          start_lat: number
          start_lon: number
          status?: Database["public"]["Enums"]["scenic_route_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ascent_m?: number | null
          certified_at?: string | null
          certified_by?: string | null
          created_at?: string
          curviness?: string | null
          distance_km?: number | null
          geometry?: Json | null
          id?: string
          name?: string
          pois?: Json | null
          provider?: string | null
          review_notes?: string | null
          sinuosity?: number | null
          start_lat?: number
          start_lon?: number
          status?: Database["public"]["Enums"]["scenic_route_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenic_routes_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "scenic_routes_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "scenic_routes_certified_by_fkey"
            columns: ["certified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenic_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "scenic_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "scenic_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_insights: {
        Row: {
          anatomy: Json | null
          chassis_balance: Json | null
          circuit_id: string | null
          computed_at: string | null
          condition: string | null
          data_quality: Json | null
          dispersion: Json | null
          engine_version: string | null
          flow_coherence: Json | null
          gg_envelope: Json | null
          id: string
          ideal_lap: Json | null
          lap_classification: Json | null
          load_transfer: Json | null
          n_frames: number | null
          n_laps: number | null
          off_track_events: Json | null
          reference_laps: Json | null
          session_drift: Json | null
          telemetry_session_id: string
          throttle_brake: Json | null
          trajectory: Json | null
          user_id: string | null
          vehicle_id: string | null
          warmup: Json | null
        }
        Insert: {
          anatomy?: Json | null
          chassis_balance?: Json | null
          circuit_id?: string | null
          computed_at?: string | null
          condition?: string | null
          data_quality?: Json | null
          dispersion?: Json | null
          engine_version?: string | null
          flow_coherence?: Json | null
          gg_envelope?: Json | null
          id?: string
          ideal_lap?: Json | null
          lap_classification?: Json | null
          load_transfer?: Json | null
          n_frames?: number | null
          n_laps?: number | null
          off_track_events?: Json | null
          reference_laps?: Json | null
          session_drift?: Json | null
          telemetry_session_id: string
          throttle_brake?: Json | null
          trajectory?: Json | null
          user_id?: string | null
          vehicle_id?: string | null
          warmup?: Json | null
        }
        Update: {
          anatomy?: Json | null
          chassis_balance?: Json | null
          circuit_id?: string | null
          computed_at?: string | null
          condition?: string | null
          data_quality?: Json | null
          dispersion?: Json | null
          engine_version?: string | null
          flow_coherence?: Json | null
          gg_envelope?: Json | null
          id?: string
          ideal_lap?: Json | null
          lap_classification?: Json | null
          load_transfer?: Json | null
          n_frames?: number | null
          n_laps?: number | null
          off_track_events?: Json | null
          reference_laps?: Json | null
          session_drift?: Json | null
          telemetry_session_id?: string
          throttle_brake?: Json | null
          trajectory?: Json | null
          user_id?: string | null
          vehicle_id?: string | null
          warmup?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "session_insights_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: true
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "session_insights_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: true
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_media: {
        Row: {
          caption: string | null
          deleted_at: string | null
          display_order: number
          duration_seconds: number | null
          file_size_bytes: number | null
          height_px: number | null
          id: string
          media_type: string
          mime_type: string | null
          pilot_user_id: string
          storage_path: string
          telemetry_session_id: string
          uploaded_at: string
          uploaded_by_user_id: string | null
          width_px: number | null
        }
        Insert: {
          caption?: string | null
          deleted_at?: string | null
          display_order?: number
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          media_type: string
          mime_type?: string | null
          pilot_user_id: string
          storage_path: string
          telemetry_session_id: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
          width_px?: number | null
        }
        Update: {
          caption?: string | null
          deleted_at?: string | null
          display_order?: number
          duration_seconds?: number | null
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          media_type?: string
          mime_type?: string | null
          pilot_user_id?: string
          storage_path?: string
          telemetry_session_id?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_media_pilot_user_id_fkey"
            columns: ["pilot_user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_media_pilot_user_id_fkey"
            columns: ["pilot_user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "session_media_pilot_user_id_fkey"
            columns: ["pilot_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "session_media_telemetry_session_id_fkey"
            columns: ["telemetry_session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "session_media_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "session_media_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          available_offers: Json | null
          capacity_access: number | null
          capacity_afternoon: number | null
          capacity_morning: number | null
          capacity_promotion: number | null
          capacity_signature: number | null
          created_at: string | null
          date: string
          end_time: string | null
          format: string | null
          id: string
          is_private: boolean | null
          max_capacity: number | null
          notes: string | null
          private_client_contact: string | null
          private_client_name: string | null
          season_type: Database["public"]["Enums"]["season_type_enum"]
          start_time: string | null
          status: Database["public"]["Enums"]["session_status_enum"] | null
          weather_status:
            | Database["public"]["Enums"]["weather_status_enum"]
            | null
        }
        Insert: {
          available_offers?: Json | null
          capacity_access?: number | null
          capacity_afternoon?: number | null
          capacity_morning?: number | null
          capacity_promotion?: number | null
          capacity_signature?: number | null
          created_at?: string | null
          date: string
          end_time?: string | null
          format?: string | null
          id?: string
          is_private?: boolean | null
          max_capacity?: number | null
          notes?: string | null
          private_client_contact?: string | null
          private_client_name?: string | null
          season_type: Database["public"]["Enums"]["season_type_enum"]
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status_enum"] | null
          weather_status?:
            | Database["public"]["Enums"]["weather_status_enum"]
            | null
        }
        Update: {
          available_offers?: Json | null
          capacity_access?: number | null
          capacity_afternoon?: number | null
          capacity_morning?: number | null
          capacity_promotion?: number | null
          capacity_signature?: number | null
          created_at?: string | null
          date?: string
          end_time?: string | null
          format?: string | null
          id?: string
          is_private?: boolean | null
          max_capacity?: number | null
          notes?: string | null
          private_client_contact?: string | null
          private_client_name?: string | null
          season_type?: Database["public"]["Enums"]["season_type_enum"]
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status_enum"] | null
          weather_status?:
            | Database["public"]["Enums"]["weather_status_enum"]
            | null
        }
        Relationships: []
      }
      social_pings: {
        Row: {
          address: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_url: string | null
          facebook_url: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          is_published: boolean
          kind: string
          lat: number
          live_url: string | null
          lon: number
          media: Json
          owner_id: string | null
          share_token: string
          starts_at: string | null
          title: string
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_url?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_published?: boolean
          kind: string
          lat: number
          live_url?: string | null
          lon: number
          media?: Json
          owner_id?: string | null
          share_token?: string
          starts_at?: string | null
          title: string
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_url?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_published?: boolean
          kind?: string
          lat?: number
          live_url?: string | null
          lon?: number
          media?: Json
          owner_id?: string | null
          share_token?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_pings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "social_pings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "social_pings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          scope: Database["public"]["Enums"]["subscription_scope"]
          season: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          scope: Database["public"]["Enums"]["subscription_scope"]
          season: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["subscription_scope"]
          season?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_admin: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          device_id: string | null
          id: string
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          session_id: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          device_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          session_id?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          device_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          session_id?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "support_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_frames: {
        Row: {
          altitude_m: number | null
          battery_level: number | null
          created_at: string
          elapsed_ms: number
          fix_valid: boolean | null
          g_force_x: number | null
          g_force_y: number | null
          g_force_z: number | null
          gps_accuracy_m: number | null
          gps_fix: number | null
          heading: number | null
          heading_accuracy: number | null
          id: number
          itow_ms: number | null
          latitude: number | null
          longitude: number | null
          pdop: number | null
          rotation_x: number | null
          rotation_y: number | null
          rotation_z: number | null
          satellites: number | null
          session_id: string
          speed_accuracy: number | null
          speed_kmh: number | null
          speed_ms: number | null
        }
        Insert: {
          altitude_m?: number | null
          battery_level?: number | null
          created_at?: string
          elapsed_ms: number
          fix_valid?: boolean | null
          g_force_x?: number | null
          g_force_y?: number | null
          g_force_z?: number | null
          gps_accuracy_m?: number | null
          gps_fix?: number | null
          heading?: number | null
          heading_accuracy?: number | null
          id?: number
          itow_ms?: number | null
          latitude?: number | null
          longitude?: number | null
          pdop?: number | null
          rotation_x?: number | null
          rotation_y?: number | null
          rotation_z?: number | null
          satellites?: number | null
          session_id: string
          speed_accuracy?: number | null
          speed_kmh?: number | null
          speed_ms?: number | null
        }
        Update: {
          altitude_m?: number | null
          battery_level?: number | null
          created_at?: string
          elapsed_ms?: number
          fix_valid?: boolean | null
          g_force_x?: number | null
          g_force_y?: number | null
          g_force_z?: number | null
          gps_accuracy_m?: number | null
          gps_fix?: number | null
          heading?: number | null
          heading_accuracy?: number | null
          id?: number
          itow_ms?: number | null
          latitude?: number | null
          longitude?: number | null
          pdop?: number | null
          rotation_x?: number | null
          rotation_y?: number | null
          rotation_z?: number | null
          satellites?: number | null
          session_id?: string
          speed_accuracy?: number | null
          speed_kmh?: number | null
          speed_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_frames_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "telemetry_frames_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_sessions: {
        Row: {
          avg_lap_seconds: number | null
          best_lap_number: number | null
          best_lap_seconds: number | null
          circuit_id: string | null
          circuit_name: string | null
          created_at: string
          custom_name: string | null
          distance_km: number | null
          duration_seconds: number | null
          ended_at: string | null
          event_id: string | null
          id: string
          lap_count: number | null
          max_g_lateral: number | null
          max_g_longitudinal: number | null
          max_speed_kmh: number | null
          name: string | null
          notes: string | null
          raw_data_url: string | null
          source_device_id: string | null
          started_at: string
          status: string
          total_frames: number | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
          vehicle_label: string | null
          weather: string | null
        }
        Insert: {
          avg_lap_seconds?: number | null
          best_lap_number?: number | null
          best_lap_seconds?: number | null
          circuit_id?: string | null
          circuit_name?: string | null
          created_at?: string
          custom_name?: string | null
          distance_km?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_id?: string | null
          id?: string
          lap_count?: number | null
          max_g_lateral?: number | null
          max_g_longitudinal?: number | null
          max_speed_kmh?: number | null
          name?: string | null
          notes?: string | null
          raw_data_url?: string | null
          source_device_id?: string | null
          started_at?: string
          status?: string
          total_frames?: number | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
          vehicle_label?: string | null
          weather?: string | null
        }
        Update: {
          avg_lap_seconds?: number | null
          best_lap_number?: number | null
          best_lap_seconds?: number | null
          circuit_id?: string | null
          circuit_name?: string | null
          created_at?: string
          custom_name?: string | null
          distance_km?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_id?: string | null
          id?: string
          lap_count?: number | null
          max_g_lateral?: number | null
          max_g_longitudinal?: number | null
          max_speed_kmh?: number | null
          name?: string | null
          notes?: string | null
          raw_data_url?: string | null
          source_device_id?: string | null
          started_at?: string
          status?: string
          total_frames?: number | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
          vehicle_label?: string | null
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_sessions_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_sessions_source_device_id_fkey"
            columns: ["source_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accepts_marketing: boolean | null
          address_city: string | null
          address_country: string | null
          address_line: string | null
          address_zip: string | null
          admin_notes: string | null
          affiliation_code: string | null
          ai_debrief_enabled: boolean
          avatar_url: string | null
          birth_date: string | null
          blood_type: string | null
          cgu_accepted_at: string | null
          cgu_version: string | null
          coach_pact_accepted_at: string | null
          coach_pact_version: string | null
          community_visibility: Database["public"]["Enums"]["community_visibility"]
          created_at: string | null
          deletion_requested_at: string | null
          deletion_scheduled_at: string | null
          email: string
          email_verified: boolean | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          experience_years: string | null
          expo_push_token: string | null
          ffsa_license: string | null
          first_name: string | null
          id: string
          is_admin: boolean | null
          kyc_status: Database["public"]["Enums"]["kyc_status_enum"] | null
          kyc_validated_at: string | null
          kyc_validated_by: string | null
          last_login_at: string | null
          last_name: string | null
          livery: Json | null
          media: Json | null
          medical_notes: string | null
          notif_newsletter: boolean | null
          notif_offers: boolean | null
          notification_preferences: Json | null
          pact_accepted_at: string | null
          pact_version: string | null
          phone: string | null
          pilot_level: string | null
          preferred_language: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          profile_completed_at: string | null
          public_handle: string | null
          push_notif_enabled: boolean
          push_token_updated_at: string | null
          ritual_jminus1_enabled: boolean
          ritual_jminus2_enabled: boolean
          ritual_jminus7_enabled: boolean
          role: Database["public"]["Enums"]["user_role"] | null
          socials: Json | null
          stripe_customer_id: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
          vehicle: string | null
        }
        Insert: {
          accepts_marketing?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_line?: string | null
          address_zip?: string | null
          admin_notes?: string | null
          affiliation_code?: string | null
          ai_debrief_enabled?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          blood_type?: string | null
          cgu_accepted_at?: string | null
          cgu_version?: string | null
          coach_pact_accepted_at?: string | null
          coach_pact_version?: string | null
          community_visibility?: Database["public"]["Enums"]["community_visibility"]
          created_at?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          email: string
          email_verified?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          experience_years?: string | null
          expo_push_token?: string | null
          ffsa_license?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          kyc_status?: Database["public"]["Enums"]["kyc_status_enum"] | null
          kyc_validated_at?: string | null
          kyc_validated_by?: string | null
          last_login_at?: string | null
          last_name?: string | null
          livery?: Json | null
          media?: Json | null
          medical_notes?: string | null
          notif_newsletter?: boolean | null
          notif_offers?: boolean | null
          notification_preferences?: Json | null
          pact_accepted_at?: string | null
          pact_version?: string | null
          phone?: string | null
          pilot_level?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          profile_completed_at?: string | null
          public_handle?: string | null
          push_notif_enabled?: boolean
          push_token_updated_at?: string | null
          ritual_jminus1_enabled?: boolean
          ritual_jminus2_enabled?: boolean
          ritual_jminus7_enabled?: boolean
          role?: Database["public"]["Enums"]["user_role"] | null
          socials?: Json | null
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          vehicle?: string | null
        }
        Update: {
          accepts_marketing?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_line?: string | null
          address_zip?: string | null
          admin_notes?: string | null
          affiliation_code?: string | null
          ai_debrief_enabled?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          blood_type?: string | null
          cgu_accepted_at?: string | null
          cgu_version?: string | null
          coach_pact_accepted_at?: string | null
          coach_pact_version?: string | null
          community_visibility?: Database["public"]["Enums"]["community_visibility"]
          created_at?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          email?: string
          email_verified?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          experience_years?: string | null
          expo_push_token?: string | null
          ffsa_license?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          kyc_status?: Database["public"]["Enums"]["kyc_status_enum"] | null
          kyc_validated_at?: string | null
          kyc_validated_by?: string | null
          last_login_at?: string | null
          last_name?: string | null
          livery?: Json | null
          media?: Json | null
          medical_notes?: string | null
          notif_newsletter?: boolean | null
          notif_offers?: boolean | null
          notification_preferences?: Json | null
          pact_accepted_at?: string | null
          pact_version?: string | null
          phone?: string | null
          pilot_level?: string | null
          preferred_language?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          profile_completed_at?: string | null
          public_handle?: string | null
          push_notif_enabled?: boolean
          push_token_updated_at?: string | null
          ritual_jminus1_enabled?: boolean
          ritual_jminus2_enabled?: boolean
          ritual_jminus7_enabled?: boolean
          role?: Database["public"]["Enums"]["user_role"] | null
          socials?: Json | null
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_kyc_validated_by_fkey"
            columns: ["kyc_validated_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "users_kyc_validated_by_fkey"
            columns: ["kyc_validated_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "users_kyc_validated_by_fkey"
            columns: ["kyc_validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "users_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "users_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          color: string | null
          created_at: string | null
          declared_value: number | null
          id: string
          license_plate: string | null
          model: string
          notes: string | null
          photo_front_url: string | null
          photo_interior_url: string | null
          photo_rear_url: string | null
          photo_side_url: string | null
          updated_at: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          brand: string
          color?: string | null
          created_at?: string | null
          declared_value?: number | null
          id?: string
          license_plate?: string | null
          model: string
          notes?: string | null
          photo_front_url?: string | null
          photo_interior_url?: string | null
          photo_rear_url?: string | null
          photo_side_url?: string | null
          updated_at?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          brand?: string
          color?: string | null
          created_at?: string | null
          declared_value?: number | null
          id?: string
          license_plate?: string | null
          model?: string
          notes?: string | null
          photo_front_url?: string | null
          photo_interior_url?: string | null
          photo_rear_url?: string | null
          photo_side_url?: string | null
          updated_at?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_snapshots: {
        Row: {
          captured_at: string
          created_at: string
          feels_like_c: number | null
          humidity_pct: number | null
          id: string
          latitude: number | null
          longitude: number | null
          moment: string
          precipitation_mm: number | null
          precipitation_probability_pct: number | null
          pressure_hpa: number | null
          raw_data: Json | null
          session_id: string
          temperature_c: number | null
          visibility_km: number | null
          weather_code: number | null
          weather_label: string | null
          wind_direction_deg: number | null
          wind_gust_kmh: number | null
          wind_speed_kmh: number | null
        }
        Insert: {
          captured_at?: string
          created_at?: string
          feels_like_c?: number | null
          humidity_pct?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          moment: string
          precipitation_mm?: number | null
          precipitation_probability_pct?: number | null
          pressure_hpa?: number | null
          raw_data?: Json | null
          session_id: string
          temperature_c?: number | null
          visibility_km?: number | null
          weather_code?: number | null
          weather_label?: string | null
          wind_direction_deg?: number | null
          wind_gust_kmh?: number | null
          wind_speed_kmh?: number | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          feels_like_c?: number | null
          humidity_pct?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          moment?: string
          precipitation_mm?: number | null
          precipitation_probability_pct?: number | null
          pressure_hpa?: number | null
          raw_data?: Json | null
          session_id?: string
          temperature_c?: number | null
          visibility_km?: number | null
          weather_code?: number | null
          weather_label?: string | null
          wind_direction_deg?: number | null
          wind_gust_kmh?: number | null
          wind_speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "day_rollups"
            referencedColumns: ["best_session_id"]
          },
          {
            foreignKeyName: "weather_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "telemetry_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_ritual_dispatches_view: {
        Row: {
          attempt_count: number | null
          audio_duration_sec: number | null
          audio_storage_path: string | null
          bounce_reason: string | null
          bounced_at: string | null
          clicked_at: string | null
          clicked_count: number | null
          complained_at: string | null
          created_at: string | null
          delivered_at: string | null
          elevenlabs_chars: number | null
          id: string | null
          last_error: string | null
          openai_tokens_used: number | null
          opened_at: string | null
          opened_count: number | null
          payload: Json | null
          pilot_email: string | null
          pilot_first_name: string | null
          pilot_last_name: string | null
          registration_id: string | null
          registration_ref: string | null
          registration_tier: string | null
          resend_message_id: string | null
          ritual_type: Database["public"]["Enums"]["ritual_type_enum"] | null
          scheduled_for: string | null
          sent_at: string | null
          session_date: string | null
          session_format: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["ritual_status_enum"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      coach_pilots_view: {
        Row: {
          assigned_at: string | null
          assignment_id: string | null
          avatar_url: string | null
          experience_years: string | null
          ffsa_license: string | null
          first_name: string | null
          last_name: string | null
          media: Json | null
          notes: string | null
          pilot_consent_at: string | null
          pilot_id: string | null
          pilot_level: string | null
          socials: Json | null
          vehicle: string | null
        }
        Relationships: []
      }
      day_rollups: {
        Row: {
          avg_valid_lap_s: number | null
          best_lap_number: number | null
          best_lap_s: number | null
          best_session_id: string | null
          circuit_id: string | null
          circuit_name: string | null
          day: string | null
          max_speed_kmh: number | null
          n_sessions: number | null
          n_valid_laps: number | null
          user_id: string | null
          vehicles: string[] | null
          weather_seen: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_sessions_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      history_rollups: {
        Row: {
          apex_bands: Json | null
          apex_bands_window_target: number | null
          circuit_id: string | null
          circuit_name: string | null
          condition: string | null
          first_day: string | null
          last_day: string | null
          n_days: number | null
          n_sessions: number | null
          personal_record_s: number | null
          records_timeline: Json | null
          regularity_trend: Json | null
          user_id: string | null
          vehicle_id: string | null
          vehicle_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_sessions_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_ritual_dispatches_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "coach_pilots_view"
            referencedColumns: ["pilot_id"]
          },
          {
            foreignKeyName: "telemetry_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_public: {
        Row: {
          available_offers: Json | null
          capacity_access: number | null
          capacity_afternoon: number | null
          capacity_morning: number | null
          capacity_promotion: number | null
          capacity_signature: number | null
          created_at: string | null
          date: string | null
          end_time: string | null
          format: string | null
          id: string | null
          is_private: boolean | null
          max_capacity: number | null
          notes: string | null
          season_type: Database["public"]["Enums"]["season_type_enum"] | null
          start_time: string | null
          status: Database["public"]["Enums"]["session_status_enum"] | null
          weather_status:
            | Database["public"]["Enums"]["weather_status_enum"]
            | null
        }
        Insert: {
          available_offers?: Json | null
          capacity_access?: number | null
          capacity_afternoon?: number | null
          capacity_morning?: number | null
          capacity_promotion?: number | null
          capacity_signature?: number | null
          created_at?: string | null
          date?: string | null
          end_time?: string | null
          format?: string | null
          id?: string | null
          is_private?: boolean | null
          max_capacity?: number | null
          notes?: string | null
          season_type?: Database["public"]["Enums"]["season_type_enum"] | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status_enum"] | null
          weather_status?:
            | Database["public"]["Enums"]["weather_status_enum"]
            | null
        }
        Update: {
          available_offers?: Json | null
          capacity_access?: number | null
          capacity_afternoon?: number | null
          capacity_morning?: number | null
          capacity_promotion?: number | null
          capacity_signature?: number | null
          created_at?: string | null
          date?: string | null
          end_time?: string | null
          format?: string | null
          id?: string | null
          is_private?: boolean | null
          max_capacity?: number | null
          notes?: string | null
          season_type?: Database["public"]["Enums"]["season_type_enum"] | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status_enum"] | null
          weather_status?:
            | Database["public"]["Enums"]["weather_status_enum"]
            | null
        }
        Relationships: []
      }
      stats_dashboard: {
        Row: {
          active_pilotes: number | null
          avg_fill_rate: number | null
          completed_sessions: number | null
          heritage_active: number | null
          heritage_revenue: number | null
          new_pilotes_this_month: number | null
          pending_amount: number | null
          pending_count: number | null
          refunded_this_month: number | null
          revenue_this_month: number | null
          revenue_this_year: number | null
          sessions_this_year: number | null
          total_pilotes: number | null
          upcoming_sessions: number | null
          validated_this_month: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _gen_aff_code: { Args: never; Returns: string }
      admin_review_demande: {
        Args: { p_action: string; p_demande_id: string; p_note?: string }
        Returns: Json
      }
      admin_ritual_stats: { Args: { p_days_back?: number }; Returns: Json }
      admin_validate_inscription: {
        Args: { p_action?: string; p_admin_note?: string; p_demande_id: string }
        Returns: Json
      }
      app_get_secret: { Args: { secret_name: string }; Returns: string }
      apply_resend_event: {
        Args: {
          p_bounce_reason?: string
          p_dispatch_id: string
          p_event_type: string
          p_occurred_at: string
        }
        Returns: undefined
      }
      are_friends: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      cancel_pending_rituals_for_registration: {
        Args: { p_registration_id: string }
        Returns: number
      }
      cleanup_old_notif_logs: { Args: never; Returns: number }
      cleanup_old_telemetry_frames: { Args: never; Returns: number }
      coach_has_permission: {
        Args: { coach_uuid: string; permission_name: string }
        Returns: boolean
      }
      coach_public_card: {
        Args: { p_coach_id: string }
        Returns: {
          avatar_url: string
          coach_id: string
          first_name: string
          last_name: string
          public_handle: string
        }[]
      }
      community_circuit_leaderboard: {
        Args: { p_circuit_id: string; p_limit?: number }
        Returns: {
          best_lap_s: number
          condition_context: string
          display_name: string
          is_self: boolean
          pilot_id: string
          rank: number
          vehicle_context: string
        }[]
      }
      community_model_observatory: {
        Args: { p_circuit_id: string }
        Returns: {
          best_lap_s: number
          condition_context: string
          median_lap_s: number
          n_pilots: number
          vehicle_model: string
        }[]
      }
      generate_oxv_reference: { Args: never; Returns: string }
      get_or_create_my_affiliation_code: { Args: never; Returns: string }
      get_session_private_client: {
        Args: { p_session_id: string }
        Returns: {
          private_client_contact: string
          private_client_name: string
        }[]
      }
      get_shared_progression: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          expires_at: string
          included_metrics: Json
          share_scope: string
        }[]
      }
      get_shared_progression_values: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          expires_at: string
          included_metrics: Json
          metric_values: Json
          share_scope: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_coach: { Args: never; Returns: boolean }
      is_coach_of: { Args: { pilot_uuid: string }; Returns: boolean }
      is_detailed_coach_of: { Args: { pilot_uuid: string }; Returns: boolean }
      is_my_coach: { Args: { coach_uuid: string }; Returns: boolean }
      is_partner: { Args: never; Returns: boolean }
      is_pro_pilot: { Args: never; Returns: boolean }
      is_subscription_current: {
        Args: {
          p_scope: Database["public"]["Enums"]["subscription_scope"]
          p_user_id: string
        }
        Returns: boolean
      }
      is_validated_member: { Args: never; Returns: boolean }
      log_coach_view: {
        Args: {
          action_subtype?: string
          target_pilot_uuid: string
          target_session_uuid?: string
        }
        Returns: undefined
      }
      measure_metric_now: {
        Args: {
          p_circuit: string
          p_metric: Database["public"]["Enums"]["objective_metric"]
          p_user: string
        }
        Returns: number
      }
      my_goal_progress: {
        Args: never
        Returns: {
          baseline_value: number
          current_value: number
          goal_id: string
          last_date: string
          measurable: boolean
          sample_count: number
          series: Json
        }[]
      }
      my_objective_progress: {
        Args: never
        Returns: {
          baseline_value: number
          current_value: number
          last_date: string
          measurable: boolean
          objective_id: string
          sample_count: number
        }[]
      }
      my_session_annotations: {
        Args: { p_circuit: string }
        Returns: {
          body: string
          coach_name: string
          corner_index: number
          created_at: string
          day: string
          has_audio: boolean
          id: string
        }[]
      }
      my_session_objectives: {
        Args: { p_circuit: string }
        Returns: {
          day: string
          objective: string
        }[]
      }
      objective_progress_for_pilot: {
        Args: { p_pilot_id: string }
        Returns: {
          baseline_value: number
          current_value: number
          last_date: string
          measurable: boolean
          objective_id: string
          sample_count: number
          series: Json
        }[]
      }
      owns_partner_account: { Args: { account: string }; Returns: boolean }
      oxv_get_secret: { Args: { secret_name: string }; Returns: string }
      oxv_is_admin: { Args: never; Returns: boolean }
      pilot_sessions_for_coach: {
        Args: { p_pilot_id: string }
        Returns: {
          annotation_count: number
          best_lap_s: number
          circuit_id: string
          circuit_name: string
          day: string
          equipment: string
          has_context: boolean
          lap_count: number
          objective: string
          pilot_level: string
          session_id: string
          vehicle_label: string
          weather_note: string
        }[]
      }
      pilot_sheet_for_coach: {
        Args: { p_pilot_id: string }
        Returns: {
          avatar_url: string
          experience_years: number
          first_name: string
          focus: string
          last_name: string
          level: string
          pilot_id: string
          public_handle: string
          vehicles_note: string
        }[]
      }
      ping_attendees: {
        Args: { p_ping_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          responded_at: string
          user_id: string
        }[]
      }
      ping_rsvp_state: {
        Args: { p_ids: string[] }
        Returns: {
          going_count: number
          i_go: boolean
          ping_id: string
        }[]
      }
      redeem_affiliation_code: {
        Args: { p_code: string }
        Returns: {
          avatar_url: string
          first_name: string
          last_name: string
          link_id: string
          pilot_id: string
          public_handle: string
        }[]
      }
      rotate_my_affiliation_code: { Args: never; Returns: string }
      schedule_rituals_for_registration: {
        Args: { p_registration_id: string }
        Returns: undefined
      }
      should_send_notif: {
        Args: {
          notif: string
          recipient: string
          source: string
          window_seconds: number
        }
        Returns: boolean
      }
      uuid_or_null: { Args: { t: string }; Returns: string }
    }
    Enums: {
      affiliation_initiator: "coach" | "pilot"
      affiliation_status: "pending" | "active" | "declined" | "ended"
      coach_access_level: "lecture_simple" | "lecture_detaillee" | "programme"
      community_visibility: "private" | "anonymous_only" | "nominative"
      document_status_enum: "pending" | "validated" | "rejected" | "expired"
      document_type_enum:
        | "driving_license"
        | "id_card"
        | "insurance_road"
        | "insurance_track"
      duel_status:
        | "pending"
        | "accepted"
        | "declined"
        | "completed"
        | "expired"
        | "cancelled"
      email_status_enum: "sent" | "delivered" | "bounced" | "opened"
      event_partner_status: "invited" | "confirmed" | "declined"
      event_registration_status:
        | "registered"
        | "checked_in"
        | "cancelled"
        | "no_show"
      heritage_pack_status_enum: "active" | "completed" | "expired"
      insurance_option_enum: "personal" | "oxv"
      kyc_status_enum: "pending" | "validated" | "rejected" | "expired"
      media_type_enum:
        | "photo"
        | "video_drone"
        | "video_embedded"
        | "telemetry_report"
      objective_direction: "below" | "above" | "reach"
      objective_metric:
        | "regularity"
        | "personal_best"
        | "corner_braking"
        | "corner_speed"
        | "top_speed"
        | "qualitative"
        | "avg_lap"
        | "lap_count"
        | "sessions"
      objective_status: "active" | "achieved" | "archived"
      offer_type_enum: "access" | "signature" | "promotion" | "heritage"
      oxv_demande_statut: "en_attente" | "acceptee" | "refusee"
      oxv_demande_type: "pilote" | "pilote_pro" | "coach" | "partenaire"
      payment_method_enum: "card" | "bank_transfer" | "paypal"
      payment_status_enum: "pending" | "succeeded" | "failed" | "refunded"
      registration_status_enum:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "attended"
        | "no_show"
        | "pending_payment"
      ritual_status_enum:
        | "pending"
        | "generating"
        | "sent"
        | "failed"
        | "skipped"
      ritual_type_enum: "jminus7" | "jminus2" | "jminus1"
      scenic_route_status: "draft" | "pending_review" | "certified" | "rejected"
      season_type_enum: "high" | "low"
      session_status_enum:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "archived"
      subscription_scope: "coach" | "pilot"
      subscription_status: "active" | "past_due" | "canceled"
      support_ticket_category:
        | "equipement"
        | "bilan"
        | "data"
        | "coach"
        | "rgpd"
      support_ticket_priority: "p0" | "p1" | "p2" | "p3"
      support_ticket_status:
        | "nouveau"
        | "ouvert"
        | "en_cours"
        | "resolu"
        | "ferme"
      user_role: "pilot" | "admin" | "coach" | "partner" | "pro_pilot"
      weather_status_enum: "pending" | "confirmed" | "postponed"
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
      affiliation_initiator: ["coach", "pilot"],
      affiliation_status: ["pending", "active", "declined", "ended"],
      coach_access_level: ["lecture_simple", "lecture_detaillee", "programme"],
      community_visibility: ["private", "anonymous_only", "nominative"],
      document_status_enum: ["pending", "validated", "rejected", "expired"],
      document_type_enum: [
        "driving_license",
        "id_card",
        "insurance_road",
        "insurance_track",
      ],
      duel_status: [
        "pending",
        "accepted",
        "declined",
        "completed",
        "expired",
        "cancelled",
      ],
      email_status_enum: ["sent", "delivered", "bounced", "opened"],
      event_partner_status: ["invited", "confirmed", "declined"],
      event_registration_status: [
        "registered",
        "checked_in",
        "cancelled",
        "no_show",
      ],
      heritage_pack_status_enum: ["active", "completed", "expired"],
      insurance_option_enum: ["personal", "oxv"],
      kyc_status_enum: ["pending", "validated", "rejected", "expired"],
      media_type_enum: [
        "photo",
        "video_drone",
        "video_embedded",
        "telemetry_report",
      ],
      objective_direction: ["below", "above", "reach"],
      objective_metric: [
        "regularity",
        "personal_best",
        "corner_braking",
        "corner_speed",
        "top_speed",
        "qualitative",
        "avg_lap",
        "lap_count",
        "sessions",
      ],
      objective_status: ["active", "achieved", "archived"],
      offer_type_enum: ["access", "signature", "promotion", "heritage"],
      oxv_demande_statut: ["en_attente", "acceptee", "refusee"],
      oxv_demande_type: ["pilote", "pilote_pro", "coach", "partenaire"],
      payment_method_enum: ["card", "bank_transfer", "paypal"],
      payment_status_enum: ["pending", "succeeded", "failed", "refunded"],
      registration_status_enum: [
        "pending",
        "confirmed",
        "cancelled",
        "attended",
        "no_show",
        "pending_payment",
      ],
      ritual_status_enum: [
        "pending",
        "generating",
        "sent",
        "failed",
        "skipped",
      ],
      ritual_type_enum: ["jminus7", "jminus2", "jminus1"],
      scenic_route_status: ["draft", "pending_review", "certified", "rejected"],
      season_type_enum: ["high", "low"],
      session_status_enum: [
        "scheduled",
        "confirmed",
        "cancelled",
        "completed",
        "archived",
      ],
      subscription_scope: ["coach", "pilot"],
      subscription_status: ["active", "past_due", "canceled"],
      support_ticket_category: ["equipement", "bilan", "data", "coach", "rgpd"],
      support_ticket_priority: ["p0", "p1", "p2", "p3"],
      support_ticket_status: [
        "nouveau",
        "ouvert",
        "en_cours",
        "resolu",
        "ferme",
      ],
      user_role: ["pilot", "admin", "coach", "partner", "pro_pilot"],
      weather_status_enum: ["pending", "confirmed", "postponed"],
    },
  },
} as const
