import { useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { OverlayMode } from '@/components/game/types';

interface UseGameKeyboardProps {
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  onToggleHelp?: () => void;
}

export function useGameKeyboard({
  overlayMode,
  setOverlayMode,
  selectedTile,
  setSelectedTile,
  onToggleHelp,
}: UseGameKeyboardProps) {
  const { state, setTool, setActivePanel, setSpeed } = useGame();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (overlayMode !== 'none') {
          setOverlayMode('none');
        } else if (state.activePanel !== 'none') {
          setActivePanel('none');
        } else if (selectedTile) {
          setSelectedTile(null);
        } else if (state.selectedTool !== 'select') {
          setTool('select');
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setTool('bulldoze');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        // Toggle pause/unpause: if paused (speed 0), resume to normal (speed 1)
        // If running, pause (speed 0)
        setSpeed(state.speed === 0 ? 1 : 0);
      } else if (e.key === '?') {
        e.preventDefault();
        onToggleHelp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.activePanel,
    state.selectedTool,
    state.speed,
    selectedTile,
    overlayMode,
    setActivePanel,
    setTool,
    setSpeed,
    setOverlayMode,
    setSelectedTile,
    onToggleHelp,
  ]);
}
