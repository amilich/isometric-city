'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MobileBarProps {
  position: 'top' | 'bottom';
  className?: string;
  children: React.ReactNode;
}

export function MobileBar({ position, className, children }: MobileBarProps) {
  const baseClass =
    position === 'top'
      ? 'fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 bg-card/95 backdrop-blur-sm safe-area-top'
      : 'fixed bottom-0 left-0 right-0 z-50 rounded-none border-x-0 border-b-0 bg-card/95 backdrop-blur-sm safe-area-bottom';

  return <Card className={cn(baseClass, className)}>{children}</Card>;
}

export default MobileBar;
