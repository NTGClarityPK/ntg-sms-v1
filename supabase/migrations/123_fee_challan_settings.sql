-- Fee challan settings (branch-scoped)

create table if not exists public.fee_challan_settings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  bank_name text,
  account_title text,
  account_number text,
  bank_branch_code text,
  payment_instructions text,
  footer_notice_title text,
  footer_notice_text text,
  footer_contact_line text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_fee_challan_settings_branch on public.fee_challan_settings(branch_id);

alter table public.fee_challan_settings enable row level security;

create policy "Fee challan settings branch isolation" on public.fee_challan_settings
  for all using (
    branch_id in (select branch_id from public.user_branches where user_id = (select auth.uid()))
  );

-- updated_at trigger
create or replace function update_fee_challan_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fee_challan_settings_updated_at on public.fee_challan_settings;
create trigger fee_challan_settings_updated_at
  before update on public.fee_challan_settings
  for each row
  execute function update_fee_challan_settings_updated_at();

