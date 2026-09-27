import { updateMember } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { memberIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * PATCH /api/healthcare/members/[memberId]
 *
 * A member of the caller's own household, and a worker only. A doctor may read the
 * register entry for a person on their case but may not edit the register: the register
 * is the worker's record of the household, and a clinician correcting somebody's age or
 * their relation to the head of the house would be editing a record they were given
 * read access to for one appointment.
 */
export async function PATCH(request: Request, context: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await context.params;
  const parsed = memberIdSchema.safeParse(memberId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['memberId']);
    return updateMember(store, { actor, memberId: parsed.data, input: await readBody() });
  });
}
