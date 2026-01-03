'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { X, Bell, AlertTriangle, Info, CheckCircle, Flame, Shield, Heart, Zap, Droplets, MapPin } from 'lucide-react';
import { Notification } from '@/types/game';

interface ToastNotificationProps {
  onNavigate?: (x: number, y: number) => void;
}

export function ToastNotification({ onNavigate }: ToastNotificationProps) {
  const { state, toastNotificationsEnabled } = useGame();
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!toastNotificationsEnabled) return;

    // Check latest notification
    if (state.notifications.length > 0) {
      const latestNotification = state.notifications[0];
      
      // Only show if it's a new notification we haven't shown yet
      if (latestNotification.id !== lastNotificationIdRef.current) {
        lastNotificationIdRef.current = latestNotification.id;
        setActiveToast(latestNotification);
        setIsVisible(true);

        // Hide after 6 seconds (slightly longer to allow interaction)
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 6000);

        return () => clearTimeout(timer);
      }
    }
  }, [state.notifications, toastNotificationsEnabled]);

  if (!activeToast || !isVisible) return null;

  const handleNavigate = () => {
    if (activeToast.coordinates && onNavigate) {
      onNavigate(activeToast.coordinates.x, activeToast.coordinates.y);
      // Optional: Close toast after navigation or keep it open
      // setIsVisible(false); 
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'fire': return <Flame className="w-5 h-5 text-orange-500" />;
      case 'police': return <Shield className="w-5 h-5 text-blue-500" />;
      case 'health': return <Heart className="w-5 h-5 text-red-500" />;
      case 'power': return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'water': return <Droplets className="w-5 h-5 text-cyan-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      default: return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const hasCoordinates = !!activeToast.coordinates;

  return (
    <div className="fixed top-4 right-4 z-[100] max-w-sm w-full animate-in slide-in-from-right-full fade-in duration-300 pointer-events-auto">
      <div 
        className={`bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl p-4 flex items-start gap-3 relative overflow-hidden group transition-all ${hasCoordinates ? 'hover:border-blue-500/50 cursor-pointer' : ''}`}
        onClick={hasCoordinates ? handleNavigate : undefined}
      >
        {/* Progress bar line */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500/50 animate-[width_6s_linear_forwards] w-full" />
        
        <div className="mt-0.5 shrink-0 p-2 bg-slate-800 rounded-full border border-slate-700">
           {getIcon(activeToast.icon)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-white text-sm leading-tight">{activeToast.title}</h4>
            {hasCoordinates && (
              <span className="flex items-center text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                <MapPin size={10} className="mr-1" />
                Git
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{activeToast.description}</p>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            {new Date(activeToast.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          className="shrink-0 text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
