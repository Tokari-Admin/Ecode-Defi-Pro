
'use client';

import * as React from 'react';
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, Timestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Medal, ArrowUp, ArrowDown, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';


// --- Motion Card ---
const MotionCard = motion(Card);

// --- Data Types ---
type UserProfile = {
  id: string;
  name: string;
  surname: string;
  sessionId?: string;
  role: 'Admin' | 'Consultant';
};

type Session = {
    id: string;
    name: string;
}

type DailyChallengeProgress = {
  id: string;
  userId: string;
  sessionId: string;
  c2Count: number;
  r0Count: number;
  r1Count: number;
  r2Count: number;
  r3Count: number;
  wellnessCompleted: boolean;
};

type RankChange = 'up' | 'down' | 'same';

type RankedUser = {
  rank: number;
  userId: string;
  name: string;
  surname: string;
  score: number;
  rankChange: RankChange;
  sessionName?: string;
};

// --- Point Coefficients ---
const ACTION_POINTS = {
  C2: 10,
  R0: 10,
  R1: 50,
  R2: 50,
  R3: 120,
  WELLNESS: 2,
};

// --- Color generation for avatar ---
const avatarColors = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", 
  "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500", 
  "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500", 
  "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
];

const generateColorFromId = (id: string) => {
    if (!id) return avatarColors[0];
    const charCodeSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatarColors[charCodeSum % avatarColors.length];
};

