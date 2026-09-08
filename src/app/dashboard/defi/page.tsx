
'use client';

import * as React from 'react';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, Timestamp, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { differenceInDays, format, startOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dumbbell, PenSquare, BookOpen, Brain, PersonStanding, MoveUp, ChevronDown } from 'lucide-react';
import { ActionCard } from '@/components/defi/action-card';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { CheckCircle, CalendarCheck2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// --- Data Types ---
type Session = {
  startDate: Timestamp;
  endDate: Timestamp;
};

type UserProfile = {
  sessionId?: string;
  name?: string;
  conferenceDate?: string; // Stored as 'yyyy-MM-dd' string
};

type DailyChallengeProgress = {
    id: string;
    userId: string;
    sessionId: string;
    date: string; // "yyyy-MM-dd"
    c2Count: number;
    r0Count: number;
    r1Count: number;
    r2Count: number;
    r3Count: number;
    wellnessCompleted: boolean;
}

// --- Point Coefficients ---
const ACTION_POINTS = {
  C2: 10,
  R0: 10,
  R1: 50,
  R2: 50,
  R3: 120,
  WELLNESS: 2,
};

const initialActionCounts = {
    c2Count: 0,
    r0Count: 0,
    r1Count: 0,
    r2Count: 0,
    r3Count: 0,
};

const wellnessHabits = [
  { name: 'Sport', icon: Dumbbell, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { name: 'Écriture', icon: PenSquare, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { name: 'Lecture', icon: BookOpen, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  { name: 'Méditation', icon: Brain, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { name: 'Étirements', icon: PersonStanding, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  { name: 'Visualisation', icon: MoveUp, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
];

const actionDescriptions = {
    C2: "Invitations individuelles envoyées pour un RDV ou une conférence (appel ou SMS). Les invitations groupées ne sont pas comptabilisées.",
    R0: "Nombre de R0 menés en tête-à-tête ou d’invités présents à une (visio)conférence.",
    R1: "Rendez-vous formalisé dédié au recueil d’informations.",
    R2: "Présentation complète d’une ou plusieurs solutions patrimoniales. En cas de 3 solutions présentées sur plusieurs RDV, cliquer 3x.",
    R3: "Mise en place d’un placement financier, immobilier ou SCPI. 50€/mois d’AV équivaut à 300k€ de SCPI pour le scoring. Uniquement pour des prospects issus de R0 post-DéfiPro.",
    WELLNESS: "2 routines matinales réalisées selon vos engagements DéfiPro (écriture, sport, visualisation, méditation, étirement, etc.).",
}


export default function DefiPage() {
  // --- Hooks & State ---
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const todayString = format(new Date(), 'yyyy-MM-dd');
  
  const [actionCounts, setActionCounts] = React.useState(initialActionCounts);
  const [isWellnessCompleted, setIsWellnessCompleted] = React.useState(false);

  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const sessionDocRef = useMemoFirebase(() => userProfile?.sessionId ? doc(firestore, 'sessions', userProfile.sessionId) : null, [userProfile, firestore]);
  const { data: session, isLoading: isSessionLoading } = useDoc<Session>(sessionDocRef);
  
  const dailyProgressId = useMemoFirebase(() => user ? `${user.uid}_${todayString}` : null, [user, todayString]);
  const dailyProgressDocRef = useMemoFirebase(() => dailyProgressId ? doc(firestore, 'dailyProgress', dailyProgressId) : null, [dailyProgressId, firestore]);
  const { data: dailyProgress, isLoading: isProgressLoading } = useDoc<DailyChallengeProgress>(dailyProgressDocRef);

  // --- Update logic to use dailyProgress documents ---
  const updateFirestoreDaily = (dataToUpdate: Partial<DailyChallengeProgress>) => {
      if (!dailyProgressDocRef || !user || !userProfile?.sessionId) return;
      
      const fullData = { ...dataToUpdate, updatedAt: serverTimestamp() };
      const docExists = dailyProgress !== null && dailyProgress !== undefined;
      
      if (docExists) {
        updateDoc(dailyProgressDocRef, fullData)
          .catch(error => {
            const permissionError = new FirestorePermissionError({
                path: dailyProgressDocRef.path,
                operation: 'update',
                requestResourceData: fullData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      } else {
        const initialData = {
            userId: user.uid,
            sessionId: userProfile.sessionId,
            date: todayString,
            ...initialActionCounts,
            wellnessCompleted: false,
            ...fullData,
            createdAt: serverTimestamp(),
        };
         setDoc(dailyProgressDocRef, initialData)
            .catch(error => {
                const permissionError = new FirestorePermissionError({
                    path: dailyProgressDocRef.path,
                    operation: 'create',
                    requestResourceData: initialData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
      }
  };
  
  // --- Load data from Firestore into local state ---
  React.useEffect(() => {
    if (dailyProgress) {
        setActionCounts({
            c2Count: dailyProgress.c2Count || 0,
            r0Count: dailyProgress.r0Count || 0,
            r1Count: dailyProgress.r1Count || 0,
            r2Count: dailyProgress.r2Count || 0,
            r3Count: dailyProgress.r3Count || 0,
        });
        setIsWellnessCompleted(dailyProgress.wellnessCompleted || false);
    } else {
        // If there's no progress doc for today, reset local state
        setActionCounts(initialActionCounts);
        setIsWellnessCompleted(false);
    }
  }, [dailyProgress]);
  

  const handleActionChange = (actionName: keyof typeof actionCounts, value: number) => {
    // Optimistically update the UI
    setActionCounts(currentCounts => ({ ...currentCounts, [actionName]: value }));
    // Immediately send the update to Firestore for the daily doc
    updateFirestoreDaily({ [actionName]: value });
  };
  
  const handleValidateWellness = () => {
    if (isWellnessCompleted) return;
    
    // Optimistic update
    setIsWellnessCompleted(true);
    
    // Firestore update for the daily doc
    updateFirestoreDaily({ wellnessCompleted: true });
  };


  // --- Calculations ---
  const { totalChallengeDays, challengeDay, challengeDaysProgress, conferencePosition } = React.useMemo(() => {
    if (!session?.startDate || !session?.endDate) {
      return { totalChallengeDays: 45, challengeDay: 1, challengeDaysProgress: 0, conferencePosition: null };
    }

    const today = startOfDay(new Date());
    const startDate = startOfDay(session.startDate.toDate());
    const endDate = startOfDay(session.endDate.toDate());

    const totalDays = differenceInDays(endDate, startDate);
    const totalChallengeDays = totalDays >= 0 ? totalDays + 1 : 1;
    
    const currentDayNumber = differenceInDays(today, startDate) + 1;
    const challengeDayClamped = Math.max(1, Math.min(currentDayNumber, totalChallengeDays));
    const challengeProgressClamped = Math.min((challengeDayClamped / totalChallengeDays) * 100, 100);
    
    let confPos = null;
    if (userProfile?.conferenceDate && typeof userProfile.conferenceDate === 'string') {
      try {
        const confDate = startOfDay(parseISO(userProfile.conferenceDate));
        const confDay = differenceInDays(confDate, startDate);
        if (confDay >= 0 && confDay < totalChallengeDays) {
            confPos = ((confDay + 1) / totalChallengeDays) * 100;
        }
      } catch (e) {
        console.error("Invalid conference date format:", userProfile.conferenceDate, e);
      }
    }

    return { 
        totalChallengeDays: totalChallengeDays,
        challengeDay: challengeDayClamped, 
        challengeDaysProgress: challengeProgressClamped,
        conferencePosition: confPos,
    };
  }, [session, userProfile?.conferenceDate]);
  
  const isLoading = isProfileLoading || isSessionLoading || isProgressLoading;

  if (isLoading) {
    return (
       <div className="grid gap-8">
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
       </div>
    );
  }

  if (!session) {
      return (
          <Card>
              <CardHeader>
                <CardTitle>Défi non trouvé</CardTitle>
              </CardHeader>
              <CardContent>
                  <p>Il semble que tu ne sois pas encore associé(e) à une session de défi. Veuillez contacter un administrateur.</p>
              </CardContent>
          </Card>
      )
  }
  
  return (
    <TooltipProvider>
      <div className="grid gap-8">
        {/* --- Header Card --- */}
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-2xl">Mon Défi 45 jours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0">
            <TooltipProvider>
              <div className="relative pt-4 pb-2">
                <Progress value={challengeDaysProgress} className="h-3 bg-primary-foreground/20" indicatorClassName="bg-brand-accent-vivid" />
                {conferencePosition !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group"
                        style={{ left: `${conferencePosition}%` }}
                      >
                        <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center border-2 border-primary-foreground">
                          <CalendarCheck2 className="h-4 w-4 text-destructive-foreground" />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ta conférence !</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
            <div className="flex justify-between text-sm font-medium text-primary-foreground/90">
              <span>Jour {challengeDay} / {totalChallengeDays}</span>
              <span>{format(session.endDate.toDate(), "d MMM", { locale: fr })}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Ma Routine Professionnelle</CardTitle>
                <CardDescription>Transforme des prospects curieux en investisseurs éclairés.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
                <ActionCard title="C2 Invitation" points={ACTION_POINTS.C2} value={actionCounts.c2Count} onValueChange={(v) => handleActionChange('c2Count', v)} description={actionDescriptions.C2} colorClass="border-l-chart-1/40" bgColorClass="bg-chart-1/10"/>
                <ActionCard title="R0 Entretien découverte" points={ACTION_POINTS.R0} value={actionCounts.r0Count} onValueChange={(v) => handleActionChange('r0Count', v)} description={actionDescriptions.R0} colorClass="border-l-chart-2/40" bgColorClass="bg-chart-2/10"/>
                <ActionCard title="R1 Prise de connaissance" points={ACTION_POINTS.R1} value={actionCounts.r1Count} onValueChange={(v) => handleActionChange('r1Count', v)} description={actionDescriptions.R1} colorClass="border-l-chart-3/40" bgColorClass="bg-chart-3/10" />
                <ActionCard title="R2 Préconisation" points={ACTION_POINTS.R2} value={actionCounts.r2Count} onValueChange={(v) => handleActionChange('r2Count', v)} description={actionDescriptions.R2} colorClass="border-l-chart-4/40" bgColorClass="bg-chart-4/10" />
                <ActionCard title="R3 Souscription" points={ACTION_POINTS.R3} value={actionCounts.r3Count} onValueChange={(v) => handleActionChange('r3Count', v)} description={actionDescriptions.R3} colorClass="border-l-chart-5/40" bgColorClass="bg-chart-5/10" />
            </CardContent>
          </Card>


          {/* --- Wellness Routines --- */}
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-none">
                <Card>
                    <AccordionTrigger className="w-full hover:no-underline p-6">
                         <div className="flex-1 text-left">
                             <CardTitle>Ma Routine Bien-être</CardTitle>
                             <CardDescription className="mt-1.5">Ancre les habitudes qui soutiennent ta performance.</CardDescription>
                         </div>
                         <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="text-sm text-muted-foreground px-6 pb-6">{actionDescriptions.WELLNESS}</p>
                    </AccordionContent>
                    <CardContent className="flex flex-col items-center gap-8">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full">
                            {wellnessHabits.map(habit => {
                                const Icon = habit.icon;
                                return (
                                    <div key={habit.name} className="flex flex-col items-center justify-center gap-3 p-4 border rounded-lg bg-muted/40">
                                        <div className={cn("flex items-center justify-center h-12 w-12 rounded-lg", habit.bgColor)}>
                                            <Icon className={cn("h-6 w-6", habit.color)} />
                                        </div>
                                        <span className="text-sm font-medium text-center">{habit.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                        <Button
                            size="lg"
                            className="w-full max-w-md"
                            onClick={handleValidateWellness}
                            disabled={isWellnessCompleted}
                        >
                            {isWellnessCompleted ? (
                                <>
                                    <CheckCircle className="mr-2 h-5 w-5" />
                                    Routines du jour validées !
                                </>
                            ) : (
                                `J'ai fait au moins deux routines (+${ACTION_POINTS.WELLNESS} pts)`
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </AccordionItem>
        </Accordion>
      </div>
    </TooltipProvider>
  );
}
