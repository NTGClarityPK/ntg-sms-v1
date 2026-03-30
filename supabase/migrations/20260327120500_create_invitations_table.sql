-- Invitations used for password setup links sent via Mailjet.
-- created_by is UUID referencing auth.users(id) per requirements.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  invitation_type text not null check (invitation_type in ('student', 'parent')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz null
);

create unique index if not exists invitations_token_key on public.invitations(token);
create index if not exists invitations_user_id_idx on public.invitations(user_id);
create index if not exists invitations_created_by_created_at_idx on public.invitations(created_by, created_at);
create index if not exists invitations_expires_at_idx on public.invitations(expires_at);

