alter table public.surf_booking_requests
  add column if not exists status text not null default 'pending_operator',
  add column if not exists internal_notes text not null default '',
  add column if not exists admin_revision integer not null default 0;

update public.surf_booking_requests set status = 'pending_operator' where status is null;

alter table public.surf_booking_requests
  alter column status set default 'pending_operator',
  alter column status set not null,
  enable row level security;

revoke all on table public.surf_booking_requests from anon, authenticated, public;
grant select, insert, update on table public.surf_booking_requests to service_role;

create index if not exists surf_booking_requests_inbox_idx
  on public.surf_booking_requests (created_at desc, id desc);
create index if not exists surf_booking_requests_status_inbox_idx
  on public.surf_booking_requests (status, created_at desc, id desc);
