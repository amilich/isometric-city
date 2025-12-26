'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGame } from '@/context/GameContext';

interface VinnieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VinnieDialog({ open, onOpenChange }: VinnieDialogProps) {
  const { addMoney, addNotification } = useGame();

  const handleAccept = () => {
    addMoney(500000);
    addNotification(
      'Questionable Finances',
      'You received $500,000 from Cousin Vinnie. Your accountants are... concerned.',
      'disaster'
    );
    onOpenChange(false);
  };

  const handleDecline = () => {
    addMoney(10000);
    addNotification(
      'Integrity Bonus',
      'You declined Vinnie\'s offer. A mysterious benefactor rewards your honesty with $10,000.',
      'trophy'
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-sky-400">A Shady Offer</DialogTitle>
          <DialogDescription asChild>
            <div className="text-slate-300 pt-2">
              <p className="mb-2">
                Hey there, Mayor... My associate Vinnie heard you could use some help with the city budget.
              </p>
              <p className="mb-2">
                He&apos;s offering <span className="text-green-400 font-semibold">$500,000</span>... no strings attached.
              </p>
              <p className="text-slate-400 italic">
                Well, maybe a few strings.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            className="border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Accept Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




