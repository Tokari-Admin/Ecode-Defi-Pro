
import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-xl font-bold tracking-tight text-sidebar-foreground", className)}>
      <Rocket className="h-8 w-8" style={{ color: '#E8335D' }} />
      <span className="font-headline opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">Défi45j</span>
    </div>
  );
}
