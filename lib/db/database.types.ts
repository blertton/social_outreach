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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      drafts: {
        Row: {
          id: string
          model: string
          prompt_version: string
          reviewed_at: string | null
          reviewed_by: string | null
          search_result_id: string
          status: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          model: string
          prompt_version: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_result_id: string
          status?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          model?: string
          prompt_version?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_result_id?: string
          status?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_search_result_id_user_id_fkey"
            columns: ["search_result_id", "user_id"]
            isOneToOne: false
            referencedRelation: "search_results"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      posts: {
        Row: {
          author_handle: string
          author_id: string
          external_id: string
          fetched_at: string
          id: string
          posted_at: string
          source: string
          text: string
          url: string | null
          user_id: string
        }
        Insert: {
          author_handle: string
          author_id: string
          external_id: string
          fetched_at?: string
          id?: string
          posted_at: string
          source: string
          text: string
          url?: string | null
          user_id: string
        }
        Update: {
          author_handle?: string
          author_id?: string
          external_id?: string
          fetched_at?: string
          id?: string
          posted_at?: string
          source?: string
          text?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      search_results: {
        Row: {
          analysis: Json | null
          analysis_error_code: string | null
          analysis_model: string | null
          analysis_prompt_version: string | null
          analysis_status: string
          analyzed_at: string | null
          id: string
          original_rank: number
          post_id: string
          search_id: string
          source: string
          source_text_snapshot: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          analysis_error_code?: string | null
          analysis_model?: string | null
          analysis_prompt_version?: string | null
          analysis_status?: string
          analyzed_at?: string | null
          id?: string
          original_rank: number
          post_id: string
          search_id: string
          source: string
          source_text_snapshot: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          analysis_error_code?: string | null
          analysis_model?: string | null
          analysis_prompt_version?: string | null
          analysis_status?: string
          analyzed_at?: string | null
          id?: string
          original_rank?: number
          post_id?: string
          search_id?: string
          source?: string
          source_text_snapshot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_post_id_user_id_source_fkey"
            columns: ["post_id", "user_id", "source"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id", "user_id", "source"]
          },
          {
            foreignKeyName: "search_results_search_id_user_id_source_fkey"
            columns: ["search_id", "user_id", "source"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id", "user_id", "source"]
          },
        ]
      }
      searches: {
        Row: {
          created_at: string
          filtered_count: number
          id: string
          query: string
          skipped_count: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filtered_count?: number
          id?: string
          query: string
          skipped_count?: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          filtered_count?: number
          id?: string
          query?: string
          skipped_count?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          action: string
          bucket_start: string
          count: number
          period: string
          user_id: string
        }
        Insert: {
          action: string
          bucket_start: string
          count: number
          period: string
          user_id: string
        }
        Update: {
          action?: string
          bucket_start?: string
          count?: number
          period?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reserve_usage: {
        Args: { p_action: string }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      save_analysis_batch: {
        Args: {
          p_model: string
          p_prompt_version: string
          p_results: Json
          p_search_id: string
          p_user_id: string
        }
        Returns: number
      }
      save_search: {
        Args: {
          p_filtered?: number
          p_posts: Json
          p_query: string
          p_skipped?: number
          p_source: string
          p_user_id: string
        }
        Returns: string
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
