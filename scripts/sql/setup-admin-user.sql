-- ============================================
-- Setup Admin User Script
-- ============================================
-- This script helps you create your first admin user
-- Run this in Supabase SQL Editor after creating a user via Dashboard
-- ============================================

-- STEP 1: Create a tenant (if you don't have one)
-- Replace 'Your School Name' with your actual school name
INSERT INTO public.tenants (name, code, is_active)
VALUES ('Your School Name', 'SCHOOL001', true)
ON CONFLICT (code) DO NOTHING
RETURNING id, name;

-- STEP 2: Get your tenant ID (run this separately to see the ID)
-- SELECT id, name FROM public.tenants WHERE code = 'SCHOOL001';

-- STEP 3: Create a branch (replace TENANT_ID_HERE with the tenant ID from step 2)
-- INSERT INTO public.branches (tenant_id, name, code, is_active)
-- VALUES (
--   'TENANT_ID_HERE',  -- Replace with actual tenant ID
--   'Main Branch',
--   'MAIN001',
--   true
-- )
-- RETURNING id, name;

-- STEP 4: Get your branch ID (run this separately to see the ID)
-- SELECT id, name FROM public.branches WHERE code = 'MAIN001';

-- ============================================
-- STEP 5: Create Admin User
-- ============================================
-- First, create the user via Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Enter email: admin@school.com (or your choice)
-- 4. Enter password
-- 5. Check "Auto Confirm User"
-- 6. Click "Create user"
-- 7. Copy the User ID (UUID)
--
-- Then run the SQL below, replacing:
-- - USER_ID_HERE with the UUID from step 7
-- - BRANCH_ID_HERE with the branch ID from step 4
-- ============================================

-- Replace these values:
-- USER_ID_HERE: UUID from Supabase Auth user you just created
-- BRANCH_ID_HERE: UUID from your branch (step 4)

-- Create profile
INSERT INTO public.profiles (id, full_name, is_active)
VALUES (
  'USER_ID_HERE',  -- Replace with actual user UUID
  'School Admin',
  true
)
ON CONFLICT (id) DO UPDATE SET full_name = 'School Admin';

-- Assign to branch
INSERT INTO public.user_branches (user_id, branch_id, is_primary)
VALUES (
  'USER_ID_HERE',  -- Replace with actual user UUID
  'BRANCH_ID_HERE',  -- Replace with actual branch UUID
  true
)
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- Assign School Admin role
INSERT INTO public.user_roles (user_id, role_id, branch_id)
SELECT 
  'USER_ID_HERE',  -- Replace with actual user UUID
  r.id,
  'BRANCH_ID_HERE'  -- Replace with actual branch UUID
FROM public.roles r
WHERE r.name = 'school_admin'
ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;

-- Verify the setup
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  b.name as branch_name,
  r.display_name as role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.user_branches ub ON ub.user_id = u.id
JOIN public.branches b ON b.id = ub.branch_id
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.branch_id = b.id
JOIN public.roles r ON r.id = ur.role_id
WHERE u.id = 'USER_ID_HERE';  -- Replace with actual user UUID

