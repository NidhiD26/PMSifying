import { createPrescription } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { caseIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';

/**
 * POST /api/healthcare/cases/[caseId]/prescriptions
 *
 * Medicine, and the single most tightly held operation in the feature.
 *
 * `requireDoctor` runs before the case is even fetched, so a member, a worker or an
 * administrator is refused with `forbidden` — a statement about their own role, which
 * reveals nothing about the case. Only then does the case matter, and only for the
 * doctor it is assigned to.
 *
 * The medicine name is deliberately not audited. `audit_logs` is read by more people
 * than the record and is exported for review, so a prescription written into it would
 * be a second, weaker copy of somebody's treatment.
 */
export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const parsed = caseIdSchema.safeParse(caseId);

  return handleRequest(request, async ({ store, actor, readBody }) => {
    if (!parsed.success) throw invalidRequest(['caseId']);
    return createPrescription(store, { actor, caseId: parsed.data, input: await readBody() });
  });
}
