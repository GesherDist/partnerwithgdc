import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/shared/components/ui/sonner';
import { QueryProvider } from '@/shared/providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Gesher Distribution',
    template: '%s | Gesher Distribution',
  },
  description: 'Enterprise Operations Platform for Agricultural Tire Distribution',
  keywords: ['distribution', 'operations', 'enterprise', 'inventory', 'orders'],
  authors: [{ name: 'Gesher Distribution' }],
  creator: 'Gesher Distribution',
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <QueryProvider>
          {children}
        </QueryProvider>
        {/* Without this mounted, every toast() call in the app is a no-op */}
        <Toaster />
      </body>
    </html>
  );
}
