'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lightbulb, SkipForward, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { T, useGT, useMessages } from 'gt-next';

export interface TipToastProps {
  message: string;
  isVisible: boolean;
  onContinue: () => void;
  onSkipAll: () => void;
}

function TipToastContent({ message, isVisible, onContinue, onSkipAll }: TipToastProps) {
  const gt = useGT();
  const m = useMessages();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Small delay to trigger animation
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      return () => cancelAnimationFrame(frame);
    } else {
      setIsAnimating(false);
      // Wait for exit animation before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'fixed z-[9999] pointer-events-auto',
        'transition-all duration-300 ease-out',
        // Mobile: top position below toolbar, full width with margins
        'top-20 left-3 right-3',
        // Desktop: bottom center position
        'md:top-auto md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2',
        isAnimating 
          ? 'opacity-100 translate-y-0' 
          : cn('opacity-0', 'max-md:-translate-y-4', 'md:translate-y-4')
      )}
      style={{ position: 'fixed' }}
    >
      <div className="relative bg-card border border-sidebar-border rounded-sm shadow-lg overflow-hidden w-full md:w-auto md:max-w-md">
        {/* Top accent border */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        {/* Content */}
        <div className="p-4 flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          
          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {m(message)}
            </p>
          </div>
          
          {/* Close button */}
          <button
            onClick={onContinue}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={gt('Dismiss tip')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Action buttons */}
        <div className="px-4 pb-4 flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipAll}
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <T>
              <SkipForward className="w-3.5 h-3.5" />
              Skip All Tips
            </T>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onContinue}
            className="text-xs gap-1"
          >
            <T>
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </T>
          </Button>
        </div>
        
        {/* Bottom decorative corners */}
        <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-primary/30" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-primary/30" />
      </div>
    </div>
  );
}

export function TipToast(props: TipToastProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use portal to render at document body level to avoid z-index/overflow issues
  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <TipToastContent {...props} />,
    document.body
  );
}
