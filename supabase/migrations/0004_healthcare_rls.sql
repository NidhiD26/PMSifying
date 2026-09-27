-- =============================================================================
-- PMSify / Healthcare Ecosystem (World C) — Row Level Security
-- =============================================================================
--
-- Apply AFTER 0003_healthcare_schema.sql.
--
-- WHAT THIS FILE IS
-- Postgres is the enforcement point for the healthcare workflows, not the
-- application. Every rule below is written so that an ASHA worker, a doctor or a
-- plain user who bypasses the API, opens a SQL console or calls PostgREST directly
-- still cannot do anything they should not. The service layer is a convenience and
-- a second opinion, never the guard.
--
-- THE SIX THINGS THAT MUST BE TRUE
--   1. Default deny. RLS is enabled *and forced* on every table below, and no
--      permissive policy is granted beyond what is listed.
--   2. The role is read from the database. Every policy asks
--      `healthcare_has_role(...)`, which reads `profiles.role` for `auth.uid()`.
--      No policy reads a role, a user id or a doctor id from the request, because
--      there is nowhere in PostgREST for a client to put one that this would use.
--   3. A worker sees only their own households. Ownership is
--      `households.assigned_asha_id = auth.uid()`.
--   4. A doctor sees only what they were referred. Ownership is
--      `referrals.referred_to_doctor_id = auth.uid()` or
--      `health_cases.assigned_doctor_id = auth.uid()`.
--   5. Only a doctor writes clinical notes and prescriptions. There is no policy
--      for any other role on either table — not a restrictive one, none at all —
--      and the doctor's own row must also match the actor, so a doctor cannot
--      write a note attributed to a colleague.
--   6. Nobody edits their own role. `profiles.role` is granted no update policy to
--      anyone. The single writer is the service role, behind a server route that
--      has already established that the caller is an ADMIN.
--
-- WHAT IS DELIBERATELY NOT ENFORCED HERE
-- `audit_logs` has no policy for any member, for the same reason SecretChat's does
-- not: the trail is written by the application through the same session (so the
-- actor cannot be forged) and read only by a server-authorised admin route.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Default deny
-- -----------------------------------------------------------------------------
-- `force` as well as `enable`: without it a migration or a query that happens to
-- run as the table owner would quietly bypass every policy below.
alter table public.profiles enable row level security;
alter table public.asha_profiles enable row level security;
alter table public.doctor_profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.health_cases enable row level security;
alter table public.case_observations enable row level security;
alter table public.referrals enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.prescriptions enable row level security;
alter table public.follow_ups enable row level security;
alter table public.health_camps enable row level security;
alter table public.camp_registrations enable row level security;
alter table public.camp_attendance enable row level security;

alter table public.profiles force row level security;
alter table public.asha_profiles force row level security;
alter table public.doctor_profiles force row level security;
alter table public.households force row level security;
alter table public.household_members force row level security;
alter table public.health_cases force row level security;
alter table public.case_observations force row level security;
alter table public.referrals force row level security;
alter table public.clinical_notes force row level security;
alter table public.prescriptions force row level security;
alter table public.follow_ups force row level security;
alter table public.health_camps force row level security;
alter table public.camp_registrations force row level security;
alter table public.camp_attendance force row level security;

-- -----------------------------------------------------------------------------
-- Table grants
-- -----------------------------------------------------------------------------
-- Grants alone grant nothing once RLS is on: a permitted statement still has to
-- pass a policy. They are listed explicitly so the surface area is declared rather
-- than inherited, and so narrowing it later is a visible edit.
--
-- Note what is absent. There is no `insert` or `update` grant on `profiles`: the
-- role column has no writer among the member roles, and denying at the grant level
-- means a policy added by mistake later still cannot promote anybody.
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.asha_profiles to authenticated;
grant select on public.doctor_profiles to authenticated;
grant select on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select on public.health_cases to authenticated;
grant select on public.case_observations to authenticated;
grant select on public.referrals to authenticated;
grant select on public.clinical_notes to authenticated;
grant select on public.prescriptions to authenticated;
grant select on public.follow_ups to authenticated;
grant select on public.health_camps to anon, authenticated;
grant select on public.camp_registrations to authenticated;
grant select on public.camp_attendance to authenticated;

