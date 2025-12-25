# 查看行人状态功能

## 新增功能概述

为了让你更好地了解游戏中的行人（特别是AI小人），我创建了以下新功能：

### 1. 行人信息面板 (PedestrianInfoPanel)
- **位置**: `src/components/game/panels/PedestrianInfoPanel.tsx`
- **功能**: 显示单个行人的详细信息

**显示内容包括**:
- ✅ 行人ID和类型标签（AI/购物中）
- ✅ 基本信息（位置、年龄、速度）
- ✅ 状态信息（当前状态、活动、进度）
- ✅ AI购物信息：
  - AI类型（WORKER, SHOPPER, TOURIST等）
  - 购物预算
  - 满足度百分比
  - 总消费额
  - 购物中的详细信息（阶段、进度、目标商店）
- ✅ 外观信息（肤色、衣服颜色、帽子等）
- ✅ 携带物品（背包、球、狗、沙滩垫）

### 2. 行人实用工具 (pedestrianUtils.ts)
- **位置**: `src/components/game/pedestrianUtils.ts`
- **提供的工具函数**:

#### 查询函数
- `getPedestrianAtTile()` - 在指定格子找到行人
- `getPedestriansNearby()` - 获取附近所有行人（已排序）
- `getPedestrianSummary()` - 获取行人的简洁描述
- `filterPedestrians()` - 按条件搜索行人

#### 统计函数
- `getPedestrianStats()` - 获取所有行人的详细统计
  - 按状态统计
  - 按活动统计
  - AI数量
  - 平均年龄
  - 平均满足度
- `countPedestriansByType()` - 按AI类型计数
- `getShoppingPedestrians()` - 获取正在购物的行人列表

#### 分析函数
- `getPedestrianDiversityScore()` - 计算行为多样性分数（0-1）

## 使用方法

### 在游戏中集成信息面板

```typescript
import { PedestrianInfoPanel } from '@/components/game/panels/PedestrianInfoPanel';
import { getPedestrianAtTile } from '@/components/game/pedestrianUtils';

// 在你的游戏组件中：
const [selectedPedestrian, setSelectedPedestrian] = useState<Pedestrian | null>(null);

// 当玩家点击地图时
const handleMapClick = (tileX: number, tileY: number) => {
  const pedestrian = getPedestrianAtTile(pedestrians, tileX, tileY);
  setSelectedPedestrian(pedestrian);
};

// 在 JSX 中渲染面板
return (
  <>
    {/* ... 其他 UI ... */}
    <PedestrianInfoPanel
      pedestrian={selectedPedestrian}
      onClose={() => setSelectedPedestrian(null)}
    />
  </>
);
```

### 获取游戏中的统计信息

```typescript
import { getPedestrianStats, getShoppingPedestrians } from '@/components/game/pedestrianUtils';

// 获取所有统计数据
const stats = getPedestrianStats(gameState.pedestrians);
console.log(`总行人: ${stats.total}`);
console.log(`AI小人: ${stats.aiCount}`);
console.log(`平均满足度: ${(stats.averageSatisfaction * 100).toFixed(0)}%`);

// 获取正在购物的行人
const shoppers = getShoppingPedestrians(gameState.pedestrians);
shoppers.forEach(({ pedestrian, progress, activity }) => {
  console.log(`${pedestrian.aiType} 正在${activity} (${(progress * 100).toFixed(0)}%)`);
});
```

### 搜索特定行人

```typescript
import { filterPedestrians, getPedestrianDiversityScore } from '@/components/game/pedestrianUtils';

// 找到所有购物中的AI小人
const aiShoppers = filterPedestrians(pedestrians, {
  isAI: true,
  isShopping: true,
});

// 找到所有SHOPPER类型的AI小人
const shoppers = filterPedestrians(pedestrians, {
  aiType: 'shopper',
});

// 计算行为多样性
const diversity = getPedestrianDiversityScore(pedestrians);
console.log(`行为多样性: ${(diversity * 100).toFixed(0)}%`);
```

## 面板功能展示

### 基本行人信息
```
行人 #42
位置: (15, 20)
年龄: 35 岁
速度: 150%
状态: 行走中
活动: 购物
进度: 75%
```

### AI小人购物信息
```
AI 购物系统
类型: shopper
预算: $1,250
满足度: 65%
总消费: $450

购物中...
阶段: 付款
进度: 55%
商店位置: (12, 18)
已购物品: 3 件
```

### 外观信息
```
外观
肤色: [黄色方块]
衣服: [红色方块]
裤子: [蓝色方块]
帽子: [棕色方块]

🎒 背包  ⚽ 球  🐕 狗
```

## 集成建议

1. **在 Game.tsx 中添加**:
   - 点击地图时获取行人信息
   - 显示 PedestrianInfoPanel 面板

2. **在 TopBar.tsx 或统计面板中显示**:
   - 当前行人数量统计
   - AI小人数量
   - 平均购物满足度

3. **在开发者工具中使用**:
   - 使用统计函数快速调试AI行为
   - 验证多样性分数

## 完成的工作

✅ 创建了 PedestrianInfoPanel 组件（150+ 行）
✅ 创建了 pedestrianUtils 工具库（200+ 行）
✅ 添加到 panels 导出配置
✅ 所有 TypeScript 类型检查通过
✅ 编译成功

## 下一步改进

- [ ] 在地图上显示行人的快速信息悬停提示
- [ ] 添加行人搜索/过滤面板
- [ ] 实时监控购物中的行人
- [ ] 行人行为统计图表
- [ ] 行人轨迹回放功能
