'use client';

import React from 'react';
import { T, Var, useGT, useMessages } from 'gt-next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Staff } from '@/games/coaster/types';
import { STAFF_DEFINITIONS } from '@/lib/coasterStaff';

interface StaffPanelProps {
  staff: Staff[];
  cash: number;
  onClose: () => void;
  onHire: (type: 'handyman' | 'mechanic' | 'security' | 'entertainer') => void;
}

export default function StaffPanel({ staff, cash, onClose, onHire }: StaffPanelProps) {
  const gt = useGT();
  const m = useMessages();
  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <T><div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Staff</div></T>
            <T><div className="text-lg font-semibold">Park Staff</div></T>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close staff panel')}>
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hire Staff</div></T>
          <div className="grid grid-cols-2 gap-2">
            {STAFF_DEFINITIONS.map((definition) => (
              <Button
                key={definition.type}
                variant="outline"
                className="h-auto text-xs justify-start"
                disabled={cash < definition.hiringFee}
                onClick={() => onHire(definition.type)}
              >
                <div>
                  <div className="font-semibold">{m(definition.name)}</div>
                  <T><div className="text-[10px] text-muted-foreground">${<Var>{definition.hiringFee}</Var>} hire</div></T>
                </div>
              </Button>
            ))}
          </div>
          <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Team</div></T>
          <ScrollArea className="h-48 rounded-md border border-border/50">
            <div className="p-3 space-y-2">
              {staff.length === 0 && (
                <T><div className="text-xs text-muted-foreground">No staff hired yet.</div></T>
              )}
              {staff.map((member) => (
                <div key={member.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{member.type}</div>
                  </div>
                  <T><div className="text-xs text-muted-foreground">${<Var>{member.wage}</Var>}/wk</div></T>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
