-- ============================================
-- MIGRATION: 032_seed_super_admin.sql
-- PURPOSE: Create super admin role and user
-- DATE: 2026
-- ============================================

-- ============================================
-- SUPER ADMIN ROLE
-- ============================================
INSERT INTO roles (name, slug, display_name, description, level, is_system_role)
VALUES (
  'super_admin',
  'super_admin',
  'Super Admin',
  'Full system access with all permissions',
  100,
  TRUE
)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- CREATE SUPER ADMIN USER IN AUTH.USERS
-- ============================================
-- Note: Password is 'superadmin1@#4' (bcrypt hashed)

DO $$
DECLARE
  v_auth_user_id UUID;
  v_role_id UUID;
BEGIN
  -- Get the super_admin role id
  SELECT id INTO v_role_id FROM roles WHERE slug = 'super_admin';

  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'superadmin@gmail.com') THEN
    -- Generate UUID for auth user
    v_auth_user_id := gen_random_uuid();

    -- Create auth user
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      v_auth_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'superadmin@gmail.com',
      crypt('superadmin1@#4', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"first_name": "Super", "last_name": "Admin"}',
      NOW(),
      NOW(),
      '',
      ''
    );

    -- Create identity for the user
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_auth_user_id,
      'superadmin@gmail.com',
      jsonb_build_object(
        'sub', v_auth_user_id::text,
        'email', 'superadmin@gmail.com',
        'email_verified', true,
        'provider', 'email'
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Create application user
    INSERT INTO users (
      auth_user_id,
      email,
      first_name,
      last_name,
      role_id,
      status,
      email_verified_at
    ) VALUES (
      v_auth_user_id,
      'superadmin@gmail.com',
      'Super',
      'Admin',
      v_role_id,
      'active',
      NOW()
    );

    RAISE NOTICE 'Super admin user created successfully';
  ELSE
    RAISE NOTICE 'Super admin user already exists';
  END IF;
END $$;

-- ============================================
-- GRANT ALL PERMISSIONS TO SUPER ADMIN
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'super_admin'
  AND p.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO NOTHING;
