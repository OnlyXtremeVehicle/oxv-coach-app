/**
 * Types TypeScript générés depuis le schéma Supabase de prod.
 * Projet : fouvuqkdxarjpjbqnsjq (Frankfurt)
 * Généré le 2026-05-24 via MCP Supabase.
 *
 * Régénérer après toute migration : commande équivalente à
 *   npx supabase gen types typescript --project-id fouvuqkdxarjpjbqnsjq > src/types/database.types.ts
 */

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
            referencedRelation: "users"
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
          city: string | null
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
          city?: string | null
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
          city?: string | null
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "users"
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
            referencedRelation: "telemetry_sessions"
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
            referencedRelation: "users"
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
      telemetry_frames: {
        Row: {
          altitude_m: number | null
          battery_level: number | null
          created_at: string
          elapsed_ms: number
          g_force_x: number | null
          g_force_y: number | null
          g_force_z: number | null
          gps_accuracy_m: number | null
          gps_fix: number | null
          heading: number | null
          id: number
          latitude: number | null
          longitude: number | null
          satellites: number | null
          session_id: string
          speed_kmh: number | null
        }
        Insert: {
          altitude_m?: number | null
          battery_level?: number | null
          created_at?: string
          elapsed_ms: number
          g_force_x?: number | null
          g_force_y?: number | null
          g_force_z?: number | null
          gps_accuracy_m?: number | null
          gps_fix?: number | null
          heading?: number | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          satellites?: number | null
          session_id: string
          speed_kmh?: number | null
        }
        Update: {
          altitude_m?: number | null
          battery_level?: number | null
          created_at?: string
          elapsed_ms?: number
          g_force_x?: number | null
          g_force_y?: number | null
          g_force_z?: number | null
          gps_accuracy_m?: number | null
          gps_fix?: number | null
          heading?: number | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          satellites?: number | null
          session_id?: string
          speed_kmh?: number | null
        }
        Relationships: [
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
          id: string
          lap_count: number | null
          max_g_lateral: number | null
          max_g_longitudinal: number | null
          max_speed_kmh: number | null
          name: string | null
          notes: string | null
          raw_data_url: string | null
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
          id?: string
          lap_count?: number | null
          max_g_lateral?: number | null
          max_g_longitudinal?: number | null
          max_speed_kmh?: number | null
          name?: string | null
          notes?: string | null
          raw_data_url?: string | null
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
          id?: string
          lap_count?: number | null
          max_g_lateral?: number | null
          max_g_longitudinal?: number | null
          max_speed_kmh?: number | null
          name?: string | null
          notes?: string | null
          raw_data_url?: string | null
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
          avatar_url: string | null
          birth_date: string | null
          blood_type: string | null
          created_at: string | null
          deletion_requested_at: string | null
          deletion_scheduled_at: string | null
          email: string
          email_verified: boolean | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          experience_years: string | null
          ffsa_license: string | null
          first_name: string | null
          id: string
          is_admin: boolean | null
          kyc_status: Database["public"]["Enums"]["kyc_status_enum"] | null
          kyc_validated_at: string | null
          kyc_validated_by: string | null
          last_login_at: string | null
          last_name: string | null
          medical_notes: string | null
          notif_newsletter: boolean | null
          notif_offers: boolean | null
          notification_preferences: Json | null
          phone: string | null
          pilot_level: string | null
          preferred_language: string | null
          profile_completed_at: string | null
          public_handle: string | null
          ritual_jminus1_enabled: boolean
          ritual_jminus2_enabled: boolean
          ritual_jminus7_enabled: boolean
          role: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          accepts_marketing?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_line?: string | null
          address_zip?: string | null
          admin_notes?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blood_type?: string | null
          created_at?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          email: string
          email_verified?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          experience_years?: string | null
          ffsa_license?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          kyc_status?: Database["public"]["Enums"]["kyc_status_enum"] | null
          kyc_validated_at?: string | null
          kyc_validated_by?: string | null
          last_login_at?: string | null
          last_name?: string | null
          medical_notes?: string | null
          notif_newsletter?: boolean | null
          notif_offers?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          pilot_level?: string | null
          preferred_language?: string | null
          profile_completed_at?: string | null
          public_handle?: string | null
          ritual_jminus1_enabled?: boolean
          ritual_jminus2_enabled?: boolean
          ritual_jminus7_enabled?: boolean
          role?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          accepts_marketing?: boolean | null
          address_city?: string | null
          address_country?: string | null
          address_line?: string | null
          address_zip?: string | null
          admin_notes?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          blood_type?: string | null
          created_at?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          email?: string
          email_verified?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          experience_years?: string | null
          ffsa_license?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          kyc_status?: Database["public"]["Enums"]["kyc_status_enum"] | null
          kyc_validated_at?: string | null
          kyc_validated_by?: string | null
          last_login_at?: string | null
          last_name?: string | null
          medical_notes?: string | null
          notif_newsletter?: boolean | null
          notif_offers?: boolean | null
          notification_preferences?: Json | null
          phone?: string | null
          pilot_level?: string | null
          preferred_language?: string | null
          profile_completed_at?: string | null
          public_handle?: string | null
          ritual_jminus1_enabled?: boolean
          ritual_jminus2_enabled?: boolean
          ritual_jminus7_enabled?: boolean
          role?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
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
      admin_ritual_stats: { Args: { p_days_back?: number }; Returns: Json }
      apply_resend_event: {
        Args: {
          p_bounce_reason?: string
          p_dispatch_id: string
          p_event_type: string
          p_occurred_at: string
        }
        Returns: undefined
      }
      cancel_pending_rituals_for_registration: {
        Args: { p_registration_id: string }
        Returns: number
      }
      generate_oxv_reference: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      schedule_rituals_for_registration: {
        Args: { p_registration_id: string }
        Returns: undefined
      }
    }
    Enums: {
      document_status_enum: "pending" | "validated" | "rejected" | "expired"
      document_type_enum:
        | "driving_license"
        | "id_card"
        | "insurance_road"
        | "insurance_track"
      email_status_enum: "sent" | "delivered" | "bounced" | "opened"
      heritage_pack_status_enum: "active" | "completed" | "expired"
      insurance_option_enum: "personal" | "oxv"
      kyc_status_enum: "pending" | "validated" | "rejected" | "expired"
      media_type_enum:
        | "photo"
        | "video_drone"
        | "video_embedded"
        | "telemetry_report"
      offer_type_enum: "access" | "signature" | "promotion" | "heritage"
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
      season_type_enum: "high" | "low"
      session_status_enum:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "archived"
      user_role: "pilot" | "admin"
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
      document_status_enum: ["pending", "validated", "rejected", "expired"],
      document_type_enum: [
        "driving_license",
        "id_card",
        "insurance_road",
        "insurance_track",
      ],
      email_status_enum: ["sent", "delivered", "bounced", "opened"],
      heritage_pack_status_enum: ["active", "completed", "expired"],
      insurance_option_enum: ["personal", "oxv"],
      kyc_status_enum: ["pending", "validated", "rejected", "expired"],
      media_type_enum: [
        "photo",
        "video_drone",
        "video_embedded",
        "telemetry_report",
      ],
      offer_type_enum: ["access", "signature", "promotion", "heritage"],
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
      season_type_enum: ["high", "low"],
      session_status_enum: [
        "scheduled",
        "confirmed",
        "cancelled",
        "completed",
        "archived",
      ],
      user_role: ["pilot", "admin"],
      weather_status_enum: ["pending", "confirmed", "postponed"],
    },
  },
} as const
