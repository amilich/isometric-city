'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = `${window.location.origin}/${normalizedPath}/${roomCode}`;
    navigator.clipboard.writeText(url);
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
