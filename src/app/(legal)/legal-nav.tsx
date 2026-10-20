'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, ShieldCheck } from 'lucide-react';

const LINKS = [
  { href: '/terms', label: 'Terms of Use', icon: FileText },
  { href: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
];

/** Switch between the two legal pages (active tab highlighted) */
export function LegalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-lg bg-muted p-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
