/**
 * Logo Component
 *
 * Application logo with optional text.
 * Supports collapsed mode for sidebar.
 */

import Link from 'next/link';
import Image from 'next/image';

import { cn } from '@/shared/lib/utils';

// ============================================
// TYPES
// ============================================

interface LogoProps {
  /** Show only icon (collapsed mode) */
  collapsed?: boolean;
  /** Custom class name */
  className?: string;
  /** Link destination */
  href?: string;
  /** Show as link or static element */
  asLink?: boolean;
  /** Variant for different contexts */
  variant?: 'sidebar' | 'default';
}

// ============================================
// COMPONENT
// ============================================

export function Logo({
  collapsed = false,
  className,
  href = '/dashboard',
  asLink = true,
  variant = 'sidebar',
}: LogoProps) {
  const isSidebar = variant === 'sidebar';
  // Use white logo for dark backgrounds (sidebar), colored logo for light backgrounds (auth pages)
  const logoSrc = isSidebar ? '/assets/gesher-logo-white.png' : '/assets/gesher-logo.png';

  const content = (
    <div
      className={cn(
        'flex items-center gap-2.5 font-semibold',
        collapsed ? 'justify-center' : 'justify-start',
        className
      )}
    >
      {/* Logo Image Only */}
      <div
        className={cn(
          'flex items-center justify-center',
          isSidebar
            ? (collapsed ? 'h-12 w-12' : 'h-12 w-44')
            : 'h-16 w-48'
        )}
      >
        <Image
          src={logoSrc}
          alt="Gesher Distribution"
          width={isSidebar ? (collapsed ? 48 : 176) : 192}
          height={isSidebar ? 48 : 64}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link
        href={href}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}
