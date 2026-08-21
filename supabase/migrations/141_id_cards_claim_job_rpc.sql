-- Claim next ID card generation job (SKIP LOCKED for multi-instance safety)

create or replace function public.claim_next_id_card_generation_job(worker_id text)
returns public.id_card_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.id_card_generation_jobs;
begin
  select * into v_job
  from public.id_card_generation_jobs
  where status = 'queued'
  order by created_at asc
  limit 1
  for update skip locked;

  if v_job.id is null then
    return null;
  end if;

  update public.id_card_generation_jobs
  set status = 'in_progress',
      updated_at = now()
  where id = v_job.id;

  select * into v_job from public.id_card_generation_jobs where id = v_job.id;
  return v_job;
end;
$$;
