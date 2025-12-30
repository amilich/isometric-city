/**
 * Rise of Nations - Standalone Game Runner API
 * 
 * Runs the game simulation server-side, no browser needed.
 * 
 * POST /api/ron-runner - Start/control the game
 *   body: { action: 'start' | 'stop' | 'status' | 'tick' | 'ai_turn' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createInitialRoNGameState, RoNGameState } from '@/games/ron/types/game';
import { simulateRoNTick } from '@/games/ron/lib/simulation';

// In-memory game state (persists across requests)
let gameState: RoNGameState | null = null;
let isRunning = false;
let totalTicks = 0;
let aiTurnCount = 0;

// AI conversation state
const aiResponseIds: Map<string, string | null> = new Map();

interface ActionLog {
  tick: number;
  playerId: string;
  type: string;
  args: Record<string, unknown>;
}
const recentActions: ActionLog[] = [];

function log(message: string) {
  console.log(`[RUNNER] ${message}`);
}

function initGame(): RoNGameState {
  log('Initializing fresh game...');
  const state = createInitialRoNGameState(100, [
    { name: 'Player', type: 'human', color: '#3b82f6' },
    { name: 'AI Red', type: 'ai', difficulty: 'medium', color: '#ef4444' },
    { name: 'AI Green', type: 'ai', difficulty: 'medium', color: '#22c55e' },
  ]);
  state.gameSpeed = 3;
  totalTicks = 0;
  aiTurnCount = 0;
  recentActions.length = 0;
  aiResponseIds.clear();
  log('Game initialized!');
  return state;
}

function getStatus() {
  if (!gameState) {
    return { status: 'no_game', message: 'No game running. Call with action: "start"' };
  }

  const aiPlayers = gameState.players.filter(p => p.type === 'ai');
  const playerStatus = aiPlayers.map(p => {
    const buildings = gameState!.grid.flat().filter(t => t.building?.ownerId === p.id);
    const units = gameState!.units.filter(u => u.ownerId === p.id);
    const military = units.filter(u => u.type !== 'citizen');
    const citizens = units.filter(u => u.type === 'citizen');
    
    // Count building types
    const buildingCounts: Record<string, number> = {};
    for (const t of buildings) {
      if (t.building) {
        buildingCounts[t.building.type] = (buildingCounts[t.building.type] || 0) + 1;
      }
    }

    return {
      id: p.id,
      name: p.name,
      age: p.age,
      population: p.population,
      populationCap: p.populationCap,
      resources: {
        food: Math.floor(p.resources.food),
        wood: Math.floor(p.resources.wood),
        metal: Math.floor(p.resources.metal),
        gold: Math.floor(p.resources.gold),
        knowledge: Math.floor(p.resources.knowledge),
        oil: Math.floor(p.resources.oil),
      },
      rates: p.resourceRates,
      units: units.length,
      citizens: citizens.length,
      military: military.length,
      buildings: buildings.length,
      buildingCounts,
      isDefeated: p.isDefeated,
    };
  });

  return {
    status: isRunning ? 'running' : 'paused',
    tick: gameState.tick,
    totalTicks,
    aiTurnCount,
    players: playerStatus,
    recentActions: recentActions.slice(-10),
  };
}

async function processAITurn(playerId: string): Promise<{ success: boolean; actions: number; error?: string; duration?: number }> {
  if (!gameState) return { success: false, actions: 0, error: 'No game running' };

  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.type !== 'ai') {
    return { success: false, actions: 0, error: 'Invalid player' };
  }

  const startTime = Date.now();
  log(`${player.name} starting turn at tick ${gameState.tick}...`);

  try {
    const response = await fetch('http://localhost:3000/api/ron-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameState,
        aiPlayerId: playerId,
        previousResponseId: aiResponseIds.get(playerId) || null,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, actions: 0, error: `API ${response.status}: ${text.slice(0, 100)}` };
    }

    const result = await response.json();
    const duration = Date.now() - startTime;

    // The ron-ai API returns newState (not updatedState)
    if (result.newState) {
      const newState = result.newState as RoNGameState;
      gameState = newState;
      aiResponseIds.set(playerId, result.responseId || null);
      aiTurnCount++;

      const actions = result.actions || [];
      for (const action of actions) {
        recentActions.push({
          tick: newState.tick,
          playerId,
          type: action.type,
          args: action.data || {},
        });
      }

      // Keep only last 50 actions
      while (recentActions.length > 50) recentActions.shift();

      log(`${player.name} completed: ${actions.length} actions in ${duration}ms`);
      return { success: true, actions: actions.length, duration };
    } else {
      return { success: false, actions: 0, error: result.error || 'No state returned' };
    }
  } catch (error) {
    return { success: false, actions: 0, error: error instanceof Error ? error.message : 'Fetch failed' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ticks, playerId } = body;

    switch (action) {
      case 'start':
        gameState = initGame();
        isRunning = true;
        return NextResponse.json({ success: true, message: 'Game started', ...getStatus() });

      case 'stop':
        isRunning = false;
        return NextResponse.json({ success: true, message: 'Game stopped', ...getStatus() });

      case 'status':
        return NextResponse.json({ success: true, ...getStatus() });

      case 'tick': {
        // Run N ticks of simulation
        const numTicks = Math.min(ticks || 1, 1000);
        if (!gameState) {
          gameState = initGame();
          isRunning = true;
        }
        
        for (let i = 0; i < numTicks; i++) {
          gameState = simulateRoNTick(gameState);
          totalTicks++;
        }
        
        log(`Advanced ${numTicks} ticks, now at tick ${gameState.tick}`);
        return NextResponse.json({ success: true, ticksAdvanced: numTicks, ...getStatus() });
      }

      case 'ai_turn': {
        // Process AI turn for specified player (or all AI players)
        if (!gameState) {
          gameState = initGame();
          isRunning = true;
        }

        const aiPlayers = gameState.players.filter(p => p.type === 'ai');
        const results: Record<string, { success: boolean; actions: number; error?: string; duration?: number }> = {};

        if (playerId) {
          // Single player turn
          results[playerId] = await processAITurn(playerId);
        } else {
          // All AI players
          for (const p of aiPlayers) {
            results[p.id] = await processAITurn(p.id);
          }
        }

        return NextResponse.json({ success: true, aiTurns: results, ...getStatus() });
      }

      case 'run_cycle': {
        // Run a complete cycle: N ticks + all AI turns
        const cycleTicks = ticks || 50;
        if (!gameState) {
          gameState = initGame();
          isRunning = true;
        }

        // Advance ticks
        for (let i = 0; i < cycleTicks; i++) {
          gameState = simulateRoNTick(gameState);
          totalTicks++;
        }

        // Process all AI turns
        const aiPlayers = gameState.players.filter(p => p.type === 'ai');
        const results: Record<string, { success: boolean; actions: number; error?: string; duration?: number }> = {};
        
        for (const p of aiPlayers) {
          results[p.id] = await processAITurn(p.id);
        }

        log(`Cycle complete: ${cycleTicks} ticks + ${Object.keys(results).length} AI turns`);
        return NextResponse.json({ success: true, ticksAdvanced: cycleTicks, aiTurns: results, ...getStatus() });
      }

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Unknown action',
          validActions: ['start', 'stop', 'status', 'tick', 'ai_turn', 'run_cycle']
        }, { status: 400 });
    }
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, ...getStatus() });
}
