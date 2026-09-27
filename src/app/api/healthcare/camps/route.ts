import { createCamp, listCamps } from '@/lib/healthcare/service';
import { handleRequest, readCampQuery } from '@/lib/healthcare/route';

/**
 * GET /api/healthcare/camps
 *
 * The public list of camps, with the caller's own registration folded into each entry.
 * `isRegisteredByViewer` and `isFull` are on the camp rather than fetched afterwards,
 * so a list of camps cannot be rendered in a state the database would have refused.
 *
 * POST /api/healthcare/camps
 *
 * Staff only, and a new camp starts as a `DRAFT`. It is not visible to anybody until
 * somebody publishes it: a camp with the wrong date or the wrong hall is worse than no
 * camp, and the person who typed it is the one who can see it is wrong.
 */
export async function GET(request: Request) {
  return handleRequest(request, async ({ store, actor }) =>
    listCamps(store, { actor, query: readCampQuery(request.url) })
  );
}

export async function POST(request: Request) {
  return handleRequest(request, async ({ store, actor, readBody }) =>
    createCamp(store, { actor, input: await readBody() })
  );
}
