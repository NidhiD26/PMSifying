import { blockMember, listBlockedMembers, unblockMember } from '@/lib/secretchat/service';
import { handleRequest } from '@/lib/secretchat/route';

/**
 * /api/secretchat/blocks
 *
 * GET     the reader's own block list, as public identities plus opaque handles
 * POST    block the author of a post the reader can see
 * DELETE  unblock, by the handle the list returned
 *
 * The asymmetry between POST and DELETE is deliberate. Blocking needs to name a
 * member, and the one thing a reader can name is a post they have read, so the
 * server resolves the author from it. Unblocking needs to name a block, and the
 * opaque handle exists exactly for that.
 *
 * Note what is absent: there is no way to post an alias number and be told who it
 * belongs to. That endpoint would be an oracle, and nine thousand calls to it
 * would rebuild the alias-to-account map for the whole community.
 */
export async function GET(request: Request) {
  return handleRequest(request, (context) =>
    listBlockedMembers(context.store, { viewerId: context.userId })
  );
}

export async function POST(request: Request) {
  return handleRequest(request, async ({ store, userId, readBody }) =>
    blockMember(store, { viewerId: userId, input: await readBody() })
  );
}

export async function DELETE(request: Request) {
  return handleRequest(request, async ({ store, userId, readBody }) =>
    unblockMember(store, { viewerId: userId, input: await readBody() })
  );
}
