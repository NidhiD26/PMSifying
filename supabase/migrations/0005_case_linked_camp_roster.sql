-- Healthcare camp recommendations and registrations refer to a household member
-- and their case. Existing member self-signups remain supported through user_id.
create unique index if not exists health_cases_case_member_unique
  on public.health_cases(id, household_member_id);

alter table public.camp_registrations
  alter column user_id drop not null,
  add column if not exists case_id uuid,
  add column if not exists household_member_id uuid,
  add column if not exists registration_status text not null default 'REGISTERED',
  add column if not exists recommendation_source text,
  add column if not exists recommendation_reason text,
  add column if not exists recommended_by_doctor_id uuid references public.doctor_profiles(user_id) on delete restrict,
  add column if not exists recommended_at timestamptz,
  add column if not exists registered_by_user_id uuid references auth.users(id) on delete set null;

alter table public.camp_registrations
  add constraint camp_registrations_status_check
    check (registration_status in ('RECOMMENDED', 'REGISTERED', 'CANCELLED')),
  add constraint camp_registrations_recommendation_source_check
    check (recommendation_source is null or recommendation_source = 'DOCTOR'),
  add constraint camp_registrations_patient_identity_check
    check (
      (user_id is not null and case_id is null and household_member_id is null and recommendation_source is null)
      or
      (user_id is null and case_id is not null and household_member_id is not null
        and recommendation_source = 'DOCTOR' and recommended_by_doctor_id is not null)
    ),
  add constraint camp_registrations_registration_time_check
    check ((registration_status = 'RECOMMENDED' and registered_at is null)
      or (registration_status <> 'RECOMMENDED' and registered_at is not null)),
  add constraint camp_registrations_case_member_fk
    foreign key (case_id, household_member_id)
    references public.health_cases(id, household_member_id) on delete cascade;

create unique index if not exists camp_registrations_one_case_per_camp_idx
  on public.camp_registrations(camp_id, case_id) where case_id is not null;
create index if not exists camp_registrations_case_idx
  on public.camp_registrations(case_id) where case_id is not null;

-- Capacity applies when a recommendation becomes a confirmed registration, not
-- while a doctor is deciding whether the patient should attend.
create or replace function public.camp_registrations_within_capacity()
returns trigger language plpgsql security invoker set search_path = public as $$
declare seats integer; taken integer;
begin
  if new.registration_status <> 'REGISTERED' then return new; end if;
  if tg_op = 'UPDATE' and old.registration_status = 'REGISTERED' then return new; end if;
  select capacity into seats from public.health_camps where id = new.camp_id for update;
  select count(*) into taken from public.camp_registrations
    where camp_id = new.camp_id and registration_status = 'REGISTERED';
  if taken >= seats then raise exception 'camp_at_capacity' using errcode = '23514'; end if;
  return new;
end;
$$;
drop trigger if exists camp_registrations_within_capacity on public.camp_registrations;
create trigger camp_registrations_within_capacity
  before insert or update of registration_status on public.camp_registrations
  for each row execute function public.camp_registrations_within_capacity();

-- Tie the roster row to the exact member on the exact case and keep case identity
-- immutable after the recommendation has been made.
create or replace function public.healthcare_validate_camp_registration()
returns trigger language plpgsql security invoker set search_path = public as $$
declare linked_member uuid; camp_state public.health_camp_status;
begin
  if new.case_id is not null then
    select household_member_id into linked_member from public.health_cases where id = new.case_id;
    if linked_member is null or linked_member <> new.household_member_id then
      raise exception 'camp_case_member_mismatch' using errcode = '23514';
    end if;
    select status into camp_state from public.health_camps where id = new.camp_id;
    if camp_state <> 'PUBLISHED' then raise exception 'camp_not_open' using errcode = '23514'; end if;
    if tg_op = 'UPDATE' and (new.case_id <> old.case_id or new.household_member_id <> old.household_member_id
      or new.camp_id <> old.camp_id or new.recommended_by_doctor_id <> old.recommended_by_doctor_id) then
      raise exception 'camp_registration_identity_immutable' using errcode = '23514';
    end if;
  end if;
  if new.registration_status = 'REGISTERED' and new.registered_at is null then new.registered_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists healthcare_validate_camp_registration on public.camp_registrations;
create trigger healthcare_validate_camp_registration
  before insert or update on public.camp_registrations
  for each row execute function public.healthcare_validate_camp_registration();

grant update on public.camp_registrations to authenticated;

drop policy if exists camp_registrations_select_own on public.camp_registrations;
create policy camp_registrations_select_own on public.camp_registrations for select to authenticated
  using (user_id = auth.uid());
drop policy if exists camp_registrations_select_staff on public.camp_registrations;
create policy camp_registrations_select_staff on public.camp_registrations for select to authenticated
  using (
    exists (select 1 from public.health_camps c where c.id = camp_id and c.organizer_user_id = auth.uid())
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[])
  );

