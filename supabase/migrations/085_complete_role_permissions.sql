-- ============================================
-- MIGRATION: 085_complete_role_permissions.sql
-- PURPOSE: Complete permission definitions and role assignments per Build Brief v2.0
-- DATE: 2025-08-21
-- ============================================
-- This migration:
-- 1. Defines ALL missing permissions for each module
-- 2. Assigns permissions to business roles as per client specification
-- ============================================
-- ROLES (from Build Brief):
-- - Sales Rep: Field reps - quotes, customer view, pricing view, availability
-- - Sales Director (Andy): Pricing approval, credit release, allocation confirm
-- - Operations (Jenny): Inventory, POs, shipping, pick tickets, allocation
-- - Finance (Ankur): Quote approval, invoices, audit, QBO, credit decisions
-- - Management: Read-only dashboard KPIs
-- ============================================

-- ============================================
-- PART 1: DEFINE MISSING PERMISSIONS
-- ============================================

-- ============================================
-- 1.1 CUSTOMERS MODULE
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('customers.view_module', 'View Customers Module', 'Customers Module', 'user', 10)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'customers.create', 'Create New Customer', 'Customers Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'customers.view_detail', 'View Customer Detail', 'Customers Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'customers.edit', 'Edit Customer', 'Customers Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'customers.delete', 'Delete Customer', 'Customers Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'customers.manage_contacts', 'Manage Customer Contacts', 'Customers Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'customers.manage_documents', 'Manage Customer Documents', 'Customers Module', 'user', p.id, 6
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.2 SALES ORDERS MODULE
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('orders.view_module', 'View Sales Orders Module', 'Sales Orders Module', 'user', 11)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.create', 'Create Sales Order', 'Sales Orders Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.view_detail', 'View Sales Order Detail', 'Sales Orders Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.edit', 'Edit Sales Order', 'Sales Orders Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.delete', 'Delete Sales Order', 'Sales Orders Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.confirm', 'Confirm Sales Order', 'Sales Orders Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.cancel', 'Cancel Sales Order', 'Sales Orders Module', 'user', p.id, 6
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.3 INVENTORY MODULE
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('inventory.view_module', 'View Inventory Module', 'Inventory Module', 'user', 12)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.view_detail', 'View Inventory Detail', 'Inventory Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.adjust', 'Adjust Inventory Quantities', 'Inventory Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.transfer', 'Transfer Inventory Between Locations', 'Inventory Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.allocate', 'Allocate Inventory to Orders', 'Inventory Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'inventory.view_movements', 'View Inventory Movement Log', 'Inventory Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'inventory.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.4 PICK TICKETS MODULE
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('pick_tickets.view_module', 'View Pick Tickets Module', 'Pick Tickets Module', 'user', 13)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.create', 'Create Pick Ticket', 'Pick Tickets Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.view_detail', 'View Pick Ticket Detail', 'Pick Tickets Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.edit', 'Edit Pick Ticket', 'Pick Tickets Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.assign', 'Assign Pick Ticket to Worker', 'Pick Tickets Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.complete', 'Complete Pick Ticket', 'Pick Tickets Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.delete', 'Delete Pick Ticket', 'Pick Tickets Module', 'user', p.id, 6
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pick_tickets.print', 'Print Pick Ticket / Packing List', 'Pick Tickets Module', 'user', p.id, 7
FROM permissions p WHERE p.name = 'pick_tickets.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.5 SHIPMENTS MODULE
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('shipments.view_module', 'View Shipments Module', 'Shipments Module', 'user', 14)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'shipments.create', 'Create Shipment', 'Shipments Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'shipments.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'shipments.view_detail', 'View Shipment Detail', 'Shipments Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'shipments.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'shipments.edit', 'Edit Shipment', 'Shipments Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'shipments.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'shipments.update_status', 'Update Shipment Status', 'Shipments Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'shipments.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'shipments.track', 'Track Shipment / Container', 'Shipments Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'shipments.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'shipments.confirm_delivery', 'Confirm Shipment Delivery', 'Shipments Module', 'user', p.id, 6
FROM permissions p WHERE p.name = 'shipments.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.6 INVOICES MODULE
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('invoices.view_module', 'View Invoices Module', 'Invoices Module', 'user', 15)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.create', 'Create Invoice', 'Invoices Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.view_detail', 'View Invoice Detail', 'Invoices Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.edit', 'Edit Invoice', 'Invoices Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.send', 'Send Invoice to Customer', 'Invoices Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.push_qbo', 'Push Invoice to QuickBooks', 'Invoices Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.record_payment', 'Record Payment on Invoice', 'Invoices Module', 'user', p.id, 6
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'invoices.void', 'Void Invoice', 'Invoices Module', 'user', p.id, 7
FROM permissions p WHERE p.name = 'invoices.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.7 CREDIT MANAGEMENT
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('credit.view_status', 'View Customer Credit Status', 'Credit Module', 'user', 16)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'credit.release_hold', 'Release Credit Hold on Order', 'Credit Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'credit.view_status'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'credit.place_hold', 'Place Credit Hold on Order', 'Credit Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'credit.view_status'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'credit.set_limit', 'Set Customer Credit Limit', 'Credit Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'credit.view_status'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.8 ALLOCATION MANAGEMENT
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('allocation.view', 'View Allocation Status', 'Allocation Module', 'user', 17)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'allocation.decide', 'Make Allocation Decision (Stock Contention)', 'Allocation Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'allocation.view'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'allocation.confirm', 'Confirm Allocation Decision', 'Allocation Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'allocation.view'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 1.9 OPERATIONS DASHBOARD (Specific)
-- ============================================
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('operations_dashboard.view_module', 'View Operations Dashboard', 'Operations Dashboard', 'user', 18)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'operations_dashboard.edit_shipments', 'Edit Shipments in Operations Dashboard', 'Operations Dashboard', 'user', p.id, 1
FROM permissions p WHERE p.name = 'operations_dashboard.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'operations_dashboard.export', 'Export Operations Dashboard Data', 'Operations Dashboard', 'user', p.id, 2
FROM permissions p WHERE p.name = 'operations_dashboard.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 2: ASSIGN PERMISSIONS TO ROLES
-- ============================================

