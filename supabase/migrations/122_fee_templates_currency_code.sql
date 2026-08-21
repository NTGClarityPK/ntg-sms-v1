-- Add currency support for fee templates
-- Default to PKR for existing records

alter table public.fee_templates
add column if not exists currency_code text not null default 'PKR';

alter table public.fee_templates
drop constraint if exists fee_templates_currency_code_check;

alter table public.fee_templates
add constraint fee_templates_currency_code_check
check (currency_code in ('PKR', 'IQD', 'SAR', 'USD'));

