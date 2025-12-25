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
    addMoney(100000);
    addNotification(
      '可疑财务',
      '你从堂兄文尼那里收到了$100,000。你的会计师...很担心。',
      'disaster'
    );
    onOpenChange(false);
  };

  const handleDecline = () => {
    addMoney(10000);
    addNotification(
      '诚信奖励',
      '你拒绝了文尼的提议。一位神秘的慈善家用$10,000奖励你的诚实。',
      'trophy'
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-sky-400">可疑的提议</DialogTitle>
          <DialogDescription asChild>
            <div className="text-slate-300 pt-2">
              <p className="mb-2">
                嘿，市长...我的同事文尼听说你需要帮助处理城市预算。
              </p>
              <p className="mb-2">
                他提供 <span className="text-green-400 font-semibold">$100,000</span>... 没有任何附加条件。
              </p>
              <p className="text-slate-400 italic">
                好吧，可能有一些。
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
            拒绝
          </Button>
          <Button
            onClick={handleAccept}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            接受提议
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




