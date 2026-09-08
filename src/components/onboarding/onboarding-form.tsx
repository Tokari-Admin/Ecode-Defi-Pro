
"use client"

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarIcon, Rocket } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


const onboardingSchema = z.object({
  name: z.string().min(1, { message: "Ton prénom est requis." }),
  surname: z.string().min(1, { message: "Ton nom est requis." }),
  sponsorFirstName: z.string().min(1, { message: "Le prénom est requis." }),
  sponsorLastName: z.string().min(1, { message: "Le nom est requis." }),
  conferenceDate: z.date({ required_error: 'La date de ta conférence est requise.' }),
  guestGoal: z.coerce.number({ invalid_type_error: "Veuillez saisir un nombre valide."}).min(1, { message: "L'objectif doit être au moins de 1." }),
});

// Helper function to capitalize names correctly
const capitalizeName = (str: string): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word =>
            word
                .split('-')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join('-')
        )
        .join(' ');
};

// Helper to add business days
const addBusinessDays = (startDate: Date, days: number): Date => {
    const date = new Date(startDate);
    let addedDays = 0;
    while (addedDays < days) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
            addedDays++;
        }
    }
    return date;
};


type OnboardingStep = {
    title: string;
    description: string;
    fields: (keyof z.infer<typeof onboardingSchema>)[];
}

const steps: OnboardingStep[] = [
    {
        title: "Qui es-tu ?",
        description: "Pour commencer, dis-nous qui tu es.",
        fields: ['name', 'surname'],
    },
    {
        title: "Qui t'accompagne ?",
        description: "Qui est ton parrain ou ta marraine dans cette aventure ?",
        fields: ['sponsorFirstName', 'sponsorLastName'],
    },
    {
        title: "Quel est ton objectif ?",
        description: "Définis la date de ta conférence et ton objectif d'invités.",
        fields: ['conferenceDate', 'guestGoal'],
    }
]

interface OnboardingFormProps {
  onProfileComplete: () => void;
  session?: {
    startDate: Timestamp;
    endDate: Timestamp;
  } | null;
}

