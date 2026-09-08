
"use client"

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Battery, Cloud, Sun, TrendingUp, Flame, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

export interface MoodOption {
  level: number;
  title: string;
  subtitle: string[];
  icon: LucideIcon;
  color: string;
  bgColor: string;
  focusRingColor: string;
  borderColor: string;
}

const moodOptions: MoodOption[] = [
  { level: 1, title: 'À plat', subtitle: ['Journée', 'difficile'], icon: Battery, color: 'text-red-500', bgColor: 'bg-red-100', focusRingColor: 'focus:ring-red-400', borderColor: 'hover:border-red-500' },
  { level: 2, title: 'Neutre', subtitle: ['Sans', 'plus'], icon: Cloud, color: 'text-blue-500', bgColor: 'bg-blue-100', focusRingColor: 'focus:ring-blue-400', borderColor: 'hover:border-blue-500' },
  { level: 3, title: 'Bien', subtitle: ['Énergie', 'positive'], icon: Sun, color: 'text-green-500', bgColor: 'bg-green-100', focusRingColor: 'focus:ring-green-400', borderColor: 'hover:border-green-500' },
  { level: 4, title: 'Au top', subtitle: ['Journée', 'productive'], icon: TrendingUp, color: 'text-yellow-500', bgColor: 'bg-yellow-100', focusRingColor: 'focus:ring-yellow-400', borderColor: 'hover:border-yellow-500' },
  { level: 5, title: 'Excellent', subtitle: ['Pleine', 'puissance'], icon: Flame, color: 'text-orange-500', bgColor: 'bg-orange-100', focusRingColor: 'focus:ring-orange-400', borderColor: 'hover:border-orange-500' },
];

interface MoodTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMood: (mood: MoodOption) => void;
}

const MoodButton = ({ mood, onSelect, isLoading }: { mood: MoodOption, onSelect: (mood: MoodOption) => void, isLoading: boolean }) => {
  const Icon = mood.icon;
  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "group relative w-full p-4 flex flex-col items-center justify-center text-center space-y-3 rounded-xl transition-all duration-200 shadow-lg",
        "bg-card focus:outline-none focus:ring-2 focus:ring-offset-2",
        "border-2 border-transparent",
        mood.focusRingColor,
        mood.borderColor,
        isLoading && "cursor-not-allowed opacity-50"
      )}
      onClick={() => onSelect(mood)}
      disabled={isLoading}
    >
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200",
        "bg-muted",
        "group-hover:bg-red-100 group-hover:bg-blue-100 group-hover:bg-green-100 group-hover:bg-yellow-100 group-hover:bg-orange-100", // Keep all possibilities for Tailwind JIT
        `group-hover:${mood.bgColor}`
      )}>
        <Icon className={cn(
            "h-5 w-5 transition-colors duration-200",
            "text-muted-foreground",
            "group-hover:text-red-500 group-hover:text-blue-500 group-hover:text-green-500 group-hover:text-yellow-500 group-hover:text-orange-500", // Keep all possibilities
            `group-hover:${mood.color}`
        )} />
      </div>
      <p className="font-semibold text-sm text-foreground">{mood.title}</p>
      <div className="text-xs text-muted-foreground leading-tight">
        {mood.subtitle.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </motion.button>
  );
};

export const MoodTrackerModal: React.FC<MoodTrackerModalProps> = ({ isOpen, onClose, onSelectMood }) => {
    const [isLoading, setIsLoading] = React.useState(false);

    const handleSelect = async (mood: MoodOption) => {
        setIsLoading(true);
        try {
            await onSelectMood(mood);
        } catch (e) {
            console.error("Failed to save mood", e);
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="max-w-3xl p-8 sm:p-12 border-none shadow-2xl bg-background"
                onInteractOutside={(e) => e.preventDefault()}
                hideCloseButton={true}
            >
                <DialogHeader className="text-center space-y-2 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <DialogTitle className="text-4xl font-bold text-foreground">Comment te sens-tu aujourd'hui ?</DialogTitle>
                        <DialogDescription className="text-lg text-muted-foreground pt-1">
                            Choisis l'état d'esprit qui te correspond le mieux pour commencer la journée.
                        </DialogDescription>
                    </motion.div>
                </DialogHeader>
                
                <motion.div 
                    className="grid grid-cols-2 sm:grid-cols-5 gap-4"
                    initial="hidden"
                    animate="visible"
                    transition={{ staggerChildren: 0.08, delayChildren: 0.2 }}
                >
                    {moodOptions.map(mood => (
                        <MoodButton key={mood.level} mood={mood} onSelect={handleSelect} isLoading={isLoading} />
                    ))}
                </motion.div>
            </DialogContent>
        </Dialog>
    );
}
