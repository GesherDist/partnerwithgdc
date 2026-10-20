import Image from 'next/image';
import Link from 'next/link';

import { LEGAL_INFO } from './legal-info';
import { LegalNav } from './legal-nav';

/**
 * Public layout for the legal pages (no login, no dashboard shell).
 * globals.css locks html/body scrolling for the dashboard, so this layout is
 * its own full-height scroll container.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="legal-scroll" className="h-screen overflow-y-auto scroll-smooth bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/terms" className="flex items-center gap-3">
            <Image src="/assets/gesher-logo.png" alt={LEGAL_INFO.companyName} width={120} height={40} className="h-9 w-auto" />
            <span className="hidden border-l pl-3 text-sm font-medium text-muted-foreground md:inline">
              {LEGAL_INFO.appName} · Legal
            </span>
          </Link>
          <LegalNav />
        </div>
      </header>

      {children}

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {LEGAL_INFO.companyName}. All rights reserved.
          </span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms of Use
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <a href={`mailto:${LEGAL_INFO.contactEmail}`} className="hover:text-foreground">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