drop policy if exists camp_registrations_insert_own on public.camp_registrations;
create policy camp_registrations_insert_own on public.camp_registrations for insert to authenticated
  with check (
    (user_id = auth.uid() and case_id is null and registration_status = 'REGISTERED'
      and exists (select 1 from public.health_camps c where c.id = camp_id and c.status = 'PUBLISHED'))
    or
    (user_id is null and registration_status = 'RECOMMENDED' and registered_at is null
      and recommendation_source = 'DOCTOR' and recommended_by_doctor_id = auth.uid()
      and public.healthcare_has_role(array['DOCTOR']::public.healthcare_role[])
      and exists (select 1 from public.health_cases hc where hc.id = camp_registrations.case_id
        and hc.household_member_id = camp_registrations.household_member_id and hc.assigned_doctor_id = auth.uid())
      and exists (select 1 from public.health_camps c where c.id = camp_id and c.status = 'PUBLISHED'))
  );

drop policy if exists camp_registrations_register_recommended on public.camp_registrations;
create policy camp_registrations_register_recommended on public.camp_registrations for update to authenticated
  using (registration_status = 'RECOMMENDED' and case_id is not null and (public.healthcare_has_role(array['ADMIN']::public.healthcare_role[]) or exists (
    select 1 from public.health_camps c where c.id = camp_id and c.organizer_user_id = auth.uid())))
  with check (registration_status = 'REGISTERED' and registered_by_user_id = auth.uid()
    and user_id is null and case_id is not null);

-- A camp organiser may see and manage its roster; doctors and ASHAs can see rows
-- only when the case itself is already within their scope.
drop policy if exists camp_registrations_select_case_team on public.camp_registrations;
create policy camp_registrations_select_case_team on public.camp_registrations for select to authenticated
  using (exists (select 1 from public.health_cases hc join public.households h on h.id = hc.household_id
    where hc.id = camp_registrations.case_id and (hc.assigned_doctor_id = auth.uid() or h.assigned_asha_id = auth.uid())));

create or replace function public.healthcare_camp_organizer_for_case(p_case_id uuid)
returns boolean language sql stable security definer set search_path = public set row_security = off as $$
  select exists (select 1 from public.camp_registrations cr join public.health_camps c on c.id = cr.camp_id
    where cr.case_id = p_case_id and c.organizer_user_id = auth.uid() and cr.registration_status <> 'CANCELLED')
    or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[]);
$$;
revoke all on function public.healthcare_camp_organizer_for_case(uuid) from public;
grant execute on function public.healthcare_camp_organizer_for_case(uuid) to authenticated;

drop policy if exists health_cases_select_camp_roster on public.health_cases;
create policy health_cases_select_camp_roster on public.health_cases for select to authenticated
  using (public.healthcare_camp_organizer_for_case(id));
drop policy if exists household_members_select_camp_roster on public.household_members;
create policy household_members_select_camp_roster on public.household_members for select to authenticated
  using (exists (select 1 from public.health_cases hc where hc.household_member_id = id
    and public.healthcare_camp_organizer_for_case(hc.id)));

drop policy if exists camp_attendance_insert_registered on public.camp_attendance;
create policy camp_attendance_insert_registered on public.camp_attendance for insert to authenticated
  with check (status = 'REGISTERED' and marked_by_user_id is null and marked_at is null and exists (
    select 1 from public.camp_registrations cr where cr.id = camp_attendance.registration_id and cr.camp_id = camp_attendance.camp_id
      and cr.registration_status = 'REGISTERED'
      and (cr.user_id = auth.uid() or public.healthcare_has_role(array['ADMIN']::public.healthcare_role[]) or exists (select 1 from public.health_camps c where c.id = camp_attendance.camp_id and c.organizer_user_id = auth.uid()))));

create or replace function public.healthcare_register_recommended_patient(p_registration_id uuid, p_registered_by_user_id uuid)
returns public.camp_registrations
language plpgsql security invoker set search_path = public as $$
declare result public.camp_registrations;
begin
  if p_registered_by_user_id is distinct from auth.uid() then
    raise exception 'registration_actor_mismatch' using errcode = '42501';
  end if;
  update public.camp_registrations
    set registration_status = 'REGISTERED', registered_by_user_id = p_registered_by_user_id, registered_at = now()
    where id = p_registration_id and registration_status = 'RECOMMENDED'
    returning * into result;
  if not found then raise exception 'camp_recommendation_unavailable' using errcode = 'P0002'; end if;
  insert into public.camp_attendance(camp_id, registration_id, status)
    values (result.camp_id, result.id, 'REGISTERED');
  return result;
end;
$$;
revoke all on function public.healthcare_register_recommended_patient(uuid, uuid) from public;
grant execute on function public.healthcare_register_recommended_patient(uuid, uuid) to authenticated;
