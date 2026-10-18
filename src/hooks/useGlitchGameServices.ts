'use client';

import { useEffect, useRef } from 'react';
import { storeCloudSave } from '@/lib/glitch/cloudSave';
import { useGlitch } from '@/lib/glitch/GlitchProvider';
import { emitGlitchBehaviorEvent } from '@/lib/glitch/behaviorEvents';
import { emitAudioCue } from '@/lib/audio/audioEvents';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';

interface UseGlitchGameServicesOptions {
  slotName: string;
  state: unknown;
  metadata: Record<string, unknown>;
  autoSaveMs?: number;
}

export function useGlitchGameServices({
  slotName,
  state,
  metadata,
  autoSaveMs = 45_000,
}: UseGlitchGameServicesOptions) {
  const glitch = useGlitch();
  const multiplayer = useMultiplayerOptional();
  const latestStateRef = useRef(state);
  const latestMetadataRef = useRef(metadata);
  const playStartedAtRef = useRef<number>(0);

  useEffect(() => {
    latestStateRef.current = state;
    latestMetadataRef.current = metadata;
    if (playStartedAtRef.current === 0) {
      playStartedAtRef.current = Date.now();
    }
  }, [metadata, state]);

  useEffect(() => {
    if (!glitch.enabled || glitch.status !== 'validated' || !glitch.client || !glitch.installId) return;

    const saveOnce = () => {
      const playDurationSeconds = Math.max(0, Math.floor((Date.now() - playStartedAtRef.current) / 1000));
      const isSharedMultiplayerCity = multiplayer?.connectionState === 'connected' && !!multiplayer.roomCode;
      const cloudState = isSharedMultiplayerCity
        ? {
            kind: 'multiplayer_join_handle',
            gameKey: glitch.gameKey,
            roomCode: multiplayer.roomCode,
            savedAt: new Date().toISOString(),
          }
        : latestStateRef.current;
      const cloudMetadata = isSharedMultiplayerCity
        ? {
            ...latestMetadataRef.current,
            cloud_save_kind: 'multiplayer_join_handle',
            source_of_truth: 'glitch_lobby_event_log',
            room_code: multiplayer.roomCode,
            player_count: multiplayer.players.length,
          }
        : latestMetadataRef.current;
      emitGlitchBehaviorEvent('cloud_save', 'attempt', {
        game: glitch.gameKey,
        save_kind: isSharedMultiplayerCity ? 'multiplayer_join_handle' : 'full_state',
        slot_index: 0,
        play_duration_seconds: playDurationSeconds,
      });
      storeCloudSave(glitch.client!, {
        gameKey: glitch.gameKey,
        installId: glitch.installId!,
        slotIndex: 0,
        slotName,
        saveType: 'auto',
        state: cloudState,
        metadata: cloudMetadata,
        playDurationSeconds,
      }).then((result) => {
        emitGlitchBehaviorEvent('cloud_save', result.status, {
          game: glitch.gameKey,
          save_kind: isSharedMultiplayerCity ? 'multiplayer_join_handle' : 'full_state',
          slot_index: 0,
          play_duration_seconds: playDurationSeconds,
        });
        if (result.status === 'conflict') {
          console.warn('[Glitch] Cloud save conflict:', result.conflict);
        } else if (result.status === 'saved') {
          emitAudioCue('ui.confirm', { gain: 0.16 });
        } else if (result.status !== 'guest_or_denied') {
          console.warn('[Glitch] Cloud save skipped:', result);
        }
      });
    };

    const timeout = window.setTimeout(saveOnce, 5_000);
    const interval = window.setInterval(saveOnce, autoSaveMs);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [
    autoSaveMs,
    glitch.client,
    glitch.enabled,
    glitch.gameKey,
    glitch.installId,
    glitch.status,
    multiplayer?.connectionState,
    multiplayer?.players.length,
    multiplayer?.roomCode,
    slotName,
  ]);
}
