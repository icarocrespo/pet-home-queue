-- Run in Supabase SQL Editor. Staff sign-in accounts are created in Supabase Auth.
create extension if not exists pgcrypto;
create type public.queue_priority as enum ('URGENT','HIGH','MEDIUM','LOW');
create type public.visit_status as enum ('WAITING','CALLED','IN_SERVICE','COMPLETED','CANCELLED');
create type public.staff_role as enum ('RECEPTION','VET','ADMIN');

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null default 'RECEPTION',
  created_at timestamptz not null default now()
);
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  species text not null,
  tutor_name text,
  created_at timestamptz not null default now()
);
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  public_label text not null check (length(trim(public_label)) between 1 and 100),
  priority public.queue_priority not null default 'LOW',
  status public.visit_status not null default 'WAITING',
  arrived_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);
create index visits_queue_idx on public.visits(status,priority,arrived_at);
create table public.visit_events (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id),
  actor uuid references auth.users(id),
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.visit_events enable row level security;

create function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = (select auth.uid()));
$$;
create function public.is_vet() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = (select auth.uid()) and role in ('VET','ADMIN'));
$$;
revoke all on function public.is_staff() from public;
revoke all on function public.is_vet() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_vet() to authenticated;

create policy staff_own on public.staff_members for select to authenticated using (user_id = (select auth.uid()));
create policy staff_read_patients on public.patients for select to authenticated using ((select public.is_staff()));
create policy staff_create_patients on public.patients for insert to authenticated with check ((select public.is_staff()));
create policy staff_read_visits on public.visits for select to authenticated using ((select public.is_staff()));
create policy staff_create_visits on public.visits for insert to authenticated
  with check ((select public.is_staff()) and status = 'WAITING' and (priority = 'LOW' or (select public.is_vet())));
create policy staff_read_events on public.visit_events for select to authenticated using ((select public.is_staff()));
-- All visit changes MUST go through guarded RPCs. No direct UPDATE/DELETE RLS policies.

create function public.change_visit_priority(p_visit_id uuid, p_priority public.queue_priority, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare prior public.queue_priority;
begin
  if not public.is_vet() then raise exception 'Triage permission required'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Reason required'; end if;
  select priority into prior from public.visits where id = p_visit_id and status = 'WAITING' for update;
  if not found then raise exception 'Waiting visit not found'; end if;
  update public.visits set priority = p_priority, changed_at = now() where id = p_visit_id;
  insert into public.visit_events(visit_id,actor,action,reason)
  values (p_visit_id, auth.uid(), 'PRIORITY:' || prior::text || '->' || p_priority::text, left(p_reason, 500));
end; $$;

create function public.change_visit_status(p_visit_id uuid, p_status public.visit_status)
returns void language plpgsql security definer set search_path = '' as $$
declare prior public.visit_status;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select status into prior from public.visits where id = p_visit_id for update;
  if not found then raise exception 'Visit not found'; end if;
  if not (
    (prior = 'WAITING' and p_status in ('CALLED','CANCELLED')) or
    (prior = 'CALLED' and p_status in ('IN_SERVICE','CANCELLED')) or
    (prior = 'IN_SERVICE' and p_status = 'COMPLETED')
  ) then raise exception 'Invalid status transition'; end if;
  update public.visits set status = p_status, changed_at = now() where id = p_visit_id;
  insert into public.visit_events(visit_id,actor,action) values(p_visit_id,auth.uid(),'STATUS:' || prior::text || '->' || p_status::text);
end; $$;
revoke all on function public.change_visit_priority(uuid,public.queue_priority,text) from public;
revoke all on function public.change_visit_status(uuid,public.visit_status) from public;
grant execute on function public.change_visit_priority(uuid,public.queue_priority,text) to authenticated;
grant execute on function public.change_visit_status(uuid,public.visit_status) to authenticated;

-- Add your first staff account after creating it under Authentication > Users:
-- insert into public.staff_members(user_id,role) values ('<AUTH-USER-UUID>','ADMIN');
