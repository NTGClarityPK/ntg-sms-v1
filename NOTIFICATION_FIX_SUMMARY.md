# Notification Feature Fix

## Issue
Notifications were showing "No new notifications" for all roles (admin, parent, class_teacher) even though notifications existed in the database.

## Root Cause
The `useNotifications` hook had a data structure mismatch. It was returning `response.data` (the array) instead of `response` (the full object with `data` and `meta`).

### Expected Flow
```typescript
Backend → { data: Notification[], meta: {...} }
Frontend Hook → { data: Notification[], meta: {...} }
Component Access → notificationsData.data (array)
```

### Actual Flow (Before Fix)
```typescript
Backend → { data: Notification[], meta: {...} }
Frontend Hook → Notification[] (just the array)
Component Access → notificationsData.data (undefined)
```

## Files Changed

### 1. `frontend/src/hooks/useNotifications.ts`
- Fixed `useNotifications`: Return `response` instead of `response.data`
- Fixed `useNotification`: Return `response` instead of `response.data`
- Fixed `useUnreadCount`: Access `response.data.data.unreadCount` correctly
- Fixed `useMarkAsRead`: Return `response` instead of `response.data`

### 2. `frontend/src/types/notifications.ts`
- Added missing notification types: `event_created`, `event_updated`, `assessment_read`, `early_departure`

### 3. `frontend/src/components/layout/NotificationDropdown.tsx`
- Updated `getTypeColor` to handle new notification types

### 4. `frontend/src/app/(portal)/notifications/page.tsx`
- Updated `getTypeColor` to handle new notification types

## Testing Checklist

### For Admin Role
- [ ] Navigate to dashboard
- [ ] Click notification bell icon
- [ ] Verify notifications appear in dropdown
- [ ] Verify unread count badge displays correct number
- [ ] Click "View All Notifications" and verify full notifications page loads
- [ ] Test marking individual notification as read
- [ ] Test "Mark all as read" functionality

### For Parent Role
- [ ] Login as parent
- [ ] Click notification bell icon
- [ ] Verify attendance notifications appear
- [ ] Verify leave request notifications appear
- [ ] Click on attendance notification and verify navigation to attendance page
- [ ] Verify notification is marked as read after clicking

### For Class Teacher Role
- [ ] Login as class teacher
- [ ] Click notification bell icon
- [ ] Verify event notifications appear
- [ ] Verify assessment notifications appear
- [ ] Navigate to full notifications page
- [ ] Verify all notification types display with correct colors:
  - Attendance: Info color (blue)
  - Leave/Early Departure: Warning color (yellow/orange)
  - Grade/Assessment: Success color (green)
  - Event: Primary color

### For Student Role
- [ ] Login as student
- [ ] Verify notifications work similar to other roles

## Database Verification

Run this query to verify notifications exist:
```sql
SELECT 
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
  type,
  COUNT(*) as count_by_type
FROM notifications
GROUP BY type
ORDER BY count_by_type DESC;
```

Expected: Should show various notification types including:
- attendance
- event_created
- event_updated
- assessment_read
- early_departure
- leave

## API Testing

Test the API endpoints directly:

```bash
# Get all notifications
GET /api/v1/notifications?limit=20

# Get unread count
GET /api/v1/notifications/unread-count

# Mark as read
PUT /api/v1/notifications/{id}/read

# Mark all as read
PUT /api/v1/notifications/read-all
```

Expected Response Format:
```json
{
  "data": [
    {
      "id": "...",
      "userId": "...",
      "type": "event_created",
      "title": "New Event: Sports Week",
      "body": "...",
      "data": {},
      "isRead": false,
      "createdAt": "2026-02-09T04:38:29.867Z"
    }
  ],
  "meta": {
    "total": 112,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

## Known Notification Types in Database

Based on database query, the following types are currently in use:
- `attendance` - When student attendance is marked
- `event_created` - When a new event is created
- `event_updated` - When an event is updated
- `assessment_read` - When assessment is viewed/read
- `leave` - Leave request notifications
- `early_departure` - Early departure request notifications

## Next Steps

If notifications still don't work:
1. Check browser console for errors
2. Check Network tab for API response format
3. Verify user authentication is working (JWT token in headers)
4. Check RLS policies on `notifications` table in Supabase
5. Verify `currentBranchId` is set in localStorage

