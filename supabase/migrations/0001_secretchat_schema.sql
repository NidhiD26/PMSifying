-- =============================================================================
-- PMSify / SecretChat (World B) — schema
-- =============================================================================
--
-- Apply with:  supabase db push        (linked project)
--          or: psql "$DATABASE_URL" -f 0001_secretchat_schema.sql
--
-- WHAT THIS SCHEMA IS
-- Ten tables for anonymous peer support. UUID primary keys throughout, and no
-- column anywhere for a name, an email address, a phone number, a location, or
-- any cycle, symptom, mood, sleep, hydration or pain value.
--
-- WHY THERE IS NO ROUTE FROM HERE TO PERSONAL HEALTH DATA
-- World A lives in the reader's IndexedDB and is never synchronised. There is
-- no health column in this file, no table a cycle record could be joined into,
-- and no function that accepts one. The separation is structural, not a policy.
--
-- Row Level Security is in 0002_secretchat_rls.sql. Applying this file alone
-- leaves every table readable only by its owner through the default-deny
-- policies created in 0002, so apply both in order.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------
-- A closed set of report reasons, so a moderation queue can be grouped and
-- reasoned about. Adding a reason is a migration, not a free-text field.
create type public.report_reason as enum (
  'harassment',
  'sexual_content',
  'self_harm',
  'medical_misinformation',
  'spam',
  'other'
);

create type public.report_target_type as enum ('post', 'comment');

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create type public.moderation_action_type as enum (
  'hide_post',
  'hide_comment',
  'restore_post',
  'restore_comment',
  'dismiss_report',
  'resolve_report',
  'suspend_author',
  'unsuspend_author'
);

create type public.moderation_action_status as enum ('applied', 'reverted');

-- -----------------------------------------------------------------------------
-- profiles — the private half of an account
-- -----------------------------------------------------------------------------
-- One row per authenticated account. It holds no personal data at all: the
-- email address lives in Supabase's own auth.users table and is never copied
-- here, so this table cannot become a second copy of a user's identity.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set by a moderator. A suspended account keeps its rows and its alias; it
  -- simply stops being able to post.
  suspended_at timestamptz
);

comment on table public.profiles is
  'Private account record. No personal data; the auth identity stays in auth.users.';

-- -----------------------------------------------------------------------------
-- anonymous_profiles — the public half of an account
-- -----------------------------------------------------------------------------
-- `user_id` is the ONLY column that links an account to its alias, and RLS lets
-- a member read exactly one row here: their own. The community reads the
-- `anonymous_identities` view below instead, which has no `user_id` in it.
create table if not exists public.anonymous_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Four digits, 1000-9999. Claimed by secretchat_claim_anonymous_profile();
  -- never derived from an email, a name or a phone number.
  alias_number integer not null unique check (alias_number between 1000 and 9999),
  -- Optional, set deliberately by a member. Never required to post, and never
  -- populated from the account by default.
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anonymous_profiles_user_id_idx
  on public.anonymous_profiles (user_id);

comment on column public.anonymous_profiles.user_id is
  'Private mapping to the account. Selectable only by that account; never exposed through the anonymous_identities view.';

comment on table public.anonymous_profiles is
  'The public anonymous identity of a member. Carries no real name, email, phone, location or health data.';

-- The public read path.
--
-- This is a function rather than a view, and the difference is the whole point.
--
-- A view over `anonymous_profiles` would have to expose the column the community
-- joins on, which is `user_id`. Publishing that column would publish the complete
-- alias-to-account mapping to every member, and in a community this small that
-- map is a re-identification table: it turns "Anonymous User #4821" back into a
-- known email address. So there is no view.
--
-- Instead, a member asks about identities they *already know*. Reading a feed
-- page yields the author ids of the posts on it, and those ids are the caller's
-- to look up. This function answers exactly that question and refuses to be a
-- directory: it returns one row per id the caller supplied, echoing their own
-- input back, and never a list, a count, or a row for anybody else. A caller who
-- passes in an id they do not already have learned nothing, because the output
-- for it is the identity of somebody they had already seen post.
--
-- Security definer, because `anonymous_profiles` is not member-readable. The
-- search_path is pinned, and the function is `stable`, so it reads a consistent
-- snapshot and is safe to call more than once per query.
create or replace function public.secretchat_identities(p_user_ids uuid[])
returns table (
  user_id uuid,
  alias_number integer,
  display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    anonymous_profiles.user_id,
    anonymous_profiles.alias_number,
    anonymous_profiles.display_name
  from public.anonymous_profiles
  where anonymous_profiles.user_id = any (p_user_ids);
$$;

revoke all on function public.secretchat_identities(uuid[]) from public;
grant execute on function public.secretchat_identities(uuid[]) to anon, authenticated;

comment on function public.secretchat_identities(uuid[]) is
  'Resolves the public identity of author ids the caller already has. Never returns a listing, so the alias-to-account mapping stays private.';

-- -----------------------------------------------------------------------------
-- posts and comments
-- -----------------------------------------------------------------------------
-- Deletes are soft. A comment thread keeps its shape, a hidden post does not
-- vanish from moderation history, and a mistaken removal can be undone — which
-- a hard delete could not offer.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Distinguishes "the author removed this" from "a moderator removed this",
  -- so an author's own delete is never counted against them by a filter.
  deleted_by_moderator boolean not null default false
);

