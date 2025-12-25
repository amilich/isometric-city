/**
 * AI Pedestrian Shopping System
 * 
 * 扩展行人系统以添加自动购物行为：
 * - AI 小人可以自动购物
 * - 在商业建筑中消费
 * - 携带购物袋
 * - 自动寻找购物目的地
 */

import { Pedestrian } from './types';
import { BuildingType, Tile } from '@/types/game';
import { AI_PEDESTRIAN_CONFIG, AIPedestrianType, getShoppingProbabilityByType } from './aiPedestrianConfig';

/**
 * 初始化AI小人购物系统
 */
export function initializeAIPedestrianShopping(
  pedestrian: Pedestrian,
  aiType: AIPedestrianType = AIPedestrianType.SHOPPER
): void {
  pedestrian.isAI = true;
  pedestrian.aiType = aiType as any;
  pedestrian.isShopping = false;
  pedestrian.shoppingProgress = 0;
  pedestrian.shoppingDuration = 0;
  pedestrian.currentShopX = undefined;
  pedestrian.currentShopY = undefined;
  pedestrian.shoppingActivity = undefined;
  pedestrian.shoppingBudget = 
    Math.random() * (AI_PEDESTRIAN_CONFIG.shopping.maxBudget - AI_PEDESTRIAN_CONFIG.shopping.minBudget) +
    AI_PEDESTRIAN_CONFIG.shopping.minBudget;
  pedestrian.itemsBought = 0;
  pedestrian.shopVisitsToday = 0;
  pedestrian.lastShoppingTime = 0;
  pedestrian.satisfactionLevel = 0.5;
  pedestrian.totalMoneySpent = 0;
}

/**
 * 更新AI小人购物状态
 */
export function updateAIPedestrianShopping(
  pedestrian: Pedestrian,
  grid: Tile[][],
  deltaTime: number,
  gameTime: number
): Pedestrian {
  if (!pedestrian.isAI) {
    return pedestrian;
  }

  // 衰减满足度
  if (pedestrian.satisfactionLevel) {
    pedestrian.satisfactionLevel = Math.max(
      0,
      pedestrian.satisfactionLevel - AI_PEDESTRIAN_CONFIG.shopping.satisfactionDecayRate * deltaTime
    );
  }

  // 更新购物状态
  if (pedestrian.isShopping && pedestrian.shoppingProgress !== undefined) {
    pedestrian.shoppingProgress += deltaTime / (pedestrian.shoppingDuration || 1);

    if (pedestrian.shoppingProgress >= 1) {
      completeShoppingActivity(pedestrian);
    } else {
      // 保持购物动画
      pedestrian.hasBag = true;
    }
  } else {
    // 检查是否应该开始购物
    if (shouldGoShopping(pedestrian)) {
      startShoppingActivity(pedestrian, grid);
    }
  }

  return pedestrian;
}

/**
 * 检查小人是否应该去购物
 */
function shouldGoShopping(pedestrian: Pedestrian): boolean {
  if (!pedestrian.aiType || !pedestrian.shoppingBudget) {
    return false;
  }

  const aiType = pedestrian.aiType as unknown as AIPedestrianType;
  const shoppingProbability = getShoppingProbabilityByType(aiType);

  // 计算综合购物概率
  const satisfactionFactor = (1 - (pedestrian.satisfactionLevel || 0.5)) * 
    AI_PEDESTRIAN_CONFIG.shopping.satisfactionMultiplier;
  const budgetFactor = Math.min(1, (pedestrian.shoppingBudget || 0) / AI_PEDESTRIAN_CONFIG.shopping.maxBudget) * 
    AI_PEDESTRIAN_CONFIG.shopping.budgetMultiplier;
  
  const totalProbability = shoppingProbability + satisfactionFactor + budgetFactor;

  return Math.random() < Math.min(0.5, totalProbability);
}

/**
 * 开始购物活动
 */
