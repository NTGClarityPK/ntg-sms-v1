-- When adding a class at a given sort_order position, shift existing classes
-- so that all rows with sort_order >= p_from_position get sort_order + 1.
CREATE OR REPLACE FUNCTION public.shift_class_sort_orders(p_branch_id uuid, p_from_position int)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.classes
  SET sort_order = sort_order + 1
  WHERE branch_id = p_branch_id AND sort_order >= p_from_position;
$$;

COMMENT ON FUNCTION public.shift_class_sort_orders(uuid, int) IS
  'Increments sort_order by 1 for all classes in the branch with sort_order >= p_from_position. Call before inserting a new class at that position.';
