// Otomatik üretildi: npm run db:types -w @bekofy/core (kaynak: canlı Supabase şeması). Elle düzenleme.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      artist_follow_playlists: {
        Row: {
          user_id: string;
          artist_id: string;
          playlist_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          artist_id: string;
          playlist_id?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          artist_id?: string;
          playlist_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "artist_follow_playlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_follow_playlists_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_follow_playlists_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlists";
            referencedColumns: ["id"];
          },
        ];
      };
      artist_follows: {
        Row: {
          user_id: string;
          artist_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          artist_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          artist_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "artist_follows_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_follows_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          },
        ];
      };
      artist_requests: {
        Row: {
          id: string;
          user_id: string;
          artist_name: string;
          message: string | null;
          links: (string)[];
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          artist_name: string;
          message?: string | null;
          links: (string)[];
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          artist_name?: string;
          message?: string | null;
          links?: (string)[];
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "artist_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "artist_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      artists: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
          profile_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          avatar_url?: string | null;
          created_at?: string;
          profile_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          avatar_url?: string | null;
          created_at?: string;
          profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "artists_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      badge_definitions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string;
          category: string;
          requirement: Json;
          is_premium: boolean;
          rarity: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          icon: string;
          category: string;
          requirement: Json;
          is_premium?: boolean;
          rarity?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          icon?: string;
          category?: string;
          requirement?: Json;
          is_premium?: boolean;
          rarity?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      bekofy: {
        Row: {
          id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      blocked_users: {
        Row: {
          id: string;
          user_id: string | null;
          blocked_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          blocked_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          blocked_id?: string | null;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string | null;
          user_name: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_name: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_name?: string;
          message?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: {
          id: string;
          user_id: string | null;
          friend_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          friend_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          friend_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      jam_participants: {
        Row: {
          id: string;
          session_id: string | null;
          user_id: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          user_id?: string | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string | null;
          user_id?: string | null;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jam_participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "jam_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      jam_sessions: {
        Row: {
          id: string;
          code: string;
          host_id: string | null;
          current_song_id: string | null;
          is_playing: boolean;
          current_position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          host_id?: string | null;
          current_song_id?: string | null;
          is_playing?: boolean;
          current_position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          host_id?: string | null;
          current_song_id?: string | null;
          is_playing?: boolean;
          current_position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jam_sessions_current_song_id_fkey";
            columns: ["current_song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      liked_songs: {
        Row: {
          user_id: string;
          song_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          song_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          song_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "liked_songs_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      listening_history: {
        Row: {
          id: number;
          user_id: string;
          song_id: string;
          played_at: string;
          seconds_played: number;
          context_id: string | null;
          platform: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          song_id: string;
          played_at?: string;
          seconds_played?: number;
          context_id?: string | null;
          platform: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          song_id?: string;
          played_at?: string;
          seconds_played?: number;
          context_id?: string | null;
          platform?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listening_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listening_history_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      ota_updates: {
        Row: {
          id: string;
          version: string;
          zip_url: string;
          release_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          version: string;
          zip_url: string;
          release_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          version?: string;
          zip_url?: string;
          release_notes?: string | null;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      playlist_collaborators: {
        Row: {
          id: string;
          playlist_id: string;
          user_id: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          user_id: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          user_id?: string;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_collaborators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      playlist_songs: {
        Row: {
          playlist_id: string;
          song_id: string;
          position: number | null;
        };
        Insert: {
          playlist_id: string;
          song_id: string;
          position?: number | null;
        };
        Update: {
          playlist_id?: string;
          song_id?: string;
          position?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey";
            columns: ["playlist_id"];
            isOneToOne: false;
            referencedRelation: "playlists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      playlists: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          cover_url: string | null;
          created_at: string;
          description: string | null;
          is_public: boolean;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          cover_url?: string | null;
          created_at?: string;
          description?: string | null;
          is_public?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          cover_url?: string | null;
          created_at?: string;
          description?: string | null;
          is_public?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "playlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          created_at: string;
          role: string;
          bio: string;
          is_banned: boolean;
          banner_url: string | null;
          is_premium: boolean;
          theme: string | null;
          avatar_frame: string | null;
          current_song_id: string | null;
          is_playing: boolean;
          last_activity: string;
          city: string | null;
          website: string | null;
          social_links: Json | null;
          favorite_genres: (string)[] | null;
          banner_position: number;
          bio_format: string;
          theme_preference: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          role?: string;
          bio?: string;
          is_banned?: boolean;
          banner_url?: string | null;
          is_premium?: boolean;
          theme?: string | null;
          avatar_frame?: string | null;
          current_song_id?: string | null;
          is_playing?: boolean;
          last_activity?: string;
          city?: string | null;
          website?: string | null;
          social_links?: Json | null;
          favorite_genres?: (string)[] | null;
          banner_position?: number;
          bio_format?: string;
          theme_preference?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          role?: string;
          bio?: string;
          is_banned?: boolean;
          banner_url?: string | null;
          is_premium?: boolean;
          theme?: string | null;
          avatar_frame?: string | null;
          current_song_id?: string | null;
          is_playing?: boolean;
          last_activity?: string;
          city?: string | null;
          website?: string | null;
          social_links?: Json | null;
          favorite_genres?: (string)[] | null;
          banner_position?: number;
          bio_format?: string;
          theme_preference?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_current_song_id_fkey";
            columns: ["current_song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      reserved_usernames: {
        Row: {
          id: string;
          username: string;
          created_at: string;
          added_by: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          created_at?: string;
          added_by?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
          added_by?: string | null;
        };
        Relationships: [

        ];
      };
      song_artists: {
        Row: {
          song_id: string;
          artist_id: string;
          position: number;
        };
        Insert: {
          song_id: string;
          artist_id: string;
          position?: number;
        };
        Update: {
          song_id?: string;
          artist_id?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "song_artists_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_artists_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          },
        ];
      };
      songs: {
        Row: {
          id: string;
          title: string;
          artist: string;
          album: string | null;
          duration: number | null;
          cover_url: string | null;
          file_path: string;
          genre: string | null;
          created_at: string;
          status: string;
          lyrics: string | null;
          synced_lyrics: string | null;
          uploaded_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          artist: string;
          album?: string | null;
          duration?: number | null;
          cover_url?: string | null;
          file_path: string;
          genre?: string | null;
          created_at?: string;
          status?: string;
          lyrics?: string | null;
          synced_lyrics?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string;
          album?: string | null;
          duration?: number | null;
          cover_url?: string | null;
          file_path?: string;
          genre?: string | null;
          created_at?: string;
          status?: string;
          lyrics?: string | null;
          synced_lyrics?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [

        ];
      };
      user_access_logs: {
        Row: {
          id: number;
          user_id: string;
          platform: string;
          app_version: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          platform: string;
          app_version?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          platform?: string;
          app_version?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_access_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string | null;
          badge_id: string | null;
          earned_at: string | null;
          progress: number;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          badge_id?: string | null;
          earned_at?: string | null;
          progress?: number;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          badge_id?: string | null;
          earned_at?: string | null;
          progress?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badge_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      artist_song_stats: { Args: Record<PropertyKey, never>; Returns: unknown };
      is_admin: { Args: Record<PropertyKey, never>; Returns: unknown };
      review_artist_request: { Args: { p_approve: boolean; p_request_id: string }; Returns: unknown };
      submit_artist_song: { Args: { p_album: string; p_cover_url: string; p_duration: number; p_file_path: string; p_genre: string; p_title: string }; Returns: unknown };
      update_user_badge_progress: { Args: { p_user_id: string }; Returns: unknown };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
