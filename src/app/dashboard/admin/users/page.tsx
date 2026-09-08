

'use client';

import * as React from 'react';
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Mail, ArrowUpCircle, ArrowDownCircle, Users as UsersIcon, Search, Trophy, Crown, Gem, Calendar, LayoutGrid, List, Send, User } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { differenceInHours, format, formatRelative, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

type Session = {
  id: string;
  name: string;
  organizerName: string;
  secretCode: string;
  startDate: Timestamp;
  endDate: Timestamp;
  archived?: boolean;
};

type UserProfile = {
    id: string;
    name: string;
    surname: string;
    email: string;
    role: 'Admin' | 'Consultant';
    sessionId?: string;
    lastActivity?: string; // ISO 8601 string
}

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

// Helper to format Firestore Timestamps
function formatDate(timestamp: Timestamp | Date) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, 'dd/MM/yyyy');
}


const SessionHeader = ({ session, searchTerm }: { session: Session; searchTerm: string }) => {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(
        () => (firestore) ? query(collection(firestore, 'users'), where('sessionId', '==', session.id)) : null,
        [firestore, session.id]
    );
    const { data: users, isLoading } = useCollection<UserProfile>(usersQuery);

    const filteredCount = React.useMemo(() => {
        if (!users || !searchTerm) return users?.length ?? 0;
        const lowercasedFilter = searchTerm.toLowerCase();
        return users.filter(user =>
            user.name.toLowerCase().includes(lowercasedFilter) ||
            user.surname.toLowerCase().includes(lowercasedFilter) ||
            user.email.toLowerCase().includes(lowercasedFilter)
        ).length;
    }, [users, searchTerm]);


    return (
        <TooltipProvider>
            <div className="flex justify-between w-full items-center">
                <div className="flex items-center gap-4">
                    <OrganizerIcon organizerName={session.organizerName} />
                    <div className="flex flex-col text-left">
                        <span className="font-medium text-lg">{session.name}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(session.startDate)} - {formatDate(session.endDate)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
                        <UsersIcon className="h-4 w-4" />
                        {isLoading ? (
                            <Skeleton className="h-5 w-12" />
                        ) : (
                            <span>{filteredCount} / {users?.length ?? 0}</span>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};


const UserListBySession = ({ session, searchTerm }: { session: Session; searchTerm: string }) => {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(
        () => (firestore) ? query(collection(firestore, 'users'), where('sessionId', '==', session.id)) : null,
        [firestore, session.id]
    );
    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const filteredUsers = React.useMemo(() => {
        if (!users) return [];
        if (!searchTerm) return users;

        const lowercasedFilter = searchTerm.toLowerCase();
        return users.filter(user =>
            user.name.toLowerCase().includes(lowercasedFilter) ||
            user.surname.toLowerCase().includes(lowercasedFilter) ||
            user.email.toLowerCase().includes(lowercasedFilter)
        );
    }, [users, searchTerm]);
    
    if (usersLoading) {
        return (
            <div className="space-y-2 px-4 pb-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        )
    }

    if (!users || users.length === 0) {
        return <p className="text-sm text-muted-foreground px-4 pb-4">Aucun consultant n'est inscrit à cette session pour le moment.</p>
    }

    return (
        <TooltipProvider>
            <div className="px-4 pb-4 space-y-4">
                {filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun utilisateur ne correspond à ta recherche dans cette session.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Activité</TableHead>
                                <TableHead className="w-[80px]">Avatar</TableHead>
                                <TableHead>Nom</TableHead>
                                <TableHead>Prénom</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map(user => {
                                const { isActive, label } = getActivityStatus(user.lastActivity);
                                const avatarColor = generateColorFromId(user.id);
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    {isActive ? (
                                                        <ArrowUpCircle className="h-5 w-5 text-blue-500" />
                                                    ) : (
                                                        <ArrowDownCircle className="h-5 w-5 text-red-500" />
                                                    )}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{label}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <Avatar>
                                                <AvatarFallback className={cn(avatarColor, "text-primary-foreground")}>
                                                    <User className="h-5 w-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium">{user.surname}</TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <a href={`mailto:${user.email}`}>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Envoyer un email</span>
                                                            <Mail className="h-4 w-4" />
                                                        </Button>
                                                    </a>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Envoyer un email</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </TooltipProvider>
    )

}

const AllUsersTable = ({ users, sessions, searchTerm, showSessionColumn = true }: { users: UserProfile[], sessions: Session[], searchTerm: string, showSessionColumn?: boolean }) => {

    const sessionsMap = React.useMemo(() => 
        sessions.reduce((acc, session) => {
            acc[session.id] = session.name;
            return acc;
        }, {} as Record<string, string>), 
    [sessions]);

    const filteredUsers = React.useMemo(() => {
        if (!users) return [];
        if (!searchTerm) return users;

        const lowercasedFilter = searchTerm.toLowerCase();
        return users.filter(user =>
            user.name?.toLowerCase().includes(lowercasedFilter) ||
            user.surname?.toLowerCase().includes(lowercasedFilter) ||
            user.email.toLowerCase().includes(lowercasedFilter)
        );
    }, [users, searchTerm]);
    
    if (filteredUsers.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-8">Aucun utilisateur ne correspond à ta recherche.</p>;
    }

    return (
        <TooltipProvider>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">Activité</TableHead>
                        <TableHead className="w-[80px]">Avatar</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Email</TableHead>
                        {showSessionColumn && <TableHead>Session</TableHead>}
                        <TableHead>Rôle</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUsers.map(user => {
                        const { isActive, label } = getActivityStatus(user.lastActivity);
                        const avatarColor = generateColorFromId(user.id);
                        return (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Tooltip><TooltipTrigger>
                                        {isActive ? <ArrowUpCircle className="h-5 w-5 text-blue-500" /> : <ArrowDownCircle className="h-5 w-5 text-red-500" />}
                                    </TooltipTrigger><TooltipContent><p>{label}</p></TooltipContent></Tooltip>
                                </TableCell>
                                <TableCell>
                                    <Avatar>
                                        <AvatarFallback className={cn(avatarColor, "text-primary-foreground")}>
                                            <User className="h-5 w-5" />
                                        </AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell className="font-medium">{user.surname ?? 'N/A'}</TableCell>
                                <TableCell>{user.name ?? 'N/A'}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                {showSessionColumn && <TableCell>{user.sessionId ? sessionsMap[user.sessionId] ?? 'N/A' : 'N/A'}</TableCell>}
                                <TableCell>
                                    <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <a href={`mailto:${user.email}`}>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Envoyer un email</span>
                                                    <Mail className="h-4 w-4" />
                                                </Button>
                                            </a>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Envoyer un email</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TooltipProvider>
    )
}

const OrganizerIcon = ({ organizerName }: { organizerName: string }) => {
    switch (organizerName) {
        case 'Xavier Nicoli':
            return <Trophy className="h-5 w-5 text-yellow-500" />;
        case 'Brice Furtak':
            return <Crown className="h-5 w-5 text-yellow-500" />;
        case 'Nicolas Rouquette':
            return <Gem className="h-5 w-5 text-yellow-500" />;
        default:
            return null;
    }
};

const getActivityStatus = (lastActivity?: string): { isActive: boolean; label: string } => {
    if (!lastActivity) {
        return { isActive: false, label: 'Aucune activité enregistrée' };
    }
    try {
        const lastActivityDate = parseISO(lastActivity);
        const now = new Date();
        const hoursSinceLastActivity = differenceInHours(now, lastActivityDate);

        if (hoursSinceLastActivity <= 24) {
            return { isActive: true, label: `Dernière activité: ${formatRelative(lastActivityDate, now, { locale: fr })}` };
        }
        return { isActive: false, label: `Dernière activité: ${formatRelative(lastActivityDate, now, { locale: fr })}` };
    } catch (e) {
        return { isActive: false, label: 'Date d\'activité invalide' };
    }
};

export default function AdminUsersPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [viewMode, setViewMode] = React.useState('session');


  // --- Security: Check user role and view mode ---
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

  // --- Fetch all sessions created by any admin ---
  const sessionsQuery = useMemoFirebase(
    () =>
      (firestore && isAdmin)
        ? query(collection(firestore, 'sessions'))
        : null,
    [firestore, isAdmin]
  );
  const {
    data: sessions,
    isLoading: sessionsLoading,
  } = useCollection<Session>(sessionsQuery);

  // Fetch all users to filter sessions based on search
  const allUsersQuery = useMemoFirebase(
    () => (firestore && isAdmin) ? query(collection(firestore, 'users')) : null,
    [firestore, isAdmin]
  );
  const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(allUsersQuery);

  const filteredSessions = React.useMemo(() => {
    if (!sessions) return [];
    // If search is active but users haven't loaded, return empty to avoid flicker
    if (searchTerm && usersLoading) return [];
    if (!searchTerm) return sessions;
    
    const lowercasedFilter = searchTerm.toLowerCase();
    const matchingSessionIds = new Set(
        allUsers
            ?.filter(user => 
                user.sessionId && (
                    user.name?.toLowerCase().includes(lowercasedFilter) ||
                    user.surname?.toLowerCase().includes(lowercasedFilter) ||
                    user.email.toLowerCase().includes(lowercasedFilter)
                )
            )
            .map(user => user.sessionId)
    );
    
    return sessions.filter(session => matchingSessionIds.has(session.id));

  }, [sessions, searchTerm, allUsers, usersLoading]);

  const adminUsers = React.useMemo(() => allUsers?.filter(u => u.role === 'Admin') ?? [], [allUsers]);
  const consultantUsers = React.useMemo(() => allUsers?.filter(u => u.role === 'Consultant') ?? [], [allUsers]);
  

  // --- Loading and access control states ---
  if (isUserLoading || isAdmin === null) {
    return <p>Vérification des droits et chargement des données...</p>;
  }

  if (!isAdmin) {
    return <p>Accès non autorisé. Tu vas être redirigé.</p>;
  }
  
  const isDataLoading = sessionsLoading || usersLoading;


  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des Utilisateurs</CardTitle>
          <CardDescription>
            Consulte la liste des consultants inscrits, groupés par session ou dans une vue globale.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
                <div className="flex items-center justify-between mb-6">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Rechercher par nom, prénom ou email..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <TabsList className="grid w-full grid-cols-2 max-w-[280px]">
                        <TabsTrigger value="session">
                            <List className="mr-2 h-4 w-4" />
                            Vue par Session
                        </TabsTrigger>
                        <TabsTrigger value="table">
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            Vue Globale
                        </TabsTrigger>
                    </TabsList>
                </div>
                
                {isDataLoading ? <p>Chargement des données...</p> : (
                  <>
                    <TabsContent value="session">
                        {filteredSessions && filteredSessions.length > 0 ? (
                            <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={filteredSessions.length === 1 ? filteredSessions[0].id : undefined}>
                                {filteredSessions.filter(s => !s.archived).map(session => (
                                    <AccordionItem value={session.id} key={session.id} className="border rounded-lg">
                                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                            <SessionHeader session={session} searchTerm={searchTerm} />
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <UserListBySession session={session} searchTerm={searchTerm}/>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                {searchTerm 
                                    ? "Aucune session ne contient d'utilisateur correspondant à ta recherche."
                                    : "Aucune session n'a été créée pour le moment."
                                }
                            </p>
                        )}
                    </TabsContent>
                    <TabsContent value="table">
                        {allUsers && sessions && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-xl font-semibold mb-4">Administrateurs</h3>
                                    <div className="border rounded-lg">
                                        <AllUsersTable 
                                            users={adminUsers} 
                                            sessions={sessions} 
                                            searchTerm={searchTerm}
                                            showSessionColumn={false}
                                        />
                                    </div>
                                </div>
                                <Separator />
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-semibold">Consultants</h3>
                                    </div>
                                    <div className="border rounded-lg">
                                        <AllUsersTable 
                                            users={consultantUsers} 
                                            sessions={sessions} 
                                            searchTerm={searchTerm}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                  </>
                )}
            </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
