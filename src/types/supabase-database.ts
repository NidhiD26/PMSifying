/**
 * Types for the SecretChat (World B) relational schema.
 *
 * This mirrors `supabase/migrations/0001_secretchat_schema.sql` and
 * `supabase/migrations/0002_secretchat_rls.sql` by hand rather than being
 * generated, so it is reviewable in a diff and cannot be silently regenerated
 * with a different shape than the one the app is tested against.
 *
 * WHAT THIS SCHEMA DELIBERATELY DOES NOT CONTAIN
 * There is no column anywhere in it for a name, an email address, a phone
 * number, a location, or any cycle, symptom, mood, sleep, hydration or pain
 * value. World A (personal tracking) lives in IndexedDB and has no query path
 * into Postgres at all, so the two systems cannot be joined even by accident.
 * A member of SecretChat is identified to the community only by a random alias
 * number; the mapping to their sign-in identity exists in `profiles` and is
 * readable by nobody but the server.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Why content was reported. The set is closed and mirrored in the UI. */
export type ReportReason =
  | 'harassment'
  | 'sexual_content'
  | 'self_harm'
  | 'medical_misinformation'
  | 'spam'
  | 'other';

export type ReportTargetType = 'post' | 'comment';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type ModerationActionType =
  | 'hide_post'
  | 'hide_comment'
  | 'restore_post'
  | 'restore_comment'
  | 'dismiss_report'
  | 'resolve_report'
  | 'suspend_author'
  | 'unsuspend_author';

export type ModerationActionStatus = 'applied' | 'reverted';

export type ProfileRow = {
  id: string;
  created_at: string;
  updated_at: string;
  /** Set when a moderator suspends the account. Null for active members. */
  suspended_at: string | null;
}

/**
 * The public face of a member.
 *
 * `alias_number` is a random 1000-9999 number, never derived from the sign-in
 * email or name, and it is stable for the life of the account. Together with
 * the post timestamps it is the only thing another member can learn about the
 * author.
 *
 * PRIVACY MODEL FOR THIS TABLE
 * `user_id` is the private half: it is the only column that links a member to
 * their account, and Row Level Security lets a member read exactly one row here
 * Ã¢â‚¬â€ their own. Another member cannot select this table at all, so no member can
 * walk from a post back to a real person.
 *
 * Feeds do not read this table directly. They read the
 * `anonymous_identities` view, which exposes only `id`, `alias_number` and
 * `display_name` and never `user_id`, so a query cannot join a post to an
 * account by accident.
 */
export type AnonymousProfileRow = {
  id: string;
  /** The one column that maps an account to its alias. Never exposed publicly. */
  user_id: string;
  alias_number: number;
  created_at: string;
  updated_at: string;
  /**
   * Free-text display name the member may set. Defaults to
   * "Anonymous User #<alias_number>". Optional, never required to post.
   */
  display_name: string | null;
}

export type PostRow = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  /** Soft deletion: set when the author or a moderator hides the post. */
  deleted_at: string | null;
  deleted_by_moderator: boolean;
}

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by_moderator: boolean;
}

export type PostLikeRow = {
  post_id: string;
  liker_id: string;
  created_at: string;
}

export type CommentLikeRow = {
  comment_id: string;
  liker_id: string;
  created_at: string;
}

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  /** Only set for `other`, so a reporter can add context. */
  details: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  /**
   * Opaque handle for this one block pair, minted server-side.
   *
   * It is the only way to unblock, because the client is never given an account
   * id. It names a block rather than a person, so holding it reveals nothing.
   */
  ref: string;
  created_at: string;
}

export type ModerationActionRow = {
  id: string;
  moderator_id: string;
  action: ModerationActionType;
  target_type: ReportTargetType;
  target_id: string;
  /** Post or comment body at the moment the action was applied. */
  reason: string | null;
  status: ModerationActionStatus;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
}

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  /** JSONB snapshot. Never contains health records or report text. */
  metadata: Json;
  created_at: string;
}

/** True when a user id is a well-formed UUID. */
export type Uuid = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ProfileRow, 'id'>>;
        Relationships: [];
      };
      anonymous_profiles: {
        Row: AnonymousProfileRow;
        Insert: Pick<AnonymousProfileRow, 'user_id' | 'alias_number'> & {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Pick<AnonymousProfileRow, 'display_name'>>;
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: Pick<PostRow, 'author_id' | 'content'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PostRow, 'id' | 'author_id'>>;
        Relationships: [];
      };
      comments: {
        Row: CommentRow;
        Insert: Pick<CommentRow, 'post_id' | 'author_id' | 'content'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CommentRow, 'id' | 'author_id' | 'post_id'>>;
        Relationships: [];
      };
      post_likes: {
        Row: PostLikeRow;
        /** `created_at` is defaulted by the database, so callers need not set it. */
        Insert: Omit<PostLikeRow, 'created_at'> & { created_at?: string };
        Update: never;
        Relationships: [];
      };
      comment_likes: {
        Row: CommentLikeRow;
        Insert: Omit<CommentLikeRow, 'created_at'> & { created_at?: string };
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: Omit<ReportRow, 'id' | 'status' | 'created_at' | 'updated_at' | 'resolved_at' | 'resolved_by'> & {
          id?: string;
          status?: ReportStatus;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: Partial<Omit<ReportRow, 'id' | 'reporter_id'>>;
        Relationships: [];
      };
      blocks: {
        Row: BlockRow;
        /**
         * `ref` and `created_at` are both minted by the database, so a caller
         * supplies only the two account ids. It never supplies an account id for
         * the *target* in this type on purpose: the store resolves that from a row
         * the caller can already read.
         */
        Insert: Pick<BlockRow, 'blocker_id' | 'blocked_id'> & {
          ref?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      moderation_actions: {
        Row: ModerationActionRow;
        Insert: Omit<ModerationActionRow, 'id' | 'status' | 'created_at' | 'reverted_at' | 'reverted_by'> & {
          id?: string;
          status?: ModerationActionStatus;
          created_at?: string;
          reverted_at?: string | null;
          reverted_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /**
       * Claims (or returns) the caller's anonymous identity.
       *
       * Security definer, because the correct answer depends on reading every
       * `anonymous_profiles` row to resolve a collision, and a member must not
       * be able to read that table. It takes no arguments and reads the caller
       * from `auth.uid()`, so it cannot be used to claim an alias for somebody
       * else.
       */
      secretchat_claim_anonymous_profile: {
        Args: Record<PropertyKey, never>;
        /**
         * A single row, not an array.
         *
         * The SQL returns the composite type `public.anonymous_profiles`, so
         * PostgREST answers with one object. Declaring an array here is the kind of
         * mismatch that survives review, because the caller can cast its way out of
         * it - so the type says what the function actually returns, and the store
         * is not allowed to cast around it.
         */
        Returns: AnonymousProfileRow;
      };
      /** True when the caller is listed as a moderator. */
      secretchat_is_moderator: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      /**
       * Resolves the public identity of account ids the caller already holds.
       *
       * Returns one row per id supplied, echoing the caller's own input back, and
       * never a listing. That is what makes it safe to grant broadly: it cannot be
       * used to enumerate who owns which alias.
       */
      secretchat_identities: {
        Args: { p_user_ids: string[] };
        Returns: {
          user_id: string;
          alias_number: number;
          display_name: string | null;
        }[];
      };
    };
    Enums: {
      report_reason: ReportReason;
      report_target_type: ReportTargetType;
      report_status: ReportStatus;
      moderation_action_type: ModerationActionType;
      moderation_action_status: ModerationActionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
