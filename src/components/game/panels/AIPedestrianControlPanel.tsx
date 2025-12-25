/**
 * AI Pedestrian Control Panel
 * 
 * 用户界面面板，用于管理和观察AI小人
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AI_PEDESTRIAN_CONFIG, getAIPedestrianStatusLabel } from '../aiPedestrianConfig';

interface AIPedestrianStats {
  totalCount: number;
  shoppingCount: number;
  walkingCount: number;
  idleCount: number;
  averageSatisfaction: number;
  totalMoneySpent: number;
}

interface AIPedestrianControlPanelProps {
  stats?: AIPedestrianStats;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onConfigChange?: (config: Partial<typeof AI_PEDESTRIAN_CONFIG>) => void;
  spawnRate?: number;
  onSpawnRateChange?: (rate: number) => void;
}

export function AIPedestrianControlPanel({
  stats = {
    totalCount: 0,
    shoppingCount: 0,
    walkingCount: 0,
    idleCount: 0,
    averageSatisfaction: 0.5,
    totalMoneySpent: 0,
  },
  enabled = false,
  onToggle = () => {},
  onConfigChange = () => {},
  spawnRate = 0.02,
  onSpawnRateChange = () => {},
}: AIPedestrianControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="absolute bottom-6 left-4 p-3 shadow-lg bg-card/95 border-border/70 max-w-xs">
      {/* 头部 - 收起/展开 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          AI 小人系统
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </Button>
      </div>

      {/* 启用/禁用开关 */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30">
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label="启用 AI 小人"
        />
        <span className="text-xs text-foreground">
          {enabled ? '已启用' : '已禁用'}
        </span>
      </div>

      {/* 统计信息 */}
      <div className="space-y-1.5 mb-3 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">总数</span>
          <span className="font-mono font-semibold text-foreground">{stats.totalCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">购物中</span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {stats.shoppingCount}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">行走中</span>
          <span className="font-mono text-foreground">{stats.walkingCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">空闲</span>
          <span className="font-mono text-foreground">{stats.idleCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">平均满足度</span>
          <div className="flex items-center gap-1">
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, stats.averageSatisfaction * 100))}%` }}
              />
            </div>
            <span className="text-[9px] font-mono">{(stats.averageSatisfaction * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* 详细设置 - 展开时显示 */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-border/30">
          {/* 生成速率控制 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground">生成速率</label>
            <div className="flex items-center gap-2">
              <Slider
                value={[spawnRate * 100]}
                onValueChange={([value]) => onSpawnRateChange(value / 100)}
                min={0}
                max={10}
                step={0.1}
                className="flex-1"
              />
              <span className="text-[9px] font-mono min-w-8">{(spawnRate * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* 购物概率 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground">购物概率</label>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="flex justify-between px-1 py-0.5 bg-muted rounded">
                <span className="text-muted-foreground">基础</span>
                <span className="font-mono">{(AI_PEDESTRIAN_CONFIG.shopping.baseProbability * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between px-1 py-0.5 bg-muted rounded">
                <span className="text-muted-foreground">满足低时</span>
                <span className="font-mono">+{(AI_PEDESTRIAN_CONFIG.shopping.satisfactionMultiplier * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* 经济统计 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground">经济数据</label>
            <div className="px-2 py-1 bg-muted/50 rounded text-[9px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">总消费额</span>
                <span className="font-mono text-green-400">${stats.totalMoneySpent.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="space-y-1 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={() => {
                // 清空所有AI小人
                onConfigChange({ maxAIPedestrians: 0 });
                setTimeout(() => {
                  onConfigChange({ maxAIPedestrians: AI_PEDESTRIAN_CONFIG.maxAIPedestrians });
                }, 100);
              }}
            >
              重置小人
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs h-7"
              onClick={() => onToggle(!enabled)}
            >
              {enabled ? '暂停' : '继续'}
            </Button>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {!enabled && (
        <div className="mt-2 text-[9px] text-muted-foreground italic">
          启用以观察AI小人自动购物和活动
        </div>
      )}
    </Card>
  );
}

export default AIPedestrianControlPanel;
