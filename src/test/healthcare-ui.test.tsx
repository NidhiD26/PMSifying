import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import en from '../../public/locales/en.json';
import {
  ASHA_HEALTHCARE_NAV,
  DOCTOR_HEALTHCARE_NAV,
  USER_HEALTHCARE_NAV,
  healthcareNavForRole,
} from '@/lib/navigation/nav-config';
import { HealthcareListViewFixtures } from './healthcare-ui-fixtures';
import { HouseholdListView, HouseholdDetailView } from '@/features/healthcare/household-views';
import { CaseReviewView } from '@/features/healthcare/case-views';
import { ReferralListView, FollowUpListView } from '@/features/healthcare/queue-views';
import { CampListView, CampDetailView } from '@/features/healthcare/camp-views';
import { StatusBadge } from '@/features/healthcare/status-badge';
import { PortalGate } from '@/features/healthcare/portal-gate';
import type {
  CampRosterEntryDto,
  FollowUpDto,
  HealthCampDto,
  HouseholdDetailDto,
  HouseholdSummaryDto,
  ReferralDto,
} from '@/types/healthcare';

/**
 * The healthcare screens, rendered.
 *
 * The service tests prove what a reader may have. These prove what a reader is then
 * *shown*, which is a different question and the one a privacy bug usually lives on: a
 * DTO that is too wide is caught by the privacy suite, and a DTO that is correct but
 * rendered badly is caught here.
 *
 * THE MESSAGES ARE THE REAL ONES
 * `next-intl` is mocked with a resolver that reads `public/locales/en.json` rather than
 * a hand-written copy. That is deliberate. A hand-written copy is a second set of
 * strings, and a component can be tested green against keys the application does not
 * have — which is exactly the bug this file was written after, where two plural
 * messages were installed as i18next-style `members_one` / `members_other` pairs and
 * `t('households.members', {count})` would have thrown on a real page while every test
 * passed. Reading the shipped file means a key that does not exist fails here.
 */

const refresh = vi.fn();
const callApi = vi.fn().mockResolvedValue(undefined);

vi.mock('../features/healthcare/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/healthcare/api-client')>()),
  callHealthcareApi: (...args: unknown[]) => callApi(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en',
}));

/** Resolves `a.b.c`, interpolates `{name}` and understands one ICU plural. */
function resolve(key: string, params?: Record<string, unknown>): string {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') return key;

  const plural = /\{(\w+),\s*plural,\s*one\s*\{([\s\S]*?)\}\s*other\s*\{([\s\S]*?)\}\}/.exec(node);
  const chosen = plural
    ? Number(params?.[plural[1]]) === 1
      ? plural[2]
      : plural[3]
    : node;

  return chosen.replace(/\{(\w+)\}/g, (match, name: string) =>
    params && name in params ? String(params[name]) : match
  );
}

vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) =>
    (key: string, params?: Record<string, unknown>): string =>
      resolve(`${namespace}.${key}`, params),
}));

const { household, otherMember, detail, review, referral, followUp, camp } =
  HealthcareListViewFixtures;

/** The id a household link is built from, and the one the route would receive. */
const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  refresh.mockClear();
  callApi.mockClear();
  callApi.mockResolvedValue(undefined);
});

