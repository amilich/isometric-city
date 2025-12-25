/**
 * Pedestrian Info Panel
 * 
 * 用于查看单个行人的详细信息
 */

'use client';

import React, { useState } from 'react';
import { Pedestrian } from '../types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PedestrianInfoPanelProps {
  pedestrian: Pedestrian | null;
  onClose?: () => void;
}

export function PedestrianInfoPanel({ pedestrian, onClose }: PedestrianInfoPanelProps) {
  if (!pedestrian) {
    return null;
  }

  const isAI = pedestrian.isAI;
  const isShopping = pedestrian.isShopping;

  // 状态中文翻译
  const stateLabels: Record<string, string> = {
    walking: '行走中',
    idle: '空闲',
    entering_building: '进入建筑',
    in_building: '在建筑内',
    exiting_building: '离开建筑',
  };

  // 活动中文翻译
  const activityLabels: Record<string, string> = {
    none: '无',
    sitting: '坐着',
    shopping: '购物',
    working: '工作',
    studying: '学习',
    exercising: '运动',
    socializing: '社交',
  };

  const shoppingActivityLabels: Record<string, string> = {
    browsing: '浏览',
    paying: '付款',
    leaving_shop: '离开商店',
    carrying_bags: '携带购物袋',
  };

  return (
    <Card className="fixed bottom-20 right-4 p-4 shadow-lg bg-card/95 border-border/70 max-w-sm z-50">
      {/* 关闭按钮 */}
      {onClose && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={onClose}
        >
          ✕
        </Button>
      )}

      {/* 标题 */}
      <div className="mb-3 pr-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">行人 #{pedestrian.id}</h3>
          <div className="flex gap-1">
            {isAI && <Badge variant="secondary" className="text-[10px]">AI</Badge>}
            {isShopping && <Badge variant="default" className="text-[10px]">购物中</Badge>}
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="space-y-2 text-xs mb-3 pb-3 border-b border-border/30">
        <div className="flex justify-between">
          <span className="text-muted-foreground">位置</span>
          <span className="font-mono">({pedestrian.tileX}, {pedestrian.tileY})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">年龄</span>
          <span>{pedestrian.age.toFixed(0)} 岁</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">速度</span>
          <span>{(pedestrian.speed * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* 状态信息 */}
      <div className="space-y-2 text-xs mb-3 pb-3 border-b border-border/30">
        <div className="flex justify-between">
          <span className="text-muted-foreground">状态</span>
          <span>{stateLabels[pedestrian.state] || pedestrian.state}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">活动</span>
          <span>{activityLabels[pedestrian.activity] || pedestrian.activity}</span>
        </div>
        {pedestrian.activityProgress > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">进度</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${pedestrian.activityProgress * 100}%` }}
              />
            </div>
            <span className="text-[9px]">{(pedestrian.activityProgress * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* AI 购物信息 */}
      {isAI && (
        <div className="space-y-2 text-xs mb-3 pb-3 border-b border-border/30">
          <div className="font-semibold text-foreground mb-1">AI 购物系统</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">类型</span>
            <span className="capitalize">{pedestrian.aiType || '未知'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">预算</span>
            <span className="font-mono">${(pedestrian.shoppingBudget || 0).toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">满足度</span>
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${Math.max(0, Math.min(100, (pedestrian.satisfactionLevel || 0) * 100))}%` }}
                />
              </div>
              <span className="text-[9px]">{((pedestrian.satisfactionLevel || 0) * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">总消费</span>
            <span className="font-mono">${(pedestrian.totalMoneySpent || 0).toFixed(0)}</span>
          </div>

          {isShopping && (
            <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
              <div className="font-semibold text-foreground">购物中...</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">阶段</span>
                <span>{shoppingActivityLabels[pedestrian.shoppingActivity || ''] || pedestrian.shoppingActivity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">进度</span>
                <span>{((pedestrian.shoppingProgress || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">进度条</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${Math.max(0, Math.min(100, (pedestrian.shoppingProgress || 0) * 100))}%` }}
                  />
                </div>
              </div>
              {pedestrian.currentShopX !== undefined && pedestrian.currentShopY !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">商店位置</span>
                  <span className="font-mono">({pedestrian.currentShopX}, {pedestrian.currentShopY})</span>
                </div>
              )}
              {(pedestrian.itemsBought ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已购物品</span>
                  <span>{pedestrian.itemsBought} 件</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 外观信息 */}
      <div className="space-y-2 text-xs">
        <div className="font-semibold text-foreground mb-1">外观</div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">肤色</span>
          <div
            className="w-6 h-6 rounded border border-border/50"
            style={{ backgroundColor: pedestrian.skinColor }}
            title={pedestrian.skinColor}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">衣服</span>
          <div
            className="w-6 h-6 rounded border border-border/50"
            style={{ backgroundColor: pedestrian.shirtColor }}
            title={pedestrian.shirtColor}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">裤子</span>
          <div
            className="w-6 h-6 rounded border border-border/50"
            style={{ backgroundColor: pedestrian.pantsColor }}
            title={pedestrian.pantsColor}
          />
        </div>
        {pedestrian.hasHat && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">帽子</span>
            <div
              className="w-6 h-6 rounded border border-border/50"
              style={{ backgroundColor: pedestrian.hatColor }}
              title={pedestrian.hatColor}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {pedestrian.hasBag && <Badge variant="outline" className="text-[9px]">🎒 背包</Badge>}
          {pedestrian.hasBall && <Badge variant="outline" className="text-[9px]">⚽ 球</Badge>}
          {pedestrian.hasDog && <Badge variant="outline" className="text-[9px]">🐕 狗</Badge>}
          {pedestrian.hasBeachMat && <Badge variant="outline" className="text-[9px]">🏖️ 沙滩垫</Badge>}
        </div>
      </div>

      {/* 提示 */}
      <div className="mt-3 text-[9px] text-muted-foreground italic">
        点击地图上的行人可查看详情
      </div>
    </Card>
  );
}

export default PedestrianInfoPanel;
