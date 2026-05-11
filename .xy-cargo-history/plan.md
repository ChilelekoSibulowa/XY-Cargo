## Notification System Plan

### 1. Database: Create `notifications` table
- Store in-app notifications for the bell icon
- Fields: user_id, title, message, type, is_read, related_entity_id, created_at
- RLS: users see only their own notifications

### 2. Edge Function: `send-notification`
- Accepts: customer_id, event_type, shipment_code, message
- Looks up customer's email and phone
- Sends email via Resend API (branded as XY Cargo Zambia)
- Sends SMS via Zamtel (existing send-sms function)
- Inserts into notifications table for bell icon

### 3. Frontend Integration - Trigger notifications on these events:
| Event | SMS | Email | Bell |
|-------|-----|-------|------|
| Account creation (welcome) | ✅ | ✅ | ✅ |
| Status → Incoming | ✅ | ✅ | ✅ |
| Status → Need Action (Arrived) | ✅ | ✅ | ✅ |
| Consolidated | ✅ | ✅ | ✅ |
| Confirmed → Outgoing | ✅ | ✅ | ✅ |
| Outgoing → In Transit | ✅ | ✅ | ✅ |
| In Transit bulk update | ✅ | ✅ | ✅ |
| Ready for Collection | ✅ | ✅ | ✅ |
| Collected | ✅ | ✅ | ✅ |
| Payment received | ✅ | ✅ | ✅ |

### 4. Notification Bell Component
- Add bell icon to TopBar with unread count badge
- Dropdown showing recent notifications
- Mark as read functionality

### Implementation Order:
1. Create notifications table (migration)
2. Create send-notification edge function
3. Add notification bell UI to TopBar
4. Integrate notification triggers into existing status update flows
