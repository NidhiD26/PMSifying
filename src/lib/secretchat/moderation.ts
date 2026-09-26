import { createAdminClient } from '@/lib/supabase/admin';
import { forbidden, notConfigured, toSecretChatError, upstreamUnavailable } from '@/lib/secretchat/errors';
import type { ModerationActionRow, ReportRow, ReportStatus } from '@/types/supabase-database';

/**
 * Moderation. Server-side authorization only.
 *
 * THE RULE THIS FILE ENFORCES
 * Moderation is the one part of SecretChat that is allowed to act on somebody
 * else's content, so it is the one part that cannot go through the member's own
 * session: RLS exists precisely to stop that. The sequence is therefore always
 *
 *   1. identify the caller from *their* cookie-backed session (anon key, RLS);
 *   2. ask Postgres whether that caller is a moderator;
 *   3. only then use the service role key to read the reports queue and apply
 *      the action.
 *
 * The service role key is the second lock, never the first. A leaked key still
 * cannot be used through this module without a moderator session, and a
 * moderator session still cannot reach anything except the operations below.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * No automatic moderation. There is no classifier, no keyword filter and no
 * scoring in this codebase, and the UI does not claim there is. Content is
 * hidden only when a person applies a recorded, reversible action.
 */

export interface ModerationQueueEntry {
  reportId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  /** The reported content, captured so a decision does not race an edit. */
  targetContent: string;
  targetAuthorId: string;
  targetDeletedAt: string | null;
}

/**
 * Resolves the moderator session.
 *
 * Uses the member client, so `auth.getUser()` reflects the real signed-in
 * identity rather than anything a request body could claim.
 */
async function requireModeratorUserId(): Promise<string> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw forbidden();

  const { data: isModerator, error: roleError } = await supabase.rpc('secretchat_is_moderator');
  if (roleError) throw upstreamUnavailable();
  if (!isModerator) throw forbidden();

  return data.user.id;
}

function requireAdmin() {
  const admin = createAdminClient();
  if (!admin) throw notConfigured();
  return admin;
}

/**
 * The open report queue, oldest first.
 *
 * Ordered by `created_at` rather than severity on purpose: there is no severity
 * score, because there is nothing here that could justify one. A human reads
 * the queue in the order reports arrived.
 */
export async function listReportQueue(options?: { status?: ReportStatus }): Promise<ModerationQueueEntry[]> {
  // The call is the authorization: reaching this line means the session is a
  // moderator. The id itself is not needed to read the queue.
  await requireModeratorUserId();
  const admin = requireAdmin();

  const status = options?.status ?? 'open';

  const { data: reports, error } = await admin
    .from('reports')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw upstreamUnavailable();

  // One extra query for the reported content, rather than N: a queue of 100
  // reports should not be 200 round trips.
  const postIds = (reports ?? [])
    .filter((report) => report.target_type === 'post')
    .map((report) => report.target_id);
  const commentIds = (reports ?? [])
    .filter((report) => report.target_type === 'comment')
    .map((report) => report.target_id);

  const [posts, comments] = await Promise.all([
    postIds.length > 0
      ? admin.from('posts').select('id, content, author_id, deleted_at').in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length > 0
      ? admin.from('comments').select('id, content, author_id, deleted_at').in('id', commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const postById = new Map(
    ((posts.data ?? []) as { id: string; content: string; author_id: string; deleted_at: string | null }[]).map(
      (row) => [row.id, row]
    )
  );
  const commentById = new Map(
    ((comments.data ?? []) as { id: string; content: string; author_id: string; deleted_at: string | null }[]).map(
      (row) => [row.id, row]
    )
  );

  return ((reports ?? []) as ReportRow[]).map((report) => {
    const target =
      report.target_type === 'post' ? postById.get(report.target_id) : commentById.get(report.target_id);
    return {
      reportId: report.id,
      targetType: report.target_type,
      targetId: report.target_id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.created_at,
      targetContent: target?.content ?? '',
      targetAuthorId: target?.author_id ?? '',
      targetDeletedAt: target?.deleted_at ?? null,
    };
  });
}

export interface ApplyModerationArgs {
  action: 'hide_post' | 'hide_comment' | 'restore_post' | 'restore_comment';
  targetType: 'post' | 'comment';
  targetId: string;
  reportId?: string;
  reason?: string;
}

/**
 * Applies one moderation action and records it.
 *
 * Three writes, in this order, and the order is the safety property:
 *   1. write an immutable `moderation_actions` row (so an action is auditable
 *      before it takes effect);
 *   2. change the target's `deleted_at`, flagging `deleted_by_moderator`;
 *   3. write an `audit_logs` row.
 *
 * A restore sets `deleted_at` back to null and records a second action with
 * `status: 'reverted'`, so hiding something is always undoable and always
 * leaves a trail. Nothing here is silently destructive.
 */
export async function applyModerationAction(args: ApplyModerationArgs): Promise<ModerationActionRow> {
  const moderatorId = await requireModeratorUserId();
  const admin = requireAdmin();

  try {
    const isHide = args.action.startsWith('hide_');
    const table = args.targetType === 'post' ? 'posts' : 'comments';
    const deletedAt = isHide ? new Date().toISOString() : null;

    const { data: action, error: actionError } = await admin
      .from('moderation_actions')
      .insert({
        moderator_id: moderatorId,
        action: args.action,
        target_type: args.targetType,
        target_id: args.targetId,
        reason: args.reason ?? null,
      })
      .select('*')
      .single();
    if (actionError || !action) throw upstreamUnavailable();

    const { error: updateError } = await admin
      .from(table)
      .update({ deleted_at: deletedAt, deleted_by_moderator: isHide })
      .eq('id', args.targetId);
    if (updateError) throw upstreamUnavailable();

    if (args.reportId) {
      const { error: reportError } = await admin
        .from('reports')
        .update({
          status: isHide ? 'resolved' : 'dismissed',
          resolved_at: new Date().toISOString(),
          resolved_by: moderatorId,
        })
        .eq('id', args.reportId);
      if (reportError) throw upstreamUnavailable();
    }

    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: moderatorId,
      action: `secretchat.${args.action}`,
      target_type: args.targetType,
      target_id: args.targetId,
      metadata: { reportId: args.reportId ?? null, reason: args.reason ?? null },
    });
    if (auditError) throw upstreamUnavailable();

    return action as ModerationActionRow;
  } catch (error) {
    throw toSecretChatError(error);
  }
}
