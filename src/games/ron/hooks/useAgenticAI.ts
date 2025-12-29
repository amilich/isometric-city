/**
 * Rise of Nations - Agentic AI Hook (Simplified)
 * 
 * Just calls the AI every few seconds - no complex state management.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { RoNGameState, RoNPlayer } from '../types/game';
import { Unit } from '../types/units';

export interface AgenticAIConfig {
  enabled: boolean;
  aiPlayerId: string;
  actionInterval: number;
}

export interface AgenticAIMessage {
  id: string;
  message: string;
  timestamp: number;
  isRead: boolean;
}

export interface UseAgenticAIResult {
  messages: AgenticAIMessage[];
  isThinking: boolean;
  lastError: string | null;
  thoughts: string | null;
  markMessageRead: (messageId: string) => void;
  clearMessages: () => void;
}

const POLL_INTERVAL_MS = 10000; // 10 seconds between AI calls (agent needs time to think)

export function useAgenticAI(
  gameState: RoNGameState,
  setGameState: (updater: (prev: RoNGameState) => RoNGameState) => void,
  config: AgenticAIConfig
): UseAgenticAIResult {
  const [messages, setMessages] = useState<AgenticAIMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const isProcessingRef = useRef(false);
  const latestStateRef = useRef(gameState);
  const responseIdRef = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    latestStateRef.current = gameState;
  }, [gameState]);

  const processAITurn = useCallback(async () => {
    if (isProcessingRef.current || !config.enabled) return;
    
    const state = latestStateRef.current;
    if (state.gameSpeed === 0 || state.gameOver) return;
    
    const aiPlayer = state.players.find(p => p.id === config.aiPlayerId);
    if (!aiPlayer || aiPlayer.isDefeated) return;

    isProcessingRef.current = true;
    setIsThinking(true);

    try {
      const response = await fetch('/api/ron-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameState: state,
          aiPlayerId: config.aiPlayerId,
          previousResponseId: responseIdRef.current,
        }),
      });

      const result = await response.json();

      if (result.error) {
        setLastError(result.error);
        // Reset response ID on errors to start fresh
        if (result.error.includes('400') || result.error.includes('invalid')) {
          responseIdRef.current = undefined;
        }
      } else {
        setLastError(null);
        
        // Save response ID for conversation continuity
        if (result.responseId) {
          responseIdRef.current = result.responseId;
        }
        
        // Add messages
        if (result.messages?.length > 0) {
          setMessages(prev => [
            ...prev,
            ...result.messages.map((msg: string) => ({
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              message: msg,
              timestamp: Date.now(),
              isRead: false,
            })),
          ]);
        }

        // Apply AI actions directly to current state
        const actions = result.actions as Array<{
          type: 'build' | 'unit_task' | 'train' | 'resource_update';
          data: Record<string, unknown>;
        }> | undefined;
        
        if (actions && actions.length > 0) {
          console.log(`[AI SYNC] Applying ${actions.length} actions from AI`);
          
          setGameState((currentState) => {
            let newGrid = currentState.grid.map(row => [...row]);
            let newUnits = [...currentState.units];
            let newPlayers = [...currentState.players];
            
            for (const action of actions) {
              if (action.type === 'build') {
                const { building, x, y, ownerId } = action.data as { 
                  building: unknown; x: number; y: number; ownerId: string 
                };
                console.log(`[AI SYNC] Building ${(building as {type: string}).type} at (${x},${y})`);
                
                // Apply building to grid
                if (newGrid[y] && newGrid[y][x]) {
                  newGrid[y][x] = {
                    ...newGrid[y][x],
                    building: building as typeof newGrid[0][0]['building'],
                    ownerId,
                  };
                }
              } else if (action.type === 'unit_task') {
                const { unitId, task, taskTarget, targetX, targetY, isMoving } = action.data as {
                  unitId: string; task: string; taskTarget?: unknown; 
                  targetX?: number; targetY?: number; isMoving?: boolean;
                };
                
                const unitIdx = newUnits.findIndex(u => u.id === unitId);
                if (unitIdx >= 0) {
                  console.log(`[AI SYNC] Unit ${unitId.slice(0,15)}: task=${task}, target=(${targetX?.toFixed(1)},${targetY?.toFixed(1)})`);
                  newUnits[unitIdx] = {
                    ...newUnits[unitIdx],
                    task: task as Unit['task'],
                    taskTarget: taskTarget as Unit['taskTarget'],
                    targetX,
                    targetY,
                    isMoving: isMoving ?? true,
                  };
                }
              } else if (action.type === 'train') {
                const { unitType, buildingX, buildingY } = action.data as {
                  unitType: string; buildingX: number; buildingY: number;
                };
                console.log(`[AI SYNC] Queued ${unitType} at (${buildingX},${buildingY})`);
                
                // Add to building queue
                if (newGrid[buildingY] && newGrid[buildingY][buildingX]?.building) {
                  const tile = newGrid[buildingY][buildingX];
                  newGrid[buildingY][buildingX] = {
                    ...tile,
                    building: {
                      ...tile.building!,
                      queuedUnits: [...(tile.building!.queuedUnits || []), unitType],
                    },
                  };
                }
              }
            }
            
            // Also sync AI player resources from newState
            if (result.newState?.players) {
              const aiPlayer = result.newState.players.find((p: RoNPlayer) => p.id === config.aiPlayerId);
              if (aiPlayer) {
                newPlayers = newPlayers.map(p => 
                  p.id === config.aiPlayerId ? { ...p, resources: aiPlayer.resources, age: aiPlayer.age } : p
                );
              }
            }
            
            console.log(`[AI SYNC] Applied ${actions.length} actions successfully`);
            
            const merged = {
              ...currentState,
              grid: newGrid,
              units: newUnits,
              players: newPlayers,
            };
            latestStateRef.current = merged;
            return merged;
          });
        } else if (result.newState?.tick) {
          // Fallback: sync resources at minimum
          setGameState((currentState) => {
            if (result.newState?.players) {
              const aiPlayer = result.newState.players.find((p: RoNPlayer) => p.id === config.aiPlayerId);
              if (aiPlayer) {
                const newPlayers = currentState.players.map(p => 
                  p.id === config.aiPlayerId ? { ...p, resources: aiPlayer.resources, age: aiPlayer.age } : p
                );
                return { ...currentState, players: newPlayers };
              }
            }
            return currentState;
          });
        }
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Error');
    } finally {
      isProcessingRef.current = false;
      setIsThinking(false);
    }
  }, [config.enabled, config.aiPlayerId, setGameState]);

  useEffect(() => {
    if (!config.enabled) return;

    const interval = setInterval(processAITurn, POLL_INTERVAL_MS);
    const initial = setTimeout(processAITurn, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [config.enabled, processAITurn]);

  const markMessageRead = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isRead: true } : msg
    ));
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    isThinking,
    lastError,
    thoughts: null,
    markMessageRead,
    clearMessages,
  };
}
