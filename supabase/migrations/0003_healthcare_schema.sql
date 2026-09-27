-- =============================================================================
-- PMSify / Healthcare Ecosystem (World C) — schema
-- =============================================================================
--
-- Apply with:  supabase db push        (linked project)
--          or: psql "$DATABASE_URL" -f 0003_healthcare_schema.sql
--
-- Apply AFTER 0001_secretchat_schema.sql. 0001 already created `profiles`,
-- `audit_logs` and the `set_updated_at()` trigger function, and this file
-- *reconciles* them rather than recreating them: it adds the one column the
-- healthcare system needs on `profiles`, and it writes healthcare events into the
-- audit table that already exists rather than starting a second one. There is no
-- table in this file that 0001 already defines.
--
-- WHAT THIS SCHEMA IS
-- Fifteen tables for community health coordination: an account's role, who works
-- as an ASHA worker or a doctor, the households they cover, the people on those
-- households' registers, and the observation → case → referral → review → advice
-- → follow-up chain that runs through it. Plus health camps and their
-- registrations and attendance.
--
-- WHY THERE IS NO ROUTE FROM HERE TO PERSONAL HEALTH DATA
-- World A (personal cycle and daily-health tracking) lives in the reader's
-- IndexedDB and is never synchronised. This file adds no column for a cycle
-- length, a period, a symptom, a mood, a sleep score, a hydration level or a pain
-- score; there is no table a World A record could be joined into and no function
-- that accepts one. A `household_members` row is a person on a community register,
-- and a `case_observations` row is what a health worker wrote down on a visit —
-- neither is a copy of anybody's private tracking, and the two systems share no
-- table, no column and no key.
--
-- WHAT IS DELIBERATELY NOT HERE
--   * no diagnosis, no ICD code, no clinical decision support. A `clinical_notes`
--     row is a clinician's free-text assessment, written by a clinician.
--   * no prescription issued by anyone other than a doctor. The role check is in
--     the database as well as in the application; see 0004_healthcare_rls.sql.
--   * no consent or identity-document storage. A household register holds a name,
--     an age, a sex and a relation to the head of the household, which is what
--     community registration needs and no more.
--
-- Row Level Security is in 0004_healthcare_rls.sql. Applying this file alone
-- leaves the new tables without any permissive policy for `anon`/`authenticated`,
-- so nothing in them is readable or writable until 0004 is applied too.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------
-- Closed sets, so a status is a thing that can be reasoned about rather than a
-- free-text field. Adding one is a migration, never a request parameter.

create type public.healthcare_role as enum ('USER', 'ASHA', 'DOCTOR', 'ADMIN');

create type public.case_status as enum ('OPEN', 'REFERRED', 'UNDER_REVIEW', 'FOLLOW_UP', 'CLOSED');

create type public.case_source as enum ('ASHA', 'CAMP');

create type public.case_priority as enum ('ROUTINE', 'URGENT');

create type public.observation_severity as enum ('MILD', 'MODERATE', 'SEVERE');

create type public.referral_status as enum (
  'PENDING',
  'ACCEPTED',
  'IN_REVIEW',
  'COMPLETED',
  'CANCELLED'
);

create type public.follow_up_status as enum ('PENDING', 'COMPLETED', 'MISSED', 'CANCELLED');

create type public.health_camp_status as enum ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

create type public.camp_attendance_status as enum ('REGISTERED', 'ATTENDED', 'ABSENT');

create type public.member_sex as enum ('FEMALE', 'MALE', 'OTHER');

-- -----------------------------------------------------------------------------
-- Register numbers
-- -----------------------------------------------------------------------------
-- A household code and a case number are shown to a health worker reading down a
-- column, so they are minted here rather than by the client. A sequence rather than
-- "how many rows are there", because that count is a guess under concurrency: two
-- workers registering a household in the same second would otherwise be handed the
-- same `HH-0007`, and the unique constraint would turn a lost update into a
-- refused registration that the worker has to retry by hand.
--
-- The sequences are exposed as column defaults, so the store inserts without naming
-- a code at all and reads the value back.
create sequence if not exists public.household_code_seq as bigint start 1 increment 1;

create sequence if not exists public.case_number_seq as bigint start 1 increment 1;


