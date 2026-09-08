'use client';

import Link from 'next/link';
import * as React from 'react';
import { Bell, User, LogOut, Settings, UserCircle, ChevronsLeft } from 'lucide-react';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/logo';
import { FullscreenToggle } from '@/components/fullscreen-toggle';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { MoodTrackerModal, type MoodOption } from '@/components/defi/mood-tracker-modal';


type UserProfile = {
    name?: string;
    surname?: string;
    profileComplete?: boolean;
    role?: 'Admin' | 'Consultant';
    sessionId?: string;
    conferenceDate?: string;
}

type Session = {
  startDate: Timestamp;
  endDate: Timestamp;
};

type MoodEntry = {
    id: string;
    level: number;
}

type ChallengeProgressData = {
    c5ClientCount?: number;
    c5FilleulCount?: number;
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


function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = React.useState(true);
  const [showMoodModal, setShowMoodModal] = React.useState(false);
  const { state, toggleSidebar, isMobile } = useSidebar();
  
  const todayString = format(new Date(), 'yyyy-MM-dd');
  const moodEntryId = useMemoFirebase(() => user ? `${user.uid}_${todayString}` : null, [user, todayString]);
  const moodEntryRef = useMemoFirebase(() => moodEntryId ? doc(firestore, 'moodEntries', moodEntryId) : null, [moodEntryId, firestore]);
  const { data: moodEntry, isLoading: isMoodLoading } = useDoc<MoodEntry>(moodEntryRef);

  const progressId = useMemoFirebase(() => user && userProfile?.sessionId ? `${user.uid}_${userProfile.sessionId}` : null, [user, userProfile]);
  const progressDocRef = useMemoFirebase(() => progressId ? doc(firestore, 'challengeProgress', progressId) : null, [progressId, firestore]);
  const { data: challengeProgress } = useDoc<ChallengeProgressData>(progressDocRef);

  const sessionDocRef = useMemoFirebase(() => userProfile?.sessionId ? doc(firestore, 'sessions', userProfile.sessionId) : null, [userProfile?.sessionId, firestore]);
  const { data: session } = useDoc<Session>(sessionDocRef);
  

   const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Logout failed:", error);
       toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de se déconnecter.',
      });
    }
  };

  const fetchProfile = async () => {
    if (user && firestore) {
        try {
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const profile = userDoc.data() as UserProfile;
                setUserProfile(profile);
                return profile;
            }
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
        }
    }
    return null;
  };

  React.useEffect(() => {
    const trackActivityAndFetchProfile = async () => {
      if (user && firestore && !isMoodLoading) {
        setIsProfileLoading(true);
        const userRef = doc(firestore, 'users', user.uid);
        
        try {
          updateDoc(userRef, { lastActivity: new Date().toISOString() });
          
          const profile = await fetchProfile();

          if (profile) {
            const isConsultant = profile.role === 'Consultant';
            
            const onboardingComplete = isConsultant ? profile.profileComplete : true;

            // Show mood modal if onboarding is done and mood for today hasn't been logged
            if (onboardingComplete && !moodEntry && isConsultant) {
                setShowMoodModal(true);
            } else {
                setShowMoodModal(false);
            }
            
          } else {
             setShowMoodModal(false);
          }

        } catch (error) {
          console.error("Failed to update last activity or fetch profile:", error);
        } finally {
            setIsProfileLoading(false);
        }
      } else if (!isUserLoading && !user) {
        setIsProfileLoading(false);
      }
    };
    
    trackActivityAndFetchProfile();

  }, [user, isUserLoading, firestore, moodEntry, isMoodLoading]);

  const handleMoodSelected = async (mood: MoodOption) => {
    if (!moodEntryRef || !user) return;
    try {
      await setDoc(moodEntryRef, {
        userId: user.uid,
        date: todayString,
        level: mood.level,
        title: mood.title,
        createdAt: serverTimestamp(),
      });
      setShowMoodModal(false);
      toast({
        title: "Humeur enregistrée !",
        description: "Merci pour ton partage. Passe une excellente journée.",
      });
    } catch (error) {
        console.error("Failed to save mood entry:", error);
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible d'enregistrer ton humeur.",
        });
    }
  };

  const isLoading = isUserLoading || isProfileLoading;
  const showOverlay = showMoodModal;
  const avatarColor = user ? generateColorFromId(user.uid) : 'bg-muted';


  return (
    <>
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
          <div className={cn("flex items-center", isMobile ? 'gap-2' : 'gap-4')}>
            <SidebarTrigger />
          </div>
          <div className="flex-1" />
          <FullscreenToggle />
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-transparent focus-visible:ring-transparent focus-visible:ring-offset-0">
                <Avatar className="h-9 w-9 border">
                   <AvatarFallback className={cn(avatarColor, "text-primary-foreground")}>
                      <User className="h-5 w-5" />
                   </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {isLoading ? 'Chargement...' : `${userProfile?.name ?? ''} ${userProfile?.surname ?? 'Utilisateur'}`}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className={cn("flex-1 p-4 sm:p-6", showOverlay && "blur-sm pointer-events-none")}>
            {children}
        </main>
        {showMoodModal && (
            <MoodTrackerModal 
                isOpen={showMoodModal}
                onClose={() => setShowMoodModal(false)}
                onSelectMood={handleMoodSelected}
            />
        )}
      </SidebarInset>
    </>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}