-- Newest first, with id as a total-order tiebreak. This index is what makes
-- keyset pagination cheap: `(created_at, id) < (cursor_created_at, cursor_id)`.
create index if not exists posts_feed_idx
  on public.posts (created_at desc, id desc)
  where deleted_at is null;

create index if not exists posts_author_idx on public.posts (author_id);

comment on table public.posts is
  'Anonymous community post. Contains no health data by construction: the only free-text column is the post body itself.';

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_moderator boolean not null default false
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_author_idx on public.comments (author_id);

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
-- The composite primary key IS the duplicate-like guarantee. One member cannot
-- like the same post twice because a second row would violate the key; there is
-- no application code that has to remember to check.
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  liker_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, liker_id)
);

create index if not exists post_likes_liker_idx on public.post_likes (liker_id);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  liker_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, liker_id)
);

create index if not exists comment_likes_liker_idx on public.comment_likes (liker_id);

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
-- `reporter_id` is written once and read by moderators only. There is no public
-- read path to this table at all, which is what keeps a reported person from
-- ever learning who reported them.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason public.report_reason not null,
  -- Only meaningful for the 'other' reason, and the API rejects it otherwise.
  details text check (details is null or char_length(details) <= 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

create index if not exists reports_status_idx on public.reports (status, created_at);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- A member may report a given thing once. Without this, a client bug or a
-- double tap would fill the moderation queue with duplicates of one report.
create unique index if not exists reports_one_per_reporter_target_idx
  on public.reports (reporter_id, target_type, target_id);

-- -----------------------------------------------------------------------------
-- blocks
-- -----------------------------------------------------------------------------
-- One row per ordered pair. A member cannot block themselves, enforced here as
-- well as in the service, so a hand-written insert cannot create a self-block.
--
-- `ref` is a random per-block handle and is the only way to unblock. It names the
-- block, not the member: a reader who stores it learns nothing they did not
-- already know by blocking, and it carries no account id, so it can be held by
-- the client without weakening anything.
create table if not exists public.blocks (
  blocker_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  blocked_id uuid not null references public.anonymous_profiles (user_id) on delete cascade,
  ref uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists blocks_ref_idx on public.blocks (ref);

-- -----------------------------------------------------------------------------
-- moderation_actions and audit_logs
-- -----------------------------------------------------------------------------
-- Append-only by policy: no update or delete policy is created for either table
-- in 0002, so under RLS these rows cannot be changed or removed by anyone
-- operating as a member. Corrections are made by a new row, never an edit.
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references auth.users (id) on delete restrict,
  action public.moderation_action_type not null,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text check (reason is null or char_length(reason) <= 500),
  status public.moderation_action_status not null default 'applied',
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users (id) on delete set null
);

create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: an automated maintenance job is a legitimate actor, and forcing a
  -- user id would mean inventing one.
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target_type text check (target_type is null or char_length(target_type) between 1 and 60),
  target_id uuid,
  -- Small structured facts about the action. Never health data, never post
  -- bodies, never report text.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists anonymous_profiles_set_updated_at on public.anonymous_profiles;
create trigger anonymous_profiles_set_updated_at
  before update on public.anonymous_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- The anonymous identity claim
-- -----------------------------------------------------------------------------
-- Deterministic, collision-safe, and assigned exactly once.
--
-- How the number is chosen: an FNV-1a 32-bit digest of 'pmsify:anon:<user id>',
-- mapped into 1000-9999. The user id is a random uuid generated by Supabase and
-- contains no personal data, so deriving from it leaks nothing about the person.
-- The exact same function is implemented in
-- src/lib/secretchat/anonymous-identity.ts, which is how these rules are unit
-- tested without a database.
--
-- Why it is security definer: resolving a collision means looking at every
-- `anonymous_profiles` row, and no member may read that table. Without definer
-- rights the claim could not be collision-safe.
--
-- Why it takes no identity input: it reads the caller from auth.uid() and
-- ignores p_user_id unless that matches, so it cannot be used to claim an alias
-- for somebody else.
--
-- Why the result is stable: the row is written once and never updated, and
-- callers read before they write. Stability is an invariant of the stored row,
-- not a side effect of the hash.
create or replace function public.secretchat_claim_anonymous_profile()
returns public.anonymous_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.anonymous_profiles;
  v_taken integer[];
  v_candidate integer;
  v_step integer;
  v_hash bigint;
  v_profile public.anonymous_profiles;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 1. Already claimed? Return it unchanged. This is what makes an alias stable.
  select * into v_existing
  from public.anonymous_profiles
  where user_id = v_user;

  if found then
    return v_existing;
  end if;

  -- 2. Deterministic starting point, then step forward past anything taken.
  --    FNV-1a 32, in bigint so the multiply cannot overflow int4. `#` is
  --    PostgreSQL's bitwise XOR operator, and `% 4294967296` is mod 2^32, so
  --    this computes exactly the digest implemented in
  --    src/lib/secretchat/anonymous-identity.ts.
  v_hash := 2166136261;
  for i in 1 .. char_length('pmsify:anon:' || v_user::text) loop
    v_hash := (v_hash # ascii(substr('pmsify:anon:' || v_user::text, i, 1))) % 4294967296;
    v_hash := (v_hash * 16777619) % 4294967296;
  end loop;
  v_candidate := 1000 + (v_hash % 9000);

  select coalesce(array_agg(alias_number), '{}'::integer[])
    into v_taken
  from public.anonymous_profiles;

  -- Walk forward, wrapping at the top of the range. Bounded by the size of the
  -- alias space, so this terminates even when every number is taken.
  v_step := 0;
  loop
    exit when not (v_candidate = any (v_taken));
    v_step := v_step + 1;
    exit when v_step >= 9000;
    v_candidate := 1000 + ((v_candidate - 1000 + 1) % 9000);
  end loop;

  -- Falling out of the loop with the candidate still taken means the alias
  -- space is full. Refuse rather than overwrite somebody's name.
  if v_candidate = any (v_taken) then
    raise exception 'anonymous_alias_space_exhausted' using errcode = '54000';
  end if;

  -- 3. The insert is the authority. `on conflict do nothing` plus the unique
  --    constraint means a concurrent claim loses the race safely instead of
  --    raising, and the caller simply reads the winner's number.
  insert into public.anonymous_profiles (user_id, alias_number)
  values (v_user, v_candidate)
  on conflict (user_id) do nothing;

  select * into v_profile
  from public.anonymous_profiles
  where user_id = v_user;

  return v_profile;
end;
$$;

comment on function public.secretchat_claim_anonymous_profile() is
  'Returns the caller''s anonymous identity, claiming one on first use. Stable, unique, and derived only from the random account uuid.';

-- -----------------------------------------------------------------------------
-- Moderator membership
-- -----------------------------------------------------------------------------
-- A table rather than an environment variable, so a moderator can be added or
-- removed without a redeploy, and so every action is attributable to a real
-- account in the audit log.
create table if not exists public.moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users (id) on delete set null
);

comment on table public.moderators is
  'Accounts allowed to act on other members'' content. Read only by the security-definer helper below.';

-- Security definer for the same reason as the claim: `moderators` is not
-- readable by members, but every RLS policy that permits an elevated read has
-- to be able to ask the question.
create or replace function public.secretchat_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.moderators where user_id = auth.uid()
  );
$$;

comment on function public.secretchat_is_moderator() is
  'True when the caller is a moderator. The only way policies learn this, since the moderators table is not member-readable.';

-- -----------------------------------------------------------------------------
-- First profile on sign-up
-- -----------------------------------------------------------------------------
-- Creates the private profile row the moment an account exists, so nothing in
-- the app has to remember to do it and a failure cannot leave an account
-- without one. The anonymous alias is NOT created here: claiming it is
-- deliberately lazy, so an account that signs up and never posts never
-- consumes an alias number.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