-- -----------------------------------------------------------------------------
-- profiles.role — the one column this schema adds to an existing table
-- -----------------------------------------------------------------------------
-- 0001 created `profiles` with no personal data in it at all, and deliberately so.
-- A role is not personal data: it is an authorisation input, and it is the reason
-- `profiles` is now the table every healthcare policy asks about. `USER` is the
-- default, so an account created before this migration, or one created after it,
-- is a plain user with no privileges whatsoever until an administrator says
-- otherwise.
--
-- There is deliberately no update policy for `role` for anyone in 0004. A member
-- cannot raise or lower their own role, and neither can another member: the only
-- writer is the service role, reached through the server route that has already
-- established that the caller is an ADMIN.
alter table public.profiles
  add column if not exists role public.healthcare_role not null default 'USER';

comment on column public.profiles.role is
  'Authorisation input, server-resolved on every request. Not self-assignable: no update policy exists for this column in 0004.';

-- -----------------------------------------------------------------------------
-- Role resolution, the only way policies can learn a caller's role
-- -----------------------------------------------------------------------------
-- `profiles` is readable by a member only for their own row, and a policy on
-- `households` must be able to ask "is the caller the ASHA assigned here?". Writing
-- that as a subquery against `profiles` inside every policy would be correct and
-- unreadable, and would also mean a policy that silently stops matching if the
-- table's grants change. So the question is asked once, here.
--
-- Security definer: the policies below are written for roles the caller does not
-- hold, so they cannot be expressed without this. It is `stable` and pins its
-- search_path, and it takes no argument: it answers about `auth.uid()` and nothing
-- else, so there is no parameter a caller could use to ask about somebody else.
create or replace function public.healthcare_role()
returns public.healthcare_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'USER'::public.healthcare_role
  );
$$;

revoke all on function public.healthcare_role() from public;
grant execute on function public.healthcare_role() to anon, authenticated;

comment on function public.healthcare_role() is
  'The caller''s role, read from profiles. Returns USER when there is no session or no profile row, so an anonymous request is never elevated.';

create or replace function public.healthcare_has_role(p_roles public.healthcare_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.healthcare_role() = any (p_roles), false);
$$;

revoke all on function public.healthcare_has_role(public.healthcare_role[]) from public;
grant execute on function public.healthcare_has_role(public.healthcare_role[]) to anon, authenticated;

comment on function public.healthcare_has_role(public.healthcare_role[]) is
  'True when the caller holds one of the given roles. The role list is supplied by a policy, never by a client.';

-- -----------------------------------------------------------------------------
-- Staff profiles
-- -----------------------------------------------------------------------------
-- A worker is a Supabase account with a role *and* a row describing who they are
-- in the community, so a doctor reviewing a case can see "referred by Anitha, ANM,
-- Ward 4" rather than a uuid. The account id is the primary key and is never
-- exposed to a client; only these four human-facing fields are.

