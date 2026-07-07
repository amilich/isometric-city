'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emitGlitchBehaviorEvent } from '@/lib/glitch/behaviorEvents';
import { buildInviteUrl } from '@/lib/glitch/publicUrl';

export function useCopyRoomLink(roomCode: string | null | undefined, path: string) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCopied = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCopied(false);
  }, []);

  const handleCopyRoomLink = useCallback(() => {
    if (!roomCode || typeof window === 'undefined') return;
    const url = buildInviteUrl(roomCode, path);
    navigator.clipboard.writeText(url);
    emitGlitchBehaviorEvent('multiplayer_invite', 'copy_link', {
      room_code_length: roomCode.length,
      local_path: path,
    });
    setCopied(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      resetCopied();
    }, 2000);
  }, [roomCode, path, resetCopied]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copied, handleCopyRoomLink, resetCopied };
}
