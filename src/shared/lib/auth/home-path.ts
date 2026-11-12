/**
 * Home Page by Permission
 *
 * Where a user lands after login, or when the dashboard has nothing for them.
 * Decided only by permissions, never by role name (Nov 11 2026: an
 * "Operations Manager" role with dashboard permissions sees the dashboard;
 * a user without dashboard access goes to the next page they may open).
 */

import type { AppUser } from '@/shared/stores/auth.store';
import { DASHBOARD_TAB_PERMISSIONS } from '@/features/dashboard/lib/dashboard-tabs';
import { isSuperAdmin } from './check-permission';

/** Pages a user can land on, in sidebar order, with the permission each needs */
const HOME_PAGES: Array<{ href: string; label: string; permission: string }> = [
  { href: '/operations', label: 'Operations', permission: 'operations_dashboard.view_module' },
  { href: '/inbox', label: 'Inbox', permission: 'inbox.view_module' },
  { href: '/shipping', label: 'Shipping', permission: 'shipments.view_module' },
  { href: '/customers', label: 'Customers', permission: 'customers.view_module' },
  { href: '/suppliers', label: 'Suppliers', permission: 'suppliers.view_module' },
  { href: '/platinum-dealers', label: 'Platinum Dealers', permission: 'platinum_dealers.view_module' },
  { href: '/purchase-orders', label: 'Purchase Orders', permission: 'purchase_orders.view_module' },
  { href: '/shipments', label: 'Shipments', permission: 'shipments.view_module' },
  { href: '/quotes', label: 'Quotes', permission: 'quotes.view_module' },
  { href: '/sales-orders', label: 'Sales Orders', permission: 'orders.view_module' },
  { href: '/invoices', label: 'Invoices', permission: 'invoices.view_module' },
  { href: '/pick-tickets', label: 'Pick Tickets', permission: 'pick_tickets.view_module' },
  { href: '/products', label: 'Products', permission: 'products.view_module' },
  { href: '/inventory', label: 'Inventory', permission: 'inventory.view_module' },
  { href: '/locations', label: 'Locations', permission: 'locations.view_module' },
  { href: '/users', label: 'Users', permission: 'users.view_module' },
  { href: '/roles', label: 'Roles', permission: 'roles.view_module' },
  { href: '/audit-logs', label: 'Audit Logs', permission: 'audit.view_module' },
  { href: '/settings', label: 'Settings', permission: 'settings.view_module' },
];

/** Permission check without the per-check console log of hasPermission (this runs many checks) */
function can(user: AppUser | null, permission: string): boolean {
  if (!user) {
    return false;
  }
  return isSuperAdmin(user) || user.permissions.includes(permission);
}

/** The dashboard counts only when the user may open it and at least one of its tabs */
export function canSeeDashboard(user: AppUser | null): boolean {
  return can(user, 'dashboard.view_module') && Object.values(DASHBOARD_TAB_PERMISSIONS).some((p) => can(user, p));
}

/** First page the user may open: the dashboard, else the next page in sidebar order */
export function homePageFor(user: AppUser | null): { href: string; label: string } {
  if (user?.supplierId) {
    return { href: '/supplier-portal', label: 'Supplier Portal' };
  }
  if (canSeeDashboard(user)) {
    return { href: '/dashboard', label: 'Dashboard' };
  }
  const page = HOME_PAGES.find((p) => can(user, p.permission));
  return page ? { href: page.href, label: page.label } : { href: '/no-permission', label: 'Home' };
}
