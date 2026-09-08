
'use client';

import { X, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSessionView } from '@/context/session-view-context';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, Timestamp } from 'firebase/firestore';

type Session = {
  id: string;
  name: string;
};

export function SessionViewBanner() {
  const { viewingSessionId, clearViewingSession } = useSessionView();
  const firestore = useFirestore();

  const sessionDocRef = useMemoFirebase(
    () => (viewingSessionId ? doc(firestore, 'sessions', viewingSessionId) : null),
    [firestore, viewingSessionId]
  );
  const { data: session, isLoading } = useDoc<Session>(sessionDocRef);

  if (!viewingSessionId) {
    return null;
  }

  const sessionName = isLoading ? 'Chargement...' : session?.name ?? 'une session';

  return (
    <Alert className="mb-4 flex items-center justify-between bg-primary/10 border-primary/20 text-primary-foreground">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5 text-primary" />
        <AlertDescription className="text-sm text-primary">
          Vous consultez la session <span className="font-semibold">"{sessionName}"</span> en tant que consultant.
        </AlertDescription>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-primary hover:bg-primary/20 hover:text-primary"
        onClick={clearViewingSession}
      >
        <X className="mr-1 h-4 w-4" />
        Quitter
      </Button>
    </Alert>
  );
}
