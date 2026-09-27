import { listDoctors } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/doctors
 *
 * The roster a worker picks a referral destination from. A referral addressed to a
 * misspelt id is the quietest failure in this feature — the row is written, the case
 * says referred, and no queue ever shows it — so the destination is picked from a real
 * list rather than typed.
 *
 * Staff only, and it returns the name and speciality rather than a person: a referral
 * queue needs to say *which* doctor, and nothing else about a clinician's account is
 * anybody else's business.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) => listDoctors(store, { actor }));
}
