
'use client';

import * as React from 'react';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Users, Shield, ShieldCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


type UserProfile = {
  id: string;
  role: 'Admin' | 'Consultant';
}

type Session = {
  id: string;
  archived?: boolean;
}

const StatCard = ({ title, value, icon, isLoading }: { title: string, value: number, icon: React.ReactNode, isLoading: boolean }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-8 w-1/2" />
                ) : (
                    <div className="text-2xl font-bold">{value}</div>
                )}
            </CardContent>
        </Card>
    )
}


export default function AdminDashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);

  // --- Security: Check user role ---
  React.useEffect(() => {
    const checkAdminRole = async () => {
      if (user && firestore) {
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          const userIsAdmin = userDoc.exists() && userDoc.data().role === 'Admin';
          setIsAdmin(userIsAdmin);

          if (!userIsAdmin) {
            toast({
              variant: 'destructive',
              title: 'Accès non autorisé',
              description: "Tu n'as pas les droits pour accéder à cette page.",
            });
            router.replace('/dashboard');
          }
        } catch (error) {
          console.error("Failed to check admin role:", error);
          setIsAdmin(false);
          router.replace('/dashboard');
        }
      }
    };

    if (!isUserLoading && user) {
      checkAdminRole();
    } else if (!isUserLoading && !user) {
        router.replace('/login');
    }
  }, [user, isUserLoading, firestore, router, toast]);


  // --- Fetch data for KPIs ---
  const usersQuery = useMemoFirebase(
    () => isAdmin ? query(collection(firestore, 'users')) : null,
    [firestore, isAdmin]
  );
  const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

  const sessionsQuery = useMemoFirebase(
    () => isAdmin ? query(collection(firestore, 'sessions')) : null,
    [firestore, isAdmin]
  );
  const { data: allSessions, isLoading: sessionsLoading } = useCollection<Session>(sessionsQuery);

  const activeSessions = React.useMemo(() => {
      return allSessions?.filter(s => !s.archived) ?? [];
  }, [allSessions]);


  // --- Loading and access control states ---
  const isLoadingData = usersLoading || sessionsLoading || isUserLoading || isAdmin === null;

  if (isUserLoading || isAdmin === null) {
    return <p>Vérification des droits en cours...</p>;
  }

  if (!isAdmin) {
    return <p>Accès non autorisé. Tu vas être redirigé.</p>;
  }

  return (
    <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard 
                title="Total Utilisateurs"
                value={allUsers?.length ?? 0}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                isLoading={isLoadingData}
            />
            <StatCard 
                title="Sessions Actives"
                value={activeSessions.length}
                icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                isLoading={isLoadingData}
            />
            <StatCard 
                title="Total Sessions"
                value={allSessions?.length ?? 0}
                icon={<Shield className="h-4 w-4 text-muted-foreground" />}
                isLoading={isLoadingData}
            />
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Bienvenue, Administrateur !</CardTitle>
                <p className="text-muted-foreground">Voici un aperçu de l'activité sur la plateforme Défi45j.</p>
            </CardHeader>
            <CardContent>
                {/* Future content can be added here, e.g., charts or recent activity */}
                 <p>Plus d'indicateurs et de graphiques seront ajoutés ici prochainement.</p>
            </CardContent>
        </Card>
    </div>
  );
}
