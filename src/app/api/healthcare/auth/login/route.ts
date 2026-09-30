import { NextResponse } from 'next/server';
import { DEMO_CREDENTIALS, setHealthcareDemoSession } from '@/lib/healthcare/demo-session';

/**
 * POST /api/healthcare/auth/login
 *
 * Demo session sign-in. Two things are deliberate here:
 *
 *   - the answer is a **code**, not prose. A member signing in from `/kn/doctor/login`
 *     must be told in Kannada that the password was wrong, and the server does not
 *     know which language the reader chose. `healthcare.errors.invalid_credentials` is
 *     resolved by the interface, exactly as every other healthcare failure is.
 *   - `redirectUrl` is an app path, not a URL. It carries no locale on purpose: the
 *     endpoint is identical for `/en/…`, `/hi/…` and `/kn/…`, so the locale has to come
 *     from where the reader is standing. The page retargets it.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; password?: string };
    const id = body.id?.trim().toUpperCase();
    const password = body.password?.trim();

    if (!id || !password) {
      return NextResponse.json({ ok: false, code: 'invalid_credentials' }, { status: 400 });
    }

    if (id === DEMO_CREDENTIALS.ASHA.id && password === DEMO_CREDENTIALS.ASHA.password) {
      await setHealthcareDemoSession('ASHA');
      return NextResponse.json({
        ok: true,
        data: {
          role: 'ASHA',
          user: DEMO_CREDENTIALS.ASHA,
          redirectUrl: '/asha',
        },
      });
    }

    if (id === DEMO_CREDENTIALS.DOCTOR.id && password === DEMO_CREDENTIALS.DOCTOR.password) {
      await setHealthcareDemoSession('DOCTOR');
      return NextResponse.json({
        ok: true,
        data: {
          role: 'DOCTOR',
          user: DEMO_CREDENTIALS.DOCTOR,
          redirectUrl: '/doctor',
        },
      });
    }

    return NextResponse.json({ ok: false, code: 'invalid_credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 });
  }
}
