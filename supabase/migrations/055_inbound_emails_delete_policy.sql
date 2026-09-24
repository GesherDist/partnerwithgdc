-- ============================================
-- MIGRATION: 055_inbound_emails_delete_policy.sql
-- PURPOSE: Add DELETE policy for inbound emails
-- ============================================

-- Allow authenticated users with quotes permission to delete emails
CREATE POLICY inbound_emails_delete ON inbound_emails
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('quotes.create', 'quotes.delete')
        AND u.deleted_at IS NULL
    )
  );

-- Allow deleting attachments when email is deleted (cascade handles this too)
CREATE POLICY inbound_email_attachments_delete ON inbound_email_attachments
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name IN ('quotes.create', 'quotes.delete')
        AND u.deleted_at IS NULL
    )
  );
