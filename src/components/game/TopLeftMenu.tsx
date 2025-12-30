'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  SearchIcon,
  SettingsIcon,
  ChartIcon,
  AdvisorIcon,
  LayersIcon,
  CloseIcon,
  PowerIcon,
  WaterIcon,
  FireIcon,
  SafetyIcon,
  HealthIcon,
  EducationIcon,
  SubwayIcon,
  BudgetIcon,
} from '@/components/ui/Icons';
import { OverlayMode } from './types';
import { ActivePanel } from '@/types/game';
import { OVERLAY_CONFIG, getOverlayButtonClass } from './overlays';
import { openCommandMenu } from '@/components/ui/CommandMenu';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface TopLeftMenuProps {
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;
}

const OVERLAY_ICONS: Record<OverlayMode, React.ReactNode> = {
  none: <CloseIcon size={16} />,
  power: <PowerIcon size={16} />,
  water: <WaterIcon size={16} />,
  fire: <FireIcon size={16} />,
  police: <SafetyIcon size={16} />,
  health: <HealthIcon size={16} />,
  education: <EducationIcon size={16} />,
  subway: <SubwayIcon size={16} />,
};

export const TopLeftMenu = React.memo(function TopLeftMenu({
  activePanel,
  setActivePanel,
  overlayMode,
  setOverlayMode,
}: TopLeftMenuProps) {
  const t = useTranslations('Game.Panels');
  const [showOverlays, setShowOverlays] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close overlays menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        setShowOverlays(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="absolute top-4 left-4 z-40 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* Search / Command Menu */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="w-12 h-12 rounded-full shadow-lg border-2 transition-all bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => openCommandMenu()}
              >
                <SearchIcon size={24} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 border-slate-700 text-white">
              <p>{t('Search') || 'Ara'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Overlays Toggle */}
        <div className="relative" ref={overlayRef}>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showOverlays || overlayMode !== 'none' ? "default" : "secondary"}
                  size="icon"
                  className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
                    showOverlays || overlayMode !== 'none'
                      ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500' 
                      : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={() => setShowOverlays(!showOverlays)}
                >
                  <LayersIcon size={24} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-900 border-slate-700 text-white">
                <p>Kaplamalar (Overlays)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Expanded Overlays Menu */}
          {showOverlays && (
             <div className="absolute top-full left-0 mt-3 p-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col gap-1 min-w-[160px] animate-in slide-in-from-top-2 fade-in duration-200">
               <div className="px-2 py-1 mb-1 border-b border-white/10 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Görünüm Modları
                </div>
               {(Object.keys(OVERLAY_CONFIG) as OverlayMode[]).map((mode) => {
                  const config = OVERLAY_CONFIG[mode];
                  const isActive = overlayMode === mode;
                  return (
                    <Button
                      key={mode}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOverlayMode(mode);
                        if (mode === 'none') setShowOverlays(false);
                      }}
                      className={`justify-start gap-3 h-9 px-2 rounded-lg transition-colors ${
                         isActive 
                           ? 'bg-blue-600 text-white hover:bg-blue-500' 
                           : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>{OVERLAY_ICONS[mode]}</span>
                      <span className="text-xs font-medium">{config.title}</span>
                    </Button>
                  );
                })}
             </div>
          )}
        </div>

        {/* Settings */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activePanel === 'settings' ? "default" : "secondary"}
                size="icon"
                className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
                  activePanel === 'settings'
                    ? 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500' 
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => setActivePanel(activePanel === 'settings' ? 'none' : 'settings')}
              >
                <SettingsIcon size={24} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 border-slate-700 text-white">
              <p>{t('Settings')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Budget - Bütçe Butonu Eklendi */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activePanel === 'budget' ? "default" : "secondary"}
                size="icon"
                className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
                  activePanel === 'budget'
                    ? 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500' 
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => setActivePanel(activePanel === 'budget' ? 'none' : 'budget')}
              >
                <BudgetIcon size={24} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 border-slate-700 text-white">
              <p>{t('Budget')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Statistics */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activePanel === 'statistics' ? "default" : "secondary"}
                size="icon"
                className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
                  activePanel === 'statistics'
                    ? 'bg-purple-600 border-purple-400 text-white hover:bg-purple-500' 
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => setActivePanel(activePanel === 'statistics' ? 'none' : 'statistics')}
              >
                <ChartIcon size={24} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 border-slate-700 text-white">
              <p>{t('Statistics')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Advisors */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activePanel === 'advisors' ? "default" : "secondary"}
                size="icon"
                className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
                  activePanel === 'advisors'
                    ? 'bg-amber-600 border-amber-400 text-white hover:bg-amber-500' 
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => setActivePanel(activePanel === 'advisors' ? 'none' : 'advisors')}
              >
                <AdvisorIcon size={24} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 border-slate-700 text-white">
              <p>{t('Advisors')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});