const DatePicker = ({ field, session, isMobile }: { field: any; session: OnboardingFormProps['session'], isMobile: boolean }) => {
    const [isMobileDatePickerOpen, setIsMobileDatePickerOpen] = React.useState(false);

    if (isMobile) {
        return (
             <Dialog open={isMobileDatePickerOpen} onOpenChange={setIsMobileDatePickerOpen}>
                <DialogTrigger asChild>
                     <Button
                        variant={'outline'}
                        className={cn(
                        'w-full justify-start text-left font-normal',
                        !field.value && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'PPP', { locale: fr }) : <span>Choisis une date</span>}
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-auto p-0">
                    <Calendar
                        locale={fr}
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            field.onChange(date);
                            setIsMobileDatePickerOpen(false);
                        }}
                        disabled={(date) =>
                            session?.startDate ? date < session.startDate.toDate() : false
                        }
                        initialFocus
                    />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <FormControl>
                <Button
                    variant={'outline'}
                    className={cn(
                    'w-full pl-3 text-left font-normal',
                    !field.value && 'text-muted-foreground'
                    )}
                >
                    {field.value ? (
                    format(field.value, 'PPP', { locale: fr })
                    ) : (
                    <span>Choisis une date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
                </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    locale={fr}
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                        session?.startDate ? date < session.startDate.toDate() : false
                    }
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}


export function OnboardingForm({ onProfileComplete, session }: OnboardingFormProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);
  const [userName, setUserName] = React.useState('');
  const isMobile = useIsMobile();

  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      surname: "",
      sponsorFirstName: "",
      sponsorLastName: "",
      conferenceDate: undefined,
      guestGoal: undefined,
    },
    mode: 'onChange'
  });
  
  React.useEffect(() => {
    if (session?.startDate && !form.getValues('conferenceDate')) {
        const defaultConferenceDate = addBusinessDays(session.startDate.toDate(), 25);
        form.setValue('conferenceDate', defaultConferenceDate);
    }
  }, [session, form]);

  const handleNext = async () => {
    const isValid = await form.trigger(steps[step].fields);
    if (isValid) {
        if (step < steps.length - 1) {
            setStep(prev => prev + 1);
        }
    }
  };

  const handlePrevious = () => {
    if (step > 0) {
      setStep(prev => prev - 1);
    }
  }

  const handleOnboarding = async (values: z.infer<typeof onboardingSchema>) => {
    if (!user) {
      toast({ variant: "destructive", title: "Erreur", description: "Session utilisateur non trouvée. Reconnecte-toi." });
      router.push('/');
      return;
    }
    
    setIsLoading(true);

    const formattedValues = {
        name: capitalizeName(values.name),
        surname: capitalizeName(values.surname),
        sponsorFirstName: capitalizeName(values.sponsorFirstName),
        sponsorLastName: capitalizeName(values.sponsorLastName),
        conferenceDate: format(values.conferenceDate, 'yyyy-MM-dd'),
        guestGoal: values.guestGoal,
        profileComplete: true,
    }
    setUserName(formattedValues.name); // Save name for welcome message

    try {
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, formattedValues);
      
      // Delay slightly to allow the state update to settle before showing modal
      setTimeout(() => {
        setShowWelcomeModal(true);
      }, 300);

    } catch (error: any) {
      console.error("Error updating user profile: ", error);
      toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue lors de la mise à jour de ton profil." });
    } finally {
        setIsLoading(false);
    } 
  }

  const handleStartAdventure = () => {
    setShowWelcomeModal(false);
    onProfileComplete();
    router.push('/dashboard/defi');
  };
  

  return (
     <>
        <Dialog open={true} modal={true}>
            <DialogContent 
                className="max-w-md bg-card flex flex-col p-0 min-h-[360px] rounded-3xl"
                onInteractOutside={(e) => e.preventDefault()}
                hideCloseButton={true}
            >
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleOnboarding)} className="flex flex-col h-full">
                        <DialogHeader className="p-6 pb-4 text-center bg-primary text-primary-foreground rounded-t-3xl">
                            <DialogTitle className="text-2xl">{steps[step].title}</DialogTitle>
                            <DialogDescription className="text-primary-foreground/90">{steps[step].description}</DialogDescription>
                        </DialogHeader>

                        <div className="p-6 space-y-6 flex-1">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: 50 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -50 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-4"
                                >
                                    {step === 0 && (
                                        <>
                                            <FormField control={form.control} name="name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prénom</FormLabel>
                                                    <FormControl><Input placeholder="Ton prénom" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="surname" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nom</FormLabel>
                                                    <FormControl><Input placeholder="Ton nom" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </>
                                    )}
                                    {step === 1 && (
                                        <>
                                            <FormField control={form.control} name="sponsorFirstName" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prénom du Parrain/Marraine</FormLabel>
                                                    <FormControl><Input placeholder="Son prénom" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="sponsorLastName" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nom du Parrain/Marraine</FormLabel>
                                                    <FormControl><Input placeholder="Son nom" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </>
                                    )}
                                    {step === 2 && (
                                        <div className="grid grid-cols-1 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="conferenceDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>Date de la conférence</FormLabel>
                                                        <DatePicker field={field} session={session} isMobile={isMobile} />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="guestGoal"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Objectif d'invités</FormLabel>
                                                    <FormControl>
                                                    <Input type="number" placeholder="Ex: 40" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} value={field.value ?? ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        
                        <div className="flex w-full items-center justify-center p-6 pt-0">
                            {steps.map((_, i) => (
                                <div key={i} className={`h-2 w-2 rounded-full mx-1 transition-colors ${i <= step ? "bg-primary" : "bg-muted-foreground/30"}`}></div>
                            ))}
                        </div>

                        <DialogFooter className="p-6 pt-0 flex-row justify-between gap-2">
                            <Button type="button" variant="outline" onClick={handlePrevious} disabled={step === 0}>
                                Précédent
                            </Button>
                            
                            {step < steps.length - 1 ? (
                                <Button type="button" onClick={handleNext}>
                                    Suivant
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isLoading || !form.formState.isValid}>
                                    {isLoading ? "Finalisation..." : "Terminer"}
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        <Dialog open={showWelcomeModal}>
            <DialogContent
                className="max-w-xs bg-card flex flex-col p-8 rounded-3xl text-center items-center"
                hideCloseButton={true}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <Rocket className="h-16 w-16 mx-auto mb-4" style={{ color: '#E8335D' }} />
                    <DialogTitle className="text-3xl font-bold">Bienvenue, {userName} !</DialogTitle>
                    <DialogDescription className="text-lg text-muted-foreground pt-2">
                        Tu fais maintenant partie du Défi45j. Prépare-toi à te dépasser.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4 w-full">
                    <Button onClick={handleStartAdventure} className="w-full">Commencer l'aventure</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
     </>
  );
}
