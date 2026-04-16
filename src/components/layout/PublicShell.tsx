'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { UsernameEnforcer } from '@/components/UsernameEnforcer';

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/itszaadminlogin');

  if (isAdmin) {
    // Admin has its own layout — render children bare, no header/footer/enforcer
    return <>{children}</>;
  }

  return (
    <UsernameEnforcer>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 pt-16 w-full overflow-x-hidden">
          {children}
        </main>
        <Footer />
      </div>
    </UsernameEnforcer>
  );
}
