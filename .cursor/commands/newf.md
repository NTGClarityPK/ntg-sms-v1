We are going to implement new feature. 
Ensure you are familiar with cursor rules. 
Read overallcontext.md if you want to see the entire scope in short way.
Read implemnted.md to see what is already implemented.  
Read scope.md only IF you want to read entire scope for better context. 
Read mistakes.md to avoid mistakes in future. 
Remember we have centralized styling system so whenver building any frontend, do styling from there. (read frontend.mdc rule file for further context)


- **Multi-tenancy context**: Prompt 2 introduced `public.tenants` and `branches.tenant_id`. All new data must be isolated per **tenant and branch** by:
  - Always taking `branch_id` from `BranchGuard` (which already validates that the branch belongs to the current tenant via `branches.tenant_id` and `user_branches`).
  - Ensuring every new table is either directly keyed by `branch_id`, or references another table that is branch- and tenant-scoped (e.g. `students.branch_id`).
  - Writing RLS policies that never allow access across tenants, typically by checking membership via `user_branches` → `branches.tenant_id`.


Let's implment a new feature... read more instructions from chat:
