# Supabase Realtime Messaging Implementation Journey

## Overview
This document outlines the major issues encountered and solutions when implementing Supabase Realtime for instant messaging in the School Management System.

## Architecture
- **Backend**: NestJS inserts messages into PostgreSQL
- **Frontend**: Next.js subscribes to `postgres_changes` events via Supabase Realtime
- **Database**: PostgreSQL with RLS policies for security

---

## Major Issues & Solutions

### 1. RLS Infinite Recursion (CRITICAL BLOCKER)

**Problem:**
Realtime events were not being delivered. Supabase Realtime logs showed:
```
infinite recursion detected in policy for relation "conversation_participants"
```

**Root Cause:**
The `conversation_participants` table had a recursive RLS policy:
- Policy: "Users see participants in own conversations"
- This policy queried `conversation_participants` itself within the policy definition
- When Realtime evaluated RLS for `messages` table (which references `conversation_participants`), it caused infinite recursion

**Solution:**
Removed the recursive policy. Kept only the simple policy:
```sql
-- Keep only: "Users see own participant rows" 
-- WHERE user_id = auth.uid()
```

This is sufficient because:
- Users can see their own participant rows
- The `messages` RLS policy checks: `conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())`
- This works because users can SELECT their own rows

**Lesson:** Never create RLS policies that reference the same table recursively. Use simple, direct checks.

---

### 2. Realtime Auth Not Set

**Problem:**
Subscriptions connected successfully (`SUBSCRIBED` status) but no events were received.

**Root Cause:**
Supabase Realtime needs explicit auth token to evaluate RLS policies correctly. The client wasn't passing the JWT to the Realtime connection.

**Solution:**
Explicitly set auth before subscribing:
```typescript
const { data: { session } } = await supabase.auth.getSession();
await supabase.realtime.setAuth(session.access_token);
// Then create channels and subscribe
```

**Lesson:** Always call `supabase.realtime.setAuth(token)` before creating Realtime subscriptions when using RLS.

---

### 3. React Query Cache Not Triggering Re-renders

**Problem:**
Cache was being updated (`message count: 23` logged), but UI didn't re-render.

**Root Cause:**
- `messagesParams` object was recreated on every render → different query key reference
- `setQueriesData` updated cache but React Query didn't notify subscribers

**Solution:**
1. **Stabilize query key params:**
   ```typescript
   const messagesParams = useMemo(() => ({ page: 1, limit: 50 }), []);
   ```

2. **Invalidate after cache update:**
   ```typescript
   queryClient.setQueriesData({ predicate: ... }, updater);
   queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
   ```

**Lesson:** 
- Use `useMemo` for query key params to ensure stable references
- Call `invalidateQueries` after `setQueriesData` to trigger re-renders

---

### 4. Query Key Mismatch

**Problem:**
Cache updates weren't matching the active query.

**Root Cause:**
Using `setQueryData` with exact key didn't work because `messagesParams` object reference changed each render.

**Solution:**
Use `setQueriesData` with predicate to match all queries regardless of params:
```typescript
queryClient.setQueriesData({
  predicate: (query) => {
    const key = query.queryKey;
    return (
      Array.isArray(key) &&
      key.length >= 2 &&
      key[0] === 'conversation-messages' &&
      key[1] === conversationId
    );
  },
}, updater);
```

**Lesson:** When query keys include objects, use predicates to match queries instead of exact key matching.

---

## Implementation Checklist

### Database Setup
- [x] Tables added to `supabase_realtime` publication
- [x] `message_reads` has `REPLICA IDENTITY FULL` (for UPDATE events)
- [x] RLS policies exist and don't recurse
- [x] RLS policies allow participants to SELECT messages

### Frontend Setup
- [x] Get session before subscribing
- [x] Call `supabase.realtime.setAuth(session.access_token)` before creating channels
- [x] Subscribe to `postgres_changes` with correct filter
- [x] Update React Query cache with `setQueriesData` + predicate
- [x] Call `invalidateQueries` to trigger re-render
- [x] Use `useMemo` for query key params

### Testing
- [x] Subscription status shows `SUBSCRIBED`
- [x] Events appear in console when messages are sent
- [x] Cache updates are logged
- [x] UI re-renders with new messages

---

## Code Pattern

```typescript
// 1. Get session and set auth
const { data: { session } } = await supabase.auth.getSession();
await supabase.realtime.setAuth(session.access_token);

// 2. Create channel with postgres_changes listener
const channel = supabase
  .channel(`messages-${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    // 3. Update cache
    queryClient.setQueriesData({
      predicate: (q) => 
        q.queryKey[0] === 'conversation-messages' && 
        q.queryKey[1] === conversationId
    }, (prev) => {
      // Append new message
      return { ...prev, data: [...(prev?.data ?? []), newMessage] };
    });
    
    // 4. Trigger re-render
    queryClient.invalidateQueries({
      queryKey: ['conversation-messages', conversationId]
    });
  })
  .subscribe();
```

---

## Key Takeaways

1. **RLS Policies**: Keep them simple. Avoid recursive references.
2. **Realtime Auth**: Always set auth explicitly before subscribing.
3. **React Query**: Use predicates + `invalidateQueries` for cache updates with dynamic query keys.
4. **Query Keys**: Stabilize object references with `useMemo` to avoid cache mismatches.
5. **Debugging**: Check Supabase Realtime logs for RLS errors - they're often the root cause.

---

## Migration Applied

See: `supabase/migrations/20260217120000_enable_realtime_messaging.sql`

This migration:
- Adds tables to `supabase_realtime` publication
- Sets `REPLICA IDENTITY FULL` on `message_reads`
- Fixes RLS recursion issue on `conversation_participants`



Document includes:
Major issues & solutions:
RLS infinite recursion (critical blocker)
Realtime auth not set
React Query cache not triggering re-renders
Query key mismatch
Lessons learned:
Avoid recursive RLS policies
Always set Realtime auth explicitly
Use predicates + invalidateQueries for cache updates
Stabilize query key params with useMemo
Implementation checklist — Quick reference for future implementations
Code pattern — Reusable pattern for Realtime subscriptions
Key takeaways — Summary points for future developers/agents
The document is concise and focuses on actionable insights rather than implementation details. It should help future developers and agents avoid these issues.