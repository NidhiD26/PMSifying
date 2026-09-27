import { createCase, listCases } from '@/lib/healthcare/service';
import { handleRequest, readCaseQuery } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/cases
 *
 * The caller's own cases: a worker sees the ones in their patch, a doctor the ones
 * assigned to them. An administrator gets an empty list rather than everything, because
 * the port deliberately has no list-all and a role that oversees should reach a case by
 * having been given it.
 *
 * POST /api/healthcare/cases
 *
 * The household and the member are in the body because there is no case yet to put in a
 * path; the ASHA, the initial status and the case number are not, because they are
 * server-side. `source` and `campId` must agree: a camp case names its camp, a
 * household case must not, or it could not be counted against the camp's work.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) =>
    listCases(store, { actor, query: readCaseQuery(request.url) })
  );
}

export async function POST(request: Request) {
  return handleRequest(request, async ({ store, actor, readBody }) =>
    createCase(store, { actor, input: await readBody() })
  );
}
