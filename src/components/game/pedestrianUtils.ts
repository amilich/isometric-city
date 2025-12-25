/**
 * Pedestrian Utilities
 * 
 * 用于查询和分析行人信息的工具函数
 */

import { Pedestrian } from './types';

/**
 * 在指定位置查找行人
 */
export function getPedestrianAtTile(
  pedestrians: Pedestrian[],
  tileX: number,
  tileY: number,
  tolerance: number = 0.3
): Pedestrian | null {
  return pedestrians.find(p => 
    Math.abs(p.tileX - tileX) < tolerance && 
    Math.abs(p.tileY - tileY) < tolerance
  ) || null;
}

/**
 * 获取附近的所有行人
 */
export function getPedestriansNearby(
  pedestrians: Pedestrian[],
  tileX: number,
  tileY: number,
  radius: number = 5
): Pedestrian[] {
  return pedestrians.filter(p => {
    const distance = Math.hypot(p.tileX - tileX, p.tileY - tileY);
    return distance <= radius;
  }).sort((a, b) => {
    const distA = Math.hypot(a.tileX - tileX, a.tileY - tileY);
    const distB = Math.hypot(b.tileX - tileX, b.tileY - tileY);
    return distA - distB;
  });
}

/**
 * 获取行人的简洁信息摘要
 */
export function getPedestrianSummary(pedestrian: Pedestrian): string {
  const parts: string[] = [];
  
  // 基本信息
  parts.push(`行人 #${pedestrian.id}`);
  
  // AI 标记
  if (pedestrian.isAI) {
    parts.push(`[AI-${pedestrian.aiType}]`);
  }
  
  // 状态
  if (pedestrian.isShopping) {
    const progress = ((pedestrian.shoppingProgress || 0) * 100).toFixed(0);
    parts.push(`购物中 (${progress}%)`);
  } else {
    parts.push(pedestrian.state);
  }
  
  // 活动
  if (pedestrian.activity !== 'none') {
    parts.push(`- ${pedestrian.activity}`);
  }
  
  return parts.join(' ');
}

/**
 * 获取行人的详细统计
 */
export function getPedestrianStats(pedestrians: Pedestrian[]): {
  total: number;
  aiCount: number;
  byState: Record<string, number>;
  byActivity: Record<string, number>;
  byShopping: number;
  averageAge: number;
  averageSatisfaction: number;
} {
  const stats = {
    total: pedestrians.length,
    aiCount: 0,
    byState: {} as Record<string, number>,
    byActivity: {} as Record<string, number>,
    byShopping: 0,
    averageAge: 0,
    averageSatisfaction: 0,
  };

  if (pedestrians.length === 0) {
    return stats;
  }

  let totalAge = 0;
  let totalSatisfaction = 0;

  pedestrians.forEach(p => {
    // AI 计数
    if (p.isAI) stats.aiCount++;

    // 状态统计
    stats.byState[p.state] = (stats.byState[p.state] || 0) + 1;

    // 活动统计
    stats.byActivity[p.activity] = (stats.byActivity[p.activity] || 0) + 1;

    // 购物计数
    if (p.isShopping) stats.byShopping++;

    // 年龄求和
    totalAge += p.age;

    // 满足度求和
    if (p.isAI) {
      totalSatisfaction += p.satisfactionLevel || 0;
    }
  });

  stats.averageAge = totalAge / pedestrians.length;
  stats.averageSatisfaction = stats.aiCount > 0 ? totalSatisfaction / stats.aiCount : 0;

  return stats;
}

/**
 * 搜索符合条件的行人
 */
export function filterPedestrians(
  pedestrians: Pedestrian[],
  filters: {
    isAI?: boolean;
    isShopping?: boolean;
    state?: string;
    activity?: string;
    aiType?: string;
  }
): Pedestrian[] {
  return pedestrians.filter(p => {
    if (filters.isAI !== undefined && p.isAI !== filters.isAI) return false;
    if (filters.isShopping !== undefined && p.isShopping !== filters.isShopping) return false;
    if (filters.state !== undefined && p.state !== filters.state) return false;
    if (filters.activity !== undefined && p.activity !== filters.activity) return false;
    if (filters.aiType !== undefined && p.aiType !== filters.aiType) return false;
    return true;
  });
}

/**
 * 获取特定类型的行人计数
 */
export function countPedestriansByType(pedestrians: Pedestrian[]): Record<string, number> {
  const counts: Record<string, number> = {
    human: 0,
    ai_worker: 0,
    ai_shopper: 0,
    ai_tourist: 0,
    ai_commuter: 0,
    ai_leisurer: 0,
  };

  pedestrians.forEach(p => {
    if (p.isAI && p.aiType) {
      const key = `ai_${p.aiType.toLowerCase()}`;
      counts[key] = (counts[key] || 0) + 1;
    } else {
      counts.human++;
    }
  });

  return counts;
}

/**
 * 获取购物中的行人列表及其进度
 */
export function getShoppingPedestrians(pedestrians: Pedestrian[]): Array<{
  pedestrian: Pedestrian;
  progress: number;
  activity: string;
}> {
  return pedestrians
    .filter(p => p.isShopping)
    .map(p => ({
      pedestrian: p,
      progress: p.shoppingProgress || 0,
      activity: p.shoppingActivity || 'unknown',
    }))
    .sort((a, b) => a.progress - b.progress);
}

/**
 * 计算小人的行为多样性分数 (0-1)
 */
export function getPedestrianDiversityScore(pedestrians: Pedestrian[]): number {
  if (pedestrians.length < 2) return 1;

  const stats = getPedestrianStats(pedestrians);
  
  // 基于状态分布的多样性
  const stateCount = Object.keys(stats.byState).length;
  const activityCount = Object.keys(stats.byActivity).length;
  const aiRatio = stats.aiCount / pedestrians.length;

  // 综合评分 (0-1)
  const score = (
    (stateCount / 6) * 0.3 +  // 最多6种状态
    (activityCount / 7) * 0.3 +  // 最多7种活动
    (aiRatio > 0.3 && aiRatio < 0.7 ? 1 : 0.5) * 0.4  // AI 比例在 30-70% 最优
  );

  return Math.min(1, Math.max(0, score));
}
