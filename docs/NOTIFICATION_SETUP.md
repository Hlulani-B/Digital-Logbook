# Notification System Setup Guide

## Overview

The notification system sends due-date reminders via:

1. **In-app notifications** (bell icon in navbar)
2. **Email notifications** (via Brevo)
3. **Browser toast notifications** (when permission granted)

---

## Step 1: Verify Database Migrations

### Check if migrations are applied

Run these queries in **Supabase SQL Editor**:

```sql
-- Check if notifications table exists
SELECT COUNT(*) FROM public.notifications;

-- Check if the generator function exists
SELECT proname FROM pg_proc WHERE proname = 'generate_due_notifications';

-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check if pg_cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'due-notification-cycle';
```

### If migrations are NOT applied

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run these migrations in order:
   - `supabase/migrations/011_create_notifications.sql`
   - `supabase/migrations/013_notification_enhancements.sql`
   - `supabase/migrations/014_keep_completed_notifications.sql`
   - `supabase/migrations/021_timer_abandonment_notifications.sql`

3. After running, verify the cron job:

```sql
-- Manually schedule if pg_cron is enabled but job doesn't exist
SELECT cron.schedule(
  'due-notification-cycle',
  '7 * * * *',
  'SELECT public.run_due_notification_cycle();'
);
```

---

## Step 2: Configure Brevo (Email Service)

### 2.1 Create Brevo Account

1. Go to [Brevo](https://app.brevo.com/) and sign up (free tier: 300 emails/day)
2. Verify your sender email address

### 2.2 Get API Key

1. In Brevo dashboard, go to **SMTP & API** → **API Keys** tab
2. Click **Create a new API key**
3. Copy the key (starts with `xkeysib-...`)

### 2.3 Add to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **project-service**
3. Go to **Environment** tab
4. Add these variables:
   - `BREVO_API_KEY` = `xkeysib-your-key-here`
   - `BREVO_SENDER_EMAIL` = `your-verified-email@example.com`
5. Click **Save Changes**
6. Service will auto-redeploy

---

## Step 3: Verify Notification Flow

### 3.1 Test In-App Notifications

1. Create an entry with a due date in the next 24 hours
2. Wait up to 1 hour for the cron job to run (or run manually):

```sql
SELECT public.generate_due_notifications();
```

3. Check the bell icon in the navbar - should show unread count
4. Click bell to see notification

### 3.2 Test Email Notifications

1. Ensure user has email notifications enabled:

```sql
-- Check user preference
SELECT email, email_notifications FROM public.users
WHERE email = 'your-email@example.com';

-- Enable if needed
UPDATE public.users
SET email_notifications = true
WHERE email = 'your-email@example.com';
```

2. Create a due entry and wait for:
   - Cron job to generate notification (hourly at :07)
   - Email flush to send via Brevo (triggered by bell poll or cron)

3. Check email inbox (and spam folder)

### 3.3 Test Browser Notifications

1. Click the bell icon
2. Browser should ask for notification permission
3. Allow notifications
4. New notifications will show as browser toasts

---

## Step 4: User Settings

Users can configure notifications in **Settings Panel**:

- **Email notifications**: Toggle ON/OFF
- **Notification lead time**: 1h, 24h, 48h, 1 week
- **Timer abandonment notifications**: Toggle ON/OFF

---

## Troubleshooting

### No notifications appearing

```sql
-- Check if entries have due dates
SELECT id, project_name, summary, due_date, status
FROM public.entries
WHERE due_date IS NOT NULL
  AND status <> 'done_and_dusted'
  AND user_email = 'your-email@example.com';

-- Manually generate notifications
SELECT public.generate_due_notifications();

-- Check generated notifications
SELECT * FROM public.notifications
WHERE user_email = 'your-email@example.com'
ORDER BY created_at DESC;
```

### Emails not sending

1. Check Brevo configuration in Render
2. Check project-service logs in Render:

```
[sendPendingEmails] sent=X skipped=Y
```

3. Verify Brevo API key is valid
4. Check Brevo dashboard for delivery logs

### Cron job not running

```sql
-- Check if pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check scheduled jobs
SELECT * FROM cron.job;

-- Check job run history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'due-notification-cycle')
ORDER BY start_time DESC LIMIT 10;
```

---

## Architecture

```
┌─────────────────┐
│   pg_cron       │ (hourly at :07)
│   job           │
└────────┬────────┘
         │
         ▼
┌─────────────────────────
│ generate_due_notifications() │
│ - Creates notification rows  │
│ - Based on due dates         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ run_due_notification_cycle()│
│ - Calls generator           │
│ - Pokes project-service     │
│   via pg_net HTTP           │
────────┬────────────────────┘
         │
         ▼
┌─────────────────────────
│ project-service         │
│ /service/notifications  │
│ - Fetches pending rows  │
│ - Sends via Brevo API   │
│ - Marks emailed = true  │
└─────────────────────────┘
         │
         ▼
─────────────────────────┐
│ Brevo API               │
│ - Sends transactional   │
│   emails to users       │
└─────────────────────────┘

Frontend polls every 60s:
- Fetches notifications
- Shows bell badge
- Displays browser toasts
```

---

## Environment Variables

### project-service (Render)

| Variable             | Description           | Example                  |
| -------------------- | --------------------- | ------------------------ |
| `BREVO_API_KEY`      | Brevo API key         | `xkeysib-abc123...`      |
| `BREVO_SENDER_EMAIL` | Verified sender email | `noreply@yourdomain.com` |

### Frontend (Vite)

| Variable                   | Description         | Example                                    |
| -------------------------- | ------------------- | ------------------------------------------ |
| `VITE_PROJECT_SERVICE_URL` | Project service URL | `https://project-service-xxx.onrender.com` |

---

## Migration History

| Migration | Purpose                                 |
| --------- | --------------------------------------- |
| 011       | Initial notifications table + generator |
| 013       | Snooze, dismiss, lead time              |
| 014       | Keep completed notifications            |
| 021       | Timer abandonment notifications         |
