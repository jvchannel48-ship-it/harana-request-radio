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
      morefm_listeners: {
        Row: {
          last_seen_at: string
          listener_id: string
        }
        Insert: {
          last_seen_at?: string
          listener_id: string
        }
        Update: {
          last_seen_at?: string
          listener_id?: string
        }
        Relationships: []
      }
      morefm_state: {
        Row: {
          storage_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          storage_key: string
          updated_at?: string
          value: Json
        }
        Update: {
          storage_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      requests: {
        Row: {
          artist: string | null
          candidate: Json | null
          confidence: string | null
          created_at: string
          heard: string | null
          id: string
          message: string | null
          name: string
          note: string | null
          song_title: string
          status: string
        }
        Insert: {
          artist?: string | null
          candidate?: Json | null
          confidence?: string | null
          created_at?: string
          heard?: string | null
          id?: string
          message?: string | null
          name?: string
          note?: string | null
          song_title: string
          status?: string
        }
        Update: {
          artist?: string | null
          candidate?: Json | null
          confidence?: string | null
          created_at?: string
          heard?: string | null
          id?: string
          message?: string | null
          name?: string
          note?: string | null
          song_title?: string
          status?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string
          category: string
          created_at: string
          decade: string | null
          duration_seconds: number
          id: string
          is_active: boolean
          language: string | null
          picture: string | null
          playlist_group: string
          sort_order: number
          title: string
          updated_at: string
          youtube_id: string
        }
        Insert: {
          artist: string
          category?: string
          created_at?: string
          decade?: string | null
          duration_seconds: number
          id?: string
          is_active?: boolean
          language?: string | null
          picture?: string | null
          playlist_group?: string
          sort_order?: number
          title: string
          updated_at?: string
          youtube_id: string
        }
        Update: {
          artist?: string
          category?: string
          created_at?: string
          decade?: string | null
          duration_seconds?: number
          id?: string
          is_active?: boolean
          language?: string | null
          picture?: string | null
          playlist_group?: string
          sort_order?: number
          title?: string
          updated_at?: string
          youtube_id?: string
        }
        Relationships: []
      }
      top_played: {
        Row: {
          artist: string
          id: string
          last_played_at: string
          play_count: number
          song_id: string | null
          title: string
          updated_at: string
          youtube_id: string
        }
        Insert: {
          artist: string
          id?: string
          last_played_at?: string
          play_count?: number
          song_id?: string | null
          title: string
          updated_at?: string
          youtube_id: string
        }
        Update: {
          artist?: string
          id?: string
          last_played_at?: string
          play_count?: number
          song_id?: string | null
          title?: string
          updated_at?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "top_played_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      morefm_acquire_lease: {
        Args: {
          _expires_at: number
          _key: string
          _now: number
          _owner: string
        }
        Returns: boolean
      }
      morefm_listener_count: { Args: never; Returns: number }
      morefm_register_listener: {
        Args: { _active: boolean; _id: string; _limit: number }
        Returns: Json
      }
      morefm_release_lease: {
        Args: { _key: string; _owner: string }
        Returns: undefined
      }
      morefm_renew_lease: {
        Args: {
          _expires_at: number
          _key: string
          _now: number
          _owner: string
        }
        Returns: boolean
      }
      morefm_storage_usage: { Args: never; Returns: Json }
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
