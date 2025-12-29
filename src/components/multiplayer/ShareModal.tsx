'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMultiplayer } from '@/context/MultiplayerContext';
import { useGame } from '@/context/GameContext';
import { Copy, Check, Loader2 } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const { roomCode, createRoom } = useMultiplayer();
  const { state, isStateReady } = useGame();

  // Create room when modal opens (if not already in a room)
  // IMPORTANT: Wait for isStateReady to ensure we have the loaded state, not the default empty state
  useEffect(() => {
    if (open && !roomCode && !isCreating && isStateReady) {
      setIsCreating(true);
      createRoom(state.cityName, state)
        .then((code) => {
          // Update URL to show room code
          window.history.replaceState({}, '', `/coop/${code}`);
        })
        .catch((err) => {
          console.error('[ShareModal] Failed to create room:', err);
        })
        .finally(() => {
          setIsCreating(false);
        });
    }
  }, [open, roomCode, isCreating, isStateReady, createRoom, state]);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopyLink = () => {
    if (!roomCode) return;

    const url = `${window.location.origin}/coop/${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inviteUrl = roomCode ? `${window.location.origin}/coop/${roomCode}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white">
            Invite Players
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Share this link with friends to play together
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-hidden">
          {isCreating || !roomCode ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="text-slate-400">Creating co-op session...</span>
            </div>
          ) : (
            <>
              {/* Invite Code */}
              <div className="text-center">
                <div className="text-4xl font-mono font-bold tracking-widest text-white mb-2">
                  {roomCode}
                </div>
                <div className="text-sm text-slate-400">Invite Code</div>
              </div>

              {/* Copy Link */}
              <div className="space-y-2 overflow-hidden">
                <div className="w-full bg-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 truncate">
                  {inviteUrl}
                </div>
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Invite Link
                    </>
                  )}
                </Button>
              </div>

              {/* Close Button */}
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
              >
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
