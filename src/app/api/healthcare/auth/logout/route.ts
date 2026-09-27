import { NextResponse } from 'next/server';
import { clearHealthcareDemoSession } from '@/lib/healthcare/demo-session';

export async function POST() {
  await clearHealthcareDemoSession();
  return NextResponse.json({ ok: true, data: { loggedOut: true } });
}
