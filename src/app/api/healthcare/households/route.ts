import { createHousehold, listHouseholds } from '@/lib/healthcare/service';
import { handleRequest } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/households
 *
 * The caller's own patch, and only for a worker: `listHouseholds` returns an empty list
 * for an administrator rather than everything, because an administrator oversees and a
 * list of every household in the programme is not oversight — it is a register of where
 * people live. An administrator reaches households through a case instead.
 *
 * POST /api/healthcare/households
 *
 * The ASHA is the session, and the household is created already assigned to them. There
 * is no `assignedAshaId` in the body: a body carrying one is refused by `.strict()`
 * rather than ignored, so a client cannot file a household under somebody else's patch
 * and then find it invisible.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) => listHouseholds(store, { actor }));
}

export async function POST(request: Request) {
  return handleRequest(request, async ({ store, actor, readBody }) =>
    createHousehold(store, { actor, input: await readBody() })
  );
}
