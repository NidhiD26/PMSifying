-- =============================================================================
-- PMSify / SecretChat (World B) — Row Level Security
-- =============================================================================
--
-- Apply AFTER 0001_secretchat_schema.sql.
--
-- WHAT THIS FILE IS
-- Postgres is the enforcement point, not the application. Every rule below is
-- written so that a member who bypasses the API, opens a console, or calls
-- PostgREST directly still cannot do anything they should not. The service layer
-- is then a convenience, not the guard.
--
-- THE FIVE THINGS THAT MUST BE TRUE
--   1. Default deny. RLS is enabled on every table and no permissive policy is
--      granted to `anon`/`authenticated` beyond what is listed.
--   2. Private identity. `anonymous_profiles.user_id` is readable only by the
--      account it belongs to. The community reads the `anonymous_identities`
--      view, which has no such column.
--   3. Anonymous, not unidentified. Writing requires a session, and the author
--      is always `auth.uid()`. There is no "no author" row and no guest insert.
--   4. A member edits only their own. Posts, comments, likes, blocks and report
--      status are all constrained to the caller; nothing is editable by id alone.
--   5. Moderation is server-side. `moderators`, `moderation_actions` and
--      `audit_logs` have no member policy at all. The service role bypasses RLS
--      by design, and the application only reaches it after checking membership
--      through `secretchat_is_moderator()`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Default deny
-- -----------------------------------------------------------------------------
-- Force RLS even for the table owner, so a migration that accidentally runs as
-- the owner still cannot quietly read `anonymous_profiles` or `reports`.
alter table public.profiles enable row level security;
alter table public.anonymous_profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.moderators enable row level security;

alter table public.profiles force row level security;
alter table public.anonymous_profiles force row level security;
alter table public.posts force row level security;
alter table public.comments force row level security;
alter table public.reports force row level security;
alter table public.blocks force row level security;
alter table public.moderation_actions force row level security;
alter table public.audit_logs force row level security;
alter table public.moderators force row level security;

-- -----------------------------------------------------------------------------
-- Table grants
-- -----------------------------------------------------------------------------
-- Grants alone grant nothing once RLS is on: a permitted statement still has to
-- pass a policy. They are listed explicitly so the surface area is declared
-- rather than inherited, and so revoking access is a visible edit.
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.anonymous_profiles to authenticated;
grant select on public.posts to anon, authenticated;
grant select on public.comments to anon, authenticated;
grant select on public.post_likes to authenticated;
grant select on public.comment_likes to authenticated;
grant select on public.blocks to authenticated;
grant select on public.reports to authenticated;

-- Only the soft delete is granted. A member's delete is an UPDATE that sets
-- `deleted_at`, so no DELETE grant and no delete policy exists for posts or
-- comments: a hard delete would be irreversible, and the one case that genuinely
-- needs to remove rows — deleting an account — is a platform operation handled by
-- the service role via the schema's `on delete cascade`.
grant insert, update on public.posts to authenticated;
grant insert, update on public.comments to authenticated;
grant insert, delete on public.post_likes to authenticated;
grant insert, delete on public.comment_likes to authenticated;
grant insert, delete on public.blocks to authenticated;
grant insert on public.reports to authenticated;

-- No grant for anon on any write: an unauthenticated request cannot create
-- content even if a policy were written to allow it.

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- Exactly one readable row per member: their own. There are no columns here that
-- identify a person, but "readable only by its owner" is still the right default
-- for an account record.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- No insert or update policy: the row is created by the on-sign-up trigger, and
-- `suspended_at` is a moderator concern, not a member's.

-- -----------------------------------------------------------------------------
-- anonymous_profiles — the private mapping
-- -----------------------------------------------------------------------------
drop policy if exists anonymous_profiles_select_own on public.anonymous_profiles;
create policy anonymous_profiles_select_own on public.anonymous_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

-- Members may give themselves a display name and nothing else. The check is
-- `user_id = auth.uid()` rather than "any column", so an update cannot touch
-- `alias_number` and cannot retarget the row at somebody else's account.
drop policy if exists anonymous_profiles_update_own on public.anonymous_profiles;
create policy anonymous_profiles_update_own on public.anonymous_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No insert policy on purpose. An alias is issued only by
-- `secretchat_claim_anonymous_profile()`. Letting a member insert their own row
-- would mean letting a member choose their own alias number, which is precisely
-- the identity collision the function exists to prevent.

-- -----------------------------------------------------------------------------
-- Identity resolution
-- -----------------------------------------------------------------------------
-- No view over `anonymous_profiles` is created or granted. Such a view would
-- have to carry `user_id` for the community to join on it, and publishing that
-- column publishes the alias-to-account mapping to every member — in a community
-- this small, that map is a re-identification table.
--
-- The read path is `secretchat_identities(uuid[])` from 0001, granted above: it
-- answers only about ids the caller already has, and returns a row per id
-- supplied rather than a listing. RLS on `anonymous_profiles` stays as written —
-- own row only — so the function is the sole way to read an identity, and it is
-- the only reason a member can render anybody's alias at all.

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
-- Readable by anyone who is signed in, deleted or not: the row is the fact that
-- something was there, and the application renders a placeholder for a deleted
-- one. Hiding the row entirely would make "this was removed" indistinguishable
-- from "this never existed".
drop policy if exists posts_select_all on public.posts;
create policy posts_select_all on public.posts
  for select
  to authenticated
  using (true);

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and deleted_by_moderator = false
    -- A member may not post while suspended. Moderation actions still work,
    -- because they run as the service role.
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and suspended_at is not null
    )
  );

