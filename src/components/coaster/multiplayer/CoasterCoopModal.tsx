'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMultiplayer } from '@/context/MultiplayerContext';
import { GameState as CoasterGameState } from '@/games/coaster/types';
import { createInitialCoasterGameState } from '@/context/CoasterContext';
import { useCopyRoomLink } from '@/hooks/useCopyRoomLink';
import { Copy, Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { T, useGT, Plural, Var } from 'gt-next';

interface CoopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartGame: (isHost: boolean, initialState?: CoasterGameState, roomCode?: string) => void;
  pendingRoomCode?: string | null;
}

type Mode = 'select' | 'create' | 'join';

export function CoasterCoopModal({
  open,
  onOpenChange,
  onStartGame,
  pendingRoomCode,
}: CoopModalProps) {
  const gt = useGT();
  const [mode, setMode] = useState<Mode>('select');
  const [parkName, setParkName] = useState(gt('My Co-op Park'));
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [waitingForState, setWaitingForState] = useState(false);
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null);

  const {
    connectionState,
    roomCode,
    players,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    initialState,
  } = useMultiplayer();
  const { copied: copiedRoomLink, handleCopyRoomLink, resetCopied } = useCopyRoomLink(roomCode, 'coaster/coop');

  useEffect(() => {
    if (open && pendingRoomCode && !autoJoinAttempted) {
      setAutoJoinAttempted(true);
      setIsLoading(true);

      joinRoom(pendingRoomCode)
        .then(() => {
          window.history.replaceState({}, '', `/coaster/coop/${pendingRoomCode.toUpperCase()}`);
          setIsLoading(false);
          setWaitingForState(true);
        })
        .catch((err) => {
          console.error('Failed to auto-join room:', err);
          setIsLoading(false);
          const errorMessage = err instanceof Error ? err.message : gt('Failed to join room');
          setAutoJoinError(errorMessage);
        });
    }
  }, [open, pendingRoomCode, autoJoinAttempted, joinRoom, gt]);

  useEffect(() => {
    if (!open) {
      if (waitingForState || (autoJoinAttempted && !initialState)) {
        leaveRoom();
      }
      setMode('select');
      setIsLoading(false);
      resetCopied();
      setAutoJoinAttempted(false);
      setWaitingForState(false);
      setAutoJoinError(null);
    }
  }, [open, waitingForState, autoJoinAttempted, initialState, leaveRoom, resetCopied]);

  const handleCreateRoom = async () => {
    if (!parkName.trim()) return;

    setIsLoading(true);
    try {
      const stateToShare = createInitialCoasterGameState(parkName);

      const code = await createRoom(parkName, stateToShare);
      window.history.replaceState({}, '', `/coaster/coop/${code}`);

      onStartGame(true, stateToShare, code);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create room:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    if (joinCode.length !== 5) return;

    setIsLoading(true);
    try {
      await joinRoom(joinCode);
      window.history.replaceState({}, '', `/coaster/coop/${joinCode.toUpperCase()}`);
      setIsLoading(false);
      setWaitingForState(true);
    } catch (err) {
      console.error('Failed to join room:', err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (waitingForState && initialState) {
      setWaitingForState(false);
      const code = roomCode || joinCode.toUpperCase() || pendingRoomCode?.toUpperCase();
      onStartGame(false, initialState as CoasterGameState, code || undefined);
      onOpenChange(false);
    }
  }, [waitingForState, initialState, onStartGame, onOpenChange, roomCode, joinCode, pendingRoomCode]);

  useEffect(() => {
    if (!waitingForState) return;

    const timeout = setTimeout(() => {
      if (waitingForState && !initialState) {
        console.error('[CoasterCoopModal] Timeout waiting for state');
        setWaitingForState(false);
        leaveRoom();
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [waitingForState, initialState, leaveRoom]);

  const handleBack = () => {
    if (roomCode) {
      leaveRoom();
    }
    setMode('select');
  };

  const handleBackFromAutoJoin = () => {
    setWaitingForState(false);
    setIsLoading(false);
    leaveRoom();
    window.history.replaceState({}, '', '/coaster');
    setMode('select');
  };

  if (autoJoinError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-white flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <T>Could Not Join Park</T>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {autoJoinError === 'Room not found' ? (
                <T>This park room doesn&apos;t exist or may have expired.</T>
              ) : (
                <T>There was a problem connecting to the room. This may be due to network issues or server limits.</T>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            {pendingRoomCode && (
              <Button
                onClick={() => {
                  setAutoJoinError(null);
                  setAutoJoinAttempted(false);
                  setIsLoading(true);
                  joinRoom(pendingRoomCode)
                    .then(() => {
                      window.history.replaceState({}, '', `/coaster/coop/${pendingRoomCode.toUpperCase()}`);
                      setIsLoading(false);
                      setWaitingForState(true);
                    })
                    .catch((err) => {
                      setIsLoading(false);
                      const errorMessage = err instanceof Error ? err.message : gt('Failed to join room');
                      setAutoJoinError(errorMessage);
                    });
                }}
                className="w-full py-4 text-base font-light bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
              >
                <T>Try Again</T>
              </Button>
            )}
            <Button
              onClick={() => {
                setAutoJoinError(null);
                setMode('create');
              }}
              variant="outline"
              className="w-full py-4 text-base font-light bg-transparent hover:bg-white/10 text-white/70 hover:text-white border border-white/15 rounded-none"
            >
              <T>Create New Park</T>
            </Button>
            <Button
              onClick={() => {
                setAutoJoinError(null);
                setMode('join');
              }}
              variant="outline"
              className="w-full py-4 text-base font-light bg-transparent hover:bg-white/10 text-white/70 hover:text-white border border-white/15 rounded-none"
            >
              <T>Join Different Room</T>
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/coaster';
              }}
              variant="ghost"
              className="w-full py-4 text-base font-light text-slate-500 hover:text-white hover:bg-transparent"
            >
              <T>Go to Park Menu</T>
            </Button>
          </div>

          <p className="text-xs text-slate-600 text-center mt-2">
            <T>Room code: <Var>{pendingRoomCode}</Var></T>
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  if (autoJoinAttempted && (isLoading || waitingForState)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white" aria-describedby={undefined}>
          <VisuallyHidden.Root>
            <DialogTitle><T>Joining Co-op Park</T></DialogTitle>
          </VisuallyHidden.Root>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleBackFromAutoJoin();
            }}
            className="absolute left-4 top-4 z-50 text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label={gt('Back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-4" />
            <T><p className="text-slate-300">Joining park...</p></T>
            <T><p className="text-slate-500 text-sm mt-1">Waiting for game state</p></T>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === 'select') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-white">
              <T>Co-op Multiplayer</T>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              <T>Build a theme park together in real-time</T>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => setMode('create')}
              className="w-full py-6 text-lg font-light bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
            >
              <T>Create Park</T>
            </Button>
            <Button
              onClick={() => setMode('join')}
              variant="outline"
              className="w-full py-6 text-lg font-light bg-transparent hover:bg-white/10 text-white/70 hover:text-white border border-white/15 rounded-none"
            >
              <T>Join Park</T>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === 'create') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-white">
              <T>Create Co-op Park</T>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {roomCode ? (
                <T>Share the invite code with friends</T>
              ) : (
                <T>Set up your co-op park</T>
              )}
            </DialogDescription>
          </DialogHeader>

          {!roomCode ? (
            <div className="flex flex-col gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="parkName" className="text-slate-300">
                  <T>Park Name</T>
                </Label>
                <Input
                  id="parkName"
                  value={parkName}
                  onChange={(e) => setParkName(e.target.value)}
                  placeholder={gt('My Co-op Park')}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <T><Var>{error}</Var></T>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 bg-transparent hover:bg-white/10 text-white/70 border-white/20 rounded-none"
                >
                  <T>Back</T>
                </Button>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isLoading || !parkName.trim()}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
                >
                  {isLoading ? (
                    <T>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </T>
                  ) : (
                    <T>Create Park</T>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-4">
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <T><p className="text-slate-400 text-sm mb-2">Invite Code</p></T>
                <p className="text-4xl font-mono font-bold tracking-widest text-white">
                  <T><Var>{roomCode}</Var></T>
                </p>
              </div>

              <Button
                onClick={handleCopyRoomLink}
                variant="outline"
                className="w-full bg-transparent hover:bg-white/10 text-white border-white/20 rounded-none"
              >
                {copiedRoomLink ? (
                  <T>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </T>
                ) : (
                  <T>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Invite Link
                  </T>
                )}
              </Button>

              {players.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <T>
                    <p className="text-slate-400 text-sm mb-2">
                      <Plural
                        n={players.length}
                        one={<>1 player</>}
                        other={<><Var>{players.length}</Var> players</>}
                      />
                    </p>
                  </T>
                  <div className="space-y-1">
                    {players.map((player) => (
                      <div key={player.id} className="text-sm text-white">
                        <T><Var>{player.name}</Var></T>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => onOpenChange(false)}
                className="w-full mt-2 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-md"
              >
                <T>Continue Playing</T>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light text-white">
            <T>Join Co-op Park</T>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            <T>Enter the 5-character invite code to join</T>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="joinCode" className="text-slate-300">
              <T>Invite Code</T>
            </Label>
            <Input
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder={gt('ABCDE')}
              maxLength={5}
              className="bg-slate-800 border-slate-600 text-white text-center text-2xl font-mono tracking-widest placeholder:text-slate-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <T><Var>{error}</Var></T>
            </div>
          )}

          {connectionState === 'connecting' && !waitingForState && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <T>Connecting...</T>
            </div>
          )}

          {waitingForState && (
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <T><p className="text-slate-300 text-sm">Connecting...</p></T>
              <T><p className="text-slate-500 text-xs mt-1">Waiting for game state</p></T>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex-1 bg-transparent hover:bg-white/10 text-white/70 border-white/20 rounded-none"
            >
              <T>Back</T>
            </Button>
            <Button
              onClick={handleJoinRoom}
              disabled={isLoading || joinCode.length !== 5}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
            >
              {isLoading ? (
                <T>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </T>
              ) : (
                <T>Join Park</T>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
