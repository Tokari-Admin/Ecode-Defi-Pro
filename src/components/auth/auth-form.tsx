"use client"

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
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

const loginFormSchema = z.object({
  email: z.string().email({ message: "Veuillez saisir une adresse e-mail valide." }),
  password: z.string().min(1, { message: "Le mot de passe est requis." }),
});

const resetPasswordFormSchema = z.object({
  resetEmail: z.string().email({ message: "Veuillez saisir une adresse e-mail valide." }),
});


export function AuthForm() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isResetLoading, setIsResetLoading] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);

  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const resetPasswordForm = useForm<z.infer<typeof resetPasswordFormSchema>>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      resetEmail: "",
    },
  });

  React.useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard/defi');
    }
  }, [user, isUserLoading, router]);

  const handleAuth = async (values: z.infer<typeof loginFormSchema>) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      // La redirection est gérée par le useEffect
    } catch (error: any) {
      let errorMessage = "Email ou mot de passe incorrect.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "L'adresse e-mail ou le mot de passe est incorrect.";
      }
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handlePasswordReset = async (values: z.infer<typeof resetPasswordFormSchema>) => {
    setIsResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, values.resetEmail);
      toast({
        title: "E-mail envoyé",
        description: "Si un compte existe avec cette adresse, un e-mail de réinitialisation de mot de passe a été envoyé.",
      });
      setIsResetDialogOpen(false);
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
      });
    } finally {
        setIsResetLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center text-center mb-6">
        <Rocket className="h-12 w-12" style={{ color: '#E8335D' }} />
        <h1 className="text-5xl font-bold mt-4 text-primary">Défi45j</h1>
      </div>
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-primary">Bienvenue</CardTitle>
          <CardDescription>
            Connecte-toi pour démarrer ta transformation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleAuth)} className="space-y-4">
               <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="nom@exemple.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-xs"
                  onClick={() => setIsResetDialogOpen(true)}
                >
                  Mot de passe oublié ?
                </Button>
              </div>
              <Button type="submit" className="w-full !mt-6" disabled={isLoading}>
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Tu n'as pas de compte ?{' '}
            <Link href="/register" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto")}>
              S'inscrire
            </Link>
          </div>
        </CardContent>
      </Card>
      
      {/* Reset Password Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
           <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit(handlePasswordReset)}>
              <AlertDialogHeader>
                <AlertDialogTitle>Réinitialiser le mot de passe</AlertDialogTitle>
                <AlertDialogDescription>
                  Saisis ton adresse e-mail. Nous t'enverrons un lien pour réinitialiser ton mot de passe.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                 <FormField
                    control={resetPasswordForm.control}
                    name="resetEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="nom@exemple.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <Button type="submit" disabled={isResetLoading}>
                  {isResetLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
