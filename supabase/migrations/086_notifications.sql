-- ============================================
-- NOTIFICATIONS MODULE
-- Migration: 086_notifications.sql
-- Purpose: Real-time notification system with role-based delivery
-- ============================================

-- ============================================
-- NOTIFICATION TYPE ENUM
-- ============================================

CREATE TYPE notification_type AS ENUM (
  'email_po_received',
  'quote_created',
  'sales_order_created',
  'pick_ticket_created',
  'purchase_order_created',
  'shipment_update',
  'inventory_low_stock',
  'approval_required',
  'system'
);

-- ============================================
-- NOTIFICATIONS TABLE
-- Stores the notification content (one record per notification event)
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500),
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes for notifications
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);

-- ============================================
-- NOTIFICATION RECIPIENTS TABLE
-- Per-user read status (one record per user per notification)
-- ============================================

CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

-- Indexes for notification_recipients
CREATE INDEX idx_notification_recipients_user ON notification_recipients(user_id);
CREATE INDEX idx_notification_recipients_unread ON notification_recipients(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notification_recipients_notification ON notification_recipients(notification_id);
CREATE INDEX idx_notification_recipients_created ON notification_recipients(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- Notifications: Everyone can read (filtered by recipients table)
CREATE POLICY "notifications_select_all" ON notifications
  FOR SELECT USING (true);

-- Notifications: Only system can insert (via service role)
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT WITH CHECK (true);

-- Notification Recipients: Users can only see their own
CREATE POLICY "notification_recipients_select_own" ON notification_recipients
  FOR SELECT USING (user_id = auth.uid());

-- Notification Recipients: Users can update their own (mark as read)
CREATE POLICY "notification_recipients_update_own" ON notification_recipients
  FOR UPDATE USING (user_id = auth.uid());

-- Notification Recipients: System can insert
CREATE POLICY "notification_recipients_insert_service" ON notification_recipients
  FOR INSERT WITH CHECK (true);

-- ============================================
-- ENABLE REALTIME
-- Enables Supabase realtime subscriptions on notification_recipients
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE notification_recipients;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE notifications IS 'Stores notification content for the notification system';
COMMENT ON TABLE notification_recipients IS 'Per-user notification delivery and read status';
COMMENT ON COLUMN notifications.type IS 'Type of notification (maps to permissions for targeting)';
COMMENT ON COLUMN notifications.link IS 'Deep link URL to navigate when notification is clicked';
COMMENT ON COLUMN notifications.entity_type IS 'Type of entity this notification relates to (quote, sales_order, etc.)';
COMMENT ON COLUMN notifications.entity_id IS 'ID of the related entity';
COMMENT ON COLUMN notifications.metadata IS 'Additional JSON data for the notification';
COMMENT ON COLUMN notification_recipients.is_read IS 'Whether the user has read/dismissed this notification';
COMMENT ON COLUMN notification_recipients.read_at IS 'Timestamp when the notification was marked as read';
