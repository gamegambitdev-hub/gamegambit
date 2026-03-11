import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AdminHeader } from '@/components/admin/AdminHeader';

export const metadata: Metadata = {
  title: 'Admin Portal - Game Gambit',
  description: 'Admin management panel for Game Gambit',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="pt-16 w-full overflow-x-hidden">
        <div className="mx-auto py-6 sm:px-6 lg:px-8 container">{children}</div>
      </main>
    </div>
  );
}