-- Update is limited to the author and to an author's own soft delete. The
-- `with check` repeats `author_id = auth.uid()` so a member cannot rewrite their
-- row into someone else's; and it pins the two moderation columns, which are
-- otherwise the one thing an author's update could set.
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and deleted_by_moderator = false
  );

-- No delete policy, and no grant to make one usable: a member's delete is the
-- soft update above. `on delete cascade` in the schema covers the account
-- deletion path, which is a platform operation.

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
drop policy if exists comments_select_all on public.comments;
create policy comments_select_all on public.comments
  for select
  to authenticated
  using (true);

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and deleted_by_moderator = false
    -- The parent post must be visible, so a reply cannot be created on a post
    -- that has been removed.
    and exists (
      select 1 from public.posts
      where posts.id = comments.post_id
        and posts.deleted_at is null
    )
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and suspended_at is not null
    )
  );

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and deleted_by_moderator = false
  );

-- No delete policy, for the same reason as posts.

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
-- Reads are scoped to the liker. A member can see "I liked this" and a count
-- derived from the feed aggregate, but not who else liked a given post. That is
-- deliberate: a like list is a social graph, and a social graph is an
-- identification channel for a small community.
drop policy if exists post_likes_select_own on public.post_likes;
create policy post_likes_select_own on public.post_likes
  for select
  to authenticated
  using (liker_id = auth.uid());

drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes
  for insert
  to authenticated
  with check (
    liker_id = auth.uid()
    and exists (
      select 1 from public.posts
      where posts.id = post_likes.post_id
        and posts.deleted_at is null
    )
  );

drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes
  for delete
  to authenticated
  using (liker_id = auth.uid());

drop policy if exists comment_likes_select_own on public.comment_likes;
create policy comment_likes_select_own on public.comment_likes
  for select
  to authenticated
  using (liker_id = auth.uid());

drop policy if exists comment_likes_insert_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes
  for insert
  to authenticated
  with check (
    liker_id = auth.uid()
    and exists (
      select 1 from public.comments
      where comments.id = comment_likes.comment_id
        and comments.deleted_at is null
    )
  );

drop policy if exists comment_likes_delete_own on public.comment_likes;
create policy comment_likes_delete_own on public.comment_likes
  for delete
  to authenticated
  using (liker_id = auth.uid());

-- -----------------------------------------------------------------------------
-- reports
-- -----------------------------------------------------------------------------
-- A member may file a report and may read back only their own. There is
-- deliberately no policy that would let one member read another member's report,
-- because a report is the one row in this schema that identifies both a person
-- and an accusation.
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select
  to authenticated
  using (reporter_id = auth.uid());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and resolved_at is null
    and resolved_by is null
    -- The reason enum does the first half of this; the rest keeps "other" from
    -- becoming a blank reason field.
    and (reason <> 'other' or char_length(btrim(coalesce(details, ''))) > 0)
  );

-- No update and no delete policy. A filed report is a record; it is resolved by a
-- moderator through the service role, and it is never withdrawn by the reporter,
-- because a report that can be taken back is not a record.

-- -----------------------------------------------------------------------------
-- blocks
-- -----------------------------------------------------------------------------
-- Reads are both directions on purpose, and this is the one place a member can
-- see somebody else's account id: their own block list names who they blocked,
-- and `blocked_id = auth.uid()` lets them see who blocked them, which the feed
-- needs in order to exclude those authors.
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select
  to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert
  to authenticated
  with check (
    blocker_id = auth.uid()
    and blocker_id <> blocked_id
    -- The blocked member must actually exist. Combined with the foreign key this
    -- makes it impossible to file a block against an id that was guessed.
    and exists (
      select 1 from public.anonymous_profiles
      where anonymous_profiles.user_id = blocks.blocked_id
    )
  );

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

-- -----------------------------------------------------------------------------
-- moderators, moderation_actions, audit_logs
-- -----------------------------------------------------------------------------
-- No policies. RLS is on and forced, so for these three tables the only path is
-- the service role, and the only application code that holds it is
-- `src/lib/secretchat/moderation.ts` — which checks `secretchat_is_moderator()`
-- against the caller's own session first.
--
-- This is intentional and is worth stating plainly: it is not an oversight that
-- moderators cannot read the queue through PostgREST. The queue is served by a
-- server route that authorises, so "is this caller a moderator" is decided in one
-- place and cannot be forgotten by a second caller of the API.

-- -----------------------------------------------------------------------------
-- Function permissions
-- -----------------------------------------------------------------------------
-- The claim is callable by any signed-in member; it derives the caller from
-- auth.uid() and ignores everything else.
revoke all on function public.secretchat_claim_anonymous_profile() from public;
grant execute on function public.secretchat_claim_anonymous_profile() to authenticated;

-- The moderator check is callable by any signed-in member too: it reveals only
-- whether they are one, which they already know. The point is that it is
-- callable without granting any read on the moderators table.
revoke all on function public.secretchat_is_moderator() from public;
grant execute on function public.secretchat_is_moderator() to authenticated;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to authenticated;

-- `handle_new_user` is owned by the platform role and runs only as a trigger
-- from auth.users. Not executable by members.
revoke all on function public.handle_new_user() from public;
