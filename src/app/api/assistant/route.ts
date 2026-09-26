import { NextResponse } from 'next/server';
import { handleAssistantRequest } from '@/lib/assistant/handler';

/**
 * The optional AI gateway endpoint.
 *
 * POST only, and deliberately a two-line adapter. The request contract, the
 * privacy allowlist and the gateway policy all live in `@/lib/assistant/handler`
 * so they can be unit-tested directly: Next.js rejects any export from a route
 * module other than the HTTP verbs and a fixed list of config fields.
 *
 * `GET` is not implemented, so the framework answers 405 automatically.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const { status, body } = await handleAssistantRequest(payload);
  return NextResponse.json(body, { status });
}
