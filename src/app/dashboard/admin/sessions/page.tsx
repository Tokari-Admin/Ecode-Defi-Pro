

'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  collection,
  serverTimestamp,
  query,
  doc,
  deleteDoc,
  getDoc,
  updateDoc,
  Timestamp,
  writeBatch,
  where,
  getDocs,
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Copy, Trash2, ChevronDown, Archive, MoreHorizontal, Trophy, Crown, Gem } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';


const formSchema = z
  .object({
    name: z.string().min(1, { message: 'Le nom de la session est requis.' }),
    organizerName: z
      .string({ required_error: "Le nom de l'organisateur est requis."}).min(1, { message: "Le nom de l'organisateur est requis."}),
    startDate: z.date({ required_error: 'La date de début est requise.' }),
    endDate: z.date({ required_error: 'La date de fin est requise.' }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'La date de fin doit être après la date de début.',
    path: ['endDate'],
  });

// --- Helper function to generate a random code ---
function generateSecretCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type Session = {
  id: string;
  name: string;
  organizerName: string;
  secretCode: string;
  startDate: Timestamp;
  endDate: Timestamp;
  archived?: boolean;
}

// Helper to format Firestore Timestamps
function formatDate(timestamp: Timestamp | Date) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return format(date, 'dd/MM/yyyy');
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


export default function AdminSessionsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [sessionToAction, setSessionToAction] = React.useState<{ session: Session; action: 'delete' | 'archive' | 'unarchive' } | null>(null);


  const [activeSessions, setActiveSessions] = React.useState<Session[]>([]);
  const [archivedSessions, setArchivedSessions] = React.useState<Session[]>([]);

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


  // --- Fetch all sessions ---
  const sessionsQuery = useMemoFirebase(
    () =>
      isAdmin
        ? query(collection(firestore, 'sessions'))
        : null,
    [firestore, isAdmin]
  );
  const {
    data: allSessions,
    isLoading: sessionsLoading,
  } = useCollection(sessionsQuery);

  // --- Filter sessions into active and archived ---
  React.useEffect(() => {
    if (allSessions) {
      const active = allSessions.filter((s: any) => !s.archived);
      const archived = allSessions.filter((s: any) => s.archived);
      setActiveSessions(active);
      setArchivedSessions(archived);
    }
  }, [allSessions]);


  // --- Form setup ---
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      organizerName: '',
      startDate: undefined,
      endDate: undefined,
    },
  });

  // --- Watch for startDate changes to auto-update endDate ---
  const startDate = useWatch({
    control: form.control,
    name: 'startDate',
  });

  React.useEffect(() => {
    if (startDate) {
      const newEndDate = addDays(startDate, 45);
      form.setValue('endDate', newEndDate, { shouldValidate: true });
    }
  }, [startDate, form]);

  // --- Form submission handler ---
  const handleCreateSession = async (values: z.infer<typeof formSchema>) => {
    if (!isAdmin || !user) return;

    setIsLoading(true);

    const secretCode = generateSecretCode();
    const sessionsRef = collection(firestore, 'sessions');

    addDocumentNonBlocking(sessionsRef, {
        name: values.name,
        organizerName: values.organizerName,
        startDate: values.startDate,
        endDate: values.endDate,
        secretCode: secretCode,
        adminId: user?.uid, // We still tag who created it
        createdAt: serverTimestamp(),
        archived: false,
      });
    
    form.reset({
      name: '',
      organizerName: '',
      startDate: undefined,
      endDate: undefined,
    });
    
    setIsLoading(false);
  };
  
  // --- Batch update users ---
  const updateUserStatusForSession = async (sessionId: string, archive: boolean) => {
    if (!isAdmin) return;
    
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('sessionId', '==', sessionId));
    
    try {
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(firestore);
      
      querySnapshot.forEach((userDoc) => {
        batch.update(userDoc.ref, { archived: archive });
      });

      await batch.commit();
    } catch (error) {
        console.error(`Error updating users for session ${sessionId}:`, error);
        throw new Error("Impossible de mettre à jour le statut des utilisateurs associés.");
    }
  };


 const handleConfirmAction = async () => {
    if (!isAdmin || !sessionToAction) return;

    const { session, action } = sessionToAction;

    try {
        if (action === 'delete') {
            await updateUserStatusForSession(session.id, true); // Archive users
            await deleteDoc(doc(firestore, 'sessions', session.id));
            toast({
                variant: "default",
                title: "Succès",
                description: `La session "${session.name}" a été supprimée et ses utilisateurs archivés.`,
            });
        } else if (action === 'archive') {
            await updateUserStatusForSession(session.id, true);
            await updateDoc(doc(firestore, 'sessions', session.id), { archived: true });
            toast({
                variant: "default",
                title: "Succès",
                description: `La session "${session.name}" et ses utilisateurs ont été archivés.`,
            });
        } else if (action === 'unarchive') {
            await updateUserStatusForSession(session.id, false);
            await updateDoc(doc(firestore, 'sessions', session.id), { archived: false });
             toast({
                variant: "default",
                title: "Succès",
                description: `La session "${session.name}" et ses utilisateurs ont été désarchivés.`,
            });
        }
    } catch (error) {
        console.error(`Error performing action ${action} on session:`, error);
        toast({
            variant: "destructive",
            title: "Erreur",
            description: `Impossible d'exécuter l'action sur la session.`,
        });
    } finally {
        setSessionToAction(null);
    }
 };


  const copyToClipboard = (text: string) => {
    if (typeof window !== 'undefined') {
        navigator.clipboard.writeText(text);
    }
  };
  
  // --- Loading and access control states ---
  if (isUserLoading || isAdmin === null) {
    return <p>Vérification des droits en cours...</p>;
  }

  if (!isAdmin) {
    // This will be briefly visible before the redirect in useEffect kicks in.
    // The redirect is the primary security measure.
    return <p>Accès non autorisé. Tu vas être redirigé.</p>;
  }

  const getAlertDialogStrings = () => {
    if (!sessionToAction) return { title: '', description: ''};
    const { session, action } = sessionToAction;
    switch(action) {
        case 'delete':
            return {
                title: 'Supprimer la session',
                description: `Êtes-vous sûr de vouloir supprimer la session "${session.name}" ? Cette action est irréversible et archivera tous les utilisateurs associés.`,
                confirmText: 'Supprimer'
            };
        case 'archive':
             return {
                title: 'Archiver la session',
                description: `Êtes-vous sûr de vouloir archiver la session "${session.name}" ? Tous les utilisateurs associés seront également archivés.`,
                confirmText: 'Archiver'
            };
        case 'unarchive':
             return {
                title: 'Désarchiver la session',
                description: `Êtes-vous sûr de vouloir désarchiver la session "${session.name}" ? Tous les utilisateurs associés seront également désarchivés.`,
                confirmText: 'Désarchiver'
            };
        default:
             return { title: '', description: '', confirmText: 'Confirmer' };
    }
  }


  return (
    <div className="grid gap-6">
      <Accordion type="multiple" className="w-full space-y-6" defaultValue={['create-session']}>
        {/* --- Create Session Card --- */}
        <AccordionItem value="create-session" className="border-none">
          <Card>
            <AccordionTrigger className="flex w-full items-center justify-between p-6 hover:no-underline [&_svg]:data-[state=open]:rotate-180">
              <div className="text-left">
                <CardTitle>Créer une Session</CardTitle>
                <CardDescription>
                  Crée et gère les sessions du Défi 45 jours.
                </CardDescription>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleCreateSession)}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom de la session</FormLabel>
                            <FormControl>
                              <Input placeholder="Défi Pro Printemps 2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="organizerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organisateur</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionne un organisateur" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Xavier Nicoli">Xavier Nicoli</SelectItem>
                                <SelectItem value="Brice Furtak">Brice Furtak</SelectItem>
                                <SelectItem value="Nicolas Rouquette">Nicolas Rouquette</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Début du Défi45j</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={'outline'}
                                    className={cn(
                                      'w-full pl-3 text-left font-normal hover:bg-transparent hover:text-foreground',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, 'PPP')
                                    ) : (
                                      <span>Choisis une date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Fin du Défi45j</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={'outline'}
                                    disabled // Prevent manual changes
                                    className={cn(
                                      'w-full pl-3 text-left font-normal hover:bg-transparent hover:text-foreground',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, 'PPP')
                                    ) : (
                                      <span>Calculée automatiquement</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled // Also disable the calendar itself
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
                      {isLoading ? 'Création en cours...' : 'Créer la session'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
        
        {/* --- List Active Sessions Card --- */}
        <AccordionItem value="active-sessions" className="border-none">
            <Card>
                 <AccordionTrigger className="flex w-full items-center justify-between p-6 hover:no-underline [&_svg]:data-[state=open]:rotate-180">
                    <div className="text-left">
                        <CardTitle>Sessions Actives</CardTitle>
                        <CardDescription>
                          Liste de toutes les sessions en cours.
                        </CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                </AccordionTrigger>
                <AccordionContent>
                    <CardContent className="pt-0">
                        {sessionsLoading && <p>Chargement des sessions...</p>}
                        {!sessionsLoading && activeSessions.length === 0 && (
                            <p className="text-sm text-muted-foreground">Aucune session active pour le moment.</p>
                        )}
                        {!sessionsLoading && activeSessions.length > 0 && (
                            <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Organisateur</TableHead>
                                <TableHead>Période</TableHead>
                                <TableHead>Code Secret</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeSessions.map((session) => (
                                <TableRow key={session.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <OrganizerIcon organizerName={session.organizerName} />
                                            <span>{session.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{session.organizerName}</TableCell>
                                    <TableCell>{formatDate(session.startDate)} - {formatDate(session.endDate)}</TableCell>
                                    <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono">{session.secretCode}</span>
                                        <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(session.secretCode)}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Copier le code</p></TooltipContent>
                                        </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Ouvrir le menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => setSessionToAction({ session: session, action: 'archive' })}>
                                                    <Archive className="mr-2 h-4 w-4" />
                                                    <span>Archiver</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setSessionToAction({ session: session, action: 'delete' })} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    <span>Supprimer</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </AccordionContent>
            </Card>
        </AccordionItem>
        
        {/* --- List Archived Sessions Card --- */}
        <AccordionItem value="archived-sessions" className="border-none">
          <Card>
            <AccordionTrigger className="flex w-full items-center justify-between p-6 hover:no-underline [&_svg]:data-[state=open]:rotate-180">
                <div className="text-left">
                    <CardTitle>Sessions Archivées</CardTitle>
                    <CardDescription>
                      Sessions terminées ou masquées.
                    </CardDescription>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                {sessionsLoading && <p>Chargement des archives...</p>}
                {!sessionsLoading && archivedSessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune session archivée.</p>
                )}
                {!sessionsLoading && archivedSessions.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Organisateur</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedSessions.map((session) => (
                        <TableRow key={session.id}>
                           <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                    <OrganizerIcon organizerName={session.organizerName} />
                                    <span>{session.name}</span>
                                </div>
                            </TableCell>
                          <TableCell>{session.organizerName}</TableCell>
                          <TableCell>{formatDate(session.startDate)} - {formatDate(session.endDate)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Ouvrir le menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => setSessionToAction({ session: session, action: 'unarchive' })}>
                                        <Archive className="mr-2 h-4 w-4" />
                                        <span>Désarchiver</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setSessionToAction({ session: session, action: 'delete' })} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Supprimer</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
      
      <AlertDialog open={!!sessionToAction} onOpenChange={(open) => !open && setSessionToAction(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{getAlertDialogStrings().title}</AlertDialogTitle>
                <AlertDialogDescription>
                    <span dangerouslySetInnerHTML={{ __html: getAlertDialogStrings().description }} />
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handleConfirmAction} 
                    className={cn(sessionToAction?.action === 'delete' && buttonVariants({ variant: 'destructive' }))}
                >
                    {getAlertDialogStrings().confirmText}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
