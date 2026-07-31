> **Historical — removed.** Platform audit trail (`audit_logs`, `AuditLogModule`, `AuditLogsModule`, Admin Portal `/adminportal/audit-trail`) was removed from NTG Alma. This document is kept for reference only.

# Audit Trail Implementation Guide

## ✅ What's Been Completed

### 1. Database Migration
- ✅ Created `audit_logs` table with comprehensive fields
- ✅ Added indexes for efficient querying
- ✅ RLS policy: Only super admins can view audit logs

### 2. Backend Infrastructure
- ✅ `AuditLogService` - Service for logging audit events (fire-and-forget, non-blocking)
- ✅ `AuditLogsService` - Service for querying audit logs
- ✅ `AuditLogsController` - API endpoints for viewing audit logs
- ✅ `AuditLogsModule` - Registered in app.module.ts

### 3. Frontend
- ✅ Audit Trail page at `/adminportal/audit-trail`
- ✅ Added to AdminSidebar navigation
- ✅ Hook: `useAuditLogs` for fetching audit logs
- ✅ Full UI with filters, pagination, and detail modal

## 📊 API Credits Usage

**Answer: NO API Credits Consumed** ✅

- Backend uses `SUPABASE_SERVICE_KEY` (service role key)
- Service role key bypasses RLS and doesn't count against API credits
- All database queries from backend are **FREE**

## 🎯 Best Approach: Dedicated Audit Logs Table

**Why this approach?**

1. **Performance**: Single indexed table optimized for audit queries
2. **Comprehensive**: Can track CREATE, UPDATE, DELETE actions
3. **Rich Data**: Stores old/new values, changed fields, IP, user agent
4. **Easy Querying**: Filter by table, action, user, date range, etc.
5. **History Tracking**: Can track deletes (not possible with just `created_by`/`updated_by`)
6. **Non-Blocking**: Fire-and-forget logging doesn't slow down main operations

## 🔧 How to Integrate Audit Logging

### Step 1: Inject AuditLogService

Add to your service constructor:

```typescript
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class YourService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService, // Add this
  ) {}
}
```

### Step 2: Log CREATE Actions

```typescript
async createSomething(input: CreateDto, branchId: string, userEmail: string) {
  const supabase = this.supabaseConfig.getClient();
  const username = extractUsernameFromEmail(userEmail);
  
  const { data, error } = await supabase
    .from('your_table')
    .insert({
      ...fields,
      created_by: username,
      updated_by: username,
    })
    .select()
    .single();
  
  throwIfDbError(error);
  
  // Log audit event (fire-and-forget)
  void this.auditLogService.logCreate(
    'your_table',
    data.id,
    userEmail,
    data, // new values
    { branchId },
  );
  
  return data;
}
```

### Step 3: Log UPDATE Actions

```typescript
async updateSomething(id: string, input: UpdateDto, branchId: string, userEmail: string) {
  const supabase = this.supabaseConfig.getClient();
  
  // Get old values BEFORE update
  const { data: oldData } = await supabase
    .from('your_table')
    .select('*')
    .eq('id', id)
    .single();
  
  const username = extractUsernameFromEmail(userEmail);
  const updates = { ...input, updated_by: username };
  
  const { data: newData, error } = await supabase
    .from('your_table')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  throwIfDbError(error);
  
  // Calculate changed fields
  const changedFields = Object.keys(updates).filter(
    key => oldData[key] !== newData[key]
  );
  
  // Log audit event
  void this.auditLogService.logUpdate(
    'your_table',
    id,
    userEmail,
    oldData, // old values
    newData, // new values
    changedFields,
    { branchId },
  );
  
  return newData;
}
```

### Step 4: Log DELETE Actions

```typescript
async deleteSomething(id: string, branchId: string, userEmail: string) {
  const supabase = this.supabaseConfig.getClient();
  
  // Get old values BEFORE delete
  const { data: oldData } = await supabase
    .from('your_table')
    .select('*')
    .eq('id', id)
    .single();
  
  const { error } = await supabase
    .from('your_table')
    .delete()
    .eq('id', id);
  
  throwIfDbError(error);
  
  // Log audit event
  void this.auditLogService.logDelete(
    'your_table',
    id,
    userEmail,
    oldData, // old values (for recovery reference)
    { branchId },
  );
}
```

## 📝 Notes

1. **Fire-and-Forget**: Using `void` ensures logging doesn't block the main operation
2. **Error Handling**: Audit logging errors are logged but don't throw
3. **Performance**: Audit logging is async and non-blocking
4. **Optional**: You can still use `created_by`/`updated_by` fields for quick queries, but audit_logs provides comprehensive history

## 🚀 Next Steps

To complete integration, add `AuditLogService` to services that need audit logging:

1. Inject `AuditLogService` in service constructors
2. Add logging calls to create/update/delete methods
3. Make sure `AuditLogService` is provided in the module (or make it global)

## 🔐 Security

- Only super admins can view audit logs (enforced by RLS)
- Audit logs are read-only (no update/delete endpoints)
- IP address and user agent are captured for security auditing
