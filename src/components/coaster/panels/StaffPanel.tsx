'use client';

import React from 'react';
import { T, Var, Num, Branch, useGT, useMessages } from 'gt-next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Staff } from '@/games/coaster/types';
import { STAFF_DEFINITIONS } from '@/lib/coasterStaff';

interface StaffPanelProps {
  staff: Staff[];
  cash: number;
  assignmentId: number | null;
  patrolRadius: number;
  onClose: () => void;
  onHire: (type: 'handyman' | 'mechanic' | 'security' | 'entertainer') => void;
  onStartPatrol: (staffId: number) => void;
  onClearPatrol: (staffId: number) => void;
  onCancelPatrol: () => void;
  onPatrolRadiusChange: (radius: number) => void;
}

export default function StaffPanel({
  staff,
  cash,
  assignmentId,
  patrolRadius,
  onClose,
  onHire,
  onStartPatrol,
  onClearPatrol,
  onCancelPatrol,
  onPatrolRadiusChange,
}: StaffPanelProps) {
  const gt = useGT();
  const m = useMessages();
  const assignmentTarget = assignmentId ? staff.find((member) => member.id === assignmentId) : null;

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
                  <T><div className="text-[10px] text-muted-foreground">$<Num>{definition.hiringFee}</Num> hire</div></T>
                </div>
              </Button>
            ))}
          </div>
          <T><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Team</div></T>
          {assignmentTarget && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <T>
                  <span>
                    Click a tile to set patrol area for <span className="font-semibold"><Var>{assignmentTarget.name}</Var></span>.
                  </span>
                </T>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCancelPatrol}>
                  <T>Cancel</T>
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <T>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Patrol Size
                  </span>
                </T>
                <div className="flex items-center gap-1">
                  {[3, 4, 6].map((radius) => (
                    <Button
                      key={radius}
                      size="sm"
                      variant={patrolRadius === radius ? 'default' : 'outline'}
                      className="h-6 px-2 text-[10px]"
                      onClick={() => onPatrolRadiusChange(radius)}
                    >
                      {radius * 2 + 1}x{radius * 2 + 1}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <ScrollArea className="h-48 rounded-md border border-border/50">
            <div className="p-3 space-y-2">
              {staff.length === 0 && (
                <T><div className="text-xs text-muted-foreground">No staff hired yet.</div></T>
              )}
              {staff.map((member) => {
                const staffDef = STAFF_DEFINITIONS.find((def) => def.type === member.type);
                const staffTypeName = staffDef ? m(staffDef.name) : member.type;
                return (
                  <div key={member.id} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <T>
                        <div className="text-xs text-muted-foreground">
                          <Var>{staffTypeName}</Var> · <Branch branch={Boolean(member.patrolArea).toString()} true={<>Patrol area</>} false={<>Park-wide</>}><></></Branch>
                        </div>
                      </T>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <T><div>$<Num>{member.wage}</Num>/wk</div></T>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={assignmentId === member.id ? 'default' : 'outline'}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onStartPatrol(member.id)}
                        >
                          {assignmentId === member.id ? <T>Click Map</T> : <T>Assign</T>}
                        </Button>
                        {member.patrolArea && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => onClearPatrol(member.id)}
                          >
                            <T>Clear</T>
                          </Button>
                        )}
                      </div>
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
