
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        // Redirige tous les utilisateurs connectés vers la page d'action "Mon Défi"
        router.replace('/dashboard/defi');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, router]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center">
      <p>Chargement...</p>
    </div>
  );
}
