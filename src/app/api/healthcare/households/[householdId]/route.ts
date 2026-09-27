import { getHouseholdDetail, updateHousehold } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { householdIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * GET /api/healthcare/households/[householdId]
 *
 * The household with its members. A household that is not the caller's returns
 * `not_found` rather than `forbidden`, so the answer does not confirm that the id names
 * a household somewhere.
 *
 * PATCH /api/healthcare/households/[householdId]
 *
 * Correcting a name or an address. Both are the kind of thing that is wrong on the day
 * it is written down — a house number, a spelling — and a register that can only be
 * appended to is a register that stays wrong.
 */
export async function GET(request: Request, context: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await context.params;
  const parsed = householdIdSchema.safeParse(householdId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['householdId']);
    return getHouseholdDetail(store, { actor, householdId: parsed.data });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await context.params;
  const parsed = householdIdSchema.safeParse(householdId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['householdId']);
    return updateHousehold(store, { actor, householdId: parsed.data, input: await readBody() });
  });
}