-- ============================================
-- 2.1 SALES REP PERMISSIONS
-- ============================================
-- Per Build Brief: quotes, pricing view, customer view, inventory availability
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales Rep'
  AND p.name IN (
    -- Dashboard (limited)
    'dashboard.view_module',
    'dashboard.view_sales',

    -- Quotes (full except approve)
    'quotes.view_module',
    'quotes.create',
    'quotes.view_detail',
    'quotes.edit',
    'quotes.submit_for_approval',

    -- Customers (view only)
    'customers.view_module',
    'customers.view_detail',

    -- Sales Orders (view only)
    'orders.view_module',
    'orders.view_detail',

    -- Products (view only)
    'products.view_module',
    'products.view_detail',

    -- Pricing (view only)
    'pricing.view',

    -- Inventory (view availability only)
    'inventory.view_module',
    'inventory.view_detail',

    -- Credit (view only)
    'credit.view_status'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 2.2 SALES DIRECTOR PERMISSIONS (Andy)
-- ============================================
-- Per Build Brief: All sales_rep + pricing approval, credit release, allocation confirm
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Sales Director'
  AND p.name IN (
    -- Dashboard (full)
    'dashboard.view_module',
    'dashboard.view_analytics',
    'dashboard.view_sales',
    'dashboard.view_activity',
    'dashboard.export',

    -- Quotes (full including approve)
    'quotes.view_module',
    'quotes.create',
    'quotes.view_detail',
    'quotes.edit',
    'quotes.delete',
    'quotes.submit_for_approval',
    'quotes.approve',
    'quotes.convert_to_order',

    -- Customers (full)
    'customers.view_module',
    'customers.create',
    'customers.view_detail',
    'customers.edit',
    'customers.manage_contacts',
    'customers.manage_documents',

    -- Sales Orders (full)
    'orders.view_module',
    'orders.create',
    'orders.view_detail',
    'orders.edit',
    'orders.confirm',
    'orders.cancel',

    -- Products (view + pricing)
    'products.view_module',
    'products.view_detail',

    -- Pricing (full)
    'pricing.view',
    'pricing.create',
    'pricing.edit',

    -- Inventory (view)
    'inventory.view_module',
    'inventory.view_detail',
    'inventory.view_movements',

    -- Credit (release hold)
    'credit.view_status',
    'credit.release_hold',

    -- Allocation (confirm)
    'allocation.view',
    'allocation.confirm',

    -- Shipments (view)
    'shipments.view_module',
    'shipments.view_detail',
    'shipments.track'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 2.3 OPERATIONS PERMISSIONS (Jenny)
-- ============================================
-- Per Build Brief: Inventory full, POs full, shipping full, pick tickets, allocation decisions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operations'
  AND p.name IN (
    -- Dashboard (operations specific)
    'dashboard.view_module',
    'dashboard.view_activity',
    'operations_dashboard.view_module',
    'operations_dashboard.edit_shipments',
    'operations_dashboard.export',

    -- Quotes (view + create for orders)
    'quotes.view_module',
    'quotes.create',
    'quotes.view_detail',
    'quotes.edit',

    -- Customers (view + contacts)
    'customers.view_module',
    'customers.view_detail',
    'customers.manage_contacts',

    -- Sales Orders (view + confirm)
    'orders.view_module',
    'orders.view_detail',
    'orders.confirm',

    -- Products (view)
    'products.view_module',
    'products.view_detail',

    -- Pricing (view)
    'pricing.view',

    -- Purchase Orders (full)
    'purchase_orders.view_module',
    'purchase_orders.create',
    'purchase_orders.view_detail',
    'purchase_orders.edit',
    'purchase_orders.send',
    'purchase_orders.confirm',
    'purchase_orders.receive',
    'purchase_orders.cancel',

    -- Inventory (full)
    'inventory.view_module',
    'inventory.view_detail',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.allocate',
    'inventory.view_movements',

    -- Pick Tickets (full)
    'pick_tickets.view_module',
    'pick_tickets.create',
    'pick_tickets.view_detail',
    'pick_tickets.edit',
    'pick_tickets.assign',
    'pick_tickets.complete',
    'pick_tickets.delete',
    'pick_tickets.print',

    -- Shipments (full)
    'shipments.view_module',
    'shipments.create',
    'shipments.view_detail',
    'shipments.edit',
    'shipments.update_status',
    'shipments.track',
    'shipments.confirm_delivery',

    -- Credit (view only)
    'credit.view_status',

    -- Allocation (decide, not confirm - that's Andy)
    'allocation.view',
    'allocation.decide'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 2.4 FINANCE PERMISSIONS (Ankur)
-- ============================================
-- Per Build Brief: Quote approval, invoices full, audit, QBO, final credit decisions, users view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Finance'
  AND p.name IN (
    -- Dashboard (full)
    'dashboard.view_module',
    'dashboard.view_analytics',
    'dashboard.view_sales',
    'dashboard.view_activity',
    'dashboard.export',

    -- Quotes (approve + convert)
    'quotes.view_module',
    'quotes.view_detail',
    'quotes.approve',
    'quotes.convert_to_order',

    -- Customers (view + credit related)
    'customers.view_module',
    'customers.view_detail',
    'customers.edit',
    'customers.manage_documents',

    -- Sales Orders (view + credit hold)
    'orders.view_module',
    'orders.view_detail',

    -- Products (view)
    'products.view_module',
    'products.view_detail',

    -- Pricing (full - owns pricing strategy)
    'pricing.view',
    'pricing.create',
    'pricing.edit',
    'pricing.delete',

    -- Purchase Orders (view)
    'purchase_orders.view_module',
    'purchase_orders.view_detail',

    -- Inventory (view)
    'inventory.view_module',
    'inventory.view_detail',
    'inventory.view_movements',

    -- Shipments (view)
    'shipments.view_module',
    'shipments.view_detail',

    -- Invoices (full)
    'invoices.view_module',
    'invoices.create',
    'invoices.view_detail',
    'invoices.edit',
    'invoices.send',
    'invoices.push_qbo',
    'invoices.record_payment',
    'invoices.void',

    -- Credit (full - final authority)
    'credit.view_status',
    'credit.release_hold',
    'credit.place_hold',
    'credit.set_limit',

    -- Allocation (confirm)
    'allocation.view',
    'allocation.confirm',

    -- Users (view)
    'users.view_module',

    -- Audit (full)
    'audit.view_module',

    -- Settings (view)
    'settings.view_module'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 2.5 MANAGEMENT PERMISSIONS (Read-Only)
-- ============================================
-- Per Build Brief: Read-only KPIs, revenue vs target, units by SKU, margin, AR/AP aging
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Management'
  AND p.name IN (
    -- Dashboard (analytics only - read only)
    'dashboard.view_module',
    'dashboard.view_analytics',
    'dashboard.view_sales',

    -- Quotes (view only)
    'quotes.view_module',
    'quotes.view_detail',

    -- Customers (view only)
    'customers.view_module',
    'customers.view_detail',

    -- Sales Orders (view only)
    'orders.view_module',
    'orders.view_detail',

    -- Products (view only)
    'products.view_module',
    'products.view_detail',

    -- Pricing (view only)
    'pricing.view',

    -- Inventory (view only)
    'inventory.view_module',
    'inventory.view_detail',

    -- Shipments (view only)
    'shipments.view_module',
    'shipments.view_detail',

    -- Invoices (view only)
    'invoices.view_module',
    'invoices.view_detail',

    -- Credit (view only)
    'credit.view_status'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 2.6 SUPER ADMIN - GRANT ALL NEW PERMISSIONS
-- ============================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    -- Customers
    'customers.view_module', 'customers.create', 'customers.view_detail',
    'customers.edit', 'customers.delete', 'customers.manage_contacts', 'customers.manage_documents',

    -- Sales Orders
    'orders.view_module', 'orders.create', 'orders.view_detail',
    'orders.edit', 'orders.delete', 'orders.confirm', 'orders.cancel',

    -- Inventory
    'inventory.view_module', 'inventory.view_detail', 'inventory.adjust',
    'inventory.transfer', 'inventory.allocate', 'inventory.view_movements',

    -- Pick Tickets
    'pick_tickets.view_module', 'pick_tickets.create', 'pick_tickets.view_detail',
    'pick_tickets.edit', 'pick_tickets.assign', 'pick_tickets.complete',
    'pick_tickets.delete', 'pick_tickets.print',

    -- Shipments
    'shipments.view_module', 'shipments.create', 'shipments.view_detail',
    'shipments.edit', 'shipments.update_status', 'shipments.track', 'shipments.confirm_delivery',

    -- Invoices
    'invoices.view_module', 'invoices.create', 'invoices.view_detail',
    'invoices.edit', 'invoices.send', 'invoices.push_qbo',
    'invoices.record_payment', 'invoices.void',

    -- Credit
    'credit.view_status', 'credit.release_hold', 'credit.place_hold', 'credit.set_limit',

    -- Allocation
    'allocation.view', 'allocation.decide', 'allocation.confirm',

    -- Operations Dashboard
    'operations_dashboard.view_module', 'operations_dashboard.edit_shipments', 'operations_dashboard.export'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  perm_count INTEGER;
  sales_rep_count INTEGER;
  sales_director_count INTEGER;
  operations_count INTEGER;
  finance_count INTEGER;
  management_count INTEGER;
BEGIN
  -- Count total permissions
  SELECT COUNT(*) INTO perm_count FROM permissions;

  -- Count permissions per role
  SELECT COUNT(*) INTO sales_rep_count
  FROM role_permissions rp
  JOIN roles r ON rp.role_id = r.id
  WHERE r.name = 'Sales Rep';

  SELECT COUNT(*) INTO sales_director_count
  FROM role_permissions rp
  JOIN roles r ON rp.role_id = r.id
  WHERE r.name = 'Sales Director';

  SELECT COUNT(*) INTO operations_count
  FROM role_permissions rp
  JOIN roles r ON rp.role_id = r.id
  WHERE r.name = 'Operations';

  SELECT COUNT(*) INTO finance_count
  FROM role_permissions rp
  JOIN roles r ON rp.role_id = r.id
  WHERE r.name = 'Finance';

  SELECT COUNT(*) INTO management_count
  FROM role_permissions rp
  JOIN roles r ON rp.role_id = r.id
  WHERE r.name = 'Management';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PERMISSION ASSIGNMENT COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Permissions Defined: %', perm_count;
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Sales Rep: % permissions', sales_rep_count;
  RAISE NOTICE 'Sales Director (Andy): % permissions', sales_director_count;
  RAISE NOTICE 'Operations (Jenny): % permissions', operations_count;
  RAISE NOTICE 'Finance (Ankur): % permissions', finance_count;
  RAISE NOTICE 'Management (Read-Only): % permissions', management_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback permission assignments:
-- DELETE FROM role_permissions
-- WHERE role_id IN (SELECT id FROM roles WHERE name IN ('Sales Rep', 'Sales Director', 'Operations', 'Finance', 'Management'))
--   AND permission_id IN (SELECT id FROM permissions WHERE name LIKE 'customers.%' OR name LIKE 'orders.%' ... etc);
