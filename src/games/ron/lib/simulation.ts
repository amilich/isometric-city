/**
 * Rise of Nations - Simulation Engine
 * 
 * Handles game tick simulation including:
 * - Resource gathering
 * - Unit movement and combat
 * - Building construction and production
 * - AI decision making
 */

import { RoNGameState, RoNPlayer, RoNTile } from '../types/game';
import { Age, AGE_ORDER, AGE_REQUIREMENTS } from '../types/ages';
import { Resources, ResourceType, BASE_GATHER_RATES } from '../types/resources';
import { RoNBuilding, RoNBuildingType, BUILDING_STATS, ECONOMIC_BUILDINGS, UNIT_PRODUCTION_BUILDINGS } from '../types/buildings';
import { Unit, UnitType, UnitTask, UNIT_STATS } from '../types/units';

// Simulation constants
const CONSTRUCTION_SPEED = 2; // Progress per tick
const PRODUCTION_SPEED = 1.5; // Unit production progress per tick
const UNIT_MOVE_SPEED = 0.1; // Movement per tick (in tiles)
const ATTACK_COOLDOWN = 10; // Ticks between attacks
const RESOURCE_GATHER_RATE = 0.5; // Base gathering per tick per worker

/**
 * Main simulation tick
 */
export function simulateRoNTick(state: RoNGameState): RoNGameState {
  if (state.gameOver) return state;
  
  let newState = { ...state, tick: state.tick + 1 };
  
  // Update each player
  newState = updatePlayers(newState);
  
  // Update buildings (construction, production)
  newState = updateBuildings(newState);
  
  // Update units (movement, gathering, combat)
  newState = updateUnits(newState);
  
  // Run AI for AI players
  newState = runAI(newState);
  
  // Check win/lose conditions
  newState = checkVictoryConditions(newState);
  
  return newState;
}

/**
 * Update player resources and rates
 */
function updatePlayers(state: RoNGameState): RoNGameState {
  const newPlayers = state.players.map(player => {
    if (player.isDefeated) return player;
    
    // Calculate resource rates from buildings and workers
    const rates: Resources = { food: 0, wood: 0, metal: 0, gold: 0, knowledge: 0, oil: 0 };
    
    // Count workers at economic buildings
    // Workers count if they have a gather task targeting the building AND aren't moving
    const workerCounts = new Map<string, number>(); // Building position key -> worker count
    
    state.units.forEach(unit => {
      if (unit.ownerId !== player.id) return;
      if (!unit.task || !unit.task.startsWith('gather_')) return;
      if (unit.isMoving) return; // Only count workers who have arrived
      
      const targetPos = unit.taskTarget;
      if (targetPos && typeof targetPos === 'object' && 'x' in targetPos) {
        // Use floor to match building grid position
        const key = `${Math.floor(targetPos.x)},${Math.floor(targetPos.y)}`;
        workerCounts.set(key, (workerCounts.get(key) || 0) + 1);
      }
    });
    
    // Calculate rates from buildings with workers
    state.grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (!tile.building || tile.ownerId !== player.id) return;
        
        const building = tile.building;
        if (building.constructionProgress < 100) return; // Not complete
        
        // Use integer key to match worker count lookup
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        const workers = workerCounts.get(key) || 0;
        
        
        // Base production from building type
        switch (building.type) {
          case 'farm':
            rates.food += workers * RESOURCE_GATHER_RATE * 1.5;
            break;
          case 'woodcutters_camp':
          case 'lumber_mill':
            rates.wood += workers * RESOURCE_GATHER_RATE * 1.2;
            break;
          case 'mine':
          case 'smelter':
            rates.metal += workers * RESOURCE_GATHER_RATE;
            break;
          case 'market':
            rates.gold += workers * RESOURCE_GATHER_RATE * 0.8;
            break;
          case 'oil_well':
          case 'refinery':
            if (tile.hasOilDeposit || building.type === 'refinery') {
              rates.oil += workers * RESOURCE_GATHER_RATE * 0.6;
            }
            break;
          case 'library':
          case 'university':
            rates.knowledge += workers * RESOURCE_GATHER_RATE * 0.5;
            break;
        }
      });
    });
    
    // Apply rates to resources (capped by storage)
    const newResources = { ...player.resources };
    for (const [resource, rate] of Object.entries(rates)) {
      const r = resource as ResourceType;
      newResources[r] = Math.min(
        player.storageLimits[r],
        newResources[r] + rate
      );
    }
    
    return {
      ...player,
      resources: newResources,
      resourceRates: rates,
    };
  });
  
  return { ...state, players: newPlayers };
}

