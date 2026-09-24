'use client';

/**
 * Supplier Portal Sidebar
 *
 * Simplified navigation sidebar for supplier portal.
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  Settings,
  X,
  LogOut,
  ChevronRight,
  Building2,
} from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { useAuthStore } from '@/shared/stores';
import { logoutAction } from '@/features/auth/actions';

// Navigation configuration for supplier portal
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/supplier-portal',
    icon: LayoutDashboard,
    permission: 'supplier_portal.view_module',
  },
  {
    id: 'purchase-orders',
    label: 'Purchase Orders',
    href: '/supplier-portal/purchase-orders',
    icon: ClipboardList,
    permission: 'supplier_portal.view_pos',
  },
  {
    id: 'shipments',
    label: 'Shipments',
    href: '/supplier-portal/shipments',
    icon: Truck,
    permission: 'supplier_portal.view_shipments',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/supplier-portal/settings',
    icon: Settings,
    permission: 'supplier_portal.view_module',
  },
];

interface SupplierSidebarProps {
  supplierName?: string;
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function SupplierSidebar({
  supplierName,
  isCollapsed = false,
  isMobileOpen = false,
  onCloseMobile,
}: SupplierSidebarProps) {
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();
  const { hasPermission, logout, appUser } = useAuthStore();

  // Supplier users always have access to supplier portal
  const isSupplierUser = !!appUser?.supplierId;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleLogout = async () => {
    logout();
    await logoutAction();
  };

  const isActive = (href: string) => {
    if (href === '/supplier-portal') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const NavSkeleton = () => (
    <div className="space-y-1 animate-pulse">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5"
        >
          <div className="h-5 w-5 bg-[hsl(var(--sidebar-accent))] rounded" />
          <div className="h-4 w-24 bg-[hsl(var(--sidebar-accent))] rounded" />
        </div>
      ))}
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Supplier Info */}
      <div className="border-b border-[hsl(var(--sidebar-border))] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))]">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[hsl(var(--sidebar-muted))]">
                Supplier Portal
              </span>
              <span className="text-sm font-semibold text-[hsl(var(--sidebar-foreground))]">
                {supplierName || 'Loading...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        {!hasMounted ? (
          <NavSkeleton />
        ) : (
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              // Supplier users always have access to supplier portal navigation
              // Otherwise check explicit permissions
              if (!isSupplierUser && !hasPermission(item.permission)) {
                return null;
              }

              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-[hsl(var(--sidebar-primary))] text-white shadow-sm'
                      : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white hover:translate-x-1',
                    isCollapsed && 'justify-center px-2 hover:translate-x-0'
                  )}
                  title={isCollapsed ? item.label : undefined}
                  onClick={onCloseMobile}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-transform duration-200',
                      !active && 'group-hover:scale-110'
                    )}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                  {!isCollapsed && active && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </ScrollArea>

      {/* Sign Out Button */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        <button
          onClick={handleLogout}
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
            'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]',
            'hover:bg-red-500/90 hover:text-white transition-all duration-200',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col',
          'bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] shadow-sm',
          isCollapsed ? 'lg:w-[70px]' : 'lg:w-64',
          'transition-all duration-300'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 lg:hidden',
          'bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]',
          'transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Close Button */}
        <div className="flex h-16 items-center justify-end border-b border-[hsl(var(--sidebar-border))] px-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
            onClick={onCloseMobile}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}
