'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMultiplayer } from '@/context/MultiplayerContext';
import { useCoaster } from '@/context/CoasterContext';
import { useCopyRoomLink } from '@/hooks/useCopyRoomLink';
import { Copy, Check, Loader2, AlertCircle } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoasterShareModal({ open, onOpenChange }: ShareModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const hasAttemptedCreateRef = useRef(false);

  const { roomCode, createRoom } = useMultiplayer();
  const { state, isStateReady } = useCoaster();
  const { copied: copiedRoomLink, handleCopyRoomLink, resetCopied } = useCopyRoomLink(roomCode, 'coaster/coop');

  const attemptCreateRoom = useCallback(() => {
    if (isCreating || roomCode || !isStateReady) return;
    setIsCreating(true);
    setCreateError(null);
    createRoom(state.settings.name, state)
      .then((code) => {
        window.history.replaceState({}, '', `/coaster/coop/${code}`);
      })
      .catch((err) => {
        console.error('[CoasterShareModal] Failed to create room:', err);
        const message = err instanceof Error ? err.message : 'Failed to create co-op session';
        setCreateError(message);
      })
      .finally(() => {
        setIsCreating(false);
      });
  }, [createRoom, isCreating, isStateReady, roomCode, state]);

  useEffect(() => {
    if (!open) {
      resetCopied();
      setCreateError(null);
      hasAttemptedCreateRef.current = false;
      return;
    }

    if (!roomCode && !isCreating && isStateReady && !createError && !hasAttemptedCreateRef.current) {
      hasAttemptedCreateRef.current = true;
      attemptCreateRoom();
    }
  }, [open, roomCode, isCreating, isStateReady, createError, attemptCreateRoom, resetCopied]);

  const inviteUrl = roomCode ? `${window.location.origin}/coaster/coop/${roomCode}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white">
            Invite Players
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Share this link with friends to build your park together
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-hidden">
          {roomCode ? (
            <>
              <div className="text-center">
                <div className="text-4xl font-mono font-bold tracking-widest text-white mb-2">
                  {roomCode}
                </div>
                <div className="text-sm text-slate-400">Invite Code</div>
              </div>

              <div className="space-y-2 overflow-hidden">
                <div className="w-full bg-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 truncate">
                  {inviteUrl}
                </div>
                <Button
                  onClick={handleCopyRoomLink}
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700"
                >
                  {copiedRoomLink ? (
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

              <Button
                onClick={() => onOpenChange(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
              >
                Close
              </Button>
            </>
          ) : createError ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>{createError}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="flex-1 border-slate-600 hover:bg-slate-700"
                >
                  Close
                </Button>
                <Button
                  onClick={attemptCreateRoom}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="text-slate-400">Creating co-op session...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
