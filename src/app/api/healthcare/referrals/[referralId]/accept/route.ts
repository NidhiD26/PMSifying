import { acceptReferral } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';
import { referralIdSchema } from '@/lib/healthcare/validation';
import { invalidRequest } from '@/lib/healthcare/errors';
import { DEMO_DOCTOR_USER_ID, persistDemoReferralAcceptance } from '@/lib/demo/healthcare-demo';

/**
 * POST /api/healthcare/referrals/[referralId]/accept
 *
 * The doctor named in the referral taking it on. This is the moment the case becomes
 * theirs: accepting assigns the doctor to the case, which is what every later
 * prescription, note and review is authorised against.
 *
 * It has no body, and that is deliberate. What somebody is accepting does not change
 * because the client sent a different body, and a write endpoint that ignores its body
 * is a write endpoint where somebody will eventually believe their body was read.
 */
export async function POST(request: Request, context: { params: Promise<{ referralId: string }> }) {
  const { referralId } = await context.params;
  const parsed = referralIdSchema.safeParse(referralId);

  return handleRequest(request, async ({ store, actor }) => {
    if (!parsed.success) throw invalidRequest(['referralId']);
    const referral = await acceptReferral(store, { actor, referralId: parsed.data });
    if (actor.userId === DEMO_DOCTOR_USER_ID) {
      await persistDemoReferralAcceptance(referral.id, referral.acceptedAt ?? new Date().toISOString());
    }
    return referral;
  });
}