create table if not exists public.asha_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  -- A professional registration number, when the worker has one. Not a government
  -- identity document and not verified by this system.
  registration_number text check (registration_number is null or char_length(registration_number) <= 60),
  -- The area a worker covers. A free-text administrative label, never a geocode.
  area text check (area is null or char_length(area) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  registration_number text check (registration_number is null or char_length(registration_number) <= 60),
  speciality text check (speciality is null or char_length(speciality) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.asha_profiles is
  'A community health worker: the human-facing identity attached to an ASHA account. Carries no health records.';

comment on table public.doctor_profiles is
  'A clinician: the human-facing identity attached to a DOCTOR account. The only role permitted to write clinical notes and prescriptions.';

-- -----------------------------------------------------------------------------
-- Households and their members
-- -----------------------------------------------------------------------------
-- A household is the unit an ASHA worker is responsible for. `assigned_asha_id`
-- points at `asha_profiles.user_id` rather than at `auth.users` so the ownership
-- question every policy asks ("is the caller the worker assigned to this
-- household?") is a join between two tables in this schema and cannot be satisfied
-- by a session that merely has the right shape.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  -- A register number a health worker can read down a column, minted by the server.
  code text not null unique check (code ~ '^HH-[0-9]{4,}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Administrative address. Not a geocode, not a location history, not a map pin.
  address_line text check (address_line is null or char_length(address_line) <= 200),
  assigned_asha_id uuid not null references public.asha_profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The dashboard reads "my households, newest activity first" and the ownership
-- check is `assigned_asha_id = auth.uid()`, so that column leads.
create index if not exists households_assigned_asha_idx
  on public.households (assigned_asha_id, updated_at desc);

alter table public.households
  alter column code set default
  'HH-' || lpad(nextval('public.household_code_seq')::text, 4, '0');

comment on column public.households.code is
  'Register number, minted by this column''s default from household_code_seq. A client never supplies one.';

comment on table public.households is
  'A household register under one ASHA worker. Contains no World A personal-health data of any kind.';

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Demographics and administration. Deliberately the whole surface: a name, an
  -- age, a sex, a relation to the head of the household, and a note that the field
  -- comment constrains to administrative content.
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  age_years integer check (age_years is null or age_years between 0 and 130),
  sex public.member_sex,
  relation_to_head text check (relation_to_head is null or char_length(relation_to_head) <= 60),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_household_idx
  on public.household_members (household_id, created_at);

comment on table public.household_members is
  'A person on a household register. Demographics and administration only: no symptom, no cycle, no mood, no pain score, and no copy of anything the person tracked privately in PMSify.';

comment on column public.household_members.note is
  'Administrative note (e.g. "student", "moved in 2026"). Never a clinical note; clinical observations live in case_observations.';

-- -----------------------------------------------------------------------------
-- Cases and observations
-- -----------------------------------------------------------------------------
create table if not exists public.health_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique check (case_number ~ '^C-[0-9]{4,}$'),
  household_id uuid not null references public.households (id) on delete cascade,
  household_member_id uuid not null references public.household_members (id) on delete cascade,
  created_by_asha_id uuid not null references public.asha_profiles (user_id) on delete restrict,
  -- The clinician currently responsible. Set when a referral is accepted, so the
  -- "can this doctor read this case" question has one column to answer.
  assigned_doctor_id uuid references public.doctor_profiles (user_id) on delete set null,
  status public.case_status not null default 'OPEN',
  priority public.case_priority not null default 'ROUTINE',
  -- A short administrative description of why the case was opened. Not a diagnosis.
  summary text not null check (char_length(btrim(summary)) between 1 and 500),
  source public.case_source not null default 'ASHA',
  -- Set when the case came out of a health camp, so a doctor can see the origin and
  -- a camp can list the cases it produced.
  camp_id uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A case is reached from its household, from its member, and from a doctor
-- dashboard. All three are real access paths, so all three are indexed.
create index if not exists health_cases_household_idx
  on public.health_cases (household_id, updated_at desc);

create index if not exists health_cases_member_idx
  on public.health_cases (household_member_id, updated_at desc);

create index if not exists health_cases_doctor_idx
  on public.health_cases (assigned_doctor_id, updated_at desc)
  where assigned_doctor_id is not null;

create index if not exists health_cases_status_idx
  on public.health_cases (status, updated_at desc);

create index if not exists health_cases_camp_idx
  on public.health_cases (camp_id)
  where camp_id is not null;

alter table public.health_cases
  alter column case_number set default
  'C-' || lpad(nextval('public.case_number_seq')::text, 4, '0');

comment on column public.health_cases.case_number is
  'Case number, minted by this column''s default from case_number_seq. A client never supplies one.';

comment on table public.health_cases is
  'A health case. Its `summary` is an administrative description written by a health worker; it is not a diagnosis and no column in this schema computes one.';

-- The member a case names must be on the case's own household. A composite foreign
-- key would express that directly, but it needs a unique index on
-- `households (id, id)`, which is a strange thing to read and suggests something it
-- does not do. A trigger says what it means, and — unlike a check the application
-- performs — it holds for a hand-written insert too.
create or replace function public.health_cases_member_in_household()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_members.id = new.household_member_id
      and household_members.household_id = new.household_id
  ) then
    raise exception 'case_member_not_in_household' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists health_cases_member_in_household on public.health_cases;
create constraint trigger health_cases_member_in_household
  after insert or update of household_id, household_member_id on public.health_cases
  for each row execute function public.health_cases_member_in_household();

-- An observation is what a health worker saw or was told, in their words.
-- `reported_symptoms` is a list of the words used, never a conclusion drawn from
-- them: there is no code path anywhere in this schema that turns these values into
-- a diagnosis.
create table if not exists public.case_observations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.health_cases (id) on delete cascade,
  household_member_id uuid not null references public.household_members (id) on delete cascade,
  recorded_by_asha_id uuid not null references public.asha_profiles (user_id) on delete restrict,
  observed_on date not null,
  reported_symptoms text[] not null
    check (coalesce(array_length(reported_symptoms, 1), 0) between 1 and 30),
  severity public.observation_severity not null default 'MILD',
  duration_days integer check (duration_days is null or duration_days between 0 and 3650),
  notes text check (notes is null or char_length(notes) <= 1000),
  -- What the worker wants a clinician to look at. A reason for review, not a
  -- diagnosis, and not a substitute for the clinical note a doctor writes.
  referral_reason text check (referral_reason is null or char_length(referral_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_observations_case_idx
  on public.case_observations (case_id, observed_on desc);

create index if not exists case_observations_member_idx
  on public.case_observations (household_member_id, observed_on desc);

create index if not exists case_observations_asha_idx
  on public.case_observations (recorded_by_asha_id, observed_on desc);

comment on table public.case_observations is
  'A structured visit note written by a health worker. Reported observations only; nothing here is a diagnosis, and no code derives one from it.';

-- -----------------------------------------------------------------------------
-- Referrals
-- -----------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.health_cases (id) on delete cascade,
  referred_by_asha_id uuid not null references public.asha_profiles (user_id) on delete restrict,
  referred_to_doctor_id uuid not null references public.doctor_profiles (user_id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  priority public.case_priority not null default 'ROUTINE',
  status public.referral_status not null default 'PENDING',
  -- Carried through from the case so a camp's referrals are answerable in one query
  -- rather than by joining back to the case every time.
  camp_id uuid,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The doctor dashboard's primary query: my referrals, oldest first, still open.
create index if not exists referrals_doctor_status_idx
  on public.referrals (referred_to_doctor_id, status, created_at);

create index if not exists referrals_asha_idx
  on public.referrals (referred_by_asha_id, created_at desc);

create index if not exists referrals_case_idx
  on public.referrals (case_id, created_at);

create index if not exists referrals_camp_idx
  on public.referrals (camp_id)
  where camp_id is not null;

comment on table public.referrals is
  'A request for a clinician to review a case. The referring worker and the receiving doctor are fixed at creation; a referral is never re-pointed at a different doctor by a client.';

-- -----------------------------------------------------------------------------
-- Clinical notes and prescriptions
-- -----------------------------------------------------------------------------
-- Everything in this section is doctor-only, and the database says so, not just the
-- application: 0004 grants no insert or update policy on either table to any role
-- other than DOCTOR, and the doctor must also be the one the case is assigned to.

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.health_cases (id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles (user_id) on delete restrict,
  -- The clinician's own assessment. Free text written by a clinician about a
  -- specific case; it is not generated, not inferred and not scored.
  assessment text not null check (char_length(btrim(assessment)) between 1 and 2000),
  observations text check (observations is null or char_length(observations) <= 2000),
  advice text not null check (char_length(btrim(advice)) between 1 and 2000),
  -- An optional recommended review date. A recommendation, not a scheduled
  -- appointment: a `follow_ups` row is the actual commitment.
  follow_up_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_notes_case_idx
  on public.clinical_notes (case_id, created_at desc);

create index if not exists clinical_notes_doctor_idx
  on public.clinical_notes (doctor_id, created_at desc);

comment on table public.clinical_notes is
  'A clinician''s assessment and advice on one case. Only a doctor may write one: see the policies in 0004_healthcare_rls.sql.';

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.health_cases (id) on delete cascade,
  clinical_note_id uuid references public.clinical_notes (id) on delete set null,
  doctor_id uuid not null references public.doctor_profiles (user_id) on delete restrict,
  medicine_name text not null check (char_length(btrim(medicine_name)) between 1 and 160),
  dosage text not null check (char_length(btrim(dosage)) between 1 and 120),
  frequency text not null check (char_length(btrim(frequency)) between 1 and 120),
  duration text not null check (char_length(btrim(duration)) between 1 and 120),
  instructions text check (instructions is null or char_length(instructions) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prescriptions_case_idx
  on public.prescriptions (case_id, created_at desc);

create index if not exists prescriptions_doctor_idx
  on public.prescriptions (doctor_id, created_at desc);

comment on table public.prescriptions is
  'Medicine advice issued by a clinician for one case. No role other than DOCTOR can insert or update a row here, in the database as well as in the API.';

-- -----------------------------------------------------------------------------
-- Follow-ups
-- -----------------------------------------------------------------------------
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.health_cases (id) on delete cascade,
  assigned_to_user_id uuid not null references auth.users (id) on delete restrict,
  -- Stored rather than derived, so an authorization check does not have to join
  -- through the profile table to learn what a worker is allowed to close.
  assigned_role public.healthcare_role not null,
  due_date date not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  status public.follow_up_status not null default 'PENDING',
  completed_at timestamptz,
  completed_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A completed follow-up must say who completed it and when. Enforced here so a
  -- hand-written insert cannot produce a completion nobody can attribute.
  constraint follow_ups_completion_is_attributable
    check (
      (status = 'PENDING' and completed_at is null and completed_by_user_id is null)
      or (status <> 'PENDING' and completed_at is not null and completed_by_user_id is not null)
    )
);

-- Both dashboards list "my follow-ups, soonest first".
create index if not exists follow_ups_assignee_idx
  on public.follow_ups (assigned_to_user_id, status, due_date);

create index if not exists follow_ups_case_idx
  on public.follow_ups (case_id, due_date);

create index if not exists follow_ups_due_idx
  on public.follow_ups (due_date)
  where status = 'PENDING';

comment on table public.follow_ups is
  'A scheduled review of a case by a named worker. Its status is advanced through the transition table in src/types/healthcare.ts, never set directly by a client.';

-- -----------------------------------------------------------------------------
-- Health camps
-- -----------------------------------------------------------------------------
create table if not exists public.health_camps (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  camp_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null check (char_length(btrim(location)) between 1 and 200),
  -- The account that created it, which is also the account allowed to publish it
  -- and to mark attendance. Not necessarily an organisation.
  organizer_user_id uuid not null references auth.users (id) on delete restrict,
  -- A real ceiling, enforced by the API and by the unique/select policies below,
  -- because a camp that says fifty and takes ninety is a broken promise to whoever
  -- turned up.
  capacity integer not null check (capacity between 1 and 10000),
  status public.health_camp_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_camps_time_order check (end_time > start_time)
);

-- The public listing is published camps by date, and nothing else.
create index if not exists health_camps_published_idx
  on public.health_camps (camp_date)
  where status = 'PUBLISHED';

create index if not exists health_camps_organizer_idx
  on public.health_camps (organizer_user_id, camp_date desc);

comment on table public.health_camps is
  'A health camp session. Created by a worker or an administrator, opened for registration when published, and closed afterwards.';

create table if not exists public.camp_registrations (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.health_camps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The duplicate-registration guarantee is this key, not a check in application
-- code: one person cannot hold two seats at one camp, so a double tap, a retry and
-- two tabs all collapse to one registration.
create unique index if not exists camp_registrations_one_per_user_idx
  on public.camp_registrations (camp_id, user_id);

-- Capacity is counted through this index, so a "how many seats are left" answer is
-- an index scan rather than a full read of the table.
create index if not exists camp_registrations_camp_idx
  on public.camp_registrations (camp_id);

comment on table public.camp_registrations is
  'One person''s seat at one camp. The unique (camp_id, user_id) index is the duplicate-registration rule.';

-- -----------------------------------------------------------------------------
-- Capacity, enforced by the database rather than by a read-then-write
-- -----------------------------------------------------------------------------
-- A camp that says fifty and takes ninety is a broken promise to whoever turned up,
-- so the ceiling is not left to the application. "Count the seats, then insert" is
-- two statements, and between them another tab can take the last one: the check
-- passes, the insert succeeds, and the camp is over capacity by exactly the number
-- of simultaneous final registrations. Two people racing for one remaining seat is
-- not a hypothetical, it is what happens when a camp opens.
--
-- So the count and the insert are one statement. `for update` takes the camp row's
-- lock first, which serialises concurrent registrations against each other; the
-- count that follows therefore cannot be stale by the time the new row lands. The
-- lock is held only for the length of this trigger, not for the rest of the
-- transaction, and the index on (camp_id) makes the count itself an index scan.
--
-- The error is raised as a check violation (23514) with a stable message, so the
-- application can map it to a "this camp is full" conflict and nothing else in the
-- database is disturbed. The application checks capacity too — for a better message
-- before the user fills a form in — but this trigger is what makes the guarantee
-- real, and it also covers a hand-written insert that skipped the API entirely.
create or replace function public.camp_registrations_within_capacity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  seats integer;
  taken integer;
begin
  select health_camps.capacity into seats
  from public.health_camps
  where health_camps.id = new.camp_id
  for update;

  -- A registration for a camp that does not exist is left to the foreign key, which
  -- reports it more precisely than a count of zero ever could.
  if seats is null then
    return new;
  end if;

  select count(*) into taken
  from public.camp_registrations
  where camp_registrations.camp_id = new.camp_id;

  if taken >= seats then
    raise exception 'camp_at_capacity' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists camp_registrations_within_capacity on public.camp_registrations;
create trigger camp_registrations_within_capacity
  before insert on public.camp_registrations
  for each row execute function public.camp_registrations_within_capacity();

comment on function public.camp_registrations_within_capacity() is
  'Refuses a registration once a camp is at its capacity. The per-camp lock makes the count and the insert atomic.';

create table if not exists public.camp_attendance (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.health_camps (id) on delete cascade,
  -- Attendance addresses a registration, not a person, so a row can never be
  -- attached to somebody who never held a seat.
  registration_id uuid not null references public.camp_registrations (id) on delete cascade,
  status public.camp_attendance_status not null default 'REGISTERED',
  marked_by_user_id uuid references auth.users (id) on delete set null,
  marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Marked attendance must be attributable; an untouched registration is not.
  constraint camp_attendance_marked_is_attributable
    check (
      (status = 'REGISTERED' and marked_at is null and marked_by_user_id is null)
      or (status <> 'REGISTERED' and marked_at is not null and marked_by_user_id is not null)
    )
);

create unique index if not exists camp_attendance_one_per_registration_idx
  on public.camp_attendance (registration_id);

create index if not exists camp_attendance_camp_idx
  on public.camp_attendance (camp_id, status);

comment on table public.camp_attendance is
  'Whether a registered person attended a camp. One row per registration; it starts at REGISTERED and is advanced to ATTENDED or ABSENT by staff.';

-- -----------------------------------------------------------------------------
-- Case and camp cross-references, added after both tables exist
-- -----------------------------------------------------------------------------
-- `camp_id` is nullable and declared without an inline reference above because
-- `health_camps` is created later in this file. `on delete set null` rather than
-- cascade: cancelling or removing a camp must not destroy the clinical record of a
-- case that came out of it.
alter table public.health_cases
  drop constraint if exists health_cases_camp_fk;
alter table public.health_cases
  add constraint health_cases_camp_fk
  foreign key (camp_id) references public.health_camps (id) on delete set null;

alter table public.referrals
  drop constraint if exists referrals_camp_fk;
alter table public.referrals
  add constraint referrals_camp_fk
  foreign key (camp_id) references public.health_camps (id) on delete set null;

-- -----------------------------------------------------------------------------
-- updated_at maintenance, reusing the function 0001 already created
-- -----------------------------------------------------------------------------
drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

drop trigger if exists health_cases_set_updated_at on public.health_cases;
create trigger health_cases_set_updated_at
  before update on public.health_cases
  for each row execute function public.set_updated_at();

drop trigger if exists case_observations_set_updated_at on public.case_observations;
create trigger case_observations_set_updated_at
  before update on public.case_observations
  for each row execute function public.set_updated_at();

drop trigger if exists referrals_set_updated_at on public.referrals;
create trigger referrals_set_updated_at
  before update on public.referrals
  for each row execute function public.set_updated_at();

drop trigger if exists clinical_notes_set_updated_at on public.clinical_notes;
create trigger clinical_notes_set_updated_at
  before update on public.clinical_notes
  for each row execute function public.set_updated_at();

drop trigger if exists prescriptions_set_updated_at on public.prescriptions;
create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

drop trigger if exists follow_ups_set_updated_at on public.follow_ups;
create trigger follow_ups_set_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();

drop trigger if exists asha_profiles_set_updated_at on public.asha_profiles;
create trigger asha_profiles_set_updated_at
  before update on public.asha_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists doctor_profiles_set_updated_at on public.doctor_profiles;
create trigger doctor_profiles_set_updated_at
  before update on public.doctor_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists health_camps_set_updated_at on public.health_camps;
create trigger health_camps_set_updated_at
  before update on public.health_camps
  for each row execute function public.set_updated_at();

drop trigger if exists camp_registrations_set_updated_at on public.camp_registrations;
create trigger camp_registrations_set_updated_at
  before update on public.camp_registrations
  for each row execute function public.set_updated_at();

drop trigger if exists camp_attendance_set_updated_at on public.camp_attendance;
create trigger camp_attendance_set_updated_at
  before update on public.camp_attendance
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
-- 0001 already created `public.audit_logs`, with the columns healthcare events
-- need (actor_id, action, target_type, target_id, metadata, created_at) and a
-- comment that says metadata holds no health records. There is no second audit
-- table in this file and there will not be one: an audit trail split across two
-- tables is an audit trail nobody reads.
--
-- The two indexes below are all that is added. The first is the query the
-- healthcare UI actually runs — "what happened to this entity" — and the second
-- is the composite the tables above need, since `target_id` on its own is not
-- selective.
create index if not exists audit_logs_target_idx
  on public.audit_logs (target_type, target_id, created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);