/**
 * Update buildings (construction progress, unit production)
 */
function updateBuildings(state: RoNGameState): RoNGameState {
  let newGrid = state.grid;
  let newUnits = [...state.units];
  let newPlayers = [...state.players];
  
  newGrid = newGrid.map((row, y) =>
    row.map((tile, x) => {
      if (!tile.building) return tile;
      
      const building = tile.building;
      let updatedBuilding = { ...building };
      
      // Construction progress
      if (building.constructionProgress < 100) {
        // Check if there's a worker building this
        const hasBuilder = state.units.some(
          u => u.task === 'build' && 
               u.taskTarget && 
               typeof u.taskTarget === 'object' &&
               'x' in u.taskTarget &&
               u.taskTarget.x === x && 
               u.taskTarget.y === y
        );
        
        if (hasBuilder) {
          updatedBuilding.constructionProgress = Math.min(
            100,
            building.constructionProgress + CONSTRUCTION_SPEED
          );
        }
      }
      
      // Unit production
      if (building.constructionProgress >= 100 && building.queuedUnits.length > 0) {
        const unitType = building.queuedUnits[0] as UnitType;
        const unitStats = UNIT_STATS[unitType];
        
        if (unitStats) {
          updatedBuilding.productionProgress += PRODUCTION_SPEED;
          
          if (updatedBuilding.productionProgress >= unitStats.buildTime) {
            // Spawn the unit
            const newUnit: Unit = {
              id: `unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: unitType,
              ownerId: building.ownerId,
              x: x + 0.5,
              y: y + 1.5, // Spawn in front of building
              health: unitStats.health,
              maxHealth: unitStats.health,
              isSelected: false,
              isMoving: false,
              task: 'idle',
              attackCooldown: 0,
              lastAttackTime: 0,
            };
            
            newUnits.push(newUnit);
            
            // Update player population
            newPlayers = newPlayers.map(p => 
              p.id === building.ownerId 
                ? { ...p, population: p.population + 1 }
                : p
            );
            
            // Remove from queue, reset progress
            updatedBuilding.queuedUnits = building.queuedUnits.slice(1);
            updatedBuilding.productionProgress = 0;
          }
        }
      }
      
      return { ...tile, building: updatedBuilding };
    })
  );
  
  return { ...state, grid: newGrid, units: newUnits, players: newPlayers };
}

/**
 * Update units (movement, combat, gathering)
 */
function updateUnits(state: RoNGameState): RoNGameState {
  const newUnits: Unit[] = [];
  let newGrid = state.grid;
  
  for (const unit of state.units) {
    let updatedUnit = { ...unit };
    
    // Movement
    if (updatedUnit.isMoving && updatedUnit.targetX !== undefined && updatedUnit.targetY !== undefined) {
      const dx = updatedUnit.targetX - updatedUnit.x;
      const dy = updatedUnit.targetY - updatedUnit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const unitStats = UNIT_STATS[unit.type];
      const speed = (unitStats?.speed || 1) * UNIT_MOVE_SPEED;
      
      // For gathering tasks, stop when close to the building (not exactly on it)
      const arrivalDist = updatedUnit.task?.startsWith('gather_') ? 1.5 : speed;
      
      if (dist < arrivalDist) {
        // Arrived - spread out around the target for gather tasks
        if (updatedUnit.task?.startsWith('gather_') && updatedUnit.taskTarget && typeof updatedUnit.taskTarget === 'object') {
          // Find a spot around the building that isn't too crowded
          const targetPos = updatedUnit.taskTarget as { x: number; y: number };
          const unitIndex = state.units.findIndex(u => u.id === unit.id);
          const angle = (unitIndex * 1.2) + Math.random() * 0.5; // Spread in a circle
          const spreadDist = 0.8 + Math.random() * 0.4;
          updatedUnit.x = targetPos.x + Math.cos(angle) * spreadDist;
          updatedUnit.y = targetPos.y + Math.sin(angle) * spreadDist;
        } else {
          updatedUnit.x = updatedUnit.targetX;
          updatedUnit.y = updatedUnit.targetY;
        }
        updatedUnit.isMoving = false;
        updatedUnit.targetX = undefined;
        updatedUnit.targetY = undefined;
      } else {
        // Move toward target
        updatedUnit.x += (dx / dist) * speed;
        updatedUnit.y += (dy / dist) * speed;
      }
    }
    
    // Combat
    if (updatedUnit.task === 'attack' && updatedUnit.taskTarget) {
      updatedUnit.attackCooldown = Math.max(0, updatedUnit.attackCooldown - 1);
      
      if (updatedUnit.attackCooldown === 0) {
        const unitStats = UNIT_STATS[unit.type];
        const attackRange = unitStats?.range || 1;
        
        // Find target
        if (typeof updatedUnit.taskTarget === 'string') {
          // Target is a unit ID
          const targetUnit = state.units.find(u => u.id === updatedUnit.taskTarget);
          if (targetUnit) {
            const dist = Math.sqrt(
              (targetUnit.x - updatedUnit.x) ** 2 + 
              (targetUnit.y - updatedUnit.y) ** 2
            );
            
            if (dist <= attackRange) {
              // Attack!
              const damage = unitStats?.attack || 1;
              const targetIndex = newUnits.findIndex(u => u.id === targetUnit.id);
              if (targetIndex >= 0) {
                newUnits[targetIndex] = {
                  ...newUnits[targetIndex],
                  health: newUnits[targetIndex].health - damage,
                };
              }
              updatedUnit.attackCooldown = ATTACK_COOLDOWN;
              updatedUnit.lastAttackTime = state.tick;
            } else {
              // Move toward target
              updatedUnit.targetX = targetUnit.x;
              updatedUnit.targetY = targetUnit.y;
              updatedUnit.isMoving = true;
            }
          }
        } else if ('x' in updatedUnit.taskTarget) {
          // Target is a building position - capture the typed value
          const targetPos = updatedUnit.taskTarget as { x: number; y: number };
          const targetTile = state.grid[Math.floor(targetPos.y)]?.[Math.floor(targetPos.x)];
          if (targetTile?.building) {
            const dist = Math.sqrt(
              (targetPos.x - updatedUnit.x) ** 2 + 
              (targetPos.y - updatedUnit.y) ** 2
            );
            
            if (dist <= attackRange) {
              // Attack building
              const damage = unitStats?.attack || 1;
              const newBuilding = {
                ...targetTile.building,
                health: targetTile.building.health - damage,
              };
              
              // Update grid
              newGrid = newGrid.map((row, gy) =>
                row.map((tile, gx) => {
                  if (gx === Math.floor(targetPos.x) && 
                      gy === Math.floor(targetPos.y)) {
                    if (newBuilding.health <= 0) {
                      return { ...tile, building: null, ownerId: null };
                    }
                    return { ...tile, building: newBuilding };
                  }
                  return tile;
                })
              );
              
              updatedUnit.attackCooldown = ATTACK_COOLDOWN;
              updatedUnit.lastAttackTime = state.tick;
            } else {
              // Move toward target
              updatedUnit.targetX = targetPos.x;
              updatedUnit.targetY = targetPos.y;
              updatedUnit.isMoving = true;
            }
          }
        }
      }
    }
    
    // Only add if still alive
    if (updatedUnit.health > 0) {
      newUnits.push(updatedUnit);
    }
  }
  
  return { ...state, units: newUnits, grid: newGrid };
}

/**
 * AI decision making
 */
function runAI(state: RoNGameState): RoNGameState {
  let newState = state;

  for (const player of state.players) {
    if (player.type !== 'ai' || player.isDefeated) continue;

    const difficulty = player.difficulty || 'medium';
    // Increase action chances so AI is more active
    const actionChance = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.5 : 0.7;

    // Random chance to take an action each tick
    if (Math.random() > actionChance) continue;

    // Log AI activity periodically
    if (state.tick % 50 === 0) {
      console.log(`AI ${player.name} (${difficulty}): resources=`, player.resources, 'units=', state.units.filter(u => u.ownerId === player.id).length);
    }

    // AI decision priorities - try multiple actions each tick
    const decisions = [
      () => aiAssignIdleWorkers(newState, player), // First assign workers
      () => aiTryTrainUnits(newState, player),     // Then train units
      () => aiTryBuildEconomic(newState, player),  // Build economy
      () => aiTryBuildMilitary(newState, player),  // Build military
      () => aiTryAdvanceAge(newState, player),     // Advance age
      () => aiAttackIfStrong(newState, player, difficulty), // Attack
    ];
    
    // Execute multiple decisions per tick (AI should be more active)
    let actionsPerTick = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    for (const decision of decisions) {
      if (actionsPerTick <= 0) break;
      const result = decision();
      if (result !== newState) {
        newState = result;
        actionsPerTick--;
      }
    }
  }
  
  return newState;
}

function aiTryAdvanceAge(state: RoNGameState, player: RoNPlayer): RoNGameState {
  const ageIndex = AGE_ORDER.indexOf(player.age);
  if (ageIndex >= AGE_ORDER.length - 1) return state;
  
  const nextAge = AGE_ORDER[ageIndex + 1];
  const requirements = AGE_REQUIREMENTS[nextAge];
  if (!requirements) return state;
  
  // Check if can afford
  for (const [resource, amount] of Object.entries(requirements)) {
    if (player.resources[resource as ResourceType] < amount) {
      return state;
    }
  }
  
  // Advance age
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(requirements)) {
    newResources[resource as ResourceType] -= amount;
  }
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, age: nextAge as Age, resources: newResources } : p
  );
  
  return { ...state, players: newPlayers };
}

function aiTryBuildEconomic(state: RoNGameState, player: RoNPlayer): RoNGameState {
  // Count existing economic buildings
  let farms = 0;
  let lumber = 0;
  let mines = 0;
  
  state.grid.forEach(row => {
    row.forEach(tile => {
      if (tile.ownerId !== player.id || !tile.building) return;
      switch (tile.building.type) {
        case 'farm': farms++; break;
        case 'woodcutters_camp':
        case 'lumber_mill': lumber++; break;
        case 'mine':
        case 'smelter': mines++; break;
      }
    });
  });
  
  // Determine what to build
  let buildingType: RoNBuildingType | null = null;
  if (farms < 2) buildingType = 'farm';
  else if (lumber < 2) buildingType = 'woodcutters_camp';
  else if (mines < 1 && AGE_ORDER.indexOf(player.age) >= 1) buildingType = 'mine';
  
  if (!buildingType) return state;
  
  return aiPlaceBuilding(state, player, buildingType);
}

function aiTryBuildMilitary(state: RoNGameState, player: RoNPlayer): RoNGameState {
  // Count barracks
  let barracks = 0;
  state.grid.forEach(row => {
    row.forEach(tile => {
      if (tile.ownerId === player.id && tile.building?.type === 'barracks') {
        barracks++;
      }
    });
  });
  
  if (barracks >= 2) return state;
  
  return aiPlaceBuilding(state, player, 'barracks');
}

function aiPlaceBuilding(state: RoNGameState, player: RoNPlayer, buildingType: RoNBuildingType): RoNGameState {
  const stats = BUILDING_STATS[buildingType];
  if (!stats) return state;
  
  // Check resources
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return state;
    }
  }
  
  // Find a suitable location near existing buildings
  let bestPos: { x: number; y: number } | null = null;
  
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      const tile = state.grid[y][x];
      
      // Check if location is valid
      if (tile.building || tile.terrain === 'water') continue;
      
      // Check if near owned territory
      let nearOwned = false;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const checkTile = state.grid[y + dy]?.[x + dx];
          if (checkTile?.ownerId === player.id) {
            nearOwned = true;
            break;
          }
        }
        if (nearOwned) break;
      }
      
      if (nearOwned) {
        // Check building size fits
        let fits = true;
        for (let dy = 0; dy < stats.size.height; dy++) {
          for (let dx = 0; dx < stats.size.width; dx++) {
            const checkTile = state.grid[y + dy]?.[x + dx];
            if (!checkTile || checkTile.building || checkTile.terrain === 'water') {
              fits = false;
              break;
            }
          }
          if (!fits) break;
        }
        
        if (fits) {
          bestPos = { x, y };
          break;
        }
      }
    }
    if (bestPos) break;
  }
  
  if (!bestPos) return state;
  
  // Deduct resources
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(stats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }
  
  // Create building
  const newBuilding: RoNBuilding = {
    type: buildingType,
    level: 1,
    ownerId: player.id,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    constructionProgress: 100, // AI buildings are instant for simplicity
    queuedUnits: [],
    productionProgress: 0,
    garrisonedUnits: [],
  };
  
  // Update grid
  const newGrid = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx >= bestPos!.x && gx < bestPos!.x + stats.size.width &&
          gy >= bestPos!.y && gy < bestPos!.y + stats.size.height) {
        return {
          ...tile,
          building: gx === bestPos!.x && gy === bestPos!.y ? newBuilding : null,
          ownerId: player.id,
        };
      }
      return tile;
    })
  );
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, resources: newResources } : p
  );
  
  return { ...state, grid: newGrid, players: newPlayers };
}

function aiTryTrainUnits(state: RoNGameState, player: RoNPlayer): RoNGameState {
  if (player.population >= player.populationCap - 2) return state;
  
  // Count units
  let citizens = 0;
  let military = 0;
  
  state.units.forEach(u => {
    if (u.ownerId !== player.id) return;
    if (u.type === 'citizen') citizens++;
    else military++;
  });
  
  // Determine what to train
  let unitType: UnitType | null = null;
  let buildingType: RoNBuildingType | null = null;
  
  if (citizens < 6) {
    unitType = 'citizen';
    buildingType = 'city_center';
  } else if (military < citizens) {
    unitType = 'militia';
    buildingType = 'barracks';
  }
  
  if (!unitType || !buildingType) return state;
  
  // Find building
  let buildingPos: { x: number; y: number } | null = null;
  
  state.grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile.ownerId === player.id && 
          tile.building?.type === buildingType &&
          tile.building.constructionProgress >= 100 &&
          tile.building.queuedUnits.length < 3) {
        buildingPos = { x, y };
      }
    });
  });
  
  if (!buildingPos) return state;
  
  const unitStats = UNIT_STATS[unitType];
  if (!unitStats) return state;
  
  // Check resources
  for (const [resource, amount] of Object.entries(unitStats.cost)) {
    if (amount && player.resources[resource as ResourceType] < amount) {
      return state;
    }
  }
  
  // Deduct resources and queue
  const newResources = { ...player.resources };
  for (const [resource, amount] of Object.entries(unitStats.cost)) {
    if (amount) {
      newResources[resource as ResourceType] -= amount;
    }
  }
  
  const newGrid = state.grid.map((row, gy) =>
    row.map((tile, gx) => {
      if (gx === buildingPos!.x && gy === buildingPos!.y && tile.building) {
        return {
          ...tile,
          building: {
            ...tile.building,
            queuedUnits: [...tile.building.queuedUnits, unitType!],
          },
        };
      }
      return tile;
    })
  );
  
  const newPlayers = state.players.map(p =>
    p.id === player.id ? { ...p, resources: newResources } : p
  );
  
  return { ...state, grid: newGrid, players: newPlayers };
}

function aiAssignIdleWorkers(state: RoNGameState, player: RoNPlayer): RoNGameState {
  // Find idle citizens
  const idleCitizens = state.units.filter(
    u => u.ownerId === player.id && u.type === 'citizen' && u.task === 'idle'
  );
  
  if (idleCitizens.length === 0) return state;
  
  // Find economic buildings that need workers
  const economicBuildings: Array<{ x: number; y: number; type: RoNBuildingType }> = [];
  
  state.grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile.ownerId === player.id && 
          tile.building && 
          tile.building.constructionProgress >= 100 &&
          ECONOMIC_BUILDINGS.includes(tile.building.type)) {
        economicBuildings.push({ x, y, type: tile.building.type });
      }
    });
  });
  
  if (economicBuildings.length === 0) return state;
  
  // Assign first idle citizen to a random building
  const citizen = idleCitizens[0];
  const building = economicBuildings[Math.floor(Math.random() * economicBuildings.length)];
  
  let taskType: UnitTask = 'gather_food';
  switch (building.type) {
    case 'farm': taskType = 'gather_food'; break;
    case 'woodcutters_camp':
    case 'lumber_mill': taskType = 'gather_wood'; break;
    case 'mine':
    case 'smelter': taskType = 'gather_metal'; break;
    case 'market': taskType = 'gather_gold'; break;
    case 'oil_well':
    case 'refinery': taskType = 'gather_oil'; break;
    case 'library':
    case 'university': taskType = 'gather_gold'; break; // Knowledge gathering
  }
  
  const newUnits = state.units.map(u => {
    if (u.id === citizen.id) {
      return {
        ...u,
        task: taskType,
        taskTarget: { x: building.x, y: building.y },
        targetX: building.x,
        targetY: building.y,
        isMoving: true,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

function aiAttackIfStrong(state: RoNGameState, player: RoNPlayer, difficulty: string): RoNGameState {
  // Count military units
  const militaryUnits = state.units.filter(
    u => u.ownerId === player.id && u.type !== 'citizen' && u.task === 'idle'
  );
  
  const threshold = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 6 : 3;
  if (militaryUnits.length < threshold) return state;
  
  // Find enemy buildings - use nested loop for proper type narrowing
  let attackTarget: { x: number; y: number } | undefined = undefined;
  
  outer: for (let y = 0; y < state.grid.length; y++) {
    const row = state.grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (tile.ownerId && tile.ownerId !== player.id && tile.building) {
        attackTarget = { x, y };
        break outer;
      }
    }
  }
  
  if (!attackTarget) return state;
  
  // Capture the value for use in callback
  const target = attackTarget;
  
  // Send military units to attack
  const newUnits = state.units.map(u => {
    if (u.ownerId === player.id && 
        u.type !== 'citizen' && 
        u.task === 'idle') {
      return {
        ...u,
        task: 'attack' as UnitTask,
        taskTarget: target,
        targetX: target.x,
        targetY: target.y,
        isMoving: true,
      };
    }
    return u;
  });
  
  return { ...state, units: newUnits };
}

/**
 * Check victory conditions
 */
function checkVictoryConditions(state: RoNGameState): RoNGameState {
  // Check if any player has no buildings (defeated)
  const newPlayers = state.players.map(player => {
    if (player.isDefeated) return player;
    
    let hasBuildings = false;
    state.grid.forEach(row => {
      row.forEach(tile => {
        if (tile.ownerId === player.id && tile.building) {
          hasBuildings = true;
        }
      });
    });
    
    if (!hasBuildings) {
      return { ...player, isDefeated: true };
    }
    return player;
  });
  
  // Check for winner
  const activePlayers = newPlayers.filter(p => !p.isDefeated);
  let winnerId: string | null = null;
  let gameOver = false;
  
  if (activePlayers.length === 1) {
    winnerId = activePlayers[0].id;
    gameOver = true;
  } else if (activePlayers.length === 0) {
    gameOver = true; // Draw
  }
  
  return { ...state, players: newPlayers, gameOver, winnerId };
}
