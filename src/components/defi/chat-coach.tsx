
'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageSquare, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useCoachChat, type CoachMessage } from '@/context/coach-chat-context';
import { cn } from '@/lib/utils';
import { formatRelative } from 'date-fns';
import { fr } from 'date-fns/locale';

export function ChatCoach() {
  const { messages, isOpen, setIsOpen, hasUnread, setHasUnread } = useCoachChat();
  const chatWindowRef = React.useRef<HTMLDivElement>(null);
  const endOfMessagesRef = React.useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
        setHasUnread(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.div
          animate={hasUnread && !isOpen ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
          transition={{ repeat: 2, duration: 0.5 }}
        >
          <Button
            onClick={toggleOpen}
            className="w-14 h-14 rounded-full bg-primary shadow-lg hover:bg-primary/90 flex items-center justify-center relative"
            size="icon"
          >
            {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            {hasUnread && !isOpen && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0"
              >
                {messages.length}
              </Badge>
            )}
          </Button>
        </motion.div>
      </div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-24 right-6 z-40 w-[350px] h-[500px] bg-card border rounded-2xl shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b flex items-center gap-3 bg-muted/50 rounded-t-2xl">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-foreground">Coach Défi45j</h3>
                <p className="text-xs text-muted-foreground">Votre partenaire de réussite</p>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((msg, index) => (
                <div key={msg.id} className={cn('flex items-end gap-2', msg.sender === 'coach' ? 'justify-start' : 'justify-end')}>
                  {msg.sender === 'coach' && 
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                            <Bot size={20}/>
                        </AvatarFallback>
                    </Avatar>
                  }
                  <div className={cn(
                      'p-3 rounded-2xl max-w-[85%] text-sm',
                      msg.sender === 'coach' ? 'bg-muted text-muted-foreground rounded-bl-none' : 'bg-primary text-primary-foreground rounded-br-none'
                  )}>
                    <p>{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1.5 text-right">
                        {formatRelative(msg.timestamp, new Date(), { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endOfMessagesRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
