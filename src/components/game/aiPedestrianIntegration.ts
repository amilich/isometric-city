/**
 * AI Pedestrian Integration
 * 
 * 将AI小人购物系统集成到主游戏循环
 */

import { Pedestrian } from './types';
import { GameState, Tile } from '@/types/game';
import { AI_PEDESTRIAN_CONFIG, getAIPedestrianStatusLabel, AIPedestrianType } from './aiPedestrianConfig';
import {
  initializeAIPedestrianShopping,
  updateAIPedestrianShopping,
  getShoppingAnimationOffset,
} from './aiPedestrianSystem';

/**
 * 生成新的AI小人
 */
export function spawnAIPedestrian(
  pedestrians: Pedestrian[],
  tileX: number,
  tileY: number,
  aiType: AIPedestrianType = AIPedestrianType.SHOPPER
): Pedestrian | null {
  if (pedestrians.length >= AI_PEDESTRIAN_CONFIG.maxAIPedestrians) {
    return null;
  }

  const skinColors = ['#f4a460', '#daa520', '#d2b48c', '#deb887', '#f5deb3'];
  const shirtColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
  const pantsColors = ['#2d3436', '#636e72', '#0984e3', '#a29bfe'];

  const id = Math.max(0, ...pedestrians.map(p => p.id), 0) + 1;

  const newPedestrian: Pedestrian = {
    id,
    tileX,
    tileY,
    direction: 'east',
    progress: 0,
    speed: 0.15,
    age: Math.random() * 40 + 20, // 20-60 years old
    maxAge: 80,
    skinColor: skinColors[Math.floor(Math.random() * skinColors.length)],
    shirtColor: shirtColors[Math.floor(Math.random() * shirtColors.length)],
    pantsColor: pantsColors[Math.floor(Math.random() * pantsColors.length)],
    hasHat: Math.random() > 0.7,
    hatColor: shirtColors[Math.floor(Math.random() * shirtColors.length)],
    walkOffset: 0,
    sidewalkSide: Math.random() > 0.5 ? 'left' : 'right',
    destType: 'commercial',
    homeX: tileX,
    homeY: tileY,
    destX: tileX + Math.floor(Math.random() * 10 - 5),
    destY: tileY + Math.floor(Math.random() * 10 - 5),
    returningHome: false,
    path: [],
    pathIndex: 0,
    state: 'walking',
    activity: 'none',
    activityProgress: 0,
    activityDuration: 0,
    buildingEntryProgress: 0,
    socialTarget: null,
    activityOffsetX: 0,
    activityOffsetY: 0,
    activityAnimTimer: 0,
    hasBall: false,
    hasDog: false,
    hasBag: false,
    hasBeachMat: false,
    matColor: '',
    beachTileX: 0,
    beachTileY: 0,
    beachEdge: null,

    // AI小人属性
    isAI: true,
    aiType: aiType as any,
    isShopping: false,
    shoppingProgress: 0,
    shoppingDuration: 0,
    currentShopX: undefined,
    currentShopY: undefined,
    shoppingActivity: undefined,
    shoppingBudget: 0,
    itemsBought: 0,
    shopVisitsToday: 0,
    lastShoppingTime: 0,
    satisfactionLevel: 0.5,
    totalMoneySpent: 0,
  };

  // 初始化购物系统
  initializeAIPedestrianShopping(newPedestrian, aiType);

  return newPedestrian;
}

/**
 * 在游戏更新中处理AI小人
 */
export function updateAIPedestrians(
  pedestrians: Pedestrian[],
  grid: Tile[][],
  deltaTime: number,
  gameTime: number
): Pedestrian[] {
  const updatedPedestrians = pedestrians.map(pedestrian => {
    if (!pedestrian.isAI) {
      return pedestrian;
    }

    // 更新购物状态
    const updated = updateAIPedestrianShopping(
      pedestrian,
      grid,
      deltaTime,
      gameTime
    );

    // 根据购物状态调整动画
    if (updated.isShopping && updated.shoppingActivity && updated.shoppingProgress !== undefined) {
      const offset = getShoppingAnimationOffset(
        updated,
        updated.shoppingProgress
      );
      updated.activityOffsetX = offset.x;
      updated.activityOffsetY = offset.y;
    }

    return updated;
  });

  return updatedPedestrians;
}

