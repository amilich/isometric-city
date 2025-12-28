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
import { GameState } from '@/types/game';
import { createInitialGameState, DEFAULT_GRID_SIZE } from '@/lib/simulation';
import { Copy, Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { T, useGT, Plural, Num } from 'gt-next';

interface CoopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartGame: (isHost: boolean, initialState?: GameState) => void;
  currentGameState?: GameState;
  pendingRoomCode?: string | null;
}

type Mode = 'select' | 'create' | 'join';

export function CoopModal({
  open,
  onOpenChange,
  onStartGame,
  currentGameState,
  pendingRoomCode,
}: CoopModalProps) {
  const gt = useGT();
  const [mode, setMode] = useState<Mode>('select');
  const [cityName, setCityName] = useState(gt('My Co-op City'));
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [waitingForState, setWaitingForState] = useState(false);

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

  // Auto-join when there's a pending room code - go directly into game
  useEffect(() => {
    if (open && pendingRoomCode && !autoJoinAttempted) {
      setAutoJoinAttempted(true);
      setIsLoading(true);
      
      // Join immediately - state will be loaded from Supabase database
      joinRoom(pendingRoomCode)
        .then(() => {
          window.history.replaceState({}, '', `/?room=${pendingRoomCode.toUpperCase()}`);
          setIsLoading(false);
          setWaitingForState(true);
        })
        .catch((err) => {
          console.error('Failed to auto-join room:', err);
          setIsLoading(false);
          // Fall back to showing join modal with error
          setJoinCode(pendingRoomCode);
          setMode('join');
        });
    }
  }, [open, pendingRoomCode, autoJoinAttempted, joinRoom]);

  // Reset state when modal closes - cleanup any pending connection
  useEffect(() => {
    if (!open) {
      // Only clean up connection if we were mid-join
      if (waitingForState || (autoJoinAttempted && !initialState)) {
        leaveRoom();
      }
      setMode('select');
      setIsLoading(false);
      setCopied(false);
      setAutoJoinAttempted(false);
      setWaitingForState(false);
    }
  }, [open, waitingForState, autoJoinAttempted, initialState, leaveRoom]);

  const handleCreateRoom = async () => {
    if (!cityName.trim()) return;
    
    setIsLoading(true);
    try {
      // Use the current game state if provided, otherwise create a fresh city
      const stateToShare = currentGameState 
        ? { ...currentGameState, cityName } 
        : createInitialGameState(DEFAULT_GRID_SIZE, cityName);
      
      const code = await createRoom(cityName, stateToShare);
      // Update URL to show room code
      window.history.replaceState({}, '', `/?room=${code}`);
      
      // Start the game immediately with the state and close the modal
      onStartGame(true, stateToShare);
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
      // State will be loaded from Supabase database
      await joinRoom(joinCode);
      // Update URL to show room code
      window.history.replaceState({}, '', `/?room=${joinCode.toUpperCase()}`);
      // Now wait for state to be received from provider
      setIsLoading(false);
      setWaitingForState(true);
    } catch (err) {
      console.error('Failed to join room:', err);
      setIsLoading(false);
      // Error is already set by the context
    }
  };
  
  // When we receive the initial state, start the game
  useEffect(() => {
    if (waitingForState && initialState) {
      setWaitingForState(false);
      onStartGame(false, initialState);
      onOpenChange(false);
    }
  }, [waitingForState, initialState, onStartGame, onOpenChange]);
  
  // Timeout after 15 seconds - if no state received, show error
  useEffect(() => {
    if (!waitingForState) return;
    
    const timeout = setTimeout(() => {
      if (waitingForState && !initialState) {
        console.error('[CoopModal] Timeout waiting for state');
        setWaitingForState(false);
        leaveRoom();
      }
    }, 15000);
    
    return () => clearTimeout(timeout);
  }, [waitingForState, initialState, leaveRoom]);

  const handleCopyLink = () => {
    if (!roomCode) return;
    
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBack = () => {
    if (roomCode) {
      leaveRoom();
    }
    setMode('select');
  };

  // Handle back from auto-join to go to select mode
  const handleBackFromAutoJoin = () => {
    // Keep autoJoinAttempted true to prevent re-triggering auto-join
    // (pendingRoomCode prop is still set from parent)
    setWaitingForState(false);
    setIsLoading(false);
    leaveRoom();
    // Clear the URL parameter
    window.history.replaceState({}, '', '/');
    setMode('select');
  };

  // If auto-joining, show loading state
  if (autoJoinAttempted && (isLoading || waitingForState)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white" aria-describedby={undefined}>
          <VisuallyHidden.Root>
            <DialogTitle>
              <T>Joining Co-op City</T>
            </DialogTitle>
          </VisuallyHidden.Root>
          {/* Back button in top left */}
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
            <T>
              <p className="text-slate-300">Joining city...</p>
            </T>
            <T>
              <p className="text-slate-500 text-sm mt-1">Waiting for game state</p>
            </T>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Selection screen
  if (mode === 'select') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-white">
              <T>Co-op Multiplayer</T>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              <T>Build a city together with friends in real-time</T>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => setMode('create')}
              className="w-full py-6 text-lg font-light bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
            >
              <T>Create City</T>
            </Button>
            <Button
              onClick={() => setMode('join')}
              variant="outline"
              className="w-full py-6 text-lg font-light bg-transparent hover:bg-white/10 text-white/70 hover:text-white border border-white/15 rounded-none"
            >
              <T>Join City</T>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Create room screen
  if (mode === 'create') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-white">
              <T>Create Co-op City</T>
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {roomCode
                ? gt('Share the invite code with friends')
                : gt('Set up your co-op city')
              }
            </DialogDescription>
          </DialogHeader>

          {!roomCode ? (
            <div className="flex flex-col gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cityName" className="text-slate-300">
                  <T>City Name</T>
                </Label>
                <Input
                  id="cityName"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder={gt('My Co-op City')}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
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
                  disabled={isLoading || !cityName.trim()}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <T>Creating...</T>
                    </>
                  ) : (
                    <T>Create City</T>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-4">
              {/* Invite Code Display */}
              <div className="bg-slate-800 rounded-lg p-6 text-center">
                <T>
                  <p className="text-slate-400 text-sm mb-2">Invite Code</p>
                </T>
                <p className="text-4xl font-mono font-bold tracking-widest text-white">
                  {roomCode}
                </p>
              </div>

              {/* Copy Link Button */}
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="w-full bg-transparent hover:bg-white/10 text-white border-white/20 rounded-none"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    <T>Copied!</T>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    <T>Copy Invite Link</T>
                  </>
                )}
              </Button>

              {/* Connected Players */}
              {players.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <T>
                    <p className="text-slate-400 text-sm mb-2">
                      <Num>{players.length}</Num>{' '}
                      <Plural
                        n={players.length}
                        one={<>player</>}
                        other={<>players</>}
                      />
                    </p>
                  </T>
                  <div className="space-y-1">
                    {players.map((player) => (
                      <div key={player.id} className="text-sm text-white">
                        {player.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Continue button */}
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

  // Join room screen
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light text-white">
            <T>Join Co-op City</T>
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
              {error}
            </div>
          )}

          {/* Connection Status when joining */}
          {connectionState === 'connecting' && !waitingForState && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <T>Connecting...</T>
            </div>
          )}

          {/* Waiting for state */}
          {waitingForState && (
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <T>
                <p className="text-slate-300 text-sm">Connecting...</p>
              </T>
              <T>
                <p className="text-slate-500 text-xs mt-1">Waiting for game state</p>
              </T>
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
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <T>Joining...</T>
                </>
              ) : (
                <T>Join City</T>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
