'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-sm text-foreground">{desc}</div>
      <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
        {keys}
      </Badge>
    </div>
  );
}

export function HelpPanel() {
  const { setActivePanel } = useGame();

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[720px] max-h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle>Help &amp; Shortcuts</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-72px)] px-6 pb-6">
          <div className="space-y-6">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="font-semibold mb-2">Quick basics</div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>
                  <span className="text-foreground">Place / inspect:</span> left-click with a tool selected.
                </li>
                <li>
                  <span className="text-foreground">Drag build:</span> roads/rails/subways and zoning support click-drag.
                </li>
                <li>
                  <span className="text-foreground">Corner roads:</span> hold <Badge variant="secondary" className="mx-1 font-mono text-[11px]">Shift</Badge> while dragging roads/rails/subways to draw an L-shaped path.
                </li>
                <li>
                  <span className="text-foreground">Pan:</span> middle-mouse drag, or <Badge variant="secondary" className="mx-1 font-mono text-[11px]">Alt</Badge> + drag.
                </li>
                <li>
                  <span className="text-foreground">Zoom:</span> mouse wheel / trackpad pinch.
                </li>
              </ul>
            </Card>

            <div>
              <div className="font-semibold mb-2">Keyboard shortcuts</div>
              <Card className="p-4">
                <div className="space-y-2">
                  <Shortcut keys="Ctrl/⌘ + K" desc="Open command menu" />
                  <Shortcut keys="Ctrl/⌘ + S" desc="Save city snapshot" />
                  <Shortcut keys="Ctrl/⌘ + Z" desc="Undo" />
                  <Shortcut keys="Ctrl/⌘ + Shift + Z / Ctrl + Y" desc="Redo" />
                  <Shortcut keys="Space" desc="Pause / resume simulation" />
                  <Shortcut keys="Esc" desc="Close panels / clear selection" />
                  <Shortcut keys="?" desc="Open this help panel" />
                </div>

                <Separator className="my-4" />

                <div className="text-xs font-semibold tracking-widest text-muted-foreground mb-2">
                  TOOL HOTKEYS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <Shortcut keys="1" desc="Select" />
                  <Shortcut keys="2" desc="Road" />
                  <Shortcut keys="3" desc="Rail" />
                  <Shortcut keys="4" desc="Subway" />
                  <Shortcut keys="B" desc="Bulldoze" />
                  <Shortcut keys="T" desc="Tree" />
                  <Shortcut keys="R" desc="Residential zone" />
                  <Shortcut keys="C" desc="Commercial zone" />
                  <Shortcut keys="I" desc="Industrial zone" />
                  <Shortcut keys="D" desc="De-zone" />
                </div>
              </Card>
            </div>

            <div>
              <div className="font-semibold mb-2">Pro tips</div>
              <Card className="p-4">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>Use the command menu to quickly find tools, panels, actions, and navigation.</li>
                  <li>Keep an eye on demand bars and the advisor grade for guidance on what your city needs next.</li>
                  <li>Utilities and services matter: power, water, safety, health, and education improve growth and happiness.</li>
                  <li>Mini-map drag is a fast way to jump around large cities.</li>
                </ul>
              </Card>
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: You can always reopen this via the command menu (search for “help”) or by pressing <Badge variant="secondary" className="mx-1 font-mono text-[11px]">?</Badge>.
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
