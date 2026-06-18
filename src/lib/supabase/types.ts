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
      court_sessions: {
        Row: {
          court_id: string
          created_at: string | null
          expires_at: string
          extended: boolean | null
          id: string
          queue_entry_id: string | null
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          court_id: string
          created_at?: string | null
          expires_at: string
          extended?: boolean | null
          id?: string
          queue_entry_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string | null
          expires_at?: string
          extended?: boolean | null
          id?: string
          queue_entry_id?: string | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_sessions_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_sessions_queue_entry_id_fkey"
            columns: ["queue_entry_id"]
            isOneToOne: false
            referencedRelation: "queue_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          address: string | null
          amenities: string[] | null
          court_type: string
          created_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
          num_courts: number
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          court_type: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
          num_courts?: number
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          court_type?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          num_courts?: number
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          extended_at: string | null
          id: string
          invite_code: string | null
          joined_at: string | null
          notified_at: string | null
          party_size: number
          position: number
          queue_id: string
          sport: string
          started_playing_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          extended_at?: string | null
          id?: string
          invite_code?: string | null
          joined_at?: string | null
          notified_at?: string | null
          party_size?: number
          position: number
          queue_id: string
          sport: string
          started_playing_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          extended_at?: string | null
          id?: string
          invite_code?: string | null
          joined_at?: string | null
          notified_at?: string | null
          party_size?: number
          position?: number
          queue_id?: string
          sport?: string
          started_playing_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          court_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          court_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          court_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: true
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          preferred_sport: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          preferred_sport?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          preferred_sport?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_old_sessions: { Args: Record<string, never>; Returns: undefined }
      generate_invite_code: { Args: Record<string, never>; Returns: string }
      reorder_queue: { Args: { p_queue_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Court = Database["public"]["Tables"]["courts"]["Row"];
export type Queue = Database["public"]["Tables"]["queues"]["Row"];
export type QueueEntry = Database["public"]["Tables"]["queue_entries"]["Row"];
export type CourtSession = Database["public"]["Tables"]["court_sessions"]["Row"];

export type CourtWithQueue = Court & {
  queue: (Queue & { queue_entries: QueueEntry[] }) | null;
  active_session: CourtSession | null;
};