/**
 * 生成初始AI小人
 */
export function initializeAIPedestrians(pedestrians: Pedestrian[], grid: Tile[][]): Pedestrian[] {
  const initialCount = AI_PEDESTRIAN_CONFIG.initialAIPedestrians;

  // 找到合适的生成位置
  const spawnPositions: Array<{ x: number; y: number }> = [];

  for (let x = 0; x < grid.length && spawnPositions.length < initialCount; x++) {
    for (let y = 0; y < grid[0].length && spawnPositions.length < initialCount; y++) {
      const tile = grid[x][y];
      // 在空地或道路上生成（zone为空并且没有建筑物）
      if (
        tile.zone === 'none' &&
        !tile.building &&
        !pedestrians.some(p => Math.hypot(p.tileX - x, p.tileY - y) < 5)
      ) {
        spawnPositions.push({ x, y });
      }
    }
  }

  // 创建AI小人
  const aiTypes: AIPedestrianType[] = [
    AIPedestrianType.WORKER,
    AIPedestrianType.SHOPPER,
    AIPedestrianType.TOURIST,
    AIPedestrianType.COMMUTER,
    AIPedestrianType.LEISURER,
  ];
  const aiTypeWeights = [0.15, 0.35, 0.15, 0.2, 0.15]; // 权重分布

  spawnPositions.forEach((pos) => {
    // 按权重选择AI类型
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedTypeEnum: AIPedestrianType = AIPedestrianType.SHOPPER;

    for (let i = 0; i < aiTypes.length; i++) {
      cumulativeWeight += aiTypeWeights[i];
      if (rand <= cumulativeWeight) {
        selectedTypeEnum = aiTypes[i];
        break;
      }
    }

    const newPedestrian = spawnAIPedestrian(pedestrians, pos.x, pos.y, selectedTypeEnum);
    if (newPedestrian) {
      pedestrians.push(newPedestrian);
    }
  });

  return pedestrians;
}

/**
 * 计算AI小人统计数据
 */
export function calculateAIPedestrianStats(pedestrians: Pedestrian[]): {
  totalCount: number;
  shoppingCount: number;
  walkingCount: number;
  idleCount: number;
  averageSatisfaction: number;
  totalMoneySpent: number;
} {
  const aiPedestrians = pedestrians.filter(p => p.isAI);

  if (aiPedestrians.length === 0) {
    return {
      totalCount: 0,
      shoppingCount: 0,
      walkingCount: 0,
      idleCount: 0,
      averageSatisfaction: 0,
      totalMoneySpent: 0,
    };
  }

  const shoppingCount = aiPedestrians.filter(p => p.isShopping).length;
  const walkingCount = aiPedestrians.filter(p => p.state === 'walking').length;
  const idleCount = aiPedestrians.filter(p => p.state === 'idle').length;
  const totalMoney = aiPedestrians.reduce((sum, p) => sum + (p.totalMoneySpent || 0), 0);
  const avgSatisfaction =
    aiPedestrians.reduce((sum, p) => sum + (p.satisfactionLevel || 0.5), 0) /
    aiPedestrians.length;

  return {
    totalCount: aiPedestrians.length,
    shoppingCount,
    walkingCount,
    idleCount,
    averageSatisfaction: avgSatisfaction,
    totalMoneySpent: totalMoney,
  };
}

/**
 * 设置AI小人系统的生成速率
 */
export function setAIPedestrianSpawnRate(rate: number): void {
  AI_PEDESTRIAN_CONFIG.spawnRate = Math.max(0, Math.min(0.1, rate));
}

/**
 * 清除所有AI小人
 */
export function clearAIPedestrians(pedestrians: Pedestrian[]): Pedestrian[] {
  return pedestrians.filter(p => !p.isAI);
}

/**
 * 获取AI小人的状态标签（中文）
 */
export function getAIPedestrianStateLabel(pedestrian: Pedestrian): string {
  if (!pedestrian.isAI) return '';

  if (pedestrian.isShopping) {
    return `购物中 (${Math.floor((pedestrian.shoppingProgress || 0) * 100)}%)`;
  }

  if (pedestrian.state === 'walking') {
    return '行走中';
  }

  if (pedestrian.state === 'idle') {
    return '闲逛中';
  }

  return getAIPedestrianStatusLabel(false, '');
}
