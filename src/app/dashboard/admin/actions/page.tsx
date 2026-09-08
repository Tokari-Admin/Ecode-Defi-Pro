
'use client';

import * as React from 'react';
import { notifyInactiveUsers } from '@/ai/flows/inactive-user-flow';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';
import { differenceInHours } from 'date-fns';

interface FlowResult {
  inactiveUsersNotified: number;
}

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Consultant';
  lastActivity?: string; // ISO 8601 string
}

export default function AdminActionsPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<FlowResult | null>(null);
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  // Basic access control
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  // Fetch all consultant users only when firestore and user are available
  const consultantsQuery = useMemoFirebase(
    () => (firestore && user) ? query(collection(firestore, 'users'), where('role', '==', 'Consultant')) : null,
    [firestore, user]
  );
  const { data: consultants, isLoading: consultantsLoading } = useCollection<UserProfile>(consultantsQuery);

  const handleRunFlow = async () => {
    setIsLoading(true);
    setResult(null);

    if (!consultants) {
        toast({
            variant: 'destructive',
            title: 'Erreur',
            description: "Impossible de charger la liste des consultants.",
        });
        setIsLoading(false);
        return;
    }
    
    // --- Logic to find inactive users is now on the client ---
    const now = new Date();
    const inactiveUsers = consultants.filter(c => {
        if (!c.lastActivity) return true; // Consider users with no activity as inactive
        const lastActivityDate = new Date(c.lastActivity);
        const hoursSinceLastActivity = differenceInHours(now, lastActivityDate);
        return hoursSinceLastActivity > 48;
    }).map(u => ({ name: u.name, email: u.email })); // Prepare data for the flow


    try {
      if (inactiveUsers.length === 0) {
        toast({
          title: 'Analyse terminée',
          description: 'Aucun utilisateur inactif détecté.',
        });
        setResult({ inactiveUsersNotified: 0 });
        setIsLoading(false);
        return;
      }
      
      // The flow now requires the list of inactive users
      const flowResult = await notifyInactiveUsers(inactiveUsers);
      setResult(flowResult);
      toast({
        title: 'Analyse terminée !',
        description: `${flowResult.inactiveUsersNotified} utilisateurs inactifs ont été notifiés.`,
      });
    } catch (error) {
      console.error('Error running inactive user flow:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Le script n'a pas pu s'exécuter correctement.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const isButtonDisabled = isLoading || consultantsLoading || isUserLoading;

  return (
    <div className="grid gap-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Notifications aux Inactifs</CardTitle>
          <CardDescription>
            Lance manuellement le script qui identifie les consultants inactifs
            depuis plus de 48h et leur envoie un e-mail de relance (simulation).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRunFlow} disabled={isButtonDisabled}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Analyse en cours...' : 'Lancer le script'}
          </Button>
          {(consultantsLoading || isUserLoading) && <p className="text-sm text-muted-foreground mt-2">Chargement des utilisateurs...</p>}
        </CardContent>
        {result && (
          <CardFooter className="flex flex-col items-start text-sm">
            <p className="font-semibold">Résultats de la dernière exécution :</p>
            <p className="text-muted-foreground">
              - Notifications envoyées : {result.inactiveUsersNotified}
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
