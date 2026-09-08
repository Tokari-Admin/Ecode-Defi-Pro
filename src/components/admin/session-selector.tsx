
'use client';

import * as React from 'react';
import { Eye, Check } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { useSessionView } from '@/context/session-view-context';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";


type Session = {
  id: string;
  name: string;
  archived?: boolean;
};

export function SessionSelector() {
  const [open, setOpen] = React.useState(false);
  const firestore = useFirestore();
  const { setViewingSessionId, viewingSessionId } = useSessionView();

  const sessionsQuery = useMemoFirebase(
    () => query(collection(firestore, 'sessions'), where('archived', '!=', true)),
    [firestore]
  );
  const { data: sessions, isLoading } = useCollection<Session>(sessionsQuery);

  const handleSelectSession = (sessionId: string) => {
    setViewingSessionId(sessionId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Eye className="h-5 w-5" />
                        <span className="sr-only">Voir en tant que consultant</span>
                    </Button>
                </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
                <p>Voir en tant que consultant</p>
            </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-[250px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Rechercher une session..." />
          <CommandList>
            <CommandEmpty>{isLoading ? "Chargement..." : "Aucune session active."}</CommandEmpty>
            <CommandGroup>
              {sessions?.map((session) => (
                <CommandItem
                  key={session.id}
                  value={session.id}
                  onSelect={() => handleSelectSession(session.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      viewingSessionId === session.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {session.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
