'use client';

import * as React from 'react';
import { useUser, useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, Timestamp, updateDoc, increment } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Battery, Cloud, Sun, TrendingUp, Flame, Rocket, BarChart3, Target, Calendar, UserPlus, Plus, Minus, Pencil } from 'lucide-react';
import { differenceInDays, startOfDay, format, parseISO, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useCoachChat } from '@/context/coach-chat-context';
import { ConferenceEditModal } from '@/components/defi/conference-edit-modal';

type UserProfile = {
  name?: string;
  role?: 'Admin' | 'Consultant';
  sessionId?: string;
  conferenceDate?: string; // yyyy-MM-dd
  guestGoal?: number;
  conferenceGuestCount?: number;
};

type DailyChallengeProgress = {
  id: string;
  userId: string;
  date: string; // "yyyy-MM-dd"
  c2Count: number;
  r0Count: number;
  r1Count: number;
  r2Count: number;
  r3Count: number;
  wellnessCompleted: boolean;
};

type MoodEntry = {
    level: number;
    title: string;
};


// --- Points & Configs ---
const ACTION_POINTS = { C2: 10, R0: 10, R1: 30, R2: 50, R3: 150, WELLNESS: 2 };
const MOOD_CONFIG: { [key: number]: { icon: React.FC<any>, label: string, color: string, bgColor: string } } = {
  1: { icon: Battery, label: 'À plat', color: 'text-red-500', bgColor: 'bg-red-500/10' },
  2: { icon: Cloud, label: 'Neutre', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  3: { icon: Sun, label: 'Bien', color: 'text-green-500', bgColor: 'bg-green-100' },
  4: { icon: TrendingUp, label: 'Au top', color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  5: { icon: Flame, label: 'Excellent', color: 'text-orange-500', bgColor: 'bg-orange-100' },
};

// --- Action Colors ---
const ACTION_COLORS = {
  C2: 'hsl(var(--chart-1))',
  R0: 'hsl(var(--chart-2))',
  R1: 'hsl(var(--chart-3))',
  R2: 'hsl(var(--chart-4))',
  R3: 'hsl(var(--chart-5))',
};


// --- Helper Functions ---
const calculateSingleDayScore = (progress: DailyChallengeProgress | undefined): number => {
    if (!progress) return 0;
    const proScore =
      (progress.c2Count || 0) * ACTION_POINTS.C2 +
      (progress.r0Count || 0) * ACTION_POINTS.R0 +
      (progress.r1Count || 0) * ACTION_POINTS.R1 +
      (progress.r2Count || 0) * ACTION_POINTS.R2 +
      (progress.r3Count || 0) * ACTION_POINTS.R3;
    const habitScore = progress.wellnessCompleted ? ACTION_POINTS.WELLNESS : 0;
    return proScore + habitScore;
};

const calculateTotalScore = (progress: DailyChallengeProgress[] | undefined | null): number => {
  if (!progress || progress.length === 0) return 0;
  return progress.reduce((totalScore, daily) => totalScore + calculateSingleDayScore(daily), 0);
};

const StatCard = ({ title, value, icon, isLoading, unit, description, action }: { title: string, value: string | number, icon: React.ReactNode, isLoading: boolean, unit?: string, description?: string | null, action?: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="flex items-center gap-2">
        {action}
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-1/2" />
      ) : (
        <>
            <div className="text-2xl font-bold">
            {value} {unit && <span className="text-sm font-normal text-muted-foreground">{unit}</span>}
            </div>
             {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </>
      )}
    </CardContent>
  </Card>
);

const ConferenceGuestCard = ({ count, onIncrement, onDecrement, isLoading }: { count: number, onIncrement: () => void, onDecrement: () => void, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inscrits Conférence</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <UserPlus className="h-6 w-6 text-blue-500" />
            </div>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                 <Skeleton className="h-8 w-1/2" />
            ) : (
                <div className="flex items-center justify-center gap-4">
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={onDecrement} disabled={count === 0}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <div className="text-2xl font-bold min-w-[3ch] text-center">{count}</div>
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={onIncrement}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </CardContent>
    </Card>
);


const MoodCard = ({ mood, isLoading }: { mood: MoodEntry | null | undefined, isLoading: boolean}) => {
    if (isLoading) {
        return <StatCard title="Humeur du jour" value="" icon={<Skeleton className="h-10 w-10 rounded-lg"/>} isLoading={true} />;
    }
    
    const moodConfig = mood ? MOOD_CONFIG[mood.level] : null;
    const Icon = moodConfig?.icon;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Humeur du jour</CardTitle>
                {Icon && (
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", moodConfig?.bgColor)}>
                        <Icon className={cn("h-6 w-6", moodConfig?.color)} />
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {moodConfig ? (
                    <div className="text-2xl font-bold">{moodConfig.label}</div>
                ) : (
                    <div className="text-lg font-medium text-muted-foreground pt-2">Non renseignée</div>
                )}
            </CardContent>
        </Card>
    );
};

const handleLegendClick = (data: any, inactive: string[], setInactive: React.Dispatch<React.SetStateAction<string[]>>) => {
    const { dataKey } = data;
    if (inactive.includes(dataKey)) {
      setInactive(inactive.filter((i) => i !== dataKey));
    } else {
      setInactive([...inactive, dataKey]);
    }
};

// --- Main Dashboard Component ---
export default function DashboardPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState("today");
  const [inactiveActions, setInactiveActions] = React.useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const { addMessage } = useCoachChat();
  
  const notificationSent = React.useRef({
    streak: false,
    coaching: false,
    inactivity: false
  });


  // --- Data Fetching ---
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  // Redirect admin users
  React.useEffect(() => {
    if (!isUserLoading && !isProfileLoading && userProfile?.role === 'Admin') {
      router.replace('/dashboard/admin');
    }
  }, [userProfile, isUserLoading, isProfileLoading, router]);

  const sessionId = userProfile?.sessionId;

  // Fetch all daily progress for the user in the session
  const userProgressQuery = useMemoFirebase(() => (firestore && user && sessionId) ? query(collection(firestore, 'dailyProgress'), where('userId', '==', user.uid), where('sessionId', '==', sessionId)) : null, [firestore, user, sessionId]);
  const { data: userProgress, isLoading: isProgressLoading } = useCollection<DailyChallengeProgress>(userProgressQuery);

  const todayString = format(new Date(), 'yyyy-MM-dd');
  const moodEntryId = useMemoFirebase(() => user ? `${user.uid}_${todayString}` : null, [user, todayString]);
  const moodEntryRef = useMemoFirebase(() => moodEntryId ? doc(firestore, 'moodEntries', moodEntryId) : null, [moodEntryId, firestore]);
  const { data: mood, isLoading: isMoodLoading } = useDoc<MoodEntry>(moodEntryRef);

  const allSessionProgressQuery = useMemoFirebase(() => (firestore && sessionId) ? query(collection(firestore, 'dailyProgress'), where('sessionId', '==', sessionId)) : null, [firestore, sessionId]);
  const { data: allSessionProgress, isLoading: isAllProgressLoading } = useCollection<DailyChallengeProgress>(allSessionProgressQuery);
  
  const allUsersInSessionQuery = useMemoFirebase(() => (firestore && sessionId) ? query(collection(firestore, 'users'), where('sessionId', '==', sessionId)) : null, [firestore, sessionId]);
  const { data: allUsersInSession, isLoading: areUsersLoading } = useCollection(allUsersInSessionQuery);


  // --- Streak, Coaching & Inactivity Notification Logic ---
  React.useEffect(() => {
    if (isProgressLoading || !userProgress) return;
    
    const showCoachMessage = (message: React.ReactNode) => {
        addMessage(message);
    };

    const today = startOfDay(new Date());

    // --- Streak Logic ---
    if (!notificationSent.current.streak) {
        const sortedProgress = [...userProgress].sort((a, b) => b.date.localeCompare(a.date));
        let consecutiveDays = 0;
        let currentDate = today;
        
        for (const progress of sortedProgress) {
            const progressDate = parseISO(progress.date);
            if (isSameDay(progressDate, currentDate)) {
                if (progress.c2Count > 0 || progress.r0Count > 0) {
                    consecutiveDays++;
                    currentDate = subDays(currentDate, 1);
                } else break;
            } else if (startOfDay(progressDate) < subDays(currentDate, 1)) {
                break;
            }
        }
        
        if (consecutiveDays >= 3) {
            showCoachMessage(`Série de ${consecutiveDays} jours ! 🔥 Félicitations ! Maintenir une série d'actions quotidiennes est la clé du succès. Continue sur cette lancée !`);
            notificationSent.current.streak = true;
        }
    }
    
    // --- Coaching Logic (runs once) ---
    if (!notificationSent.current.coaching) {
        const sevenDaysAgo = subDays(today, 7);
        const last7DaysProgress = userProgress.filter(p => parseISO(p.date) > sevenDaysAgo);

        const totals = last7DaysProgress.reduce((acc, p) => {
            acc.c2 += p.c2Count || 0;
            acc.r0 += p.r0Count || 0;
            return acc;
        }, { c2: 0, r0: 0 });

        if (totals.c2 > 5 && totals.r0 < 2) {
            showCoachMessage(
                <>
                    Je vois que tu es très fort(e) pour les invitations (C2), c'est un excellent point !
                    <br/><br/>
                    Le secret maintenant, c'est de transformer cet élan en entretiens (R0). Planifie un moment pour relancer tes contacts.
                </>
            );
            notificationSent.current.coaching = true;
        }
        else if (totals.r0 > 2 && totals.c2 < 3) {
             showCoachMessage(
                 <>
                    Tes entretiens (R0) portent leurs fruits, bravo !
                    <br/><br/>
                    N'oublie pas d'alimenter continuellement le haut de ton tunnel avec de nouvelles invitations (C2) pour préparer la semaine prochaine.
                </>
            );
            notificationSent.current.coaching = true;
        }
    }
    
    // --- Inactivity Logic ---
    if (!notificationSent.current.inactivity) {
        const activeProgress = userProgress.filter(p => p.c2Count > 0 || p.r0Count > 0);
        if (activeProgress.length > 0) {
            const lastActivityDate = activeProgress.sort((a,b) => b.date.localeCompare(a.date))[0].date;
            const daysSinceLastActivity = differenceInDays(today, parseISO(lastActivityDate));

            if (daysSinceLastActivity >= 2 && daysSinceLastActivity < 7) { 
                 showCoachMessage("On garde le rythme ? Je ne t'ai pas vu(e) depuis quelques jours. Et si tu prenais 15 minutes aujourd'hui pour envoyer 3 invitations (C2) ? C'est le meilleur moyen de relancer la machine !");
                notificationSent.current.inactivity = true;
            }
        }
    }

  }, [userProgress, isProgressLoading, addMessage]);


  // --- Memoized Calculations ---
  const score = React.useMemo(() => calculateTotalScore(userProgress), [userProgress]);

  const rank = React.useMemo(() => {
    if (!allSessionProgress || !user) return 0;

    const userScores = new Map<string, number>();
    for (const progress of allSessionProgress) {
        const currentScore = userScores.get(progress.userId) || 0;
        const dailyScore = calculateSingleDayScore(progress);
        userScores.set(progress.userId, currentScore + dailyScore);
    }
    
    const rankedUsers = Array.from(userScores.entries())
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score);
      
    const userRank = rankedUsers.findIndex(u => u.userId === user.uid);
    return userRank !== -1 ? userRank + 1 : 0;
  }, [allSessionProgress, user]);
  
  const { conferenceDateFormatted } = React.useMemo(() => {
    if (!userProfile?.conferenceDate) return { conferenceDateFormatted: null };
    try {
        const confDate = startOfDay(parseISO(userProfile.conferenceDate));
        return {
            conferenceDateFormatted: format(confDate, 'd MMM', { locale: fr })
        };
    } catch {
        return { conferenceDateFormatted: null };
    }
  }, [userProfile?.conferenceDate]);
  
  const todayProgress = React.useMemo(() => {
    const todayData = userProgress?.find(p => p.date === todayString);
    if (!todayData) {
        return [{ name: 'C2', Répétitions: 0, fill: ACTION_COLORS.C2 },
                { name: 'R0', Répétitions: 0, fill: ACTION_COLORS.R0 },
                { name: 'R1', Répétitions: 0, fill: ACTION_COLORS.R1 },
                { name: 'R2', Répétitions: 0, fill: ACTION_COLORS.R2 },
                { name: 'R3', Répétitions: 0, fill: ACTION_COLORS.R3 }];
    }
    return [
        { name: 'C2', Répétitions: todayData.c2Count, fill: ACTION_COLORS.C2 },
        { name: 'R0', Répétitions: todayData.r0Count, fill: ACTION_COLORS.R0 },
        { name: 'R1', Répétitions: todayData.r1Count, fill: ACTION_COLORS.R1 },
        { name: 'R2', Répétitions: todayData.r2Count, fill: ACTION_COLORS.R2 },
        { name: 'R3', Répétitions: todayData.r3Count, fill: ACTION_COLORS.R3 },
    ];
  }, [userProgress, todayString]);

   const totalProgress = React.useMemo(() => {
    if (!userProgress) {
      return [{ name: 'C2', Répétitions: 0, fill: ACTION_COLORS.C2 },
              { name: 'R0', Répétitions: 0, fill: ACTION_COLORS.R0 },
              { name: 'R1', Répétitions: 0, fill: ACTION_COLORS.R1 },
              { name: 'R2', Répétitions: 0, fill: ACTION_COLORS.R2 },
              { name: 'R3', Répétitions: 0, fill: ACTION_COLORS.R3 }];
    }

    const totals = userProgress.reduce((acc, p) => {
        acc.c2Count += p.c2Count || 0;
        acc.r0Count += p.r0Count || 0;
        acc.r1Count += p.r1Count || 0;
        acc.r2Count += p.r2Count || 0;
        acc.r3Count += p.r3Count || 0;
        return acc;
    }, { c2Count: 0, r0Count: 0, r1Count: 0, r2Count: 0, r3Count: 0 });

    return [
      { name: 'C2', Répétitions: totals.c2Count, fill: ACTION_COLORS.C2 },
      { name: 'R0', Répétitions: totals.r0Count, fill: ACTION_COLORS.R0 },
      { name: 'R1', Répétitions: totals.r1Count, fill: ACTION_COLORS.R1 },
      { name: 'R2', Répétitions: totals.r2Count, fill: ACTION_COLORS.R2 },
      { name: 'R3', Répétitions: totals.r3Count, fill: ACTION_COLORS.R3 },
    ];
  }, [userProgress]);


  const generateChartData = (days: number) => {
    if (!userProgress) return [];
    
    const today = new Date();
    const startDate = subDays(today, days - 1);
    const dateInterval = eachDayOfInterval({ start: startDate, end: today });

    const progressByDate = new Map(userProgress.map(p => [p.date, p]));

    return dateInterval.map(date => {
        const dateString = format(date, 'yyyy-MM-dd');
        const progressDoc = progressByDate.get(dateString);
        return {
            date: format(date, 'dd/MM'),
            C2: progressDoc?.c2Count || 0,
            R0: progressDoc?.r0Count || 0,
            R1: progressDoc?.r1Count || 0,
            R2: progressDoc?.r2Count || 0,
            R3: progressDoc?.r3Count || 0,
        };
    });
  };
  
  const chartData7 = React.useMemo(() => generateChartData(7), [userProgress]);
  const chartData15 = React.useMemo(() => generateChartData(15), [userProgress]);
  const chartData30 = React.useMemo(() => generateChartData(30), [userProgress]);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="flex flex-col space-y-1 mb-2">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Date
              </span>
              <span className="font-bold text-muted-foreground">{label}</span>
            </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {payload.map((p: any) => (
               <div key={p.dataKey} className="flex items-center space-x-2">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.stroke }}></div>
                 <span className="text-xs text-muted-foreground">{p.name}:</span>
                 <span className="font-bold text-xs">{p.value}</span>
               </div>
            )).reverse()}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleGuestCountChange = (amount: number) => {
    if (userDocRef) {
        // Prevent count from going below zero
        const currentCount = userProfile?.conferenceGuestCount ?? 0;
        if (currentCount + amount < 0) return;

        updateDoc(userDocRef, {
            conferenceGuestCount: increment(amount)
        });
    }
  }


  const isLoading = isUserLoading || isProfileLoading || isProgressLoading || isMoodLoading || isAllProgressLoading || areUsersLoading;

  if (userProfile && userProfile.role !== 'Consultant' && !isLoading) {
    // This is for non-consultants who might land here by mistake before redirect
    return <p>Redirection en cours...</p>;
  }

  return (
    <div className="grid gap-6">
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          {isLoading ? (
            <Skeleton className="h-8 w-48 bg-primary-foreground/20" />
          ) : (
            <CardTitle>Bonjour, {userProfile?.name ?? 'Défieur'} !</CardTitle>
          )}
          <CardDescription className="text-primary-foreground/90">
            Voici un aperçu de ta progression dans le Défi45j.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MoodCard mood={mood} isLoading={isLoading} />
        <StatCard title="Mon Score" value={score} icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10"><Rocket className="h-6 w-6 text-yellow-500" /></div>} isLoading={isLoading} unit="pts" />
        <StatCard title="Classement" value={rank > 0 ? `${rank} / ${allUsersInSession?.length ?? 0}` : "-"} icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10"><BarChart3 className="h-6 w-6 text-blue-500" /></div>} isLoading={isLoading} />
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard 
                title="Ma Conférence" 
                value={conferenceDateFormatted ?? "-"} 
                icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10"><Calendar className="h-6 w-6 text-red-500" /></div>} 
                isLoading={isLoading}
                action={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setIsEditModalOpen(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
            />
            <StatCard 
                title="Objectif d'invités" 
                value={userProfile?.guestGoal ?? "-"} 
                icon={<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10"><Target className="h-6 w-6 text-green-500" /></div>} 
                isLoading={isLoading}
                unit={userProfile?.guestGoal ? 'invités' : ''}
            />
            <ConferenceGuestCard
                count={userProfile?.conferenceGuestCount ?? 0}
                onIncrement={() => handleGuestCountChange(1)}
                onDecrement={() => handleGuestCountChange(-1)}
                isLoading={isLoading}
            />
       </div>

       <Card>
            <Tabs defaultValue="today" onValueChange={setActiveTab}>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Analyse des Actions</CardTitle>
                            <CardDescription>Visualise tes performances sur différentes périodes.</CardDescription>
                        </div>
                        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-5">
                            <TabsTrigger value="today">Auj.</TabsTrigger>
                            <TabsTrigger value="7d">7 jours</TabsTrigger>
                            <TabsTrigger value="15d">15 jours</TabsTrigger>
                            <TabsTrigger value="30d">30 jours</TabsTrigger>
                            <TabsTrigger value="all">Tout</TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>
                <CardContent className="h-[350px] w-full pl-0">
                    {isLoading ? (
                        <div className="flex h-full w-full items-center justify-center">
                            <Skeleton className="h-full w-full" />
                        </div>
                    ) : (
                        <>
                            <TabsContent value="today" className="h-full mt-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={todayProgress} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} allowDecimals={false} />
                                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                                        <Bar dataKey="Répétitions" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </TabsContent>
                            
                            <TabsContent value="7d" className="h-full mt-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData7} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--muted))'}} />
                                        <Legend onClick={(data) => handleLegendClick(data, inactiveActions, setInactiveActions)} />
                                        <Bar dataKey="C2" fill={ACTION_COLORS.C2} name="C2" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('C2')} />
                                        <Bar dataKey="R0" fill={ACTION_COLORS.R0} name="R0" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R0')} />
                                        <Bar dataKey="R1" fill={ACTION_COLORS.R1} name="R1" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R1')} />
                                        <Bar dataKey="R2" fill={ACTION_COLORS.R2} name="R2" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R2')} />
                                        <Bar dataKey="R3" fill={ACTION_COLORS.R3} name="R3" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R3')} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </TabsContent>
                             <TabsContent value="15d" className="h-full mt-0">
                                <ResponsiveContainer width="100%" height="100%">
                                     <BarChart data={chartData15} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--muted))'}} />
                                        <Legend onClick={(data) => handleLegendClick(data, inactiveActions, setInactiveActions)} />
                                        <Bar dataKey="C2" fill={ACTION_COLORS.C2} name="C2" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('C2')} />
                                        <Bar dataKey="R0" fill={ACTION_COLORS.R0} name="R0" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R0')} />
                                        <Bar dataKey="R1" fill={ACTION_COLORS.R1} name="R1" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R1')} />
                                        <Bar dataKey="R2" fill={ACTION_COLORS.R2} name="R2" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R2')} />
                                        <Bar dataKey="R3" fill={ACTION_COLORS.R3} name="R3" barSize={8} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R3')} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </TabsContent>
                            <TabsContent value="30d" className="h-full mt-0">
                               <ResponsiveContainer width="100%" height="100%">
                                     <BarChart data={chartData30} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--muted))'}} />
                                        <Legend onClick={(data) => handleLegendClick(data, inactiveActions, setInactiveActions)} />
                                        <Bar dataKey="C2" fill={ACTION_COLORS.C2} name="C2" barSize={4} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('C2')} />
                                        <Bar dataKey="R0" fill={ACTION_COLORS.R0} name="R0" barSize={4} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R0')} />
                                        <Bar dataKey="R1" fill={ACTION_COLORS.R1} name="R1" barSize={4} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R1')} />
                                        <Bar dataKey="R2" fill={ACTION_COLORS.R2} name="R2" barSize={4} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R2')} />
                                        <Bar dataKey="R3" fill={ACTION_COLORS.R3} name="R3" barSize={4} radius={[4, 4, 0, 0]} hide={inactiveActions.includes('R3')} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </TabsContent>
                             <TabsContent value="all" className="h-full mt-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={totalProgress} margin={{ top: 5, right: 20, left: -10, bottom: 5 }} barCategoryGap="20%">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={true} allowDecimals={false} />
                                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                                        <Bar dataKey="Répétitions" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </TabsContent>
                        </>
                    )}
                </CardContent>
            </Tabs>
        </Card>

        <ConferenceEditModal 
          isOpen={isEditModalOpen} 
          onOpenChange={setIsEditModalOpen} 
          initialDate={userProfile?.conferenceDate}
          initialGoal={userProfile?.guestGoal}
        />
    </div>
  );
}
