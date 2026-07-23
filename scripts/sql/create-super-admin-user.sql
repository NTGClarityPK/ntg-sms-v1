-- ============================================
-- Create Super Admin User
-- ============================================
-- This script creates a super admin user
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Create the user via Supabase Dashboard first:
-- 1. Go to Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Enter email: mshaheeruddin@superuser.com
-- 4. Enter password: NtgC_2025
-- 5. Check "Auto Confirm User"
-- 6. Click "Create user"
--
-- Then run the SQL below (it will automatically find the user by email)
-- ============================================

DO $$
DECLARE
  v_user_id UUID;
  v_branch_id UUID;
  v_role_id UUID;
BEGIN
  -- Find the user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'mshaheeruddin@superuser.com';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email mshaheeruddin@superuser.com not found. Please create the user via Supabase Dashboard first.';
  END IF;
  
  -- Create or update profile
  INSERT INTO public.profiles (id, full_name, is_active)
  VALUES (v_user_id, 'Super Admin', true)
  ON CONFLICT (id) DO UPDATE SET full_name = 'Super Admin';
  
  -- Get any existing branch (super admin needs a branch for user_branches and user_roles)
  SELECT id INTO v_branch_id FROM public.branches LIMIT 1;
  
  -- If no branch exists, create a system branch
  IF v_branch_id IS NULL THEN
    INSERT INTO public.branches (tenant_id, name, code, is_active)
    VALUES (NULL, 'System Branch', 'SYS001', true)
    RETURNING id INTO v_branch_id;
  END IF;
  
  -- Assign to branch
  INSERT INTO public.user_branches (user_id, branch_id, is_primary)
  VALUES (v_user_id, v_branch_id, true)
  ON CONFLICT (user_id, branch_id) DO NOTHING;
  
  -- Get super_admin role ID
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'super_admin';
  
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'super_admin role not found. Please run the migration to add super_admin role first.';
  END IF;
  
  -- Assign Super Admin role
  INSERT INTO public.user_roles (user_id, role_id, branch_id)
  VALUES (v_user_id, v_role_id, v_branch_id)
  ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;
  
  RAISE NOTICE 'Super admin user created successfully!';
END $$;

-- Verify the setup
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  b.name as branch_name,
  r.display_name as role,
  r.name as role_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_branches ub ON ub.user_id = u.id
LEFT JOIN public.branches b ON b.id = ub.branch_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.branch_id = ub.branch_id
LEFT JOIN public.roles r ON r.id = ur.role_id
WHERE u.email = 'mshaheeruddin@superuser.com';