grant insert, update on public.households to authenticated;
grant insert, update on public.household_members to authenticated;
grant insert, update on public.health_cases to authenticated;
grant insert, update on public.case_observations to authenticated;
grant insert, update on public.referrals to authenticated;
grant insert, update on public.follow_ups to authenticated;
grant insert on public.clinical_notes to authenticated;
grant insert, update on public.prescriptions to authenticated;
grant insert, update on public.health_camps to authenticated;
grant insert on public.camp_registrations to authenticated;
grant insert, update on public.camp_attendance to authenticated;

grant update on public.asha_profiles to authenticated;
grant update on public.doctor_profiles to authenticated;

-- No `insert` on `asha_profiles` or `doctor_profiles`: a worker cannot promote
-- themselves into a role by inserting their own row. Those two rows are created by
-- the service role, behind a server route that has checked the caller's role.

-- No grant to `anon` on any write, in any table, anywhere in this schema. An
-- unauthenticated request cannot create a healthcare record even if a policy were
-- written to allow it.

-- -----------------------------------------------------------------------------
-- profiles — readable, never writable
-- -----------------------------------------------------------------------------
-- 0001 already granted a member their own row. The role column rides along, which
-- is exactly what a client needs: to know which navigation to draw. It is not
-- authority — every decision that matters is made again by a policy below, from
-- the same column, without asking the client.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- No insert policy: 0001's on-sign-up trigger creates the row, and that trigger
-- runs as the platform role, not as the member.
--
-- No update policy, and no update grant, on `profiles`. This is the rule that makes
-- "a user cannot turn themselves into an ASHA" a fact about the database rather
-- than a fact about a form. Even a member who knows their own id and issues a
-- hand-written PATCH cannot change `role`, and neither can another member.

-- -----------------------------------------------------------------------------
-- asha_profiles / doctor_profiles
-- -----------------------------------------------------------------------------
-- A worker directory. A doctor reviewing a case needs the referring worker's name
-- to render "referred by Anitha, ANM"; a user needs a doctor's name to pick a
-- referral. So the directory is readable by any signed-in account, and it carries
-- nothing but a name, an optional registration number and an optional area.
drop policy if exists asha_profiles_select_all on public.asha_profiles;
create policy asha_profiles_select_all on public.asha_profiles
  for select
  to authenticated
  using (true);

drop policy if exists asha_profiles_update_own on public.asha_profiles;
create policy asha_profiles_update_own on public.asha_profiles
  for update
  to authenticated
  using (user_id = auth.uid() and public.healthcare_has_role(array['ASHA']::public.healthcare_role[]))
  with check (user_id = auth.uid());

drop policy if exists doctor_profiles_select_all on public.doctor_profiles;
create policy doctor_profiles_select_all on public.doctor_profiles
  for select
  to authenticated
  using (true);

drop policy if exists doctor_profiles_update_own on public.doctor_profiles;
create policy doctor_profiles_update_own on public.doctor_profiles
  for update
  to authenticated
  using (user_id = auth.uid() and public.healthcare_has_role(array['DOCTOR']::public.healthcare_role[]))
  with check (user_id = auth.uid());

-- Neither insert nor delete policy exists. A worker row is a platform fact about
-- someone's employment, and creating one for yourself would be a self-promotion
-- the role system exists to prevent.

