
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Star, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface ActionCardProps {
  title: string;
  points: number;
  value: number;
  onValueChange: (value: number) => void;
  description: string;
  colorClass?: string;
  bgColorClass?: string;
}

export function ActionCard({ title, points, value, onValueChange, description, colorClass = 'border-l-brand-accent', bgColorClass = 'bg-brand-accent/20' }: ActionCardProps) {
  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    onValueChange(value + 1);
  };
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion from toggling
    onValueChange(Math.max(0, value - 1));
  };

  const match = title.match(/^(C2|R[0-3])\s(.*)$/);
  const tag = match ? match[1] : null;
  const mainTitle = match ? match[2].trim() : title;

  return (
     <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b-0">
         <Card className={cn("overflow-hidden shadow-md transition-shadow hover:shadow-lg border-l-4", colorClass)}>
            <AccordionTrigger className="w-full p-0 [&_svg.chevron]:data-[state=open]:rotate-180 hover:no-underline">
                <div className="flex flex-1 flex-row items-start justify-between p-3 pb-2 space-y-0">
                    <div className="flex items-center gap-2">
                        {tag && (
                            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-foreground/80 font-bold text-xs", bgColorClass)}>
                                {tag}
                            </div>
                        )}
                        <CardTitle className="text-sm font-medium leading-tight text-left">{mainTitle}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span>{points} pts</span>
                        </div>
                         <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                    </div>
                </div>
            </AccordionTrigger>
            <CardContent className="flex items-center justify-between p-3 pt-0">
                <div className={cn("flex h-auto w-24 items-center justify-start p-0 text-left font-bold text-2xl")}>
                {value}
                </div>
                <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={handleDecrement}>
                    <Minus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={handleIncrement}>
                    <Plus className="h-4 w-4" />
                </Button>
                </div>
            </CardContent>
             <AccordionContent className={cn("p-0", bgColorClass)}>
                <div className="px-3 pb-3 pt-3 border-t">
                    <p className="text-sm text-foreground/80">{description}</p>
                </div>
            </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>
  );
}
