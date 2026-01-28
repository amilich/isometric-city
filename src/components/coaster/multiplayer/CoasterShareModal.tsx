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
import { useCoaster } from '@/context/CoasterContext';
import { Copy, Check, Loader2 } from 'lucide-react';
import { T, Branch } from 'gt-next';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoasterShareModal({ open, onOpenChange }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { roomCode, createRoom } = useMultiplayer();
  const { state, isStateReady } = useCoaster();

  useEffect(() => {
    if (open && !roomCode && !isCreating && isStateReady) {
      setIsCreating(true);
      createRoom(state.settings.name, state)
        .then((code) => {
          window.history.replaceState({}, '', `/coaster/coop/${code}`);
        })
        .catch((err) => {
          console.error('[CoasterShareModal] Failed to create room:', err);
        })
        .finally(() => {
          setIsCreating(false);
        });
    }
  }, [open, roomCode, isCreating, isStateReady, createRoom, state]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopyLink = () => {
    if (!roomCode) return;

    const url = `${window.location.origin}/coaster/coop/${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inviteUrl = roomCode ? `${window.location.origin}/coaster/coop/${roomCode}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white">
            <T>Invite Players</T>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            <T>Share this link with friends to build your park together</T>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-hidden">
          {isCreating || !roomCode ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="text-slate-400"><T>Creating co-op session...</T></span>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="text-4xl font-mono font-bold tracking-widest text-white mb-2">
                  {roomCode}
                </div>
                <div className="text-sm text-slate-400"><T>Invite Code</T></div>
              </div>

              <div className="space-y-2 overflow-hidden">
                <div className="w-full bg-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 truncate">
                  {inviteUrl}
                </div>
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-700"
                >
                  <T>
                    <Branch
                      branch={copied.toString()}
                      true={
                        <>
                          <Check className="w-4 h-4 mr-2 text-green-400" />
                          Copied!
                        </>
                      }
                      false={
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Invite Link
                        </>
                      }
                    />
                  </T>
                </Button>
              </div>

              <Button
                onClick={() => onOpenChange(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
              >
                <T>Close</T>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
