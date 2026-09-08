
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
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { CoachChatProvider } from '@/context/coach-chat-context';
import { ChatCoach } from '@/components/defi/chat-coach';


type UserProfile = {
    name?: string;
    surname?: string;
    profileComplete?: boolean;
    role?: 'Admin' | 'Consultant';
    sessionId?: string;
    conferenceDate?: string;
    guestGoal?: number;
}

type Session = {
  startDate: Timestamp;
  endDate: Timestamp;
};

type MoodEntry = {
    id: string;
    level: number;
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


function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [showMoodModal, setShowMoodModal] = React.useState(false);
  const { isMobile } = useSidebar();
  
  // --- Data Fetching: Use a single source of truth for the user profile ---
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userDocRef);

  const todayString = format(new Date(), 'yyyy-MM-dd');
  const moodEntryId = useMemoFirebase(() => (user ? `${user.uid}_${todayString}` : null), [user, todayString]);
  const moodEntryRef = useMemoFirebase(() => moodEntryId ? doc(firestore, 'moodEntries', moodEntryId) : null, [moodEntryId, firestore]);
  const { data: moodEntry, isLoading: isMoodLoading } = useDoc<MoodEntry>(moodEntryRef);

  const sessionDocRef = useMemoFirebase(() => (userProfile?.sessionId ? doc(firestore, 'sessions', userProfile.sessionId) : null), [userProfile?.sessionId, firestore]);
  const { data: session } = useDoc<Session>(sessionDocRef);
  
  // --- Effect for activity tracking ---
  React.useEffect(() => {
    if (user && firestore) {
      const userRef = doc(firestore, 'users', user.uid);
      updateDoc(userRef, { lastActivity: new Date().toISOString() }).catch(() => {
        // This might fail if the document doesn't exist yet, which is fine during registration.
      });
    }
  }, [user, firestore]);


  // --- Effect for showing mood/onboarding modal ---
  React.useEffect(() => {
    if (!isProfileLoading && userProfile) {
        const isConsultant = userProfile.role === 'Consultant';
        const onboardingComplete = userProfile.profileComplete;

        if (isConsultant && onboardingComplete && !moodEntry && !isMoodLoading) {
            setShowMoodModal(true);
        } else {
            setShowMoodModal(false);
        }
    }
  }, [isProfileLoading, userProfile, moodEntry, isMoodLoading]);

  
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
  
  // This state is now managed directly by the useDoc hook
  const onProfileComplete = () => {
      // The useDoc hook will automatically update the userProfile data,
      // which will trigger re-renders. No need to manually refetch.
  }

  // --- DERIVED STATE ---
  const needsOnboarding = !isLoading && user && userProfile?.role === 'Consultant' && !userProfile.profileComplete;
  const canShowModals = !isLoading && user && userProfile?.profileComplete;
  const showPageContent = !isLoading && user && (userProfile?.profileComplete || userProfile?.role === 'Admin');

  const showActiveMoodModal = canShowModals && showMoodModal;
  const showOverlay = showActiveMoodModal || needsOnboarding;
  const avatarColor = user ? generateColorFromId(user.uid) : 'bg-muted';
  
  // --- RENDER LOGIC ---
  if (isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
          <p>Chargement du profil...</p>
      </div>
    );
  }

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
                    {`${userProfile?.name ?? ''} ${userProfile?.surname ?? 'Utilisateur'}`}
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
            {showPageContent && children}
        </main>
        {needsOnboarding && (
            <OnboardingForm onProfileComplete={onProfileComplete} session={session} />
        )}
        {showActiveMoodModal && (
            <MoodTrackerModal 
                isOpen={showActiveMoodModal}
                onClose={() => setShowMoodModal(false)}
                onSelectMood={handleMoodSelected}
            />
        )}
        {showPageContent && userProfile?.role === 'Consultant' && <ChatCoach />}
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
      <CoachChatProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </CoachChatProvider>
    </SidebarProvider>
  );
}
