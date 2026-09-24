'use client';

/**
 * Header Component
 *
 * Modern dark header with logo, search, and user menu.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Menu, Search, LogOut, User, Settings } from 'lucide-react';
import { NotificationBell } from '@/features/notifications/components';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAuthStore, selectFullName, selectInitials } from '@/shared/stores';
import { useSidebarStore } from '@/shared/stores';
import { logoutAction } from '@/features/auth/actions';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { appUser, logout } = useAuthStore();
  const fullName = useAuthStore(selectFullName);
  const initials = useAuthStore(selectInitials);
  const { toggleMobile, toggleCollapse } = useSidebarStore();

  const handleLogout = async () => {
    // Clear client-side state
    logout();
    // Call server action to sign out and clear cookies
    await logoutAction();
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-16 items-center px-4 lg:px-6',
        'bg-[hsl(var(--sidebar-background))] border-b border-[hsl(var(--sidebar-border))]',
        className
      )}
    >
      {/* Left Section - Logo & Menu */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center">
          <div className="flex h-12 w-44 items-center justify-center">
            <Image
              src="/assets/gesher-logo-white.png"
              alt="Gesher Distribution"
              width={176}
              height={48}
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--foreground))] lg:hidden focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={toggleMobile}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--foreground))] lg:flex focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={toggleCollapse}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Center - Search */}
      <div className="mx-4 hidden flex-1 md:flex md:max-w-md lg:max-w-lg">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--sidebar-muted))]" />
          <input
            type="search"
            placeholder="Search..."
            className="h-10 w-full rounded-lg border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] pl-10 pr-4 text-sm text-[hsl(var(--sidebar-foreground))] placeholder:text-[hsl(var(--sidebar-muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sidebar-primary))]"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="ml-auto flex items-center gap-2">
        {/* Mobile Search */}
        <Button
          variant="ghost"
          size="icon"
          className="text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--foreground))] md:hidden"
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full hover:bg-[hsl(var(--sidebar-accent))] focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <Avatar className="h-9 w-9 border-2 border-[hsl(var(--sidebar-primary))]">
                <AvatarImage src={appUser?.avatarUrl ?? undefined} alt={fullName} />
                <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-sm font-medium text-white">
                  {initials || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-2">
            <DropdownMenuLabel className="p-0 pb-2">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                <Avatar className="h-10 w-10 border-2 border-[hsl(var(--sidebar-primary))]">
                  <AvatarImage src={appUser?.avatarUrl ?? undefined} alt={fullName} />
                  <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-sm font-medium text-white">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-gray-900">{fullName || 'User'}</p>
                  <p className="text-xs text-gray-500">{appUser?.email || 'No email'}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center text-gray-700">
                <User className="mr-3 h-4 w-4 text-gray-500" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center text-gray-700">
                <Settings className="mr-3 h-4 w-4 text-gray-500" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              className="text-red-600 hover:!bg-red-50 hover:!text-red-600 focus:!bg-red-50 focus:!text-red-600"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
