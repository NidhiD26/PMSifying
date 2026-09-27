import { createMember, listMembers } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { householdIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * GET /api/healthcare/households/[householdId]/members
 *
 * The register, and the answer is deliberately not the same shape for everybody. A
 * worker sees the whole household; a doctor sees only the members on cases of their
 * own, because the unit of access there is the person rather than the address. A
 * household of six with one referred member is not six records a doctor may read.
 *
 * POST /api/healthcare/households/[householdId]/members
 *
 * The household is in the path and the worker is the session, so a body cannot name a
 * different one.
 */
export async function GET(request: Request, context: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await context.params;
  const parsed = householdIdSchema.safeParse(householdId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['householdId']);
    return listMembers(store, { actor, householdId: parsed.data });
  });
}

export async function POST(request: Request, context: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await context.params;
  const parsed = householdIdSchema.safeParse(householdId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['householdId']);
    return createMember(store, { actor, householdId: parsed.data, input: await readBody() });
  });
}