function startShoppingActivity(pedestrian: Pedestrian, grid: Tile[][]): void {
  pedestrian.isShopping = true;
  pedestrian.shoppingActivity = 'browsing';
  pedestrian.shoppingProgress = 0;
  pedestrian.shoppingDuration = 
    Math.random() * (AI_PEDESTRIAN_CONFIG.shopping.maxDuration - AI_PEDESTRIAN_CONFIG.shopping.minDuration) +
    AI_PEDESTRIAN_CONFIG.shopping.minDuration;
  pedestrian.itemsBought = 0;

  // 在网格中找到附近的商店
  const shopCoords = findNearestShop(pedestrian, grid);
  if (shopCoords) {
    pedestrian.currentShopX = shopCoords.x;
    pedestrian.currentShopY = shopCoords.y;
  }
}

/**
 * 完成购物活动
 */
function completeShoppingActivity(pedestrian: Pedestrian): void {
  if (!pedestrian.isShopping) return;

  // 模拟购物消费
  const items = Math.floor(Math.random() * 5) + 1;
  const spending = items * AI_PEDESTRIAN_CONFIG.economy.averageItemPrice;
  const actualSpending = Math.min(spending, pedestrian.shoppingBudget || 0);

  pedestrian.shoppingBudget = (pedestrian.shoppingBudget || 0) - actualSpending;
  pedestrian.itemsBought = items;
  pedestrian.totalMoneySpent = (pedestrian.totalMoneySpent || 0) + actualSpending;
  pedestrian.hasBag = true;

  // 增加满足度
  pedestrian.satisfactionLevel = Math.min(
    1,
    (pedestrian.satisfactionLevel || 0) + AI_PEDESTRIAN_CONFIG.shopping.satisfactionGainPerPurchase
  );

  // 结束购物
  pedestrian.isShopping = false;
  pedestrian.shoppingProgress = 0;
  pedestrian.shoppingActivity = undefined;
  pedestrian.lastShoppingTime = Date.now() / 1000;
  pedestrian.shopVisitsToday = (pedestrian.shopVisitsToday || 0) + 1;
}

/**
 * 寻找最近的商店
 */
function findNearestShop(pedestrian: Pedestrian, grid: Tile[][]): { x: number; y: number } | null {
  const searchRange = AI_PEDESTRIAN_CONFIG.navigation.searchRange;
  const commercialTypes: BuildingType[] = ['shop_small', 'shop_medium', 'mall', 'office_low', 'office_high'];
  
  let nearestShop = null;
  let minDistance = searchRange * searchRange;

  for (let x = Math.max(0, pedestrian.tileX - searchRange); 
       x < Math.min(grid.length, pedestrian.tileX + searchRange); x++) {
    for (let y = Math.max(0, pedestrian.tileY - searchRange); 
         y < Math.min(grid[0].length, pedestrian.tileY + searchRange); y++) {
      const tile = grid[x][y];
      if (tile.building && commercialTypes.includes(tile.building.type)) {
        const distance = Math.pow(x - pedestrian.tileX, 2) + Math.pow(y - pedestrian.tileY, 2);
        if (distance < minDistance) {
          minDistance = distance;
          nearestShop = { x, y };
        }
      }
    }
  }

  return nearestShop;
}

/**
 * 获取购物动画偏移
 */
export function getShoppingAnimationOffset(
  pedestrian: Pedestrian,
  progress: number
): { x: number; y: number } {
  if (!pedestrian.isShopping) {
    return { x: 0, y: 0 };
  }

  const activity = pedestrian.shoppingActivity;

  switch (activity) {
    case 'browsing':
      // 浏览时的摇摆动画
      return {
        x: Math.sin(progress * Math.PI * 4) * AI_PEDESTRIAN_CONFIG.animation.browsingSwayAmount,
        y: Math.cos(progress * Math.PI * 4) * (AI_PEDESTRIAN_CONFIG.animation.browsingSwayAmount * 0.5),
      };
    case 'paying':
      // 付款时的震动动画
      return {
        x: (Math.random() - 0.5) * AI_PEDESTRIAN_CONFIG.animation.payingShakeAmount,
        y: (Math.random() - 0.5) * AI_PEDESTRIAN_CONFIG.animation.payingShakeAmount,
      };
    case 'carrying_bags':
      // 携带购物袋时的波浪动画
      return {
        x: Math.sin(progress * Math.PI * 6) * 2,
        y: Math.cos(progress * Math.PI * 3) * 1,
      };
    default:
      return { x: 0, y: 0 };
  }
}
