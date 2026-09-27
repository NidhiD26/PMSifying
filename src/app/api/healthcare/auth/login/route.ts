import { NextResponse } from 'next/server';
import { DEMO_CREDENTIALS, setHealthcareDemoSession } from '@/lib/healthcare/demo-session';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; password?: string };
    const id = body.id?.trim().toUpperCase();
    const password = body.password?.trim();

    if (!id || !password) {
      return NextResponse.json(
        { ok: false, code: 'invalid_credentials', message: 'ID and Password are required.' },
        { status: 400 }
      );
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

    return NextResponse.json(
      { ok: false, code: 'invalid_credentials', message: 'Invalid Healthcare ID or Password.' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid_request', message: 'Malformed login request.' },
      { status: 400 }
    );
  }
}
