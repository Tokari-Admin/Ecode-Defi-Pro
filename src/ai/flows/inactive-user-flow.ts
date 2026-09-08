'use server';
/**
 * @fileOverview A flow to notify a list of inactive users.
 *
 * - notifyInactiveUsers - A function that takes a list of users and sends them a reminder email.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input schema for a single user to be notified
const InactiveUserInputSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// The flow will now accept an array of these users
const FlowInputSchema = z.array(InactiveUserInputSchema);

// Define a tool to send an email (mocked for now)
const sendEmailTool = ai.defineTool(
  {
    name: 'sendEmail',
    description: 'Sends an email to a user.',
    inputSchema: z.object({
      to: z.string().email(),
      subject: z.string(),
      body: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
    }),
  },
  async (input) => {
    console.log(`INFO: Sending email to ${input.to}`);
    console.log(`INFO: Subject: ${input.subject}`);
    console.log(`INFO: Body: ${input.body}`);
    // Simulate a successful email send
    return { success: true };
  }
);


const notifyInactiveUsersFlow = ai.defineFlow(
  {
    name: 'notifyInactiveUsersFlow',
    inputSchema: FlowInputSchema, // The input is now a list of users
    outputSchema: z.object({
        inactiveUsersNotified: z.number(),
    }),
  },
  async (inactiveUsers) => {
    let notifiedCount = 0;
    for (const user of inactiveUsers) {
        const userName = user.name || 'Consultant';
        
        await sendEmailTool({
            to: user.email,
            subject: 'On garde le rythme dans le Défi45j ?',
            body: `
Bonjour ${userName},

Juste un petit mot pour prendre de tes nouvelles. On ne t'a pas vu(e) sur l'application Défi45j depuis quelques jours.

La régularité est la clé du succès. Et si tu prenais 15 minutes aujourd'hui pour envoyer 3 invitations (C2) ? C'est le meilleur moyen de relancer la machine !

On compte sur toi.

L'équipe Défi45j
`
        });
        notifiedCount++;
    }

    console.log(`Successfully notified ${notifiedCount} inactive users.`);
    return {
        inactiveUsersNotified: notifiedCount,
    };
  }
);

// The exported function now takes the list of users as an argument
export async function notifyInactiveUsers(users: z.infer<typeof FlowInputSchema>) {
    return notifyInactiveUsersFlow(users);
}
