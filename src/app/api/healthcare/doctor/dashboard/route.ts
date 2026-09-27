import { getDoctorDashboard } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/doctor/dashboard
 *
 * The clinician's side of the same morning: referrals addressed to them and not yet
 * taken, the cases they are actually reviewing, the follow-ups they owe, and the
 * referrals that came out of camps.
 *
 * Doctor-only. A worker or a member asking gets `forbidden` before any case is read,
 * which is a statement about their own role and reveals nothing about the queue.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) => getDoctorDashboard(store, { actor }));
}
