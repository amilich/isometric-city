/**
 * AI Pedestrian System - 使用指南
 * 
 * 这个文档说明如何在游戏中集成AI小人购物系统
 */

/**
 * 快速集成指南
 * 
 * 1. 在 src/context/GameContext.tsx 中添加AI状态管理
 */

// 在GameState或GameContextType中添加以下属性：
interface GameState {
  // ... 现有属性
  
  // AI小人系统
  aiEnabled: boolean;                    // AI系统是否启用
  aiPedestrianStats: {
    totalCount: number;
    shoppingCount: number;
    walkingCount: number;
    idleCount: number;
    averageSatisfaction: number;
    totalMoneySpent: number;
  };
  aiSpawnRate: number;                   // 当前生成速率
}

/**
 * 2. 在游戏更新循环中集成（通常在 src/lib/simulation.ts）
 */

import {
  updateAIPedestrians,
  initializeAIPedestrians,
  calculateAIPedestrianStats,
  spawnAIPedestrian,
} from '@/components/game/aiPedestrianIntegration';

// 在游戏初始化中：
export function initializeGame(gameState: GameState) {
  // ... 现有初始化代码
  
  if (gameState.aiEnabled) {
    initializeAIPedestrians(gameState);
  }
}

// 在主游戏更新循环中（每一帧）：
export function updateGame(gameState: GameState, deltaTime: number) {
  // ... 现有更新代码
  
  if (gameState.aiEnabled) {
    // 更新AI小人
    gameState.pedestrians = updateAIPedestrians(
      gameState.pedestrians,
      gameState,
      gameState.grid,
      deltaTime,
      Date.now() / 1000 // 游戏时间（秒）
    );
    
    // 定期生成新AI小人
    if (Math.random() < AI_PEDESTRIAN_CONFIG.spawn.spawnRate) {
      const randomX = Math.floor(Math.random() * gameState.grid.length);
      const randomY = Math.floor(Math.random() * gameState.grid[0].length);
      const newPed = spawnAIPedestrian(gameState, randomX, randomY);
      if (newPed) {
        gameState.pedestrians.push(newPed);
      }
    }
    
    // 更新统计数据
    gameState.aiPedestrianStats = calculateAIPedestrianStats(gameState.pedestrians);
  }
}

/**
 * 3. 在UI中添加控制面板
 */

import { AIPedestrianControlPanel } from '@/components/game/panels/AIPedestrianControlPanel';

// 在游戏组件中使用：
export function GameComponent() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiStats, setAiStats] = useState(/* ... */);
  const [aiSpawnRate, setAiSpawnRate] = useState(0.02);
  
  return (
    <>
      {/* ... 其他组件 */}
      
      <AIPedestrianControlPanel
        enabled={aiEnabled}
        onToggle={setAiEnabled}
        stats={aiStats}
        spawnRate={aiSpawnRate}
        onSpawnRateChange={setAiSpawnRate}
      />
    </>
  );
}

/**
 * 4. 配置说明
 * 
 * 在 src/components/game/aiPedestrianConfig.ts 中调整以下参数：
 */

// 生成配置
AI_PEDESTRIAN_CONFIG.spawn = {
  spawnRate: 0.02,              // 降低值生成更少AI小人
  maxAIPedestrians: 100,        // 最大AI小人数量
  initialAIPedestrians: 20,     // 启动时生成的初始数量
  minDistanceFromExisting: 8,   // 避免互相重叠的最小距离
}

// 购物配置
AI_PEDESTRIAN_CONFIG.shopping = {
  baseProbability: 0.1,         // 每秒0.1的概率决定是否去购物
  satisfactionMultiplier: 0.3,  // 满足度低时更容易购物
  budgetMultiplier: 0.2,        // 有预算时更容易购物
  
  minBudget: 500,               // 小人的最小购物预算
  maxBudget: 2000,              // 小人的最大购物预算
  
  minDuration: 10,              // 最短购物时间（秒）
  maxDuration: 30,              // 最长购物时间（秒）
  
  satisfactionGainPerPurchase: 0.3,    // 购物时满足度增加0.3
  satisfactionDecayRate: 0.01,         // 每秒满足度衰减0.01
}

/**
 * 5. AI小人类型说明
 * 
 * 系统包含5种AI小人类型，各有不同的购物倾向：
 */

// WORKER (工作者) - 购物概率 15%
// 特点：工作日购物，预算中等
// 适用场景：模拟上班族

// SHOPPER (购物者) - 购物概率 50% ⭐ 最爱购物
// 特点：经常购物，预算较高
// 适用场景：商业区人气

// TOURIST (游客) - 购物概率 30%
// 特点：中等购物，探索城市
// 适用场景：景点和娱乐区

// COMMUTER (通勤者) - 购物概率 20%
// 特点：上班途中偶尔购物
// 适用场景：交通枢纽

// LEISURER (休闲者) - 购物概率 10%
// 特点：偶尔购物，更多休闲活动
// 适用场景：公园和休闲区

/**
 * 6. 事件和钩子
 * 
 * 以下事件可以用于游戏逻辑扩展：
 */

// 当AI小人完成购物时
// 可以触发：
// - 商业区人气增加
// - 商业建筑收入增加
// - 城市满足度变化
// - 经济数据更新

/**
 * 7. 性能考虑
 */

// 调整maxAIPedestrians以平衡游戏性能
// - 20-30: 轻量级（移动设备）
// - 50-70: 中等（桌面设备）
// - 100+: 高端（性能高的设备）

// 定期检查AI小人数量，清除长期不活动的小人以节省性能

/**
 * 8. 调试和监控
 */

// 在控制面板中查看实时统计：
// - 总数：当前AI小人总数
// - 购物中：正在购物的AI小人数
// - 行走中：在移动的AI小人数
// - 空闲：站立或闲逛的AI小人数
// - 平均满足度：所有AI小人的平均满足度(0-1)
// - 总消费额：所有AI小人的总消费金额

/**
 * 9. 扩展建议
 */

// 可以添加的功能：
// 1. AI小人的购物习惯偏好（某些类型倾向特定商店）
// 2. 社交互动（小人之间的对话和聚集）
// 3. 特殊事件（节日购物增加、促销等）
// 4. 可视化指标（购物热力图、客流分析）
// 5. 经济影响模型（购物影响房地产价值）
// 6. 时间周期（工作日vs周末购物变化）

/**
 * 常见问题
 */

// Q: AI小人为什么没有出现？
// A: 检查以下几点：
//    1. aiEnabled 是否为 true
//    2. 游戏中是否有足够的商业建筑作为购物目标
//    3. 生成位置是否有足够的道路
//    4. initialAIPedestrians 值是否大于0

// Q: AI小人购物时会影响游戏经济吗？
// A: 目前框架支持追踪消费，但经济影响需要在GameContext中实现

// Q: 如何调整购物频率？
// A: 修改 baseProbability（0.1 = 10%概率/秒）

// Q: 不同AI类型如何在游戏中体现？
// A: 通过购物频率、停留时间和预算分配来区分，可以进一步扩展到服装/肤色颜色
