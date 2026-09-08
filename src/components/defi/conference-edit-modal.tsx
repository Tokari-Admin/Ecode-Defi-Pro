'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  conferenceDate: z.date({
    required_error: 'La date de la conférence est requise.',
  }),
  guestGoal: z.coerce
    .number({
      invalid_type_error: 'Veuillez saisir un nombre valide.',
    })
    .min(1, { message: "L'objectif doit être au moins de 1." }),
});

interface ConferenceEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  initialGoal?: number;
}

export function ConferenceEditModal({
  isOpen,
  onOpenChange,
  initialDate,
  initialGoal,
}: ConferenceEditModalProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      conferenceDate: initialDate ? parseISO(initialDate) : new Date(),
      guestGoal: initialGoal || 40,
    },
  });

  // Reset form when modal opens with new initial values
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        conferenceDate: initialDate ? parseISO(initialDate) : new Date(),
        guestGoal: initialGoal || 40,
      });
    }
  }, [isOpen, initialDate, initialGoal, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !firestore) return;

    setIsLoading(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        conferenceDate: format(values.conferenceDate, 'yyyy-MM-dd'),
        guestGoal: values.guestGoal,
      });

      toast({
        title: 'Succès',
        description: 'Vos objectifs de conférence ont été mis à jour.',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update conference info:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour les informations.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Modifier ma conférence</DialogTitle>
              <DialogDescription>
                Mettez à jour la date de votre conférence et votre objectif d'invités.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="conferenceDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de la conférence</FormLabel>
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
                              <span>Choisir une date</span>
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
                          locale={fr}
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
                name="guestGoal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objectif d'invités</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 40"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
