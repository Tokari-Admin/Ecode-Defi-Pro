"use client";

import { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Set initial state
    onFullscreenChange();

    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  if (!isClient) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Maximize className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-9 w-9">
      {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      <span className="sr-only">{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</span>
    </Button>
  );
}
