/**
 * Rise of Nations - Agentic AI API Route
 * 
 * True agentic AI using OpenAI Responses API with tools.
 * The AI can call tools, see results, and continue reasoning.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { RoNGameState, RoNTile, RoNPlayer } from '@/games/ron/types/game';
import { Unit, UNIT_STATS } from '@/games/ron/types/units';
import { BUILDING_STATS } from '@/games/ron/types/buildings';
import {
  generateCondensedGameState,
  executeBuildBuilding,
  executeCreateUnit,
  executeSendUnits,
  executeAdvanceAge,
  executeReassignWorkerToResource,
  CondensedGameState,
} from '@/games/ron/lib/aiTools';

// Helper to format cost from building/unit stats
function formatCost(cost: Partial<Record<string, number>>): string {
  const parts: string[] = [];
  if (cost.wood) parts.push(`${cost.wood}w`);
  if (cost.food) parts.push(`${cost.food}f`);
  if (cost.gold) parts.push(`${cost.gold}g`);
  if (cost.metal) parts.push(`${cost.metal}m`);
  if (cost.oil) parts.push(`${cost.oil}o`);
  if (cost.knowledge) parts.push(`${cost.knowledge}k`);
  return parts.join('+') || 'free';
}

// Format condensed game state into a readable string for the AI
function formatGameStateForAI(condensed: CondensedGameState): string {
  const p = condensed.myPlayer;
  
  return `## RESOURCES:
Food: ${Math.round(p.resources.food)} (+${p.resourceRates.food.toFixed(1)}/s)
Wood: ${Math.round(p.resources.wood)} (+${p.resourceRates.wood.toFixed(1)}/s)
Metal: ${Math.round(p.resources.metal)} (+${p.resourceRates.metal.toFixed(1)}/s)
Gold: ${Math.round(p.resources.gold)} (+${(p.resourceRates.gold || 0).toFixed(1)}/s)
Knowledge: ${Math.round(p.resources.knowledge || 0)} (+${(p.resourceRates.knowledge || 0).toFixed(1)}/s)
Oil: ${Math.round(p.resources.oil || 0)} (+${(p.resourceRates.oil || 0).toFixed(1)}/s)

## POPULATION: ${p.population}/${p.populationCap} | Age: ${p.age}

## YOUR BUILDINGS:
${condensed.myBuildings.map(b => `- ${b.type} at (${b.x},${b.y})`).join('\n') || '(none)'}

## YOUR WORKERS:
${(() => {
  const citizens = condensed.myUnits.filter(u => u.type === 'citizen');
  const byTask: Record<string, string[]> = {};
  for (const c of citizens) {
    const task = c.task || 'idle';
    if (!byTask[task]) byTask[task] = [];
    byTask[task].push(c.id);
  }
  const lines: string[] = [];
  if (byTask['idle']?.length) lines.push(`IDLE (need assignment!): ${byTask['idle'].join(', ')}`);
  if (byTask['gather_food']?.length) lines.push(`Food: ${byTask['gather_food'].join(', ')}`);
  if (byTask['gather_wood']?.length) lines.push(`Wood: ${byTask['gather_wood'].join(', ')}`);
  if (byTask['gather_metal']?.length) lines.push(`Metal: ${byTask['gather_metal'].join(', ')}`);
  if (byTask['gather_gold']?.length) lines.push(`Gold: ${byTask['gather_gold'].join(', ')}`);
  if (byTask['gather_knowledge']?.length) lines.push(`Knowledge: ${byTask['gather_knowledge'].join(', ')}`);
  if (byTask['gather_oil']?.length) lines.push(`Oil: ${byTask['gather_oil'].join(', ')}`);
  return lines.length > 0 ? lines.join('\n') : '(no workers)';
})()}

## YOUR MILITARY:
${condensed.myUnits.filter(u => u.type !== 'citizen').map(u => `${u.id}`).join(', ') || 'none'}

## TERRITORY: x ${condensed.territoryBounds.minX}-${condensed.territoryBounds.maxX}, y ${condensed.territoryBounds.minY}-${condensed.territoryBounds.maxY}

## BUILD LOCATIONS:
General: ${(condensed.emptyTerritoryTiles || []).slice(0, 5).map(t => `(${t.x},${t.y})`).join(', ') || 'none'}
For city expansion: ${(condensed.tilesForCityExpansion || []).slice(0, 4).map(t => `(${t.x},${t.y})`).join(', ') || 'none'}
Near forest: ${(condensed.tilesNearForest || []).slice(0, 4).map(t => `(${t.x},${t.y})`).join(', ') || 'none'}
Near metal: ${(condensed.tilesNearMetal || []).slice(0, 4).map(t => `(${t.x},${t.y})`).join(', ') || 'none'}
Near oil: ${(condensed.tilesNearOil || []).slice(0, 4).map(t => `(${t.x},${t.y})`).join(', ') || 'none'}

## ENEMIES:
Buildings: ${condensed.enemyBuildings.slice(0, 8).map(b => `${b.type}@(${b.x},${b.y})`).join(', ') || 'none visible'}
Units: ${condensed.enemyUnits.slice(0, 8).map(u => `${u.type}@(${Math.round(u.x)},${Math.round(u.y)})`).join(', ') || 'none visible'}
Cities: ${condensed.enemyBuildings.filter(b => ['city_center', 'small_city', 'large_city', 'major_city'].includes(b.type)).map(c => `(${c.x},${c.y})`).join(', ') || 'none'}

## TRAINING BUILDINGS:
${(() => {
  const cityTypes = ['city_center', 'small_city', 'large_city', 'major_city'];
  const cities = condensed.myBuildings.filter(b => cityTypes.includes(b.type));
  const barracks = condensed.myBuildings.filter(b => b.type === 'barracks');
  const stables = condensed.myBuildings.filter(b => b.type === 'stable');
  const docks = condensed.myBuildings.filter(b => b.type === 'dock');
  
  const locs: string[] = [];
  if (cities.length > 0) locs.push(`Citizens: ${cities.map(c => `(${c.x},${c.y})`).join(', ')}`);
  if (barracks.length > 0) locs.push(`Infantry/Ranged: ${barracks.map(b => `(${b.x},${b.y})`).join(', ')}`);
  if (stables.length > 0) locs.push(`Cavalry: ${stables.map(b => `(${b.x},${b.y})`).join(', ')}`);
  if (docks.length > 0) locs.push(`Naval: ${docks.map(b => `(${b.x},${b.y})`).join(', ')}`);
  
  return locs.join('\n') || 'none';
})()}

## MILITARY STATUS:
${(() => {
  const sa = condensed.strategicAssessment;
  const lines = [];
  lines.push(`Your military: ${sa.myMilitaryCount} units (strength ${sa.myMilitaryStrength})`);
  lines.push(`Enemy military: ${sa.enemyMilitaryCount} units (strength ${sa.enemyMilitaryStrength}), nearest ${sa.nearestEnemyDistance} tiles away`);
  
  const militaryUnits = condensed.myUnits.filter(u => u.type !== 'citizen');
  if (militaryUnits.length > 0) {
    lines.push(`Your unit IDs: ${militaryUnits.slice(0, 10).map(u => u.id).join(', ')}${militaryUnits.length > 10 ? ` (+${militaryUnits.length - 10} more)` : ''}`);
  }
  
  const enemyCities = condensed.enemyBuildings.filter(b => 
    ['city_center', 'small_city', 'large_city', 'major_city'].includes(b.type)
  );
  if (enemyCities.length > 0) {
    const targets = enemyCities.slice(0, 5).map(c => `${c.type}@(${c.x},${c.y})`).join(', ');
    lines.push(`Enemy cities: ${targets}${enemyCities.length > 5 ? ` (+${enemyCities.length - 5} more)` : ''}`);
  }
  
  return lines.join('\n');
})()}`;
}

// Generate costs dynamically from actual game data to prevent divergence
const BUILDING_COSTS = {
  farm: formatCost(BUILDING_STATS.farm.cost),
  woodcutters_camp: formatCost(BUILDING_STATS.woodcutters_camp.cost),
  mine: formatCost(BUILDING_STATS.mine.cost),
  barracks: formatCost(BUILDING_STATS.barracks.cost),
  market: formatCost(BUILDING_STATS.market.cost),
  library: formatCost(BUILDING_STATS.library.cost),
  smelter: formatCost(BUILDING_STATS.smelter.cost),
  small_city: formatCost(BUILDING_STATS.small_city.cost),
  oil_well: formatCost(BUILDING_STATS.oil_well.cost),
  refinery: formatCost(BUILDING_STATS.refinery.cost),
};

const UNIT_COSTS = {
  citizen: formatCost(UNIT_STATS.citizen.cost),
  infantry: formatCost(UNIT_STATS.infantry.cost),
};

// ============================================================================
// AI MODEL CONFIGURATION
// ============================================================================
// Change this to switch AI models (e.g., 'gpt-4.1', 'gpt-4o', 'gpt-5.1-2025-11-13')
export const AI_MODEL = 'gpt-5.1';

// ============================================================================
// AGENT LOGGING SYSTEM
// ============================================================================

interface AgentTurnLog {
  timestamp: string;
  tick: number;
  playerId: string;
  playerName: string;
  
  input: {
    systemPrompt: string;
    turnPrompt: string;
    gameStateSnapshot: {
      resources: Record<string, number>;
      population: string;
      militaryCount: number;
      barracksCount: number;
      age: string;
      enemyCities: Array<{ x: number; y: number; type: string }>;
      buildingCount: number;
    };
  };
  
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
    success: boolean;
  }>;
  
  thinking: string[];
  
  output: {
    actions: Array<{ type: string; data: unknown }>;
    responseTimeMs: number;
    iterations: number;
  };
  
  errors: string[];
}

// Session tracking
let currentSessionId: string | null = null;
let sessionStartTick: number | null = null;

function getSessionId(tick: number): string {
  // Start a new session if none exists or if tick reset (new game)
  if (!currentSessionId || (sessionStartTick !== null && tick < sessionStartTick)) {
    currentSessionId = `session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    sessionStartTick = tick;
  }
  return currentSessionId;
}

async function ensureLogDir(sessionId: string): Promise<string> {
  const logDir = path.join(process.cwd(), 'agent-logs', sessionId);
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch {
    // Directory might already exist
  }
  return logDir;
}

async function writeAgentLog(log: AgentTurnLog): Promise<void> {
  try {
    const sessionId = getSessionId(log.tick);
    const logDir = await ensureLogDir(sessionId);
    
    // Create filename with tick and player name (sanitized)
    const sanitizedName = log.playerName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `turn-${String(log.tick).padStart(6, '0')}-${sanitizedName}.json`;
    const filepath = path.join(logDir, filename);
    
    // Write the log
    await fs.writeFile(filepath, JSON.stringify(log, null, 2));
    
    // Also update session summary
    const summaryPath = path.join(logDir, 'session-summary.json');
    let summary: { 
      startTime: string; 
      lastTick: number; 
      players: string[];
      turnCount: number;
      errors: number;
    };
    
    try {
      const existing = await fs.readFile(summaryPath, 'utf-8');
      summary = JSON.parse(existing);
      summary.lastTick = log.tick;
      summary.turnCount++;
      if (log.errors.length > 0) summary.errors += log.errors.length;
      if (!summary.players.includes(log.playerName)) {
        summary.players.push(log.playerName);
      }
    } catch {
      summary = {
        startTime: log.timestamp,
        lastTick: log.tick,
        players: [log.playerName],
        turnCount: 1,
        errors: log.errors.length,
      };
    }
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('[AGENT LOG] Failed to write log:', err);
  }
}

// Tool definitions for the Responses API
const AI_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'get_game_state',
    description: 'Refresh the game state after taking actions. The initial state is provided in the prompt - use this to see updated resources/units after building or training.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [] as string[],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'assign_worker',
    description: 'Assign a worker to gather a resource. Call for EACH idle worker! Also use to reassign workers between resources.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        unit_id: { 
          type: 'string', 
          description: 'Worker ID (e.g., "citizen-0"). See game state for idle workers and their IDs.' 
        },
        resource_type: { 
          type: 'string', 
          enum: ['food', 'wood', 'metal', 'gold', 'knowledge', 'oil'],
          description: 'Resource to gather: food(farm), wood(woodcutters_camp), metal(mine), gold(market), knowledge(library), oil(oil_well).'
        },
      },
      required: ['unit_id', 'resource_type'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'build',
    description: 'Build a building. Costs: farm(50w), woodcutters_camp(30w), mine(80w+50g), barracks(100w), library(80w+50g), market(60w+30g), university(150w+100g), stable(150w+50m), small_city(400w+200g+100m,pop+20), large_city(600w+400g+200m,pop+35). Use tiles from game state!',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        building_type: {
          type: 'string',
          enum: [
            // Economy
            'farm', 'woodcutters_camp', 'mine', 'market', 'granary', 'lumber_mill', 'smelter',
            // Oil (industrial+)
            'oil_well', 'refinery',
            // Knowledge
            'library', 'university', 'temple', 'senate',
            // Military
            'barracks', 'stable', 'siege_factory', 'dock', 'factory', 'airbase',
            // Defense
            'tower', 'fort', 'fortress', 'castle',
            // Cities
            'small_city', 'large_city', 'major_city'
          ],
          description: 'Type of building to construct. Economic: farm, woodcutters_camp, mine, market (gold), library (knowledge), oil_well (oil). Military: barracks, stable, siege_factory, dock. Cities: small_city (pop+20), large_city (pop+35).',
        },
        x: { type: 'number', description: 'X coordinate (must be from buildable tiles in game state)' },
        y: { type: 'number', description: 'Y coordinate (must be from buildable tiles in game state)' },
      },
      required: ['building_type', 'x', 'y'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'train_unit',
    description: 'Train units. Citizens at city (60 food). Infantry at barracks (40f+20w, scales with age). Ranged at barracks (35f+25w). Cavalry at stable (60f+40g). Siege at siege_factory. Use count to train multiple at once.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        unit_type: {
          type: 'string',
          enum: ['citizen', 'infantry', 'ranged', 'cavalry', 'siege', 'naval', 'air'],
          description: 'Type of unit to train. Military units auto-scale with your age.',
        },
        building_x: { type: 'number', description: 'X coordinate of production building' },
        building_y: { type: 'number', description: 'Y coordinate of production building' },
        count: { type: 'number', description: 'Number of units to train (1-5).' },
      },
      required: ['unit_type', 'building_x', 'building_y', 'count'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'send_units',
    description: 'Send military units to a location. They will auto-attack enemy buildings/units at the destination.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        unit_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of unit IDs to send (from game state)',
        },
        target_x: { type: 'number', description: 'Target X coordinate' },
        target_y: { type: 'number', description: 'Target Y coordinate' },
      },
      required: ['unit_ids', 'target_x', 'target_y'],
      additionalProperties: false,
    },
  },
  // {
  //   type: 'function',
  //   name: 'send_message',
  //   description: 'Send a taunting message to the opponent. Be creative and aggressive!',
  //   strict: true,
  //   parameters: {
  //     type: 'object',
  //     properties: {
  //       message: { type: 'string', description: 'The message to send' },
  //     },
  //     required: ['message'],
  //     additionalProperties: false,
  //   },
  // },
];

// System prompt uses dynamic costs from actual game data
const SYSTEM_PROMPT = `You are an AI player in Rise of Nations. Build a thriving civilization with a strong economy before military conquest.

GAME MECHANICS:
- Buildings: farm ${BUILDING_COSTS.farm}, woodcutters_camp ${BUILDING_COSTS.woodcutters_camp}, mine ${BUILDING_COSTS.mine}, market ${BUILDING_COSTS.market}, barracks ${BUILDING_COSTS.barracks}, library ${BUILDING_COSTS.library}, smelter ${BUILDING_COSTS.smelter}, small_city ${BUILDING_COSTS.small_city}
- Units: citizen ${UNIT_COSTS.citizen}, infantry ${UNIT_COSTS.infantry} (strength scales with age)
- Population cap increases with cities: small_city (+20 pop), large_city (+35 pop)
- Workers gather resources when assigned: farm→food, woodcutters_camp→wood, mine→metal, market→gold

PRIORITIES:
1. Economy first: train citizens, build farms/woodcutters/mines, assign all workers
2. Expand: build small_city when at pop cap to grow further
3. Military: only attack with 8+ units, never attack early with just 2-3 units
4. Late game: destroy enemy city_centers to win

A strong economy (15+ workers, 3+ cities) beats a rushed attack. Be patient. Build big.`;

interface AIAction {
  type: 'build' | 'unit_task' | 'train' | 'resource_update';
  data: Record<string, unknown>;
}

interface AIResponseBody {
  newState: RoNGameState;
  messages: string[];
  actions?: AIAction[];
  error?: string;
  responseId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AIResponseBody>> {
  try {
    const { gameState, aiPlayerId, previousResponseId } = await request.json();

    if (!gameState || !aiPlayerId) {
      return NextResponse.json({ newState: gameState, messages: [], error: 'Missing data' }, { status: 400 });
    }

    const aiPlayer = gameState.players.find((p: { id: string }) => p.id === aiPlayerId);
    if (!aiPlayer || aiPlayer.isDefeated) {
      return NextResponse.json({ newState: gameState, messages: [] });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ newState: gameState, messages: [], error: 'No API key' }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });
    let currentState = gameState;
    const messages: string[] = [];
    
    // Track explicit actions for frontend to apply directly
    const actions: Array<{
      type: 'build' | 'unit_task' | 'train' | 'resource_update';
      data: Record<string, unknown>;
    }> = [];

    console.log('\n' + '='.repeat(60));
    console.log(`[AGENT] Starting turn at tick ${gameState.tick}`);
    console.log('='.repeat(60));

    // Check for resource boost
    const boostFile = '/tmp/ron-ai-debug/ai-boost.json';
    try {
      const fs = await import('fs');
      if (fs.existsSync(boostFile)) {
        const boostData = JSON.parse(fs.readFileSync(boostFile, 'utf-8'));
        if (!boostData.applied) {
          const aiPlayer = currentState.players.find((p: { id: string }) => p.id === aiPlayerId);
          if (aiPlayer) {
            aiPlayer.resources.food += boostData.boost.food || 0;
            aiPlayer.resources.wood += boostData.boost.wood || 0;
            aiPlayer.resources.metal += boostData.boost.metal || 0;
            aiPlayer.resources.gold += boostData.boost.gold || 0;
            boostData.applied = true;
            fs.writeFileSync(boostFile, JSON.stringify(boostData, null, 2));
            console.log(`[AI BOOST] Applied: +${boostData.boost.food} food, +${boostData.boost.wood} wood, +${boostData.boost.metal} metal, +${boostData.boost.gold} gold`);
            
            // Add resource update action to sync to frontend
            actions.push({
              type: 'resource_update',
              data: { 
                playerId: aiPlayerId, 
                resources: { ...aiPlayer.resources } 
              }
            });
          }
        }
      }
    } catch (e) {
      // Ignore boost errors
    }

    // Compute key metrics for turn prompt
    const popCapped = aiPlayer.population >= aiPlayer.populationCap;
    const barracksCount = gameState.grid.flat().filter((t: RoNTile) => t.building?.type === 'barracks' && t.building?.ownerId === aiPlayerId).length;
    const militaryCount = gameState.units.filter((u: Unit) => u.ownerId === aiPlayerId && u.type !== 'citizen').length;
    
    // Calculate threat level - find enemy military near our city
    const myCity = gameState.grid.flat().find((t: RoNTile) => 
      t.building?.ownerId === aiPlayerId && t.building?.type === 'city_center'
    );
    const myCityX = myCity?.x || 50;
    const myCityY = myCity?.y || 50;
    
    const enemyMilitaryNearby = gameState.units.filter((u: Unit) => {
      if (u.ownerId === aiPlayerId) return false;
      if (u.type === 'citizen') return false;
      const dist = Math.sqrt((u.x - myCityX) ** 2 + (u.y - myCityY) ** 2);
      return dist < 25; // Within 25 tiles of our city
    });
    
    let threatLevel = 'NONE';
    let threatInfo = '';
    if (enemyMilitaryNearby.length > 0) {
      const nearestEnemy = enemyMilitaryNearby.reduce((nearest: Unit, u: Unit) => {
        const dist = Math.sqrt((u.x - myCityX) ** 2 + (u.y - myCityY) ** 2);
        const nearestDist = Math.sqrt((nearest.x - myCityX) ** 2 + (nearest.y - myCityY) ** 2);
        return dist < nearestDist ? u : nearest;
      });
      const nearestDist = Math.sqrt((nearestEnemy.x - myCityX) ** 2 + (nearestEnemy.y - myCityY) ** 2);
      
      if (nearestDist < 10) threatLevel = 'CRITICAL';
      else if (nearestDist < 15) threatLevel = 'HIGH';
      else if (nearestDist < 20) threatLevel = 'MEDIUM';
      else threatLevel = 'LOW';
      
      threatInfo = `\n🚨 THREAT ${threatLevel}! ${enemyMilitaryNearby.length} enemy military within 25 tiles! Nearest at (${Math.round(nearestEnemy.x)},${Math.round(nearestEnemy.y)}). DEFEND!`;
    }
    
    // Find enemy cities from ALL enemies (including other AIs) - prioritize city_center
    const enemyPlayers = gameState.players.filter((pl: RoNPlayer) => pl.id !== aiPlayerId && !pl.isDefeated);
    const allEnemyCities: { x: number; y: number; type: string; ownerId: string; ownerName: string }[] = [];
    
    for (const enemy of enemyPlayers) {
      for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
          const tile = gameState.grid[y]?.[x];
          if (tile?.building?.ownerId === enemy.id && 
              ['city_center', 'small_city', 'large_city', 'major_city'].includes(tile.building.type)) {
            allEnemyCities.push({ x, y, type: tile.building.type, ownerId: enemy.id, ownerName: enemy.name });
          }
        }
      }
    }
    
    // Sort: city_center first, then by distance from AI's city_center
    const aiCityCenter = gameState.grid.flat().find((t: RoNTile) => 
      t.building?.ownerId === aiPlayerId && t.building?.type === 'city_center'
    );
    const aiX = aiCityCenter?.x || 50;
    const aiY = aiCityCenter?.y || 50;
    
    allEnemyCities.sort((a, b) => {
      // Prioritize city_center
      if (a.type === 'city_center' && b.type !== 'city_center') return -1;
      if (b.type === 'city_center' && a.type !== 'city_center') return 1;
      // Then by distance
      const distA = Math.sqrt((a.x - aiX) ** 2 + (a.y - aiY) ** 2);
      const distB = Math.sqrt((b.x - aiX) ** 2 + (b.y - aiY) ** 2);
      return distA - distB;
    });
    
    const enemyCityPos = allEnemyCities[0] || null;
    if (enemyCityPos) {
      console.log(`[TARGETING] ${aiPlayer.name} targeting ${enemyCityPos.ownerName}'s ${enemyCityPos.type} at (${enemyCityPos.x}, ${enemyCityPos.y})`);
    }
    
    // Generate full game state upfront to include in prompt (saves a round-trip)
    const initialCondensed = generateCondensedGameState(gameState, aiPlayerId);
    const initialState = formatGameStateForAI(initialCondensed);
    
    // Include full state in prompt so AI can act immediately
    const turnPrompt = `Turn ${gameState.tick}. You are ${aiPlayer.name}.${threatInfo}

${initialState}

Take actions now based on the state above. You can call get_game_state later if you need to refresh after taking actions.`;

    // Log what we're sending to the agent
    console.log('\n' + '-'.repeat(60));
    console.log('[AGENT INPUT] Turn prompt:', turnPrompt);
    console.log('[AGENT INPUT] System prompt length:', SYSTEM_PROMPT.length, 'chars');
    console.log('[AGENT INPUT] Available tools:', AI_TOOLS.map(t => (t as { name?: string }).name).join(', '));
    console.log('-'.repeat(60));

    // Create initial response - always provide input, optionally use previous_response_id for context
    const startTime = Date.now();
    let response = await client.responses.create({
      model: AI_MODEL,
      instructions: SYSTEM_PROMPT,
      input: turnPrompt,
      tools: AI_TOOLS,
      tool_choice: 'auto',
    });
    const responseTime = Date.now() - startTime;

    console.log(`[AGENT OUTPUT] Initial response in ${responseTime}ms, ${response.output?.length || 0} outputs`);
    console.log(`[AGENT OUTPUT] Response ID: ${response.id}`);

    // Process tool calls in a loop
    let iterations = 0;
    const maxIterations = 12; // More iterations for aggressive play
    
    // Track all tool calls for frontend display
    const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = [];
    let lastThinking = '';

    while (response.output && iterations < maxIterations) {
      iterations++;

      // Find tool calls
      const toolCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
          item.type === 'function_call'
      );

      // Check for text responses (agent thinking)
      const messageOutputs = response.output.filter(
        (item): item is OpenAI.Responses.ResponseOutputMessage =>
          item.type === 'message'
      );
      
      for (const msg of messageOutputs) {
        const textContent = msg.content
          .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === 'output_text')
          .map(t => t.text)
          .join('');
        if (textContent) {
          console.log(`[AGENT THINKING] ${textContent}`);
          lastThinking = textContent;
        }
      }

      if (toolCalls.length === 0) {
        console.log('[AGENT] No more tool calls, turn complete');
        break;
      }

      // Process each tool call
      const toolResults: Array<{ call_id: string; output: string }> = [];

      for (const toolCall of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.arguments || '{}');
        } catch {
          args = {};
        }

        console.log(`\n[TOOL CALL] ${toolCall.name}`);
        if (Object.keys(args).length > 0) {
          console.log(`[TOOL INPUT] ${JSON.stringify(args, null, 2)}`);
        }

        let result: { success: boolean; message: string; data?: unknown };

        switch (toolCall.name) {
          case 'get_game_state': {
            // Refresh game state mid-turn (state was already provided in initial prompt)
            const condensed = generateCondensedGameState(currentState, aiPlayerId);
            const stateStr = formatGameStateForAI(condensed);

            result = { success: true, message: stateStr };
            // Detailed logging
            const mp = condensed.myPlayer;
            console.log(`[TOOL OUTPUT] Game state refreshed (${stateStr.length} chars)`);
            console.log(`  [STATE] Tick: ${condensed.tick} | Pop: ${mp.population}/${mp.populationCap} | Military: ${condensed.myUnits.filter(u => u.type !== 'citizen').length}`);
            break;
          }

          case 'assign_worker': {
            const { unit_id, resource_type } = args as { unit_id: string; resource_type: string };
            const res = executeReassignWorkerToResource(currentState, aiPlayerId, unit_id, resource_type);
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
            // Track action for frontend
            if (res.result.success) {
              const unit = currentState.units.find((u: Unit) => u.id === unit_id || u.id.endsWith(unit_id));
              if (unit) {
                actions.push({
                  type: 'unit_task',
                  data: {
                    unitId: unit.id,
                    task: unit.task,
                    taskTarget: unit.taskTarget,
                    targetX: unit.targetX,
                    targetY: unit.targetY,
                    isMoving: unit.isMoving
                  }
                });
              }
            }
            break;
          }

          case 'build': {
            const { building_type, x, y } = args as { building_type: string; x: number; y: number };
            const res = executeBuildBuilding(currentState, aiPlayerId, building_type, x, y);
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
            // Track action for frontend
            if (res.result.success) {
              const tile = currentState.grid[y]?.[x];
              if (tile?.building) {
                actions.push({
                  type: 'build',
                  data: { building: tile.building, x, y, ownerId: aiPlayerId }
                });
              }
            }
            break;
          }

          case 'train_unit': {
            const { unit_type, building_x, building_y, count } = args as { unit_type: string; building_x: number; building_y: number; count?: number };
            const trainCount = Math.min(5, Math.max(1, count || 1)); // Clamp to 1-5
            
            let successCount = 0;
            let lastError = '';
            
            for (let i = 0; i < trainCount; i++) {
              const res = executeCreateUnit(currentState, aiPlayerId, unit_type, building_x, building_y);
              if (res.result.success) {
                currentState = res.newState;
                successCount++;
                actions.push({
                  type: 'train',
                  data: { unitType: unit_type, buildingX: building_x, buildingY: building_y }
                });
              } else {
                lastError = res.result.message;
                break; // Stop on first failure (likely pop cap or resources)
              }
            }
            
            if (successCount === trainCount) {
              result = { success: true, message: `Trained ${successCount} ${unit_type}(s) at (${building_x},${building_y})` };
            } else if (successCount > 0) {
              result = { success: true, message: `Trained ${successCount}/${trainCount} ${unit_type}(s). Stopped: ${lastError}` };
            } else {
              result = { success: false, message: lastError };
            }
            console.log(`  → ${result.message}`);
            break;
          }

          case 'send_units': {
            const { unit_ids, target_x, target_y } = args as { unit_ids: string[]; target_x: number; target_y: number };
            // Auto-detect: if there's an enemy building/unit at target, attack; otherwise move
            const targetTile = currentState.grid[Math.floor(target_y)]?.[Math.floor(target_x)];
            const hasEnemyBuilding = targetTile?.building && targetTile.building.ownerId !== aiPlayerId;
            const hasEnemyUnit = currentState.units.some((u: Unit) => 
              u.ownerId !== aiPlayerId && 
              Math.abs(u.x - target_x) < 2 && Math.abs(u.y - target_y) < 2
            );
            const unitTask = (hasEnemyBuilding || hasEnemyUnit) ? 'attack' : 'move';
            const res = executeSendUnits(currentState, aiPlayerId, unit_ids, target_x, target_y, unitTask);
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
            
            // Push unit_task actions for each unit that was updated
            if (res.result.success) {
              // Find the units that were sent and push their updated state
              const normalizedIds = unit_ids.map((id: string) => {
                const match = id.match(/u\d+|unit-[a-z0-9-]+/i);
                return match ? match[0] : id;
              });
              const sentUnits = currentState.units.filter((u: Unit) => 
                normalizedIds.includes(u.id) && u.ownerId === aiPlayerId
              );
              sentUnits.forEach((u: Unit) => {
                actions.push({
                  type: 'unit_task',
                  data: {
                    unitId: u.id,
                    task: u.task,
                    taskTarget: u.taskTarget,
                    targetX: u.targetX,
                    targetY: u.targetY,
                    isMoving: u.isMoving
                  }
                });
              });
            }
            break;
          }

          case 'send_message': {
            const { message } = args as { message: string };
            messages.push(message);
            result = { success: true, message: `Message sent: "${message}"` };
            console.log(`  → Message: "${message}"`);
            break;
          }

          case 'advance_age': {
            const res = executeAdvanceAge(currentState, aiPlayerId);
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
            break;
          }

          default:
            result = { success: false, message: `Unknown tool: ${toolCall.name}` };
        }

        const outputStr = JSON.stringify(result);
        console.log(`[TOOL RESULT] ${toolCall.name}: ${result.success ? '✓' : '✗'} ${result.message.substring(0, 100)}${result.message.length > 100 ? '...' : ''}`);
        
        // Track tool call for frontend
        allToolCalls.push({
          name: toolCall.name,
          args: args,
          result: result.message,
        });
        
        toolResults.push({
          call_id: toolCall.call_id,
          output: outputStr,
        });
      }

      // Continue the conversation with tool results
      console.log(`\n[AGENT CONTINUE] Sending ${toolResults.length} tool results back to agent...`);
      try {
        const continueStart = Date.now();
        response = await client.responses.create({
          model: AI_MODEL,
          instructions: SYSTEM_PROMPT,
          previous_response_id: response.id,
          input: toolResults.map(r => ({
            type: 'function_call_output' as const,
            call_id: r.call_id,
            output: r.output,
          })),
          tools: AI_TOOLS,
          tool_choice: 'auto',
        });
        const continueTime = Date.now() - continueStart;
        console.log(`[AGENT OUTPUT] Continuation response in ${continueTime}ms, ${response.output?.length || 0} outputs`);
      } catch (err) {
        if (err instanceof Error && (err.message.includes('429') || err.message.includes('rate'))) {
          console.log('[AGENT] Rate limited, stopping turn');
          break;
        }
        throw err;
      }
    }

    const totalTurnTime = Date.now() - startTime;
    console.log('\n' + '='.repeat(60));
    console.log(`[TURN SUMMARY] Completed in ${(totalTurnTime / 1000).toFixed(1)}s | ${iterations} iterations | ${actions.length} actions`);
    if (actions.length > 0) {
      console.log(`[TURN ACTIONS]:`);
      for (const action of actions) {
        console.log(`  - ${action.type}: ${JSON.stringify(action.data).slice(0, 80)}${JSON.stringify(action.data).length > 80 ? '...' : ''}`);
      }
    }
    console.log('='.repeat(60) + '\n');

    // ========================================================================
    // WRITE STRUCTURED AGENT LOG
    // ========================================================================
    const agentLog: AgentTurnLog = {
      timestamp: new Date().toISOString(),
      tick: gameState.tick,
      playerId: aiPlayerId,
      playerName: aiPlayer.name,
      
      input: {
        systemPrompt: SYSTEM_PROMPT,
        turnPrompt,
        gameStateSnapshot: {
          resources: {
            food: Math.round(aiPlayer.resources.food),
            wood: Math.round(aiPlayer.resources.wood),
            metal: Math.round(aiPlayer.resources.metal),
            gold: Math.round(aiPlayer.resources.gold),
            knowledge: Math.round(aiPlayer.resources.knowledge),
            oil: Math.round(aiPlayer.resources.oil),
          },
          population: `${aiPlayer.population}/${aiPlayer.populationCap}`,
          militaryCount,
          barracksCount,
          age: aiPlayer.age,
          enemyCities: allEnemyCities.slice(0, 10).map(c => ({ x: c.x, y: c.y, type: c.type })),
          buildingCount: gameState.grid.flat().filter((t: RoNTile) => t.building?.ownerId === aiPlayerId).length,
        },
      },
      
      toolCalls: allToolCalls.map(tc => ({
        name: tc.name,
        args: tc.args,
        result: tc.result.slice(0, 500), // Truncate long results
        success: !tc.result.includes('✗') && !tc.result.toLowerCase().includes('error'),
      })),
      
      thinking: lastThinking ? [lastThinking] : [],
      
      output: {
        actions,
        responseTimeMs: totalTurnTime,
        iterations,
      },
      
      errors: allToolCalls
        .filter(tc => tc.result.includes('✗') || tc.result.toLowerCase().includes('error'))
        .map(tc => `${tc.name}: ${tc.result.slice(0, 200)}`),
    };
    
    // Write log asynchronously (don't wait for it)
    writeAgentLog(agentLog).catch(err => console.error('[AGENT LOG] Write failed:', err));

    return NextResponse.json({
      newState: currentState,
      messages,
      actions, // Explicit actions for frontend to apply
      responseId: response.id,
      toolCalls: allToolCalls, // For frontend conversation display
      thinking: lastThinking, // Last AI reasoning
      turnPrompt, // The prompt sent to the agent
    });

  } catch (error) {
    console.error('[AGENT Error]', error);
    const body = await request.json().catch(() => ({})) as { gameState?: RoNGameState };
    return NextResponse.json({
      newState: body.gameState || ({} as RoNGameState),
      messages: [],
      error: error instanceof Error ? error.message : 'Error',
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
