-- Patch commit_setup_wizard to persist is_term_examination from wizard payload (idempotent).
DO $patch$
DECLARE
  fdef text;
  old_snip text := $old$
  -- Assessment types
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'assessment'->'assessmentTypes','[]'::jsonb)) loop
    v_name := trim(coalesce(v_item->>'name',''));
    if v_name = '' then
      raise exception 'Assessment type name is required';
    end if;

    insert into public.assessment_types (name, name_ar, sort_order, is_active, tenant_id, branch_id, created_by, updated_by)
    values (
      v_name,
      nullif(trim(coalesce(v_item->>'nameAr','')), ''),
      coalesce((v_item->>'sortOrder')::int, 0),
      true,
      p_tenant_id,
      p_branch_id,
      p_user_email,
      p_user_email
    )
    on conflict (branch_id, name)
    do update set
      name_ar = excluded.name_ar,
      sort_order = excluded.sort_order,
      updated_at = now(),
      updated_by = p_user_email;
  end loop;
$old$;
  new_snip text := $new$
  -- Assessment types
  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'assessment'->'assessmentTypes','[]'::jsonb)) loop
    v_name := trim(coalesce(v_item->>'name',''));
    if v_name = '' then
      raise exception 'Assessment type name is required';
    end if;

    insert into public.assessment_types (name, name_ar, sort_order, is_active, is_term_examination, tenant_id, branch_id, created_by, updated_by)
    values (
      v_name,
      nullif(trim(coalesce(v_item->>'nameAr','')), ''),
      coalesce((v_item->>'sortOrder')::int, 0),
      true,
      coalesce((v_item->>'isTermExamination')::boolean, false),
      p_tenant_id,
      p_branch_id,
      p_user_email,
      p_user_email
    )
    on conflict (branch_id, name)
    do update set
      name_ar = excluded.name_ar,
      sort_order = excluded.sort_order,
      is_term_examination = excluded.is_term_examination,
      updated_at = now(),
      updated_by = p_user_email;
  end loop;
$new$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO fdef FROM pg_proc WHERE proname = 'commit_setup_wizard' LIMIT 1;
  IF fdef IS NULL THEN
    RAISE NOTICE 'commit_setup_wizard not found; skipping patch';
    RETURN;
  END IF;
  IF position(old_snip IN fdef) > 0 THEN
    EXECUTE replace(fdef, old_snip, new_snip);
  ELSE
    RAISE NOTICE 'commit_setup_wizard already includes term examination handling; skipping';
  END IF;
END
$patch$;
