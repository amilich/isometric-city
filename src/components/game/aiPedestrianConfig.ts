/**
 * AI Pedestrian Configuration
 * 
 * 配置AI小人的行为参数
 */

/**
 * AI小人配置
 */
export const AI_PEDESTRIAN_CONFIG = {
  // 生成配置
  spawnRate: 0.02,           // 每帧生成AI小人的概率
  maxAIPedestrians: 100,     // 最多AI小人数量
  initialAIPedestrians: 20,  // 初始AI小人数量

  // 购物行为配置
  shopping: {
    // 购物概率
    baseProbability: 0.1,              // 基础购物概率
    satisfactionMultiplier: 0.3,       // 满足度对概率的影响
    budgetMultiplier: 0.2,             // 预算对概率的影响
    timeMultiplier: 0.1,               // 时间因素

    // 购物持续时间
    minDuration: 10,                   // 最短购物时间(秒)
    maxDuration: 30,                   // 最长购物时间(秒)

    // 购物预算范围
    minBudget: 500,                    // 最小购物预算
    maxBudget: 2000,                   // 最大购物预算

    // 购物频率
    maxVisitsPerDay: 3,                // 每天最多购物次数
    timeBetweenShops: 100,             // 两次购物的最小间隔(游戏秒)

    // 满足度
    satisfactionGainPerPurchase: 0.3,  // 每次购物增加的满足度
    satisfactionDecayRate: 0.01,       // 满足度每秒衰减率
  },

  // 导航配置
  navigation: {
    searchRange: 10,                   // 寻找商店的搜索范围
    pathUpdateInterval: 5,             // 路径更新间隔(秒)
  },

  // 动画配置
  animation: {
    browsingSwayAmount: 5,             // 浏览时摇摆量
    payingShakeAmount: 2,              // 付款时震动量
    carryingBagsWaveAmount: 3,         // 携带购物袋时波动量
  },

  // AI小人外观配置
  appearance: {
    // AI小人标记（用于区分）
    useSpecialColors: true,            // 是否使用特殊颜色标记AI小人
    aiMarkerColor: '#FFD700',          // AI小人标记颜色(金色)
    aiMarkerOpacity: 0.3,              // 标记不透明度
  },

  // 购物袋配置
  shoppingBag: {
    probability: 0.8,                  // 购物时携带袋子的概率
    maxItemsDisplay: 5,                // 显示的最多物品数量
  },

  // 消费经济模拟
  economy: {
    averageItemPrice: 50,              // 平均物品价格
    shopsRequiredForFullSatisfaction: 3, // 达到完全满足的购物次数
    maxMoneyPerTrip: 1000,             // 每次购物最多花费
  },

  // 社交交互
  social: {
    meetingChanceAtShop: 0.1,          // 在商店遇见其他小人的概率
    conversationDuration: 5,           // 对话持续时间(秒)
  },
};

/**
 * 获取AI小人的状态标签
 */
export function getAIPedestrianStatusLabel(isShopping: boolean, activity: string): string {
  if (isShopping) {
    switch (activity) {
      case 'browsing':
        return '浏览中';
      case 'paying':
        return '付款中';
      case 'carrying_bags':
        return '离开商店';
      default:
        return '购物中';
    }
  }
  return '漫步中';
}

/**
 * AI小人行为描述
 */
export const AI_PEDESTRIAN_BEHAVIORS = {
  idle: {
    name: '空闲',
    description: '站立或坐着',
    frequency: 0.3,
  },
  walking: {
    name: '行走',
    description: '在街道上行走',
    frequency: 0.4,
  },
  shopping: {
    name: '购物',
    description: '在商店购物',
    frequency: 0.2,
  },
  socializing: {
    name: '社交',
    description: '与其他小人互动',
    frequency: 0.1,
  },
};

/**
 * AI小人类别
 */
export enum AIPedestrianType {
  WORKER = 'worker',           // 工人，经常去办公室
  SHOPPER = 'shopper',         // 购物者，频繁购物
  TOURIST = 'tourist',         // 游客，去景点和公园
  COMMUTER = 'commuter',       // 通勤者，在家和办公室之间往返
  LEISURER = 'leisurer',       // 休闲者，在公园和娱乐设施
}

/**
 * 获取AI类型的购物倾向
 */
export function getShoppingProbabilityByType(type: AIPedestrianType): number {
  switch (type) {
    case AIPedestrianType.SHOPPER:
      return 0.5;    // 购物者高购物概率
    case AIPedestrianType.WORKER:
      return 0.15;   // 工人中等购物概率
    case AIPedestrianType.COMMUTER:
      return 0.2;    // 通勤者中低购物概率
    case AIPedestrianType.TOURIST:
      return 0.3;    // 游客中等购物概率
    case AIPedestrianType.LEISURER:
      return 0.1;    // 休闲者低购物概率
    default:
      return 0.15;
  }
}