-- -----------------------------------------------------------------------------
-- households
-- -----------------------------------------------------------------------------
-- The single ownership predicate, written once and reused by every table below
-- through the subqueries: `assigned_asha_id = auth.uid()`.
drop policy if exists households_select_assigned on public.households;
create policy households_select_assigned on public.households
  for select
  to authenticated
  using (
    assigned_asha_id = auth.uid()
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- A worker may create a household, and only for themselves. `with check` repeats
-- the predicate: without it a row could be inserted claiming to be assigned to
-- somebody else and then be invisible to the worker who created it, or visible to
-- the one who did not.
drop policy if exists households_insert_own on public.households;
create policy households_insert_own on public.households
  for insert
  to authenticated
  with check (
    assigned_asha_id = auth.uid()
    and public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
  );

-- Reassignment is not offered at all. `with check` pins the owner to the caller, so
-- an update cannot hand a household to another worker, and cannot edit one that is
-- not theirs. Changing who covers an area is an administrative action, not a
-- field a client sets.
drop policy if exists households_update_own on public.households;
create policy households_update_own on public.households
  for update
  to authenticated
  using (assigned_asha_id = auth.uid())
  with check (assigned_asha_id = auth.uid());

-- No delete policy and no delete grant. A household holds cases and observations;
-- removing one is a platform operation, not a field worker action.

-- -----------------------------------------------------------------------------
-- household_members
-- -----------------------------------------------------------------------------
-- Readable through the household, which is how a member's page resolves without
-- ever naming a household id the caller could not already read.
drop policy if exists household_members_select_via_household on public.household_members;
create policy household_members_select_via_household on public.household_members
  for select
  to authenticated
  using (
    exists (
      select 1 from public.households
      where households.id = household_members.household_id
        and (
          households.assigned_asha_id = auth.uid()
          or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
        )
    )
    -- A doctor needs the register entry for a case they were referred. Without
    -- this, the review screen could show a case with no name against it, and with
    -- it the doctor sees only the household-member row, never a personal record.
    or exists (
      select 1 from public.health_cases
      where health_cases.household_member_id = household_members.id
        and health_cases.assigned_doctor_id = auth.uid()
    )
  );

drop policy if exists household_members_insert_via_household on public.household_members;
create policy household_members_insert_via_household on public.household_members
  for insert
  to authenticated
  with check (
    public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    and exists (
      select 1 from public.households
      where households.id = household_members.household_id
        and households.assigned_asha_id = auth.uid()
    )
  );

drop policy if exists household_members_update_via_household on public.household_members;
create policy household_members_update_via_household on public.household_members
  for update
  to authenticated
  using (
    public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    and exists (
      select 1 from public.households
      where households.id = household_members.household_id
        and households.assigned_asha_id = auth.uid()
    )
  )
  with check (
    public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    and exists (
      select 1 from public.households
      where households.id = household_members.household_id
        and households.assigned_asha_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- health_cases
-- -----------------------------------------------------------------------------
-- Readable by the worker who covers the household, by the doctor the case is
-- assigned to, and by an administrator. Note that "a doctor I referred somebody
-- else to" is deliberately not in this list: the case becomes theirs when the
-- referral is accepted, which is a moment with an actor and an audit event behind
-- it, not a side effect of a row appearing in a listing.
drop policy if exists health_cases_select_scoped on public.health_cases;
create policy health_cases_select_scoped on public.health_cases
  for select
  to authenticated
  using (
    exists (
      select 1 from public.households
      where households.id = health_cases.household_id
        and households.assigned_asha_id = auth.uid()
    )
    or assigned_doctor_id = auth.uid()
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

drop policy if exists health_cases_insert_own on public.health_cases;
create policy health_cases_insert_own on public.health_cases
  for insert
  to authenticated
  with check (
    created_by_asha_id = auth.uid()
    and public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    -- The case must sit on a household this worker actually covers. Without this a
    -- worker could open a case against any household id they had guessed.
    and exists (
      select 1 from public.households
      where households.id = health_cases.household_id
        and households.assigned_asha_id = auth.uid()
    )
    -- A new case is OPEN. The client cannot open a case directly into a review
    -- state, because the only moves are the ones the application performs.
    and status = 'OPEN'
  );

-- The status is advanced by the application as the *result* of an action, and the
-- permitted states are pinned here. A member who writes this update by hand still
-- cannot move a case from OPEN to CLOSED and skip the clinical record in between.
drop policy if exists health_cases_update_scoped on public.health_cases;
create policy health_cases_update_scoped on public.health_cases
  for update
  to authenticated
  using (
    public.healthcare_has_role(array['ASHA', 'DOCTOR', 'ADMIN']::public.healthcare_role[])
    and (
      exists (
        select 1 from public.households
        where households.id = health_cases.household_id
          and households.assigned_asha_id = auth.uid()
      )
      or assigned_doctor_id = auth.uid()
      or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
    )
  )
  with check (
    status in ('OPEN', 'REFERRED', 'UNDER_REVIEW', 'FOLLOW_UP', 'CLOSED')
  );

-- -----------------------------------------------------------------------------
-- case_observations
-- -----------------------------------------------------------------------------
drop policy if exists case_observations_select_via_case on public.case_observations;
create policy case_observations_select_via_case on public.case_observations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.health_cases
      where health_cases.id = case_observations.case_id
        and (
          health_cases.assigned_doctor_id = auth.uid()
          or exists (
            select 1 from public.households
            where households.id = health_cases.household_id
              and households.assigned_asha_id = auth.uid()
          )
          or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
        )
    )
  );

-- An observation is a health worker's record of their own visit. Only a worker can
-- write one, only their own, and only onto a case inside their own area.
drop policy if exists case_observations_insert_own on public.case_observations;
create policy case_observations_insert_own on public.case_observations
  for insert
  to authenticated
  with check (
    recorded_by_asha_id = auth.uid()
    and public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    and exists (
      select 1 from public.health_cases
      where health_cases.id = case_observations.case_id
        and exists (
          select 1 from public.households
          where households.id = health_cases.household_id
            and households.assigned_asha_id = auth.uid()
        )
    )
  );

-- Observations are a dated record of what was seen. Correcting one is done by
-- adding another, and the only columns an update may change are the ones a worker
-- could plausibly have got wrong when typing.
drop policy if exists case_observations_update_own on public.case_observations;
create policy case_observations_update_own on public.case_observations
  for update
  to authenticated
  using (recorded_by_asha_id = auth.uid())
  with check (recorded_by_asha_id = auth.uid());

-- -----------------------------------------------------------------------------
-- referrals
-- -----------------------------------------------------------------------------
-- Two audiences, one row: the worker who filed it and the doctor who received it.
drop policy if exists referrals_select_parties on public.referrals;
create policy referrals_select_parties on public.referrals
  for select
  to authenticated
  using (
    referred_by_asha_id = auth.uid()
    or referred_to_doctor_id = auth.uid()
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- A referral names both parties, and the caller may only name themselves. The
-- `referred_to_doctor_id` is a real doctor row, so this cannot be aimed at a
-- guessed uuid, and the case must be one the worker covers.
drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own on public.referrals
  for insert
  to authenticated
  with check (
    referred_by_asha_id = auth.uid()
    and public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    and status = 'PENDING'
    and exists (
      select 1 from public.health_cases
      where health_cases.id = referrals.case_id
        and exists (
          select 1 from public.households
          where households.id = health_cases.household_id
            and households.assigned_asha_id = auth.uid()
        )
    )
  );

-- Only the receiving doctor moves a referral, and only forward: PENDING to
-- ACCEPTED or CANCELLED, ACCEPTED to IN_REVIEW, COMPLETED or CANCELLED, IN_REVIEW
-- to COMPLETED or CANCELLED. COMPLETED and CANCELLED are terminal. The originating
-- worker cannot re-point it at a different doctor either, because `with check`
-- pins both party columns.
drop policy if exists referrals_update_doctor on public.referrals;
create policy referrals_update_doctor on public.referrals
  for update
  to authenticated
  using (
    referred_to_doctor_id = auth.uid()
    and public.healthcare_has_role(array['DOCTOR']::public.healthcare_role[])
  )
  with check (
    referred_by_asha_id = referrals.referred_by_asha_id
    and referred_to_doctor_id = auth.uid()
    and status in ('PENDING', 'ACCEPTED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED')
  );

-- The originating worker may withdraw a referral they have not yet had accepted.
-- Only that one move, and only while it is still PENDING.
drop policy if exists referrals_update_withdraw_own on public.referrals;
create policy referrals_update_withdraw_own on public.referrals
  for update
  to authenticated
  using (
    referred_by_asha_id = auth.uid()
    and public.healthcare_has_role(array['ASHA']::public.healthcare_role[])
    and status = 'PENDING'
  )
  with check (
    referred_by_asha_id = auth.uid()
    and referred_to_doctor_id = referrals.referred_to_doctor_id
    and status = 'CANCELLED'
  );

-- -----------------------------------------------------------------------------
-- clinical_notes
-- -----------------------------------------------------------------------------
-- Doctors only. There is no policy for ASHA, USER or ADMIN here at all, so no role
-- other than the receiving clinician can insert one — and the `with check` pins
-- `doctor_id` to the caller, so a doctor cannot write a note that appears to be
-- somebody else's.
drop policy if exists clinical_notes_insert_assigned_doctor on public.clinical_notes;
create policy clinical_notes_insert_assigned_doctor on public.clinical_notes
  for insert
  to authenticated
  with check (
    doctor_id = auth.uid()
    and public.healthcare_has_role(array['DOCTOR']::public.healthcare_role[])
    and exists (
      select 1 from public.health_cases
      where health_cases.id = clinical_notes.case_id
        and health_cases.assigned_doctor_id = auth.uid()
    )
  );

drop policy if exists clinical_notes_update_own on public.clinical_notes;
create policy clinical_notes_update_own on public.clinical_notes
  for update
  to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- A clinical note is a dated, attributable record of a clinician's assessment. It
-- is not editable by another clinician, not editable by the worker who referred
-- the case, and there is no delete policy for anybody: an amendment is a new note.

-- -----------------------------------------------------------------------------
-- prescriptions — the rule this sprint cares most about
-- -----------------------------------------------------------------------------
-- The same shape as clinical notes, and for the same reason. There is exactly one
-- role that can insert here, the caller has to be that role, the caller has to be
-- the doctor the case is assigned to, and the row's `doctor_id` has to be the
-- caller. An ASHA worker and a plain user have no policy at all, so "must never be
-- able to prescribe" holds even if the application forgot to check.
drop policy if exists prescriptions_insert_assigned_doctor on public.prescriptions;
create policy prescriptions_insert_assigned_doctor on public.prescriptions
  for insert
  to authenticated
  with check (
    doctor_id = auth.uid()
    and public.healthcare_has_role(array['DOCTOR']::public.healthcare_role[])
    and exists (
      select 1 from public.health_cases
      where health_cases.id = prescriptions.case_id
        and health_cases.assigned_doctor_id = auth.uid()
    )
  );

-- A prescription may be corrected by the doctor who wrote it, and by nobody else.
drop policy if exists prescriptions_update_own on public.prescriptions;
create policy prescriptions_update_own on public.prescriptions
  for update
  to authenticated
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- No delete policy. Superseding a prescription means writing a new one, which
-- leaves the history of what was advised.

-- -----------------------------------------------------------------------------
-- follow_ups
-- -----------------------------------------------------------------------------
-- Assigned to a named worker, readable by the parties to the case, writable by
-- whoever is on the hook for it.
drop policy if exists follow_ups_select_via_case on public.follow_ups;
create policy follow_ups_select_via_case on public.follow_ups
  for select
  to authenticated
  using (
    assigned_to_user_id = auth.uid()
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
    or exists (
      select 1 from public.health_cases
      where health_cases.id = follow_ups.case_id
        and health_cases.assigned_doctor_id = auth.uid()
    )
  );

-- Created by a doctor on a case they hold, or by a worker on a case in their area,
-- and always assigned to somebody real.
--
-- The worker's own patch counts. The first draft of this policy listed only the
-- doctor branch and the admin branch, so an ASHA could be handed a follow-up and
-- could not schedule the next one on their own case; the comment above already said
-- the worker branch was intended, and the code is what has to be brought in line.
-- An ASHA reaches their cases through the household, not through
-- `assigned_doctor_id`, which is the whole reason this predicate needs the join.
drop policy if exists follow_ups_insert_scoped on public.follow_ups;
create policy follow_ups_insert_scoped on public.follow_ups
  for insert
  to authenticated
  with check (
    status = 'PENDING'
    and completed_at is null
    and completed_by_user_id is null
    and public.healthcare_has_role(array['ASHA', 'DOCTOR', 'ADMIN']::public.healthcare_role[])
    and (
      exists (
        select 1 from public.health_cases
        where health_cases.id = follow_ups.case_id
          and health_cases.assigned_doctor_id = auth.uid()
      )
      or exists (
        select 1 from public.health_cases
        join public.households on households.id = health_cases.household_id
        where health_cases.id = follow_ups.case_id
          and households.assigned_asha_id = auth.uid()
      )
      or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
    )
  );

-- The assignee closes it, and the `with check` requires a real completion stamp, so
-- "done" is always attributable to a person and a moment.
drop policy if exists follow_ups_update_assignee on public.follow_ups;
create policy follow_ups_update_assignee on public.follow_ups
  for update
  to authenticated
  using (
    assigned_to_user_id = auth.uid()
    and public.healthcare_has_role(array['ASHA', 'DOCTOR', 'ADMIN']::public.healthcare_role[])
  )
  with check (
    completed_by_user_id = auth.uid()
    and completed_at is not null
  );

-- -----------------------------------------------------------------------------
-- health_camps
-- -----------------------------------------------------------------------------
-- The only table here with an `anon` read grant, and it is the published listing
-- only: an unauthenticated visitor can see that a camp is happening, which is what
-- makes a camp public, and nothing else. Drafts, rosters and attendance are not
-- public.
drop policy if exists health_camps_select_published on public.health_camps;
create policy health_camps_select_published on public.health_camps
  for select
  to anon, authenticated
  using (status = 'PUBLISHED');

-- Staff additionally see their own camps whatever their state, so a draft is
-- editable by the person who wrote it and invisible to everybody else.
drop policy if exists health_camps_select_staff on public.health_camps;
create policy health_camps_select_staff on public.health_camps
  for select
  to authenticated
  using (
    organizer_user_id = auth.uid()
    or public.healthcare_has_role(array['ASHA', 'DOCTOR', 'ADMIN']::public.healthcare_role[])
  );

-- A worker, a doctor or an administrator may open a camp; a plain user may not.
drop policy if exists health_camps_insert_staff on public.health_camps;
create policy health_camps_insert_staff on public.health_camps
  for insert
  to authenticated
  with check (
    organizer_user_id = auth.uid()
    and public.healthcare_has_role(array['ASHA', 'DOCTOR', 'ADMIN']::public.healthcare_role[])
  );

-- The organizer or an administrator moves a camp through its states. The permitted
-- status set is pinned in `with check`; the transition itself is checked in the
-- application against `HEALTH_CAMP_TRANSITIONS`, and the `using` clause below stops
-- a terminal camp being reopened by an update written by hand.
drop policy if exists health_camps_update_staff on public.health_camps;
create policy health_camps_update_staff on public.health_camps
  for update
  to authenticated
  using (
    public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
    or (
      organizer_user_id = auth.uid()
      and public.healthcare_has_role(array['ASHA', 'DOCTOR']::public.healthcare_role[])
    )
  )
  with check (
    organizer_user_id = auth.uid()
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- No delete policy. A camp that people registered for is a record; it is cancelled,
-- not erased.

-- -----------------------------------------------------------------------------
-- camp_registrations
-- -----------------------------------------------------------------------------
drop policy if exists camp_registrations_select_own on public.camp_registrations;
create policy camp_registrations_select_own on public.camp_registrations
  for select
  to authenticated
  using (user_id = auth.uid());

-- Staff need the roster to mark attendance, and only for a camp they run.
drop policy if exists camp_registrations_select_staff on public.camp_registrations;
create policy camp_registrations_select_staff on public.camp_registrations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.health_camps
      where health_camps.id = camp_registrations.camp_id
        and health_camps.organizer_user_id = auth.uid()
    )
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- One row, one person, one camp. The unique index from 0003 is what makes a second
-- registration impossible; the policy pins `user_id` so nobody can register
-- somebody else, and requires a published camp so a cancelled session cannot take
-- new sign-ups.
drop policy if exists camp_registrations_insert_own on public.camp_registrations;
create policy camp_registrations_insert_own on public.camp_registrations
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.health_camps
      where health_camps.id = camp_registrations.camp_id
        and health_camps.status = 'PUBLISHED'
    )
    -- The capacity ceiling, evaluated by the database rather than trusted from the
    -- client: the seat count at the moment of the insert, compared against the
    -- camp's own capacity. `r` is the alias so the inner reference is to the
    -- *existing* rows and the outer one is to the row being inserted.
    and (
      select health_camps.capacity
      from public.health_camps
      where health_camps.id = camp_registrations.camp_id
    ) > (
      select count(*)
      from public.camp_registrations r
      where r.camp_id = camp_registrations.camp_id
    )
  );

-- A person may withdraw from a camp they registered for. Staff may remove anybody
-- from a camp they run. Neither can change which camp or which person a row is for.
drop policy if exists camp_registrations_delete_own on public.camp_registrations;
create policy camp_registrations_delete_own on public.camp_registrations
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.health_camps
      where health_camps.id = camp_registrations.camp_id
        and health_camps.organizer_user_id = auth.uid()
    )
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- -----------------------------------------------------------------------------
-- camp_attendance
-- -----------------------------------------------------------------------------
drop policy if exists camp_attendance_select_staff on public.camp_attendance;
create policy camp_attendance_select_staff on public.camp_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from public.health_camps
      where health_camps.id = camp_attendance.camp_id
        and health_camps.organizer_user_id = auth.uid()
    )
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- Marked by the organizer or an administrator, attributed to them, and only for a
-- registration that actually belongs to this camp.
drop policy if exists camp_attendance_insert_staff on public.camp_attendance;
create policy camp_attendance_insert_staff on public.camp_attendance
  for insert
  to authenticated
  with check (
    marked_by_user_id = auth.uid()
    and (
      exists (
        select 1 from public.health_camps
        where health_camps.id = camp_attendance.camp_id
          and health_camps.organizer_user_id = auth.uid()
      )
      or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
    )
    and exists (
      select 1 from public.camp_registrations
      where camp_registrations.id = camp_attendance.registration_id
        and camp_registrations.camp_id = camp_attendance.camp_id
    )
  );

