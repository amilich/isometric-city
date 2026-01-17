'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Staff } from '@/games/coaster/types';
import { getStaffPatrolColor, STAFF_DEFINITIONS } from '@/lib/coasterStaff';

interface StaffPanelProps {
  staff: Staff[];
  cash: number;
  assignmentId: number | null;
  patrolRadius: number;
  focusId: number | null;
  staffRoomCount: number;
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
  staffRoomCount,
  onClose,
  onHire,
  onStartPatrol,
  onClearPatrol,
  onCancelPatrol,
  onPatrolRadiusChange,
  onFocusStaff,
}: StaffPanelProps) {
  const assignmentTarget = assignmentId ? staff.find((member) => member.id === assignmentId) : null;
  const focusTarget = focusId ? staff.find((member) => member.id === focusId) : null;
  const focusLabel = focusTarget?.patrolArea ? 'patrol area' : 'location';

  return (
    <div className="absolute top-20 right-6 z-50 w-80">
      <Card className="bg-card/95 border-border/70 shadow-xl">
        <div className="flex items-start justify-between p-4 border-b border-border/60">
          <div>
            <div className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Staff</div>
            <div className="text-lg font-semibold">Park Staff</div>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close staff panel">
            ✕
          </Button>
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hire Staff</div>
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
                  <div className="font-semibold">{definition.name}</div>
                  <div className="text-[10px] text-muted-foreground">${definition.hiringFee} hire</div>
                </div>
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>Team</span>
            <span className="text-[10px] text-muted-foreground">
              Staff Rooms {staffRoomCount}
            </span>
          </div>
          {assignmentTarget && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span>
                  Click a tile to set patrol area for <span className="font-semibold">{assignmentTarget.name}</span>.
                </span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCancelPatrol}>
                  Cancel
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Patrol Size
                </span>
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
              <span>
                Highlighting <span className="font-semibold">{focusTarget.name}</span> {focusLabel}.
              </span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onFocusStaff(null)}>
                Clear
              </Button>
            </div>
          )}
          <ScrollArea className="h-48 rounded-md border border-border/50">
            <div className="p-3 space-y-2">
              {staff.length === 0 && (
                <div className="text-xs text-muted-foreground">No staff hired yet.</div>
              )}
              {staff.map((member) => {
                const isFocused = focusId === member.id;
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
                        {member.type} · {member.patrolArea ? 'Patrol area' : 'Park-wide'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <div>${member.wage}/wk</div>
                      <div>Fatigue {Math.round((member.fatigue / 255) * 100)}%</div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={isFocused ? 'default' : 'outline'}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onFocusStaff(isFocused ? null : member.id)}
                        >
                          {isFocused ? 'Focused' : 'Focus'}
                        </Button>
                        <Button
                          size="sm"
                          variant={assignmentId === member.id ? 'default' : 'outline'}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onStartPatrol(member.id)}
                        >
                          {assignmentId === member.id ? 'Click Map' : member.patrolArea ? 'Edit' : 'Assign'}
                        </Button>
                        {member.patrolArea && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => onClearPatrol(member.id)}
                          >
                            Clear
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
