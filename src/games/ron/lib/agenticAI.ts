/**
 * Rise of Nations - Agentic AI System
 * 
 * Uses OpenAI Responses SDK to create an intelligent, tool-using AI opponent.
 * The AI runs in a loop, reading game state and taking actions using tools.
 */

import OpenAI from 'openai';
import { RoNGameState } from '../types/game';
import {
  AI_TOOLS,
  CondensedGameState,
  ToolResult,
  generateCondensedGameState,
  executeBuildBuilding,
  executeCreateUnit,
  executeSendUnits,
  executeAdvanceAge,
} from './aiTools';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// OpenAI client - will be initialized with API key from environment
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * AI Agent state - persists across turns
 */
export interface AgenticAIState {
  playerId: string;
  responseId?: string;  // For continuing conversations
  lastActionTick: number;
  actionInterval: number;  // How many ticks between AI actions
  messages: Array<{ role: 'assistant' | 'user'; content: string }>;
  aiMessages: string[];  // Messages sent to the human player
  isThinking: boolean;
  lastError?: string;
  tmpFilePath?: string;
}

/**
 * System prompt for the AI
 */
const SYSTEM_PROMPT = `You are an advanced AI opponent in a Rise of Nations-style real-time strategy game. You are playing against a VERY SKILLED human player, so you must play strategically and aggressively.

## Your Goal
Win the game by either:
1. Destroying all enemy city centers and buildings
2. Achieving military dominance and forcing surrender

## Game Mechanics Overview
- You control units and buildings on an isometric tile-based map
- Resources: Food, Wood, Metal, Gold, Knowledge, Oil
- Ages: Classical → Medieval → Enlightenment → Industrial → Modern
- Buildings produce resources (with workers assigned) and spawn units
- Units can gather resources, build, or fight

## Strategy Priorities (in order)
1. **Economy First**: Build farms and assign citizens to gather food
2. **Expand Citizens**: Train more citizens (population is key)
3. **Build Military Production**: Barracks for infantry, stables for cavalry
4. **Train Army**: Build a military force before attacking
5. **Scout Enemy**: Know where the enemy is
6. **Attack Wisely**: Strike when you have advantage

## Available Actions
- refresh_game_state: Get current game state (call at start of each turn)
- read_game_state: Read the detailed game state
- build_building: Construct buildings (farms, barracks, etc.)
- create_unit: Queue units at production buildings
- send_units: Move units, attack, or assign gathering tasks
- send_message: Communicate with opponent (DO THIS FREQUENTLY!)
- advance_age: Advance to next age when you have resources
- wait_ticks: Wait for economy/production (use sparingly)

## Game State JSON Structure
When you call read_game_state, you'll get:
{
  "tick": number,           // Current game time
  "myPlayer": {
    "id", "name", "age",
    "resources": { food, wood, metal, gold, knowledge, oil },
    "resourceRates": { ... },  // Income per tick
    "population", "populationCap"
  },
  "myUnits": [{ id, type, x, y, health, task, isMoving }],
  "myBuildings": [{ type, x, y, health, constructionProgress, queuedUnits }],
  "enemyUnits": [{ id, type, x, y, health }],
  "enemyBuildings": [{ type, x, y, health }],
  "mapSize": number,
  "availableBuildingTypes": [...],
  "availableUnitTypes": [{ type, cost, producedAt }],
  "territoryTiles": [{ x, y }],  // Your territory
  "resourceTiles": { forests, metalDeposits, oilDeposits }
}

## Important Tips
1. Citizens must be assigned to economic buildings to gather resources
2. Only build within your territory (near city centers)
3. Each building can only have a limited number of workers
4. Military units auto-attack nearby enemies
5. Buildings under construction need workers to finish faster

## Communication
SEND MESSAGES FREQUENTLY to your opponent! Be creative:
- Taunt them when you're winning
- Bluff about your strength
- React to their actions
- Make the game fun and engaging

Remember: You're playing against a skilled human. Play smart, be aggressive, and communicate!`;

/**
 * Initialize AI agent state
 */
export function initializeAgenticAI(playerId: string, actionInterval: number = 100): AgenticAIState {
  return {
    playerId,
    lastActionTick: 0,
    actionInterval,
    messages: [],
    aiMessages: [],
    isThinking: false,
  };
}

/**
 * Write game state to a temporary JSON file
 */
function writeGameStateToFile(state: CondensedGameState): string {
  const tmpDir = os.tmpdir();
  const fileName = `ron_game_state_${Date.now()}.json`;
  const filePath = path.join(tmpDir, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  
  return filePath;
}

/**
 * Process a tool call from the AI
 */
function processToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  gameState: RoNGameState,
  aiState: AgenticAIState
): { newState: RoNGameState; result: ToolResult; waitTicks?: number } {
  const playerId = aiState.playerId;

  switch (toolName) {
    case 'refresh_game_state':
    case 'read_game_state': {
      const condensed = generateCondensedGameState(gameState, playerId);
      const filePath = writeGameStateToFile(condensed);
      aiState.tmpFilePath = filePath;
      return {
        newState: gameState,
        result: {
          success: true,
          message: `Game state written to ${filePath}`,
          data: condensed,
        },
      };
    }

    case 'build_building': {
      const { building_type, x, y } = toolArgs as { building_type: string; x: number; y: number };
      return executeBuildBuilding(gameState, playerId, building_type, Math.floor(x), Math.floor(y));
    }

    case 'create_unit': {
      const { unit_type, building_x, building_y } = toolArgs as { unit_type: string; building_x: number; building_y: number };
      return executeCreateUnit(gameState, playerId, unit_type, Math.floor(building_x), Math.floor(building_y));
    }

    case 'send_units': {
      const { unit_ids, target_x, target_y, task } = toolArgs as {
        unit_ids: string[];
        target_x: number;
        target_y: number;
        task: string;
      };
      return executeSendUnits(gameState, playerId, unit_ids, target_x, target_y, task);
    }

    case 'send_message': {
      const { message } = toolArgs as { message: string };
      aiState.aiMessages.push(message);
      return {
        newState: gameState,
        result: { success: true, message: `Message sent: "${message}"` },
      };
    }

    case 'advance_age': {
      return executeAdvanceAge(gameState, playerId);
    }

    case 'wait_ticks': {
      const { ticks } = toolArgs as { ticks: number };
      const clampedTicks = Math.min(100, Math.max(1, ticks));
      return {
        newState: gameState,
        result: { success: true, message: `Waiting ${clampedTicks} ticks` },
        waitTicks: clampedTicks,
      };
    }

    default:
      return {
        newState: gameState,
        result: { success: false, message: `Unknown tool: ${toolName}` },
      };
  }
}

