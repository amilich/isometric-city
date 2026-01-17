'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Research } from '@/games/coaster/types';

interface ResearchPanelProps {
  research: Research;
  onClose: () => void;
  onFundingChange: (funding: number) => void;
  onStartResearch: (researchId: string) => void;
}

export default function ResearchPanel({
  research,
  onClose,
  onFundingChange,
  onStartResearch,
}: ResearchPanelProps) {
  const fundingPercent = Math.round(research.funding * 100);

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Research</div>
            <div className="text-lg font-semibold">Innovation Lab</div>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close research panel">
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Funding</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Budget</span>
              <span>{fundingPercent}%</span>
            </div>
            <Slider
              value={[fundingPercent]}
              min={0}
              max={100}
              step={5}
              onValueChange={(value) => onFundingChange(value[0] / 100)}
            />
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Projects</div>
          <ScrollArea className="h-56 rounded-md border border-border/50">
            <div className="p-3 space-y-3">
              {research.items.map((item) => {
                const percent = Math.round((item.progress / item.cost) * 100);
                const isActive = research.activeResearchId === item.id;
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {item.category} · ${item.cost}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        disabled={item.unlocked}
                        onClick={() => onStartResearch(item.id)}
                      >
                        {item.unlocked ? 'Unlocked' : isActive ? 'Active' : 'Research'}
                      </Button>
                    </div>
                    <Progress value={percent} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {Math.min(100, percent)}% complete
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
