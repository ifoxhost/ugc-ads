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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audio_generations: {
        Row: {
          completed_at: string | null
          created_at: string
          duration: string
          email: string
          generated_audio_url: string | null
          id: string
          reference_image_url: string | null
          status: string
          user_id: string
          voice_id: string
          voice_name: string
          voice_script: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration: string
          email: string
          generated_audio_url?: string | null
          id?: string
          reference_image_url?: string | null
          status?: string
          user_id: string
          voice_id: string
          voice_name: string
          voice_script: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration?: string
          email?: string
          generated_audio_url?: string | null
          id?: string
          reference_image_url?: string | null
          status?: string
          user_id?: string
          voice_id?: string
          voice_name?: string
          voice_script?: string
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempt_count: number
          created_at: string
          first_attempt_at: string
          id: string
          identifier: string
          identifier_type: string
          last_attempt_at: string
          locked_until: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier: string
          identifier_type: string
          last_attempt_at?: string
          locked_until?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          last_attempt_at?: string
          locked_until?: string | null
        }
        Relationships: []
      }
      cleanup_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          img_ttl_days: number | null
          imgs_deleted: number
          imgs_scanned: number
          live_imgs: number
          ref_ttl_days: number | null
          refs_deleted: number
          refs_scanned: number
          started_at: string
          success: boolean
          triggered_by: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          img_ttl_days?: number | null
          imgs_deleted?: number
          imgs_scanned?: number
          live_imgs?: number
          ref_ttl_days?: number | null
          refs_deleted?: number
          refs_scanned?: number
          started_at?: string
          success?: boolean
          triggered_by?: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          img_ttl_days?: number | null
          imgs_deleted?: number
          imgs_scanned?: number
          live_imgs?: number
          ref_ttl_days?: number | null
          refs_deleted?: number
          refs_scanned?: number
          started_at?: string
          success?: boolean
          triggered_by?: string
        }
        Relationships: []
      }
      generated_ads: {
        Row: {
          ad_copy: Json | null
          aspect_ratio: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          email: string
          generated_image_url: string | null
          generated_video_url: string | null
          id: string
          product_image_url: string
          prompt_used: string | null
          status: string
          style_template: string
          user_id: string
          video_duration: number | null
          video_last_checked_at: string | null
          video_progress: number | null
          video_retry_count: number | null
          video_status: string | null
          video_task_id: string | null
        }
        Insert: {
          ad_copy?: Json | null
          aspect_ratio?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          generated_image_url?: string | null
          generated_video_url?: string | null
          id?: string
          product_image_url: string
          prompt_used?: string | null
          status?: string
          style_template: string
          user_id: string
          video_duration?: number | null
          video_last_checked_at?: string | null
          video_progress?: number | null
          video_retry_count?: number | null
          video_status?: string | null
          video_task_id?: string | null
        }
        Update: {
          ad_copy?: Json | null
          aspect_ratio?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          generated_image_url?: string | null
          generated_video_url?: string | null
          id?: string
          product_image_url?: string
          prompt_used?: string | null
          status?: string
          style_template?: string
          user_id?: string
          video_duration?: number | null
          video_last_checked_at?: string | null
          video_progress?: number | null
          video_retry_count?: number | null
          video_status?: string | null
          video_task_id?: string | null
        }
        Relationships: []
      }
      image_generations: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string
          generated_image_url: string | null
          id: string
          image_description: string
          reference_image_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email: string
          generated_image_url?: string | null
          id?: string
          image_description: string
          reference_image_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string
          generated_image_url?: string | null
          id?: string
          image_description?: string
          reference_image_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          feature_announcements: boolean
          id: string
          marketing_emails: boolean
          subscription_expiry_notifications: boolean
          trash_expiry_notifications: boolean
          updated_at: string
          user_id: string
          video_status_emails: boolean
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          feature_announcements?: boolean
          id?: string
          marketing_emails?: boolean
          subscription_expiry_notifications?: boolean
          trash_expiry_notifications?: boolean
          updated_at?: string
          user_id: string
          video_status_emails?: boolean
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          feature_announcements?: boolean
          id?: string
          marketing_emails?: boolean
          subscription_expiry_notifications?: boolean
          trash_expiry_notifications?: boolean
          updated_at?: string
          user_id?: string
          video_status_emails?: boolean
          weekly_digest?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          credits: number
          credits_used: number
          id: string
          payfast_token: string | null
          plan_id: string
          renew_date: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credits?: number
          credits_used?: number
          id?: string
          payfast_token?: string | null
          plan_id: string
          renew_date: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          credits_used?: number
          id?: string
          payfast_token?: string | null
          plan_id?: string
          renew_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          payment_id: string
          payment_method: string | null
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_id: string
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_id?: string
          payment_method?: string | null
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_requests: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          processed_at: string | null
          request_data: Json
          result_url: string | null
          retry_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          request_data: Json
          result_url?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          request_data?: Json
          result_url?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_prompt_presets: {
        Row: {
          created_at: string
          demographics: Json | null
          id: string
          name: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demographics?: Json | null
          id?: string
          name: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          demographics?: Json | null
          id?: string
          name?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_info: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          location: string | null
          os: string | null
          session_token: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_info?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          os?: string | null
          session_token: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_info?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          os?: string | null
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      video_generations: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string
          generated_images: Json | null
          generated_video_url: string | null
          id: string
          reference_image_url: string | null
          status: string
          user_id: string
          video_description: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email: string
          generated_images?: Json | null
          generated_video_url?: string | null
          id?: string
          reference_image_url?: string | null
          status?: string
          user_id: string
          video_description: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string
          generated_images?: Json | null
          generated_video_url?: string | null
          id?: string
          reference_image_url?: string | null
          status?: string
          user_id?: string
          video_description?: string
        }
        Relationships: []
      }
      video_scenes: {
        Row: {
          ad_id: string
          created_at: string
          end_sec: number
          error_message: string | null
          failed_step: string | null
          id: string
          image_status: string
          image_url: string | null
          index: number
          lyric_lines: string[]
          prompt: Json
          regen_count: number
          start_sec: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          end_sec?: number
          error_message?: string | null
          failed_step?: string | null
          id?: string
          image_status?: string
          image_url?: string | null
          index: number
          lyric_lines?: string[]
          prompt?: Json
          regen_count?: number
          start_sec?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          end_sec?: number
          error_message?: string | null
          failed_step?: string | null
          id?: string
          image_status?: string
          image_url?: string | null
          index?: number
          lyric_lines?: string[]
          prompt?: Json
          regen_count?: number
          start_sec?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      consume_credit: {
        Args: { _amount?: number; _user_id: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_credits: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
