# AI 小人购物系统实现

本次提交为 BNBCITY 添加了 AI 小人自动购物功能。

## 已创建的新文件

### 1. `src/components/game/aiPedestrianConfig.ts` (157 行)
- **目的**: AI 小人购物系统的配置参数和行为定义
- **关键内容**:
  - `AI_PEDESTRIAN_CONFIG`: 主配置对象，包含：
    - 生成参数 (spawnRate, maxAIPedestrians, initialAIPedestrians)
    - 购物行为 (baseProbability, 预算范围, 持续时间, 满足度衰减)
    - 导航配置 (searchRange, pathUpdateInterval)
    - 动画参数 (browsingSwayAmount, payingShakeAmount)
    - 经济模拟参数 (averageItemPrice, maxMoneyPerTrip)
  - `AIPedestrianType` enum: 5 种 AI 小人类型 (WORKER, SHOPPER, TOURIST, COMMUTER, LEISURER)
  - `getShoppingProbabilityByType()`: 根据 AI 类型返回购物倾向

### 2. `src/components/game/aiPedestrianSystem.ts` (188 行)
- **目的**: AI 小人购物行为的核心实现
- **关键函数**:
  - `initializeAIPedestrianShopping()`: 初始化 AI 小人购物状态，分配预算和满足度
  - `updateAIPedestrianShopping()`: 主更新循环，管理购物状态机
  - `shouldGoShopping()`: 概率计算，决定是否去购物
  - `startShoppingActivity()`: 开始购物活动，找到附近的商店
  - `completeShoppingActivity()`: 完成购物，模拟消费和满足度更新
  - `findNearestShop()`: 在网格中定位最近的商业建筑
  - `getShoppingAnimationOffset()`: 提供购物各阶段的动画偏移

### 3. `src/components/game/aiPedestrianIntegration.ts` (270 行)
- **目的**: 将 AI 购物系统集成到游戏中
- **关键函数**:
  - `spawnAIPedestrian()`: 创建新的 AI 小人
  - `updateAIPedestrians()`: 在游戏主循环中更新所有 AI 小人
  - `initializeAIPedestrians()`: 在游戏启动时生成初始 AI 小人
  - `calculateAIPedestrianStats()`: 计算实时统计数据
  - `setAIPedestrianSpawnRate()`: 动态调整生成速率
  - `clearAIPedestrians()`: 清除所有 AI 小人
  - `getAIPedestrianStateLabel()`: 获取中文状态标签

### 4. `src/components/game/panels/AIPedestrianControlPanel.tsx` (150 行)
- **目的**: UI 控制面板，用于管理和监控 AI 小人系统
- **功能**:
  - 启用/禁用 AI 小人
  - 实时显示统计数据 (总数、购物中、行走中、空闲)
  - 平均满足度进度条
  - 调整生成速率滑块
  - 购物概率显示
  - 经济数据监控
  - 重置和暂停/继续按钮

### 5. `src/components/game/AI_PEDESTRIAN_INTEGRATION_GUIDE.md`
- **目的**: 详细的集成指南和配置说明
- **内容**:
  - 快速集成步骤
  - 配置参数解释
  - AI 小人类型说明
  - 性能优化建议
  - 调试和监控方法
  - 常见问题解答

## 已修改的现有文件

### 1. `src/components/game/types.ts`
- 扩展了 `Pedestrian` 类型，添加 AI 购物相关属性：
  - `isAI`: 是否为 AI 控制
  - `aiType`: AI 小人类型
  - `isShopping`, `shoppingProgress`, `shoppingDuration`: 购物状态
  - `shoppingActivity`: 购物阶段 (浏览、付款、携带购物袋)
  - `shoppingBudget`, `itemsBought`, `satisfactionLevel`: 经济数据

### 2. `src/components/game/panels/index.ts`
- 添加 `AIPedestrianControlPanel` 导出

### 3. `src/components/game/index.ts`
- 添加三个 AI 模块的导出：
  - `aiPedestrianConfig`
  - `aiPedestrianSystem`
  - `aiPedestrianIntegration`

## 核心功能

### 购物行为模型
1. **概率决策**: 基于满足度、预算和 AI 类型决定是否购物
2. **目标寻找**: 在 10 格范围内搜索商业建筑
3. **状态机**: 购物分为三个阶段：
   - 浏览 (0-30%): 摇摆动画
   - 付款 (30-70%): 震动动画
   - 离开 (70-100%): 波浪动画，携带购物袋

### 经济模拟
- 每次购物消费 50-250 货币（1-5 件物品 × 50 单位）
- 预算范围 500-2000 货币
- 购物增加满足度 0.3
- 每秒满足度衰减 0.01
- 追踪总消费额

### AI 类型差异
| 类型 | 购物概率 | 用途 |
|------|--------|------|
| WORKER | 15% | 工作者 |
| SHOPPER | 50% | 购物者（最爱购物）|
| TOURIST | 30% | 游客 |
| COMMUTER | 20% | 通勤者 |
| LEISURER | 10% | 休闲者 |

## 编译状态
✅ 所有 TypeScript 编译通过
✅ 开发服务器启动成功
✅ 模块导出正确配置

## 使用方法

### 在游戏中启用
1. 在 GameContext 中添加 `aiEnabled` 状态
2. 在主游戏循环中调用：
   ```typescript
   gameState.pedestrians = updateAIPedestrians(
     gameState.pedestrians,
     gameState.grid,
     deltaTime,
     gameTime
   );
   ```
3. 在 UI 中添加 `AIPedestrianControlPanel` 组件

### 配置调整
在 `aiPedestrianConfig.ts` 中修改配置参数，如：
- `initialAIPedestrians`: 初始数量 (默认 20)
- `maxAIPedestrians`: 最大数量 (默认 100)
- `shopping.baseProbability`: 购物概率 (默认 0.1)

## 下一步改进方向

- [ ] 与游戏经济系统集成（购物收入）
- [ ] 实现路径寻找到商店
- [ ] AI 小人之间的社交互动
- [ ] 商店人气影响房地产价值
- [ ] 时间周期影响 (工作日 vs 周末)
- [ ] 促销和特殊事件

