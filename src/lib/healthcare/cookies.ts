/**
 * The name of the healthcare session cookie, on its own.
 *
 * WHY IT IS NOT DECLARED IN `demo-session.ts`
 * That module reads and writes cookies through `next/headers`, which is a server-only
 * API. `middleware.ts` runs on the edge runtime and needs to know the same name in
 * order to answer "is anybody signed in to the healthcare portal?" before a page renders,
 * and importing a `next/headers` module there would drag a server-only binding into a
 * bundle that cannot have one. A constant is the whole shared contract, so it lives
 * where both can reach it and `demo-session` re-exports it so existing importers do not
 * have to change.
 *
 * NOTHING TRUSTS THIS VALUE
 * The cookie says which demo *login* happened, not what a caller may read. It is read
 * here only to decide whether a signed-out visitor should be sent to a sign-in page; the
 * role that authorises anything is re-resolved from the store on the server by
 * `resolveHealthcareActor`, and a wrong or forged value gets a gate, not a queue.
 */
export const DEMO_HEALTHCARE_COOKIE = 'pmsify_demo_healthcare_session';

/** The two values a real demo session cookie can hold. */
export const DEMO_HEALTHCARE_ROLES = ['ASHA', 'DOCTOR'] as const;

export type DemoHealthcareRole = (typeof DEMO_HEALTHCARE_ROLES)[number];

export function isDemoHealthcareRole(value: string | undefined): value is DemoHealthcareRole {
  return !!value && (DEMO_HEALTHCARE_ROLES as readonly string[]).includes(value);
}
