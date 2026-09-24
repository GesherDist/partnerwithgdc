# Database Documentation

## Overview

Gesher Distribution uses PostgreSQL (via Supabase) as the database with Prisma as the ORM.

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    USERS                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ auth_user_id     │ UUID      │ Supabase Auth reference (unique)                 │
│ email            │ CITEXT    │ Email address (unique)                           │
│ first_name       │ VARCHAR   │ First name                                       │
│ last_name        │ VARCHAR   │ Last name                                        │
│ phone            │ VARCHAR   │ Phone number                                     │
│ avatar_url       │ TEXT      │ Profile image URL                                │
│ role_id (FK)     │ UUID      │ References roles.id                              │
│ status           │ ENUM      │ active/inactive/suspended/pending                │
│ last_login_at    │ TIMESTAMP │ Last login timestamp                             │
│ login_count      │ INTEGER   │ Total successful logins                          │
│ ...audit fields  │           │ created_at, updated_at, created_by, etc.         │
└────────┬────────────────────────────────────────────────────────────────────────┘
         │
         │ role_id
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    ROLES                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ name             │ VARCHAR   │ Role name (unique)                               │
│ slug             │ VARCHAR   │ URL-safe identifier (unique)                     │
│ display_name     │ VARCHAR   │ Human-readable name                              │
│ description      │ TEXT      │ Role description                                 │
│ level            │ INTEGER   │ Hierarchy level (0-100)                          │
│ is_system        │ BOOLEAN   │ System role flag (cannot delete)                 │
│ ...audit fields  │           │                                                  │
└────────┬────────────────────────────────────────────────────────────────────────┘
         │
         │ role_id
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ROLE_PERMISSIONS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ role_id (FK)     │ UUID      │ References roles.id                              │
│ permission_id(FK)│ UUID      │ References permissions.id                        │
│ created_at       │ TIMESTAMP │ Creation timestamp                               │
│ created_by (FK)  │ UUID      │ References users.id                              │
└────────┬────────────────────────────────────────────────────────────────────────┘
         │
         │ permission_id
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 PERMISSIONS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ name             │ VARCHAR   │ Permission name (module.action format)           │
│ display_name     │ VARCHAR   │ Human-readable name                              │
│ description      │ TEXT      │ Permission description                           │
│ module           │ VARCHAR   │ Module name                                      │
│ action           │ VARCHAR   │ Action type                                      │
│ category         │ VARCHAR   │ Grouping category                                │
│ ...audit fields  │           │                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                               USER_SESSIONS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ user_id (FK)     │ UUID      │ References users.id                              │
│ refresh_token_hash│ VARCHAR  │ Hashed refresh token                             │
│ ip_address       │ INET      │ Client IP                                        │
│ user_agent       │ TEXT      │ Browser user agent                               │
│ device_type      │ VARCHAR   │ Device type                                      │
│ expires_at       │ TIMESTAMP │ Session expiration                               │
│ last_active_at   │ TIMESTAMP │ Last activity                                    │
│ revoked_at       │ TIMESTAMP │ Revocation timestamp                             │
│ revoked_reason   │ VARCHAR   │ Revocation reason                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                AUDIT_LOGS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ user_id (FK)     │ UUID      │ References users.id                              │
│ user_email       │ VARCHAR   │ Snapshot of user email                           │
│ user_name        │ VARCHAR   │ Snapshot of user name                            │
│ action           │ ENUM      │ Action type                                      │
│ module           │ VARCHAR   │ Module name                                      │
│ description      │ TEXT      │ Action description                               │
│ entity_type      │ VARCHAR   │ Affected entity type                             │
│ entity_id        │ UUID      │ Affected entity ID                               │
│ old_data         │ JSONB     │ State before change                              │
│ new_data         │ JSONB     │ State after change                               │
│ changes          │ JSONB     │ Computed diff                                    │
│ ip_address       │ INET      │ Client IP                                        │
│ user_agent       │ TEXT      │ Browser user agent                               │
│ metadata         │ JSONB     │ Additional context                               │
│ created_at       │ TIMESTAMP │ Immutable timestamp                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                ATTACHMENTS                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ id (PK)          │ UUID      │ Primary key                                      │
│ entity_type      │ VARCHAR   │ Parent entity type                               │
│ entity_id        │ UUID      │ Parent entity ID                                 │
│ file_name        │ VARCHAR   │ Stored file name                                 │
│ original_name    │ VARCHAR   │ Original upload name                             │
│ file_path        │ TEXT      │ Storage path                                     │
│ file_size        │ BIGINT    │ Size in bytes                                    │
│ mime_type        │ VARCHAR   │ MIME type                                        │
│ category         │ VARCHAR   │ File category                                    │
│ description      │ TEXT      │ File description                                 │
│ storage_bucket   │ VARCHAR   │ Supabase bucket                                  │
│ ...audit fields  │           │                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Tables

