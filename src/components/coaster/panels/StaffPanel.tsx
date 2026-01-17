'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Staff } from '@/games/coaster/types';
import { getStaffPatrolColor, STAFF_DEFINITIONS } from '@/lib/coasterStaff';
import { T, Var, useGT, useMessages } from 'gt-next';

interface StaffPanelProps {
  staff: Staff[];
  cash: number;
  assignmentId: number | null;
  patrolRadius: number;
  focusId: number | null;
  onClose: () => void;
  onHire: (type: 'handyman' | 'mechanic' | 'security' | 'entertainer') => void;
  onStartPatrol: (staffId: number) => void;
  onClearPatrol: (staffId: number) => void;
  onCancelPatrol: () => void;
  onPatrolRadiusChange: (radius: number) => void;
  onFocusStaff: (staffId: number | null) => void;
}

export default function StaffPanel({
  staff,
  cash,
  assignmentId,
  patrolRadius,
  focusId,
  onClose,
  onHire,
  onStartPatrol,
  onClearPatrol,
  onCancelPatrol,
  onPatrolRadiusChange,
  onFocusStaff,
}: StaffPanelProps) {
  const gt = useGT();
  const m = useMessages();
  const assignmentTarget = assignmentId ? staff.find((member) => member.id === assignmentId) : null;
  const focusTarget = focusId ? staff.find((member) => member.id === focusId) : null;
  const focusLabel = focusTarget?.patrolArea ? gt('patrol area') : gt('location');

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <T>
          <div className="flex items-start justify-between p-4 border-b border-border/60">
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Staff</div>
              <div className="text-lg font-semibold">Park Staff</div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={gt('Close staff panel')}>
              ✕
            </Button>
          </div>
        </T>
        <div className="p-4 space-y-4 text-sm">
          <T>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hire Staff</div>
          </T>
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
                  <div className="text-[10px] text-muted-foreground">{gt('${hiringFee} hire', { hiringFee: definition.hiringFee })}</div>
                </div>
              </Button>
            ))}
          </div>
          <T>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Team</div>
          </T>
          {assignmentTarget && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <T>
                  <span>
                    Click a tile to set patrol area for <span className="font-semibold"><Var>{assignmentTarget.name}</Var></span>.
                  </span>
                </T>
                <T>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCancelPatrol}>
                    Cancel
                  </Button>
                </T>
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
          {focusTarget && !assignmentTarget && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs flex items-center justify-between">
              <T>
                <span>
                  Highlighting <span className="font-semibold"><Var>{focusTarget.name}</Var></span> <Var>{focusLabel}</Var>.
                </span>
              </T>
              <T>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onFocusStaff(null)}>
                  Clear
                </Button>
              </T>
            </div>
          )}
          <ScrollArea className="h-48 rounded-md border border-border/50">
            <div className="p-3 space-y-2">
              {staff.length === 0 && (
                <T>
                  <div className="text-xs text-muted-foreground">No staff hired yet.</div>
                </T>
              )}
              {staff.map((member) => {
                const isFocused = focusId === member.id;
                const patrolStatus = member.patrolArea ? gt('Patrol area') : gt('Park-wide');
                const focusButtonLabel = isFocused ? gt('Focused') : gt('Focus');
                const assignButtonLabel = assignmentId === member.id ? gt('Click Map') : member.patrolArea ? gt('Edit') : gt('Assign');
                return (
                  <div key={member.id} className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: getStaffPatrolColor(member.id) }}
                        />
                        <span className="font-medium">{member.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {member.type} · {patrolStatus}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <div>{gt('${wage}/wk', { wage: member.wage })}</div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={isFocused ? 'default' : 'outline'}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onFocusStaff(isFocused ? null : member.id)}
                        >
                          {focusButtonLabel}
                        </Button>
                        <Button
                          size="sm"
                          variant={assignmentId === member.id ? 'default' : 'outline'}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onStartPatrol(member.id)}
                        >
                          {assignButtonLabel}
                        </Button>
                        {member.patrolArea && (
                          <T>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => onClearPatrol(member.id)}
                            >
                              Clear
                            </Button>
                          </T>
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
