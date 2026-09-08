
'use client';

import * as React from 'react';
import { AnimatePresence } from 'framer-motion';

export type CoachMessage = {
  id: string;
  text: React.ReactNode;
  timestamp: Date;
  sender: 'coach';
};

type CoachChatContextType = {
  messages: CoachMessage[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  addMessage: (text: React.ReactNode) => void;
  hasUnread: boolean;
  setHasUnread: (hasUnread: boolean) => void;
};

const CoachChatContext = React.createContext<CoachChatContextType | undefined>(undefined);

export function CoachChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<CoachMessage[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasUnread, setHasUnread] = React.useState(false);

  const addMessage = React.useCallback((text: React.ReactNode) => {
    setMessages(prev => [
      ...prev,
      {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text,
        timestamp: new Date(),
      },
    ]);
    if (!isOpen) {
        setHasUnread(true);
    }
  }, [isOpen]);

  const value = {
    messages,
    isOpen,
    setIsOpen,
    addMessage,
    hasUnread,
    setHasUnread,
  };

  return (
    <CoachChatContext.Provider value={value}>
        {children}
    </CoachChatContext.Provider>
  );
}

export function useCoachChat() {
  const context = React.useContext(CoachChatContext);
  if (!context) {
    throw new Error('useCoachChat must be used within a CoachChatProvider');
  }
  return context;
}
