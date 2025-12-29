/**
 * Rise of Nations - Agentic AI API Route
 * 
 * True agentic AI using OpenAI Responses API with tools.
 * The AI can call tools, see results, and continue reasoning.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RoNGameState } from '@/games/ron/types/game';
import {
  generateCondensedGameState,
  executeBuildBuilding,
  executeCreateUnit,
  executeSendUnits,
  executeAdvanceAge,
  executeAssignIdleWorkers,
} from '@/games/ron/lib/aiTools';

// Tool definitions for the Responses API
const AI_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'get_game_state',
    description: 'Get the current game state including resources, buildings, units, and enemy positions. Call this first to understand the situation.',
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
    name: 'assign_workers',
    description: 'Automatically assign idle workers to economic buildings. Also rebalances workers if wood/metal rate is 0. CALL THIS EVERY TURN!',
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
    description: 'Train a unit at a building. Citizens at city_center (50 food). Militia at barracks (40 food, 20 wood). Hoplite at barracks (60 food, 40 metal).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        unit_type: {
          type: 'string',
          enum: ['citizen', 'militia', 'hoplite', 'archer', 'cavalry'],
          description: 'Type of unit to train',
        },
        building_x: { type: 'number', description: 'X coordinate of production building' },
        building_y: { type: 'number', description: 'Y coordinate of production building' },
      },
      required: ['unit_type', 'building_x', 'building_y'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'send_units',
    description: 'Send military units to attack an enemy position',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        unit_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of unit IDs to send',
        },
        target_x: { type: 'number', description: 'Target X coordinate' },
        target_y: { type: 'number', description: 'Target Y coordinate' },
      },
      required: ['unit_ids', 'target_x', 'target_y'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'send_message',
    description: 'Send a taunting message to the opponent. Be creative and aggressive!',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to send' },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
];

const SYSTEM_PROMPT = `You are an AGGRESSIVE AI in Rise of Nations. Goal: DEFEAT THE HUMAN.

## EVERY TURN:
1. get_game_state
2. assign_workers  
3. BUILD something
4. TRAIN units
5. ATTACK when ready

## KEY RULES:
**POP CAP IS #1 PRIORITY!**
- If population >= populationCap, you MUST save for small_city (400 wood + 200 gold + 100 metal)
- DON'T waste resources when pop-capped - SAVE THEM!
- Build small_city the MOMENT you have 400 wood + 200 gold + 100 metal
- If you don't have enough gold, build a market or mine to generate gold!

**BALANCED ECONOMY:**
- Need 3-4 farms (not just 1!)
- Need 2-3 woodcutters on 🌲 tiles
- Need 1-2 mines on ⛏️ tiles for metal
- Don't overbuild one type - diversify!

**MILITARY:**
- Build barracks early (costs 100 wood)
- Train militia (40 food, 20 wood each)

**KNOWLEDGE & AGES:**
- Build LIBRARY to generate knowledge and advance ages!
- Build UNIVERSITY for faster research
- Knowledge is required to advance to next age (more buildings unlock!)
- Industrial age unlocks oil_well, factory, airbase

**GOLD:**
- Build MARKET to generate gold income!
- Gold is needed for small_city, mines, and advanced buildings
- Attack enemy when you have 5+ military units
- Target: enemy city_center first!

## BUILD LOCATIONS:
- woodcutters_camp: ONLY on "🌲" tiles
- mine: ONLY on "⛏️" tiles  
- Other buildings: "General" tiles

## DECISION TREE:
1. UNDER ATTACK? → Send ALL military to defend! Train more units!
2. Wood rate = 0 AND wood < 400? → BUILD WOODCUTTERS_CAMP FIRST! (you can't save for small_city if you can't generate wood!)
3. Pop capped AND wood >= 400? → Build small_city immediately!
4. Pop capped AND wood < 400? → Save for small_city, only build resource buildings if rate is 0
5. No barracks AND wood >= 200? → Build barracks
6. Food rate < 2? → Build farm
7. Wood rate < 1? → Build woodcutters_camp  
8. Metal rate = 0? → Build mine
9. Military < 5 AND have barracks? → Train militia
10. Military >= 5? → ATTACK!

## CRITICAL ECONOMY RULES:
- You CANNOT save for small_city if wood rate is 0! You must have income!
- Always ensure at least 1 of each: farm (food), woodcutters_camp (wood)
- Build multiple small_city to expand population - don't stop at just one!

## AGGRESSIVE EXPANSION (VERY IMPORTANT):
- ALWAYS train citizens! Queue 2-3 citizens EVERY turn until you have 15+ workers
- ALWAYS build! Every turn should have at least 1-2 builds
- Target: 4+ farms, 3+ woodcutters, 2+ mines MINIMUM
- Build MULTIPLE barracks (2-3) for faster military production
- Train militia at EVERY barracks EVERY turn
- Never stop expanding! If resources > 200, BUILD SOMETHING!

## DEFENDING:
If you see "🚨 THREATS" or "⚠️ UNDER ATTACK":
- IMMEDIATELY send all military units to the threatened location!
- Train more militia urgently!
- Protect your city_center at all costs!
- Use send_units tool with your military unit IDs and the threat coordinates

Be strategic, not spam. Save resources when needed!`;

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

    // Initial prompt to the agent
    const turnPrompt = `New turn! Tick: ${gameState.tick}. Analyze the game state and take strategic actions. Remember: call get_game_state first, then assign_workers, then build/train as needed.`;

    // Log what we're sending to the agent
    console.log('\n' + '-'.repeat(60));
    console.log('[AGENT INPUT] Turn prompt:', turnPrompt);
    console.log('[AGENT INPUT] System prompt length:', SYSTEM_PROMPT.length, 'chars');
    console.log('[AGENT INPUT] Available tools:', AI_TOOLS.map(t => t.name).join(', '));
    console.log('-'.repeat(60));

    // Create initial response - always provide input, optionally use previous_response_id for context
    const startTime = Date.now();
    let response = await client.responses.create({
      model: 'gpt-5-mini-2025-08-07',
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
    const maxIterations = 10;

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
            const condensed = generateCondensedGameState(currentState, aiPlayerId);
            // Debug: log what tiles are near forest/metal
            console.log('[AI DEBUG] tilesNearForest:', condensed.tilesNearForest?.map(t => `(${t.x},${t.y})`).join(', ') || 'EMPTY');
            console.log('[AI DEBUG] tilesNearMetal:', condensed.tilesNearMetal?.map(t => `(${t.x},${t.y})`).join(', ') || 'EMPTY');
            const p = condensed.myPlayer;
            
            // Format a readable game state
            const stateStr = `## YOUR RESOURCES:
Food: ${Math.round(p.resources.food)} (rate: ${p.resourceRates.food.toFixed(1)}/s)
Wood: ${Math.round(p.resources.wood)} (rate: ${p.resourceRates.wood.toFixed(1)}/s)${p.resourceRates.wood === 0 ? ' ⚠️ ZERO!' : ''}
Metal: ${Math.round(p.resources.metal)} (rate: ${p.resourceRates.metal.toFixed(1)}/s)
Gold: ${Math.round(p.resources.gold)} (rate: ${(p.resourceRates.gold || 0).toFixed(1)}/s)
Knowledge: ${Math.round(p.resources.knowledge || 0)} (rate: ${(p.resourceRates.knowledge || 0).toFixed(1)}/s) ${(p.resources.knowledge || 0) > 0 ? '📚' : '- need library!'}
Oil: ${Math.round(p.resources.oil || 0)} (rate: ${(p.resourceRates.oil || 0).toFixed(1)}/s) ${(p.resources.oil || 0) > 0 ? '🛢️' : '- need oil_well (industrial age)!'}

## POPULATION: ${p.population}/${p.populationCap}${p.population >= p.populationCap ? ' ⚠️ CAPPED!' : ''}

## YOUR BUILDINGS:
${condensed.myBuildings.map(b => `- ${b.type} at (${b.x},${b.y})`).join('\n') || '(none)'}

## YOUR UNITS:
- Citizens: ${condensed.myUnits.filter(u => u.type === 'citizen').length} (idle: ${condensed.myUnits.filter(u => u.type === 'citizen' && u.task === 'idle').length})
- Military: ${condensed.myUnits.filter(u => u.type !== 'citizen').map(u => `${u.type}[${u.id}]`).join(', ') || 'none'}

## BUILDABLE TILES:
General: ${(condensed.emptyTerritoryTiles || []).slice(0, 5).map(t => `(${t.x},${t.y})`).join(', ')}
🌲 For woodcutters_camp (near forest): ${(condensed.tilesNearForest || []).slice(0, 4).map(t => `(${t.x},${t.y})`).join(', ') || 'none in territory'}
⛏️ For mine (near metal): ${(condensed.tilesNearMetal || []).slice(0, 4).map(t => `(${t.x},${t.y})`).join(', ') || 'none in territory'}

## ENEMY INFO:
Buildings: ${condensed.enemyBuildings.slice(0, 5).map(b => `${b.type}@(${b.x},${b.y})`).join(', ') || 'none visible'}
Units: ${condensed.enemyUnits.slice(0, 8).map(u => `${u.type}@(${Math.round(u.x)},${Math.round(u.y)})`).join(', ') || 'none visible'}
${(() => {
  // Detect if enemy units are near AI buildings (attack warning)
  const myBuildingPositions = condensed.myBuildings.map(b => ({ x: b.x, y: b.y, type: b.type }));
  const threats: string[] = [];
  for (const enemy of condensed.enemyUnits) {
    for (const building of myBuildingPositions) {
      const dist = Math.sqrt(Math.pow(enemy.x - building.x, 2) + Math.pow(enemy.y - building.y, 2));
      if (dist < 15) {
        threats.push(`⚠️ UNDER ATTACK! Enemy ${enemy.type} near your ${building.type} at (${building.x},${building.y})!`);
      }
    }
  }
  // Also check if enemy near AI units
  for (const enemy of condensed.enemyUnits) {
    for (const myUnit of condensed.myUnits) {
      const dist = Math.sqrt(Math.pow(enemy.x - myUnit.x, 2) + Math.pow(enemy.y - myUnit.y, 2));
      if (dist < 10 && myUnit.type === 'citizen') {
        threats.push(`⚠️ Your worker at (${Math.round(myUnit.x)},${Math.round(myUnit.y)}) is in danger from enemy ${enemy.type}!`);
      }
    }
  }
  return threats.length > 0 ? '\n🚨 THREATS:\n' + threats.slice(0, 3).join('\n') : '';
})()}

## TRAINING LOCATIONS:
- Citizens: city_center at ${condensed.myBuildings.find(b => b.type === 'city_center' || b.type === 'small_city') ? `(${condensed.myBuildings.find(b => b.type === 'city_center' || b.type === 'small_city')!.x},${condensed.myBuildings.find(b => b.type === 'city_center' || b.type === 'small_city')!.y})` : '(none!)'}
- Military: barracks at ${condensed.myBuildings.find(b => b.type === 'barracks') ? `(${condensed.myBuildings.find(b => b.type === 'barracks')!.x},${condensed.myBuildings.find(b => b.type === 'barracks')!.y})` : '(build one first!)'}

## ⚡ PRIORITY ACTIONS:
${(() => {
  const suggestions: string[] = [];
  const farmCount = condensed.myBuildings.filter(b => b.type === 'farm').length;
  const woodCount = condensed.myBuildings.filter(b => b.type === 'woodcutters_camp').length;
  const mineCount = condensed.myBuildings.filter(b => b.type === 'mine').length;
  const barracksExists = condensed.myBuildings.some(b => b.type === 'barracks');
  const militaryCount = condensed.myUnits.filter(u => u.type !== 'citizen').length;
  const cityTile = condensed.emptyTerritoryTiles?.[0];
  const forestTile = condensed.tilesNearForest?.[0];
  const metalTile = condensed.tilesNearMetal?.[0];
  const popCapped = p.population >= p.populationCap;

  // CRITICAL: Deadlock detection - can't save for small_city if wood rate is 0!
  if (p.resourceRates.wood === 0 && p.resources.wood < 400) {
    if (forestTile) {
      suggestions.push(`🚨 CRITICAL DEADLOCK! Wood rate is 0 - you can NEVER save for small_city! BUILD woodcutters_camp at (${forestTile.x},${forestTile.y}) IMMEDIATELY!`);
    }
  }

  // #1 PRIORITY: Pop cap - must expand!
  // small_city costs: wood 400, gold 200, metal 100
  if (popCapped) {
    const hasEnoughForCity = p.resources.wood >= 400 && p.resources.metal >= 100 && p.resources.gold >= 200;
    if (hasEnoughForCity && cityTile) {
      suggestions.push(`🚨 URGENT: BUILD small_city at (${cityTile.x},${cityTile.y}) NOW! You have resources!`);
    } else {
      const needWood = Math.max(0, 400 - p.resources.wood);
      const needMetal = Math.max(0, 100 - p.resources.metal);
      const needGold = Math.max(0, 200 - p.resources.gold);
      suggestions.push(`⏳ POP CAPPED! Saving for small_city - need ${needWood} more wood, ${needMetal} more metal, ${needGold} more gold.`);
      if (needGold > 0 && cityTile) {
        suggestions.push(`💰 BUILD market at (${cityTile.x},${cityTile.y}) for gold income!`);
      }
    }
  }

  // Always need resource income - even if pop-capped!
  if (p.resourceRates.food < 1 && cityTile) {
    suggestions.push(`🌾 LOW FOOD! BUILD farm at (${cityTile.x},${cityTile.y})`);
  }
  if (p.resourceRates.wood < 1 && forestTile) {
    suggestions.push(`🪵 LOW WOOD! BUILD woodcutters_camp at (${forestTile.x},${forestTile.y})`);
  }
  if (p.resourceRates.metal === 0 && metalTile) {
    suggestions.push(`⛏️ NO METAL! BUILD mine at (${metalTile.x},${metalTile.y})`);
  }
  
  // Knowledge and gold suggestions
  const hasLibrary = condensed.myBuildings.some(b => b.type === 'library');
  const hasMarket = condensed.myBuildings.some(b => b.type === 'market');
  if (!hasLibrary && cityTile && p.resources.wood >= 80) {
    suggestions.push(`📚 BUILD library at (${cityTile.x},${cityTile.y}) for knowledge income and age advancement!`);
  }
  if (!hasMarket && cityTile && p.resources.wood >= 60 && (p.resourceRates.gold || 0) === 0) {
    suggestions.push(`💰 BUILD market at (${cityTile.x},${cityTile.y}) for gold income!`);
  }

  // Only suggest other builds if NOT pop-capped or already have enough for small_city
  if (!popCapped || (p.resources.wood >= 400 && p.resources.metal >= 100)) {
    if (!barracksExists && p.resources.wood >= 100 && cityTile) {
      suggestions.push(`⚔️ BUILD barracks at (${cityTile.x},${cityTile.y})`);
    }
    if (p.resourceRates.metal === 0 && mineCount < 2 && metalTile) {
      suggestions.push(`⛏️ BUILD mine at (${metalTile.x},${metalTile.y})`);
    }
    if (p.resourceRates.wood < 1 && woodCount < 3 && forestTile) {
      suggestions.push(`🪵 BUILD woodcutters_camp at (${forestTile.x},${forestTile.y})`);
    }
  }
  
  // Citizen training - need workers for economy! BE AGGRESSIVE!
  const citizenCount = condensed.myUnits.filter(u => u.type === 'citizen').length;
  const cityCenter = condensed.myBuildings.find(b => b.type === 'city_center' || b.type === 'small_city');
  const allCityCenters = condensed.myBuildings.filter(b => b.type === 'city_center' || b.type === 'small_city');
  if (!popCapped && cityCenter && citizenCount < 20 && p.resources.food >= 50) {
    suggestions.push(`👷 TRAIN 2-3 citizens NOW! You only have ${citizenCount} workers - need 15+!`);
    for (const cc of allCityCenters.slice(0, 2)) {
      suggestions.push(`  → Train citizen at (${cc.x},${cc.y})`);
    }
  }

  // Multiple barracks for faster military
  const barracksCount = condensed.myBuildings.filter(b => b.type === 'barracks').length;
  if (barracksCount < 2 && p.resources.wood >= 100 && cityTile) {
    suggestions.push(`🏰 BUILD 2nd barracks at (${cityTile.x},${cityTile.y}) for faster military!`);
  }

  // Military actions
  if (barracksExists && militaryCount < 5 && !popCapped) {
    suggestions.push(`🗡️ TRAIN militia at barracks`);
  }
  if (militaryCount >= 5 && condensed.enemyBuildings.length > 0) {
    const enemy = condensed.enemyBuildings[0];
    suggestions.push(`⚔️ ATTACK enemy at (${enemy.x},${enemy.y})!`);
  }

  // Expansion reminder
  if (!popCapped && p.resources.wood >= 400 && cityTile) {
    suggestions.push(`🏙️ Build another small_city at (${cityTile.x},${cityTile.y}) to expand population cap!`);
  }

  // Always build something if resources are high!
  if (p.resources.wood >= 150 && suggestions.length < 3) {
    if (farmCount < 5 && cityTile) suggestions.push(`🌾 Build more farms! (have ${farmCount}, want 5+)`);
    if (woodCount < 4 && forestTile) suggestions.push(`🪵 Build more woodcutters! (have ${woodCount}, want 4+)`);
    if (mineCount < 3 && metalTile) suggestions.push(`⛏️ Build more mines! (have ${mineCount}, want 3+)`);
  }

  // ALWAYS remind to be aggressive
  suggestions.push(`⚡ EVERY TURN: Train citizens, train militia, build buildings! Never idle!`);

  return suggestions.join('\n');
})()}`;

            result = { success: true, message: stateStr };
            // Detailed logging
            console.log(`[TOOL OUTPUT] Game state retrieved (${stateStr.length} chars)`);
            console.log(`  [STATE] Tick: ${condensed.tick} | Pop: ${p.population}/${p.populationCap} | Military: ${condensed.myUnits.filter(u => u.type !== 'citizen').length}`);
            console.log(`  [STATE] Resources: Food ${Math.round(p.resources.food)} (${p.resourceRates.food}/s) | Wood ${Math.round(p.resources.wood)} (${p.resourceRates.wood}/s) | Metal ${Math.round(p.resources.metal)} (${p.resourceRates.metal}/s) | Gold ${Math.round(p.resources.gold)}`);
            console.log(`  [STATE] Buildings: ${condensed.myBuildings.map(b => b.type).join(', ')}`);
            console.log(`  [STATE] Citizens: ${condensed.myUnits.filter(u => u.type === 'citizen').length} | Idle: ${condensed.myUnits.filter(u => u.type === 'citizen' && (u.task === 'idle' || u.task === 'move')).length}`);
            // Log the full prompt going to AI (first 2000 chars)
            console.log(`\n[FULL PROMPT TO AI] (showing first 2500 chars):\n${'-'.repeat(50)}`);
            console.log(stateStr.substring(0, 2500));
            if (stateStr.length > 2500) console.log(`\n... (${stateStr.length - 2500} more chars)`);
            console.log('-'.repeat(50));
            break;
          }

          case 'assign_workers': {
            const res = executeAssignIdleWorkers(currentState, aiPlayerId);
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
            // Track unit task updates for frontend
            if (res.result.success && (res.result.data as { assigned?: number })?.assigned && (res.result.data as { assigned: number }).assigned > 0) {
              // Get all AI units with gather tasks
              const aiUnits = currentState.units.filter((u: { ownerId: string; task?: string }) => 
                u.ownerId === aiPlayerId && u.task?.startsWith('gather_')
              );
              aiUnits.forEach((u: { id: string; task: string; taskTarget?: unknown; targetX?: number; targetY?: number; isMoving?: boolean }) => {
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
            const { unit_type, building_x, building_y } = args as { unit_type: string; building_x: number; building_y: number };
            const res = executeCreateUnit(currentState, aiPlayerId, unit_type, building_x, building_y);
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
            // Track action for frontend
            if (res.result.success) {
              actions.push({
                type: 'train',
                data: { unitType: unit_type, buildingX: building_x, buildingY: building_y }
              });
            }
            break;
          }

          case 'send_units': {
            const { unit_ids, target_x, target_y } = args as { unit_ids: string[]; target_x: number; target_y: number };
            const res = executeSendUnits(currentState, aiPlayerId, unit_ids, target_x, target_y, 'attack');
            currentState = res.newState;
            result = res.result;
            console.log(`  → ${result.message}`);
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
          model: 'gpt-5-mini-2025-08-07',
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

    return NextResponse.json({
      newState: currentState,
      messages,
      actions, // Explicit actions for frontend to apply
      responseId: response.id,
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
