import { recommendCaseForCamp } from '@/lib/healthcare/service';
import { handleRequest, readParams } from '@/lib/healthcare/route';

export async function POST(request: Request, props: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await readParams(props.params);
  return handleRequest(request, async ({ store, actor, readBody }) => {
    const body = (await readBody()) as { campId?: string };
    return recommendCaseForCamp(store, { actor, caseId, campId: body.campId ?? '' });
  });
}