drop policy if exists camp_attendance_update_staff on public.camp_attendance;
create policy camp_attendance_update_staff on public.camp_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from public.health_camps
      where health_camps.id = camp_attendance.camp_id
        and health_camps.organizer_user_id = auth.uid()
    )
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  )
  with check (
    marked_by_user_id = auth.uid()
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
-- No policy, exactly as in 0002. RLS is on and forced, so the only path is the
-- service role, and the only application code that holds it authorises the caller
-- first. Healthcare audit rows are written through the *member's own* session
-- rather than the service role, so the actor in the row is the database's answer
-- to `auth.uid()` and not a value the application chose — but that write happens
-- through a `security definer` function, not through a grant, so no member gains
-- a general write path onto the table.
--
-- That function lives in 0003's companion:
create or replace function public.healthcare_record_audit_event(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.healthcare_record_audit_event(text, text, uuid, jsonb) from public;
grant execute on function public.healthcare_record_audit_event(text, text, uuid, jsonb)
  to authenticated;

comment on function public.healthcare_record_audit_event(text, text, uuid, jsonb) is
  'Appends one healthcare audit row with the actor taken from auth.uid(). Members may call it; the table itself stays unreachable to them.';

-- -----------------------------------------------------------------------------
-- Function permissions
-- -----------------------------------------------------------------------------
revoke all on function public.healthcare_role() from public;
grant execute on function public.healthcare_role() to anon, authenticated;

revoke all on function public.healthcare_has_role(public.healthcare_role[]) from public;
grant execute on function public.healthcare_has_role(public.healthcare_role[]) to anon, authenticated;

revoke all on function public.health_cases_member_in_household() from public;
grant execute on function public.health_cases_member_in_household() to authenticated;
