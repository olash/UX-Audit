-- Migration: Add payment_source to projects and create notifications table

-- 1. Add payment_source to projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS payment_source text; -- 'monthly' or 'credits'

-- 2. Create notifications table (if not exists)
CREATE TABLE IF NOT EXISTS notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    type text NOT NULL, -- 'audit_completed', 'info', 'alert'
    title text NOT NULL,
    meta jsonb, -- structured data { website, score, etc. }
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