/**
 * Run one AI turn using OpenAI Responses SDK
 */
export async function runAgenticAITurn(
  gameState: RoNGameState,
  aiState: AgenticAIState
): Promise<{ newState: RoNGameState; updatedAIState: AgenticAIState }> {
  // Check if it's time to act
  if (gameState.tick - aiState.lastActionTick < aiState.actionInterval) {
    return { newState: gameState, updatedAIState: aiState };
  }

  // Check if game is over
  if (gameState.gameOver) {
    return { newState: gameState, updatedAIState: aiState };
  }

  // Check if AI player exists and isn't defeated
  const aiPlayer = gameState.players.find(p => p.id === aiState.playerId);
  if (!aiPlayer || aiPlayer.isDefeated) {
    return { newState: gameState, updatedAIState: aiState };
  }

  aiState.isThinking = true;
  aiState.lastActionTick = gameState.tick;

  try {
    const client = getOpenAIClient();
    
    // Generate initial game state for context
    const condensedState = generateCondensedGameState(gameState, aiState.playerId);
    
    // Build the prompt
    const userMessage = `Current game state (tick ${gameState.tick}):
${JSON.stringify(condensedState, null, 2)}

It's your turn. Analyze the situation and take actions. Remember to:
1. First call refresh_game_state to get the latest state
2. Make strategic decisions based on the state
3. Execute multiple actions if beneficial
4. Send a message to your opponent at least once every few turns
5. Be aggressive and strategic - you're playing against a skilled human!`;

    // Create the response using OpenAI Responses API
    let response = await client.responses.create({
      model: 'gpt-5-mini-2025-08-07', // Using gpt-4o-mini as gpt-5-mini doesn't exist
      instructions: SYSTEM_PROMPT,
      input: userMessage,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      ...(aiState.responseId ? { previous_response_id: aiState.responseId } : {}),
    });

    // Store response ID for conversation continuity
    aiState.responseId = response.id;

    let currentState = gameState;
    let totalWaitTicks = 0;
    const maxIterations = 20; // Prevent infinite loops
    let iterations = 0;

    // Process tool calls in a loop
    while (response.output && iterations < maxIterations) {
      iterations++;
      
      const toolCalls = response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall => 
          item.type === 'function_call'
      );

      if (toolCalls.length === 0) {
        // No more tool calls, AI is done
        break;
      }

      // Process each tool call
      const toolResults: Array<{ call_id: string; output: string }> = [];
      
      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.arguments || '{}');
        const { newState, result, waitTicks } = processToolCall(
          toolCall.name,
          args,
          currentState,
          aiState
        );
        
        currentState = newState;
        if (waitTicks) {
          totalWaitTicks += waitTicks;
        }
        
        toolResults.push({
          call_id: toolCall.call_id,
          output: JSON.stringify(result),
        });
      }

      // Continue the conversation with tool results
      response = await client.responses.create({
        model: 'gpt-4o-mini',
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

      aiState.responseId = response.id;
    }

    // Extract any text response from the AI (message type contains text content)
    const messageOutputs = (response.output || []).filter(
      (item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message'
    );

    if (messageOutputs.length > 0) {
      const thoughts = messageOutputs
        .flatMap(m => m.content)
        .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === 'output_text')
        .map(t => t.text)
        .join('\n');
      if (thoughts) {
        console.log('[AI Thoughts]', thoughts);
      }
    }

    // Adjust next action time based on wait_ticks
    if (totalWaitTicks > 0) {
      aiState.lastActionTick += totalWaitTicks;
    }

    aiState.isThinking = false;
    aiState.lastError = undefined;

    return { newState: currentState, updatedAIState: aiState };

  } catch (error) {
    console.error('[Agentic AI Error]', error);
    aiState.isThinking = false;
    aiState.lastError = error instanceof Error ? error.message : 'Unknown error';
    
    // On error, just return unchanged state
    return { newState: gameState, updatedAIState: aiState };
  }
}

/**
 * Get any pending messages from the AI
 */
export function getAIMessages(aiState: AgenticAIState): string[] {
  const messages = [...aiState.aiMessages];
  aiState.aiMessages = []; // Clear after reading
  return messages;
}

/**
 * Clean up temporary files
 */
export function cleanupAgenticAI(aiState: AgenticAIState): void {
  if (aiState.tmpFilePath) {
    try {
      fs.unlinkSync(aiState.tmpFilePath);
    } catch {
      // Ignore cleanup errors
    }
    aiState.tmpFilePath = undefined;
  }
}