describe('household register', () => {
  it('counts members with a real plural, not an i18next key', () => {
    const one: HouseholdSummaryDto = { ...household, memberCount: 1 };
    const two: HouseholdSummaryDto = { ...household, memberCount: 2 };

    const { unmount } = render(
      <HouseholdListView households={[one]} locale="en" basePath="/asha/households" casesPath="/asha/cases" />
    );
    expect(screen.getByText('1 member')).toBeInTheDocument();
    unmount();

    render(
      <HouseholdListView households={[two]} locale="en" basePath="/asha/households" casesPath="/asha/cases" />
    );
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('keeps the locale on the link into a record', () => {
    render(
      <HouseholdListView
        households={[household]}
        locale="kn"
        basePath="/asha/households"
        casesPath="/asha/cases"
      />
    );
    expect(screen.getByRole('link', { name: 'Gowda household' })).toHaveAttribute(
      'href',
      `/kn/asha/households/${HOUSEHOLD_ID}`
    );
  });

  it('offers the create form on the register, not behind a link', () => {
    render(
      <HouseholdListView
        households={[]}
        locale="en"
        basePath="/asha/households"
        casesPath="/asha/cases"
      />
    );
    expect(screen.getByText('Add a household')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows every member of a household the worker owns', () => {
    const withBoth: HouseholdDetailDto = { ...detail, members: [...detail.members, otherMember] };
    render(
      <HouseholdDetailView
        detail={withBoth}
        locale="en"
        basePath="/asha/households"
        casesPath="/asha/cases"
      />
    );

    expect(screen.getByText('Lakshmi Gowda')).toBeInTheDocument();
    expect(screen.getByText('Ravi Gowda')).toBeInTheDocument();
    expect(screen.getByText('Add a household member')).toBeInTheDocument();
  });
});

describe('case review', () => {
  it('shows a clinician the patient and not the rest of the household', () => {
    render(<CaseReviewView review={review} locale="en" role="DOCTOR" backPath="/doctor/cases" />);

    expect(screen.getByText('Lakshmi Gowda')).toBeInTheDocument();
    // The other member is in the same household and must not be reachable from here,
    // not by a link and not by a name in the markup.
    expect(screen.queryByText('Ravi Gowda')).not.toBeInTheDocument();
  });

  it('offers the clinician the clinical writes and not the worker’s observation', () => {
    render(<CaseReviewView review={review} locale="en" role="DOCTOR" backPath="/doctor/cases" />);

    expect(screen.getByText('Write a clinical note')).toBeInTheDocument();
    expect(screen.getByText('Write a prescription')).toBeInTheDocument();
    expect(screen.getByText('Schedule a follow-up')).toBeInTheDocument();
    expect(screen.queryByText('Record an observation')).not.toBeInTheDocument();
  });

  it('offers the worker the observation and none of the clinical writes', () => {
    render(<CaseReviewView review={review} locale="en" role="ASHA" backPath="/asha/cases" />);

    expect(screen.getByText('Record an observation')).toBeInTheDocument();
    expect(screen.queryByText('Write a clinical note')).not.toBeInTheDocument();
    expect(screen.queryByText('Write a prescription')).not.toBeInTheDocument();
  });

  it('labels a machine state in words rather than in capitals', () => {
    render(<CaseReviewView review={review} locale="en" role="DOCTOR" backPath="/doctor/cases" />);
    // UNDER_REVIEW is what the database stores. What a clinician reads is "Under review".
    expect(screen.queryByText('UNDER_REVIEW')).not.toBeInTheDocument();
  });
});

describe('referral queue', () => {
  const one = (patch: Partial<ReferralDto>): ReferralDto => ({ ...referral, ...patch });

  it('offers a clinician the transition its state allows, and nothing else', () => {
    render(<ReferralListView referrals={[one({ status: 'PENDING' })]} role="DOCTOR" />);
    expect(screen.getByRole('button', { name: 'Accept referral' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel referral' })).not.toBeInTheDocument();
  });

  it('moves the control along with the state', () => {
    render(<ReferralListView referrals={[one({ status: 'ACCEPTED' })]} role="DOCTOR" />);
    expect(screen.getByRole('button', { name: 'Start review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept referral' })).not.toBeInTheDocument();
  });

  it('never offers a clinician the withdrawal, which is the worker’s to make', () => {
    render(<ReferralListView referrals={[one({ status: 'IN_REVIEW' })]} role="DOCTOR" />);
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel referral' })).not.toBeInTheDocument();
  });

  it('offers the worker the withdrawal, including one under review', () => {
    render(<ReferralListView referrals={[one({ status: 'IN_REVIEW' })]} role="ASHA" />);
    expect(screen.getByRole('button', { name: 'Cancel referral' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept referral' })).not.toBeInTheDocument();
  });

  it('stops offering the withdrawal once it has been made', () => {
    render(<ReferralListView referrals={[one({ status: 'CANCELLED' })]} role="ASHA" />);
    expect(screen.queryByRole('button', { name: 'Cancel referral' })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Gap 1 — the referral form is reachable and complete                *
 * ------------------------------------------------------------------ */

describe('the referral form on a worker’s case', () => {
  const doctorOptions = [
    { value: '44444444-4444-4444-8444-444444444444', label: 'Doctor One · MBBS-1 · General' },
    { value: '77777777-7777-4777-8777-777777777777', label: 'Doctor Two · MBBS-2 · Paediatrics' },
  ];

  it('offers a worker the doctor picker the roster made possible', () => {
    render(
      <CaseReviewView
        review={review}
        locale="en"
        role="ASHA"
        backPath="/asha/cases"
        doctorOptions={doctorOptions}
      />
    );

    expect(screen.getByText('Refer to a doctor')).toBeInTheDocument();
    const picker = screen.getByLabelText(/^Referred to/);
    expect(picker).toBeInTheDocument();
    // The options are the server's, and the value is the id the write needs.
    expect(within(picker as HTMLSelectElement).getByRole('option', { name: doctorOptions[1].label })).toHaveAttribute(
      'value',
      doctorOptions[1].value
    );
  });

  it('shows the two fields the write requires, so the worker is not left guessing', () => {
    render(
      <CaseReviewView
        review={review}
        locale="en"
        role="ASHA"
        backPath="/asha/cases"
        doctorOptions={doctorOptions}
      />
    );

    // The required marker is an `aria-hidden` asterisk appended inside the `<label>`, so
    // a substring match is the honest way to ask for these two by name.
    const picker = screen.getByLabelText(/^Referred to/);
    const reason = screen.getByLabelText(/^Reason/);
    expect(picker).toBeRequired();
    expect(reason).toBeRequired();

    // Scoped to the referral form, because a worker's case also carries the observation
    // form and both submit with the same label.
    const form = picker.closest('form');
    expect(form).not.toBeNull();
    expect(within(form as HTMLFormElement).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('says so when there is no doctor to refer to, rather than offering an empty picker', () => {
    render(
      <CaseReviewView
        review={review}
        locale="en"
        role="ASHA"
        backPath="/asha/cases"
        doctorOptions={[]}
      />
    );

    expect(screen.getByText('No doctors on the roster')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Referred to/)).not.toBeInTheDocument();
  });

  it('never offers the referral form to a clinician, who receives referrals', () => {
    render(
      <CaseReviewView
        review={review}
        locale="en"
        role="DOCTOR"
        backPath="/doctor/cases"
        doctorOptions={doctorOptions}
      />
    );

    expect(screen.queryByText('Refer to a doctor')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Gap 2 — the camp controls follow the server's capability           *
 * ------------------------------------------------------------------ */

describe('camp management controls follow canManage', () => {
  it('draws the status moves for a camp the viewer may manage', () => {
    render(
      <CampDetailView
        camp={{ ...camp, status: 'DRAFT', canManage: true }}
        locale="en"
        canChangeStatus
        canMarkAttendance
      />
    );

    expect(screen.getByRole('button', { name: 'Publish camp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel camp' })).toBeInTheDocument();
  });

  it('draws none of them for a camp the viewer may not manage', () => {
    // The page passes `canManage` straight through, so a non-manager sees a camp they
    // can read with no controls on it at all.
    render(
      <CampDetailView
        camp={{ ...camp, status: 'DRAFT', canManage: false }}
        locale="en"
        canChangeStatus={false}
        canMarkAttendance={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Publish camp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel camp' })).not.toBeInTheDocument();
    // The camp is still readable — hiding controls is not hiding the camp.
    expect(screen.getByText('Village health camp')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Gap 3 — the roster the attendance is written against              *
 * ------------------------------------------------------------------ */

describe('the camp roster', () => {
  const entry = (patch: Partial<CampRosterEntryDto>): CampRosterEntryDto => ({
    registrationId: 'reg-1',
    userId: '11111111-1111-4111-8111-111111111111',
    registeredAt: '2030-01-02T09:00:00.000Z',
    attendanceStatus: 'REGISTERED',
    markedAt: null,
    ...patch,
  });

  it('marks an unregistered row, addressed to that row’s registration', async () => {
    render(
      <CampDetailView
        camp={camp}
        locale="en"
        roster={[entry({})]}
        canMarkAttendance
        canChangeStatus={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark attended' }));

    // The attendance write is addressed by camp *and* registration. The registration id
    // is what the roster read just made available, and the service re-checks that the
    // two belong together — so a path built from either one alone would be a bug this
    // assertion is here to catch.
    await waitFor(() =>
      expect(callApi).toHaveBeenCalledWith(
        `/camps/${camp.id}/registrations/reg-1/attendance`,
        expect.objectContaining({ method: 'POST', body: { status: 'ATTENDED' } })
      )
    );
  });

  it('marks somebody absent without touching anybody else’s row', async () => {
    render(
      <CampDetailView
        camp={camp}
        locale="en"
        roster={[
          entry({ registrationId: 'reg-1', userId: 'user-1' }),
          entry({ registrationId: 'reg-2', userId: 'user-2', attendanceStatus: 'ATTENDED' }),
        ]}
        canMarkAttendance
        canChangeStatus={false}
      />
    );

    // Two identical-looking buttons; the second row is the one that must be addressed.
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark absent' })[1]);

    await waitFor(() =>
      expect(callApi).toHaveBeenCalledWith(
        `/camps/${camp.id}/registrations/reg-2/attendance`,
        expect.objectContaining({ body: { status: 'ABSENT' } })
      )
    );
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it('shows what attendance already says', () => {
    const { unmount } = render(
      <CampDetailView
        camp={camp}
        locale="en"
        roster={[entry({ attendanceStatus: 'ATTENDED' })]}
        canMarkAttendance={false}
        canChangeStatus={false}
      />
    );
    expect(screen.getByText('Attended')).toBeInTheDocument();
    unmount();

    render(
      <CampDetailView
        camp={camp}
        locale="en"
        roster={[entry({ attendanceStatus: 'ABSENT' })]}
        canMarkAttendance={false}
        canChangeStatus={false}
      />
    );
    expect(screen.getByText('Absent')).toBeInTheDocument();
  });

  it('says the camp has nobody on it yet, rather than showing an empty table', () => {
    render(<CampDetailView camp={camp} locale="en" roster={[]} canMarkAttendance canChangeStatus={false} />);
    expect(screen.getByText('Nobody registered yet')).toBeInTheDocument();
  });

  it('offers no attendance buttons to somebody who may not mark them', () => {
    render(
      <CampDetailView
        camp={{ ...camp, canManage: false }}
        locale="en"
        roster={[entry({})]}
        canMarkAttendance={false}
        canChangeStatus={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Mark attended' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark absent' })).not.toBeInTheDocument();
  });

  it('shows no roster section at all when the page was not given one', () => {
    // A reader who may not manage the camp gets the camp and not the roster: the page
    // never fetched it, so there is nothing to render.
    render(<CampDetailView camp={{ ...camp, canManage: false }} locale="en" canChangeStatus={false} />);
    expect(screen.queryByText('Nobody registered yet')).not.toBeInTheDocument();
  });
});

describe('follow-up queue', () => {
  it('names the assigned role instead of printing the enum', () => {
    render(<FollowUpListView followUps={[{ ...followUp, assignedRole: 'ASHA' }]} />);
    expect(screen.getByText('Community health worker')).toBeInTheDocument();
    expect(screen.queryByText('ASHA')).not.toBeInTheDocument();
  });

  it('settles a pending visit and leaves a settled one alone', () => {
    const { unmount } = render(<FollowUpListView followUps={[followUp]} />);
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark missed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel follow-up' })).toBeInTheDocument();
    unmount();

    render(<FollowUpListView followUps={[{ ...followUp, status: 'COMPLETED' }]} />);
    expect(screen.queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark missed' })).not.toBeInTheDocument();
  });

  it('shows an unrecognised role as unknown rather than as an acronym', () => {
    const odd = { ...followUp, assignedRole: 'NOT_A_ROLE' as never };
    render(<FollowUpListView followUps={[odd as FollowUpDto]} />);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });
});

describe('health camps', () => {
  const published: HealthCampDto = { ...camp, status: 'PUBLISHED', isFull: false };

  it('offers registration on a published camp with places left', () => {
    render(<CampListView camps={[published]} locale="en" />);
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText('7 places left')).toBeInTheDocument();
  });

  it('says a full camp is full rather than offering a button that will fail', () => {
    render(<CampListView camps={[{ ...published, isFull: true }]} locale="en" />);
    expect(screen.getByText('This camp is full')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('offers no registration on a draft, which `registerForCamp` refuses', () => {
    render(<CampListView camps={[{ ...camp, status: 'DRAFT' }]} locale="en" />);
    expect(screen.queryByRole('button', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('offers the withdrawal once the seat is taken, on a finished camp too', () => {
    render(
      <CampListView
        camps={[{ ...published, status: 'COMPLETED', isRegisteredByViewer: true }]}
        locale="en"
      />
    );
    expect(screen.getByRole('button', { name: 'Cancel my registration' })).toBeInTheDocument();
  });

  it('offers an organiser the moves the camp state machine allows', () => {
    const { unmount } = render(
      <CampDetailView camp={{ ...camp, status: 'DRAFT' }} locale="en" canChangeStatus />
    );
    expect(screen.getByRole('button', { name: 'Publish camp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark camp complete' })).not.toBeInTheDocument();
    unmount();

    render(<CampDetailView camp={{ ...camp, status: 'PUBLISHED' }} locale="en" canChangeStatus />);
    expect(screen.getByRole('button', { name: 'Mark camp complete' })).toBeInTheDocument();
  });

  it('does not reopen a completed camp, because attendance is recorded against it', () => {
    render(<CampDetailView camp={{ ...camp, status: 'COMPLETED' }} locale="en" canChangeStatus />);
    expect(screen.queryByRole('button', { name: 'Publish camp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark camp complete' })).not.toBeInTheDocument();
  });
});

describe('statuses and gates', () => {
  it('translates a known state and says so plainly for an unknown one', () => {
    const { unmount } = render(<StatusBadge status="URGENT" />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    unmount();

    render(<StatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });

  it('gives each blocked portal a different sentence, and offers a way back only where there is one', () => {
    const { unmount } = render(<PortalGate status="forbidden" homeHref="/en" />);
    expect(screen.getByText('This workspace is not for your role')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my workspace' })).toHaveAttribute('href', '/en');
    unmount();

    const notConfigured = render(<PortalGate status="not_configured" homeHref="/en" />);
    expect(
      within(notConfigured.container).getByText('The healthcare portal is not configured')
    ).toBeInTheDocument();
    // There is nowhere to go: the deployment is missing a database, not a permission.
    expect(notConfigured.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('healthcare navigation', () => {
  it('offers a member camps and nothing else', () => {
    expect(healthcareNavForRole('USER').map((item) => item.href)).toEqual(['/health-camps']);
  });

  it('offers a worker their own queues and no clinician page', () => {
    const hrefs = healthcareNavForRole('ASHA').map((item) => item.href);
    expect(hrefs).toContain('/asha/households');
    expect(hrefs).toContain('/health-camps');
    expect(hrefs.some((href) => href.startsWith('/doctor'))).toBe(false);
  });

  it('never offers a clinician a household register', () => {
    const hrefs = healthcareNavForRole('DOCTOR').map((item) => item.href);
    expect(hrefs.some((href) => href.includes('households'))).toBe(false);
  });

  it('treats a signed-out visitor as a member, because the camp list is public', () => {
    expect(healthcareNavForRole(null).map((item) => item.href)).toEqual(['/health-camps']);
    expect(healthcareNavForRole(undefined)).toHaveLength(USER_HEALTHCARE_NAV.length);
  });

  it('keeps the union complete, so every href in it is a real page', () => {
    for (const role of ['ASHA', 'DOCTOR', 'USER', 'ADMIN'] as const) {
      for (const item of healthcareNavForRole(role)) {
        expect([...ASHA_HEALTHCARE_NAV, ...DOCTOR_HEALTHCARE_NAV, ...USER_HEALTHCARE_NAV]).toContainEqual(
          item
        );
      }
    }
  });
});

/** The compiler is told a review has no household field; this is the same claim, at runtime. */
describe('privacy, at the point of rendering', () => {
  it('has no path from a case review to the household register', () => {
    const keys = Object.keys(review as unknown as Record<string, unknown>);
    expect(keys).not.toContain('household');
    expect(keys).not.toContain('members');
  });

  it('carries one member on a case review', () => {
    const asRecord = review as unknown as Record<string, unknown>;
    expect(asRecord['member']).toMatchObject({ fullName: 'Lakshmi Gowda' });
  });
});