### Core Tables (Phase 0)

| Table | Description | Soft Delete |
|-------|-------------|-------------|
| `users` | Application users with profile data | ✅ |
| `user_sessions` | Active user sessions | ❌ (uses revoked_at) |
| `roles` | System and custom roles | ✅ |
| `permissions` | Granular permissions | ✅ |
| `role_permissions` | Role-permission junction | ❌ |
| `audit_logs` | Immutable audit trail | ❌ (immutable) |
| `attachments` | Polymorphic file attachments | ✅ |

### Enums

#### user_status
- `active` - Account is active
- `inactive` - Account is deactivated
- `suspended` - Account is suspended
- `pending` - Account pending verification

#### audit_action
- `create` - Record created
- `update` - Record updated
- `delete` - Record soft-deleted
- `restore` - Record restored
- `login` - User logged in
- `logout` - User logged out
- `password_change` - Password changed
- `password_reset` - Password reset
- `role_assign` - Role assigned to user
- `permission_grant` - Permission granted
- `permission_revoke` - Permission revoked
- `export` - Data exported
- `import` - Data imported
- `approve` - Record approved
- `reject` - Record rejected

## Conventions

### Primary Keys
- All tables use UUID as primary key
- Generated using `uuid_generate_v4()`

### Audit Fields
Every table includes:
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
created_by UUID REFERENCES users(id)
updated_by UUID REFERENCES users(id)
deleted_at TIMESTAMPTZ  -- Soft delete (NULL = active)
```

### Soft Deletes
- Records are never permanently deleted
- `deleted_at` timestamp indicates deletion
- Queries should filter `WHERE deleted_at IS NULL`

### Money
- Store in integer minor units (cents)
- Example: $19.99 = 1999

### Timestamps
- All timestamps use `TIMESTAMPTZ` (timezone-aware)
- Stored in UTC

## Indexes

### Users
- `idx_users_email` - Email lookup
- `idx_users_auth_user_id` - Supabase Auth lookup
- `idx_users_role_id` - Role filtering
- `idx_users_status` - Status filtering
- `idx_users_deleted_at` - Active record filtering
- `idx_users_full_name` - Name search

### Roles
- `idx_roles_slug` - Slug lookup
- `idx_roles_level` - Hierarchy sorting
- `idx_roles_is_system` - System role filtering

### Permissions
- `idx_permissions_module` - Module filtering
- `idx_permissions_action` - Action filtering
- `idx_permissions_category` - Category grouping

### Audit Logs
- `idx_audit_logs_user_id` - User filtering
- `idx_audit_logs_action` - Action filtering
- `idx_audit_logs_module` - Module filtering
- `idx_audit_logs_entity` - Entity lookup
- `idx_audit_logs_created_at` - Time-based queries (BRIN)

## Row Level Security (RLS)

All tables have RLS enabled with policies:

- **Users**: Can view/update own profile
- **Sessions**: Can view own sessions
- **Roles**: Readable by authenticated users
- **Permissions**: Readable by authenticated users
- **Audit Logs**: Readable by admins (level >= 90)
- **Attachments**: Readable by authenticated users

## Helper Functions

### `update_updated_at_column()`
Trigger function to auto-update `updated_at` timestamp.

### `prevent_hard_delete()`
Trigger function to prevent hard deletes.

### `user_has_permission(user_id, permission_name)`
Check if user has a specific permission.

### `get_user_permissions(user_id)`
Get all permissions for a user.

### `create_audit_log(...)`
Helper to create audit log entries with computed changes.

## Migration Files

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Extensions, enums, utility functions |
| `002_auth_tables.sql` | Users, user sessions |
| `003_rbac_tables.sql` | Roles, permissions, role_permissions |
| `004_audit_tables.sql` | Audit logs, attachments |

## Seed Data

### Default Roles (Phase 0)
| Role | Slug | Level | System |
|------|------|-------|--------|
| Super Admin | `super_admin` | 100 | ✅ |
| Admin | `admin` | 90 | ✅ |

### Default Permissions (Phase 0)
| Module | Actions |
|--------|---------|
| dashboard | view |
| users | view, create, edit, delete, export |
| roles | view, create, edit, delete, manage |
| permissions | view, manage |
| audit_logs | view, export |
| settings | view, edit |