// --- Helper Functions ---
const calculateScoreForSingleDay = (progress: DailyChallengeProgress | undefined): number => {
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

const calculateTotalScore = (progressList: DailyChallengeProgress[]): number => {
    return progressList.reduce((total, daily) => total + calculateScoreForSingleDay(daily), 0);
}

const RankIndicator = ({ rank }: { rank: number }) => {
    const medalColors = {
      1: "text-yellow-400",
      2: "text-gray-400",
      3: "text-yellow-600",
    };
    const colorClass = medalColors[rank as keyof typeof medalColors];
    
    if (rank <= 3) {
      return <Medal className={`h-6 w-6 ${colorClass}`} />;
    }
    return <span className="font-bold text-lg text-muted-foreground w-6 text-center">{rank}</span>;
}

const RankChangeIndicator = ({ change }: { change: RankChange }) => {
  if (change === 'up') return <ArrowUp className="h-4 w-4 text-green-500" />;
  if (change === 'down') return <ArrowDown className="h-4 w-4 text-red-500" />;
  return null;
}

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

const UserRankingCard = ({ rankedUser, isCurrentUser }: { rankedUser: RankedUser; isCurrentUser: boolean }) => {
    const avatarColor = generateColorFromId(rankedUser.userId);
    return (
        <MotionCard 
            key={rankedUser.userId} 
            className="overflow-hidden shadow-md transition-shadow hover:shadow-lg hover:-translate-y-1"
            variants={itemVariants}
        >
            <div className="flex items-stretch">
                <div className="flex flex-col items-center justify-center gap-1 p-3 bg-muted/50 w-24">
                        <RankIndicator rank={rankedUser.rank} />
                </div>
                <div className="flex flex-1 items-center gap-4 p-3">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback className={cn(avatarColor, "text-primary-foreground")}>
                            <User className="h-6 w-6" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <span className="font-medium">
                            {isCurrentUser ? 'Moi' : `${rankedUser.name} ${rankedUser.surname}`}
                        </span>
                         {rankedUser.sessionName && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Shield className="h-3 w-3"/>
                                <span>{rankedUser.sessionName}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                        <div>
                            <p className="font-bold text-xl">{rankedUser.score}</p>
                            <p className="text-xs text-muted-foreground">points</p>
                        </div>
                        <div className="w-4">
                            <RankChangeIndicator change={rankedUser.rankChange} />
                        </div>
                    </div>
                </div>
            </div>
        </MotionCard>
    );
}

// --- Main Page Component ---
export default function ClassementPage() {
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();

  // --- Session Ranking Data ---
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const currentSessionId = userProfile?.sessionId;

  const sessionUsersQuery = useMemoFirebase(() => (firestore && currentSessionId) ? query(collection(firestore, 'users'), where('sessionId', '==', currentSessionId)) : null, [firestore, currentSessionId]);
  const { data: sessionUsers, isLoading: sessionUsersLoading } = useCollection<UserProfile>(sessionUsersQuery);

  const sessionProgressQuery = useMemoFirebase(() => (firestore && currentSessionId) ? query(collection(firestore, 'dailyProgress'), where('sessionId', '==', currentSessionId)) : null, [firestore, currentSessionId]);
  const { data: sessionProgress, isLoading: sessionProgressLoading } = useCollection<DailyChallengeProgress>(sessionProgressQuery);
  
  // --- Global Ranking Data ---
  const allUsersQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'users')) : null, [firestore, user]);
  const { data: allUsers, isLoading: allUsersLoading } = useCollection<UserProfile>(allUsersQuery);

  const allProgressQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'dailyProgress')) : null, [firestore, user]);
  const { data: allProgress, isLoading: allProgressLoading } = useCollection<DailyChallengeProgress>(allProgressQuery);
  
  const allSessionsQuery = useMemoFirebase(() => (firestore && user) ? query(collection(firestore, 'sessions')) : null, [firestore, user]);
  const { data: allSessions, isLoading: allSessionsLoading } = useCollection<Session>(allSessionsQuery);


  // --- Memoized Data Processing ---
  const sessionRanking = React.useMemo(() => {
    if (sessionUsersLoading || sessionProgressLoading || !sessionUsers || !currentSessionId) {
      return [];
    }

    const storageKey = `ranking-session-${currentSessionId}`;
    let previousRanking: { [userId: string]: number } = {};
    if (typeof window !== 'undefined') {
        try { const stored = localStorage.getItem(storageKey); if (stored) previousRanking = JSON.parse(stored); } catch (e) { console.error("Failed to read previous ranking", e); }
    }
    
    // Group progress by user
    const userProgressMap = new Map<string, DailyChallengeProgress[]>();
    for (const progress of sessionProgress ?? []) {
        if (!userProgressMap.has(progress.userId)) {
            userProgressMap.set(progress.userId, []);
        }
        userProgressMap.get(progress.userId)!.push(progress);
    }
    
    const rankedUsers: Omit<RankedUser, 'rank' | 'rankChange'>[] = sessionUsers.map(u => ({
      userId: u.id, name: u.name, surname: u.surname, score: calculateTotalScore(userProgressMap.get(u.id) ?? []),
    }));
    
    rankedUsers.sort((a, b) => b.score - a.score);

    const newRankingWithChanges: RankedUser[] = rankedUsers.map((u, index) => {
        const rank = index + 1;
        const prevRank = previousRanking[u.userId];
        let rankChange: RankChange = 'same';
        if (prevRank !== undefined) { if (rank < prevRank) rankChange = 'up'; else if (rank > prevRank) rankChange = 'down'; }
        return { ...u, rank, rankChange };
    });

    if (typeof window !== 'undefined') {
        const newRankingToStore = Object.fromEntries(newRankingWithChanges.map(u => [u.userId, u.rank]));
        try { localStorage.setItem(storageKey, JSON.stringify(newRankingToStore)); } catch(e) { console.error("Failed to save ranking", e); }
    }

    return newRankingWithChanges;
  }, [sessionUsers, sessionProgress, sessionUsersLoading, sessionProgressLoading, currentSessionId]);

  const pantheonRanking = React.useMemo(() => {
    if (allUsersLoading || allProgressLoading || allSessionsLoading || !allUsers || !allProgress || !allSessions) {
        return [];
    }

    const usersMap = new Map(allUsers.map(u => [u.id, u]));
    const sessionsMap = new Map(allSessions.map(s => [s.id, s.name]));

    const scoreMap = new Map<string, { totalScore: number; sessionIds: Set<string> }>();

    for (const progress of allProgress) {
        const dailyScore = calculateScoreForSingleDay(progress);
        const existing = scoreMap.get(progress.userId) || { totalScore: 0, sessionIds: new Set() };
        existing.sessionIds.add(progress.sessionId);
        scoreMap.set(progress.userId, {
            totalScore: existing.totalScore + dailyScore,
            sessionIds: existing.sessionIds
        });
    }

    const rankedUsers: Omit<RankedUser, 'rank' | 'rankChange'>[] = [];
    for (const [userId, { totalScore, sessionIds }] of scoreMap.entries()) {
        const user = usersMap.get(userId);
        if (user) {
            const lastSessionId = Array.from(sessionIds).pop(); // Get one session for context
            rankedUsers.push({
                userId,
                name: user.name,
                surname: user.surname,
                score: totalScore,
                sessionName: lastSessionId ? sessionsMap.get(lastSessionId) : undefined,
            });
        }
    }
    
    rankedUsers.sort((a, b) => b.score - a.score);
    
    const top10 = rankedUsers.slice(0, 10);

    return top10.map((u, index) => ({ ...u, rank: index + 1, rankChange: 'same' })); // rankChange is not relevant here

  }, [allUsers, allProgress, allSessions, allUsersLoading, allProgressLoading, allSessionsLoading]);

  const isLoading = isAuthLoading || isProfileLoading;
  const isSessionDataLoading = sessionUsersLoading || sessionProgressLoading;
  const isGlobalDataLoading = allUsersLoading || allProgressLoading || allSessionsLoading;

  return (
    <div className="grid gap-6">
        <Tabs defaultValue="arena" className="w-full">
            <div className="flex justify-center mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="arena">L'Arène</TabsTrigger>
                    <TabsTrigger value="pantheon">Le Panthéon</TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="arena">
                <Card>
                    <CardHeader>
                    <CardTitle>L'Arène</CardTitle>
                    <CardDescription>
                        Seuls les plus déterminés atteignent le sommet. Quelle sera ta place ?
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading || isSessionDataLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-lg" />
                                <Skeleton className="h-20 w-full rounded-lg" />
                                <Skeleton className="h-20 w-full rounded-lg" />
                            </div>
                        ) : sessionRanking.length === 0 ? (
                            <p className="text-center text-muted-foreground mt-8">Aucun consultant dans cette session pour le moment.</p>
                        ) : (
                            <motion.div 
                                className="space-y-3"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {sessionRanking.map((rankedUser) => (
                                    <UserRankingCard key={rankedUser.userId} rankedUser={rankedUser} isCurrentUser={rankedUser.userId === user?.uid} />
                                ))}
                            </motion.div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="pantheon">
                <Card>
                    <CardHeader>
                        <CardTitle>Le Panthéon</CardTitle>
                        <CardDescription>
                            Le classement ultime des 10 meilleurs Défieurs de tous les temps.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading || isGlobalDataLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-lg" />
                                <Skeleton className="h-20 w-full rounded-lg" />
                                <Skeleton className="h-20 w-full rounded-lg" />
                            </div>
                        ) : pantheonRanking.length === 0 ? (
                            <p className="text-center text-muted-foreground mt-8">Le Panthéon est encore vide. Sois le premier à y entrer !</p>
                        ) : (
                            <motion.div 
                                className="space-y-3"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {pantheonRanking.map((rankedUser) => (
                                     <UserRankingCard key={rankedUser.userId} rankedUser={rankedUser} isCurrentUser={rankedUser.userId === user?.uid} />
                                ))}
                            </motion.div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
