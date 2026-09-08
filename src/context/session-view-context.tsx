
'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';

type SessionViewContextType = {
  viewingSessionId: string | null;
  isViewingAsConsultant: boolean;
  setViewingSessionId: (sessionId: string) => void;
  clearViewingSession: () => void;
};

const SessionViewContext = React.createContext<SessionViewContextType | undefined>(undefined);

export function SessionViewProvider({ children }: { children: React.ReactNode }) {
  const [viewingSessionId, setViewingSessionId] = React.useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const handleSetViewingSession = (sessionId: string) => {
    setViewingSessionId(sessionId);
    // When starting to view a session, redirect to the consultant's main dashboard.
    if (pathname.startsWith('/dashboard/admin')) {
        router.push('/dashboard');
    }
  };

  const handleClearViewingSession = () => {
    setViewingSessionId(null);
    // When leaving the consultant view, redirect to the admin's main dashboard.
    router.push('/dashboard/admin');
  };

  const contextValue = {
    viewingSessionId,
    isViewingAsConsultant: viewingSessionId !== null,
    setViewingSessionId: handleSetViewingSession,
    clearViewingSession: handleClearViewingSession,
  };

  return (
    <SessionViewContext.Provider value={contextValue}>
      {children}
    </SessionViewContext.Provider>
  );
}

export function useSessionView() {
  const context = React.useContext(SessionViewContext);
  if (context === undefined) {
    throw new Error('useSessionView must be used within a SessionViewProvider');
  }
  return context;
}
