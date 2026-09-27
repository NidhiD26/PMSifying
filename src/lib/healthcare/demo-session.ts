import { cookies } from 'next/headers';
import { DEMO_ASHA_USER_ID, DEMO_DOCTOR_USER_ID } from '@/lib/demo/healthcare-demo';
import type { HealthcareRole } from '@/types/healthcare';

export const DEMO_HEALTHCARE_COOKIE = 'pmsify_demo_healthcare_session';

export interface DemoSession {
  role: 'ASHA' | 'DOCTOR';
  userId: string;
  loginId: string;
  name: string;
}

export const DEMO_CREDENTIALS = {
  ASHA: {
    id: 'ASHA1001',
    password: 'asha123',
    role: 'ASHA' as const,
    userId: DEMO_ASHA_USER_ID,
    name: 'Sunita Devi (ASHA Worker)',
  },
  DOCTOR: {
    id: 'DOC1001',
    password: 'doctor123',
    role: 'DOCTOR' as const,
    userId: DEMO_DOCTOR_USER_ID,
    name: 'Dr. Ananya Rao, MD',
  },
};

export async function getHealthcareDemoSession(): Promise<DemoSession | null> {
  try {
    const cookieStore = await cookies();
    const roleValue = cookieStore.get(DEMO_HEALTHCARE_COOKIE)?.value;
    if (roleValue === 'ASHA') {
      return {
        role: 'ASHA',
        userId: DEMO_CREDENTIALS.ASHA.userId,
        loginId: DEMO_CREDENTIALS.ASHA.id,
        name: DEMO_CREDENTIALS.ASHA.name,
      };
    }
    if (roleValue === 'DOCTOR') {
      return {
        role: 'DOCTOR',
        userId: DEMO_CREDENTIALS.DOCTOR.userId,
        loginId: DEMO_CREDENTIALS.DOCTOR.id,
        name: DEMO_CREDENTIALS.DOCTOR.name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setHealthcareDemoSession(role: 'ASHA' | 'DOCTOR'): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_HEALTHCARE_COOKIE, role, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearHealthcareDemoSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_HEALTHCARE_COOKIE);
}
