
"use client"

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Rocket } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useFirestore, FirestorePermissionError } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, FirestoreError } from "firebase/firestore";

import { Button } from "@/components/ui/button";
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

const formSchema = z.object({
  email: z.string().email({ message: "Veuillez saisir une adresse e-mail valide." }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères." }),
  confirmPassword: z.string(),
  secretCode: z.string().min(1, { message: "Le code secret est requis." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
});

// Code maître temporaire pour la création de l'admin
const ADMIN_SECRET_CODE = "SUPER_ADMIN_45J";

type UserData = {
    email: string | null;
    role: 'Admin' | 'Consultant';
    sessionId: string | null;
    profileComplete: boolean;
    lastActivity: string;
    name?: string;
    surname?: string;
};


export function RegisterForm() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      secretCode: "",
    },
  });

  const handleRegister = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    let sessionId: string | null = null;
    let role: 'Admin' | 'Consultant' = 'Consultant';
    let sessionFound = false;

    try {
        if (values.secretCode === ADMIN_SECRET_CODE) {
            role = 'Admin';
            sessionFound = true;
        } else {
            const sessionsRef = collection(firestore, "sessions");
            const q = query(sessionsRef, where("secretCode", "==", values.secretCode), where("archived", "==", false));
            
            try {
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    sessionFound = true;
                    sessionId = querySnapshot.docs[0].id;
                    role = 'Consultant';
                }
            } catch (error) {
                // This catch block will now handle permission errors from getDocs
                 const contextualError = new FirestorePermissionError({
                    operation: 'list',
                    path: 'sessions', // Path of the collection being queried
                });
                // We throw it to be caught by the outer catch block for toast notifications
                throw contextualError;
            }
        }
        
        if (!sessionFound) {
            toast({
                variant: "destructive",
                title: "Code secret invalide",
                description: "Le code fourni n'est pas valide ou la session est archivée.",
            });
            setIsLoading(false);
            return;
        }
      
      // 2. Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      // 3. Create the user document in Firestore immediately
      const userRef = doc(firestore, "users", user.uid);
      
      const userData: UserData = {
        email: user.email,
        role: role,
        sessionId: role === 'Consultant' ? sessionId : null,
        profileComplete: false, // Set to false to trigger onboarding
        lastActivity: new Date().toISOString(),
      };

      if (role === 'Admin') {
          userData.name = 'Admin';
          userData.surname = 'Défi45j';
          userData.profileComplete = true; // Admins skip onboarding
      }

      await setDoc(userRef, userData);

      router.push('/dashboard'); 

    } catch (error: any) {
      let errorMessage = "Une erreur est survenue lors de l'inscription.";
      
      if (error instanceof FirestorePermissionError) {
          errorMessage = "Le code secret est invalide ou tu n'as pas la permission."
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Cette adresse e-mail est déjà utilisée.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Le mot de passe est trop faible. Il doit contenir au moins 6 caractères.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "L'adresse e-mail n'est pas valide.";
      }
      
      toast({
        variant: "destructive",
        title: "Erreur d'inscription",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-4">
       <div className="flex flex-col items-center text-center mb-6">
        <Rocket className="h-12 w-12" style={{ color: '#E8335D' }} />
        <h1 className="text-5xl font-bold mt-4 text-primary">Défi45j</h1>
      </div>
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-primary">Créer un compte</CardTitle>
          <CardDescription>
            Rejoins l'aventure et commence ta transformation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secretCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code secret</FormLabel>
                    <FormControl>
                      <Input placeholder="Ton code secret" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full !mt-6" disabled={isLoading}>
                {isLoading ? 'Inscription...' : "S'inscrire"}
              </Button>
            </form>
          </Form>
           <div className="mt-4 text-center text-sm">
            Tu as déjà un compte ?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/')}>
              Se connecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
