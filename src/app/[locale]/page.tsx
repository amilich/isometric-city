'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { GameProvider, useGame } from '@/context/GameContext';
import Game from '@/components/Game';
import { useMobile } from '@/hooks/useMobile';
import { getSpritePack, getSpriteCoords, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
import { SavedCityMeta } from '@/types/game';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { SettingsPanel } from '@/components/game/panels';
import { 
  Play, 
  Hammer, 
  Target, 
  ShoppingBag, 
  Settings, 
  CheckCircle2, 
  Circle,
  MessageCircle,
  Sparkles,
  Trophy
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  PLANE_DIRECTION_COLS, 
  PLANE_TYPE_ROWS, 
  PLANE_SCALES, 
  AIRPLANE_SPRITE_SRC 
} from '@/components/game/constants';

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';
const SAVED_CITY_PREFIX = 'isocity-city-';

// Background color to filter from sprite sheets (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// Filter red background from sprite sheet
function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );
    
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Sky Animation Component
function SkyAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const planesRef = useRef<any[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const spriteRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Load sprite
    const img = new window.Image();
    img.src = AIRPLANE_SPRITE_SRC;
    img.onload = () => {
      spriteRef.current = img;
    };
    
    // Initial planes
    const createPlane = () => {
      if (typeof window === 'undefined') return null;
      
      const isRight = Math.random() > 0.5;
      const startY = 50 + Math.random() * 200;
      const types = Object.keys(PLANE_TYPE_ROWS);
      const type = types[Math.floor(Math.random() * types.length)];
      
      const baseAngle = isRight ? Math.PI : 0; 
      const angle = baseAngle + (Math.random() * 0.5 - 0.25);

      return {
        x: isRight ? window.innerWidth + 100 : -100,
        y: startY,
        angle: angle,
        speed: 80 + Math.random() * 40,
        type: type,
        altitude: 0.8 + Math.random() * 0.4,
        scale: (PLANE_SCALES[type] || 0.2) * 3 
      };
    };

    planesRef.current = [createPlane(), createPlane()].filter(Boolean);

    const animate = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (time - lastSpawnTimeRef.current > 4000) { 
        if (planesRef.current.length < 5) {
          const plane = createPlane();
          if (plane) planesRef.current.push(plane);
        }
        lastSpawnTimeRef.current = time;
      }

      planesRef.current.forEach((plane, index) => {
        plane.x += Math.cos(plane.angle) * plane.speed * 0.016;
        plane.y += Math.sin(plane.angle) * plane.speed * 0.016;

        if (plane.x < -200 || plane.x > canvas.width + 200 || plane.y < -200 || plane.y > canvas.height + 200) {
          planesRef.current.splice(index, 1);
          return;
        }

        if (spriteRef.current) {
          let degrees = plane.angle * (180 / Math.PI);
          while (degrees < 0) degrees += 360;
          while (degrees >= 360) degrees -= 360;

          let dirKey = 'e';
          if (degrees >= 337.5 || degrees < 22.5) dirKey = 'e';
          else if (degrees >= 22.5 && degrees < 67.5) dirKey = 'se';
          else if (degrees >= 67.5 && degrees < 112.5) dirKey = 's';
          else if (degrees >= 112.5 && degrees < 157.5) dirKey = 'sw';
          else if (degrees >= 157.5 && degrees < 202.5) dirKey = 'w';
          else if (degrees >= 202.5 && degrees < 247.5) dirKey = 'nw';
          else if (degrees >= 247.5 && degrees < 292.5) dirKey = 'n';
          else if (degrees >= 292.5 && degrees < 337.5) dirKey = 'ne';

          const dirInfo = PLANE_DIRECTION_COLS[dirKey];
          const row = PLANE_TYPE_ROWS[plane.type] || 0;
          const col = dirInfo.col;
          
          const spriteW = spriteRef.current.width / 5; 
          const spriteH = spriteRef.current.height / 6; 
          
          const sx = col * spriteW;
          const sy = row * spriteH;

          ctx.save();
          ctx.translate(plane.x, plane.y);
          
          let rotationOffset = plane.angle - dirInfo.baseAngle;
          while (rotationOffset > Math.PI) rotationOffset -= Math.PI * 2;
          while (rotationOffset < -Math.PI) rotationOffset += Math.PI * 2;
          
          ctx.rotate(rotationOffset);
          
          const scaleX = dirInfo.mirrorX ? -plane.scale : plane.scale;
          const scaleY = dirInfo.mirrorY ? -plane.scale : plane.scale;
          
          ctx.scale(scaleX, scaleY);
          
          ctx.drawImage(
            spriteRef.current,
            sx, sy, spriteW, spriteH,
            -spriteW/2, -spriteH/2, spriteW, spriteH
          );
          
          ctx.restore();
        }
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-10"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Saved City Card Component
function SavedCityCard({ city, onLoad }: { city: SavedCityMeta; onLoad: () => void }) {
  const t = useTranslations('HomePage');
  return (
    <button
      onClick={onLoad}
      className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 group"
    >
      <h3 className="text-white font-medium truncate group-hover:text-white/90 text-sm">
        {city.cityName}
      </h3>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
        <span>{t('population')}: {city.population.toLocaleString()}</span>
        <span>₺{city.money.toLocaleString()}</span>
      </div>
    </button>
  );
}

// Menu Button Component - Updated for Bottom Bar
function MenuButton({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'default',
  active = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  onClick?: () => void;
  variant?: 'default' | 'primary';
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`
            flex items-center justify-center w-14 h-14 rounded-full transition-all duration-200
            shadow-lg border-2
            ${variant === 'primary' 
              ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500 hover:scale-110' 
              : active 
                ? 'bg-blue-600 border-blue-400 text-white' 
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:scale-110'
            }
          `}
        >
          <Icon size={24} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={10} className="bg-slate-900 border-slate-700 text-white">
        <span className="font-bold">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

// User Profile Component
function UserProfile({ cityName, level }: { cityName: string; level: number }) {
  const t = useTranslations('HomePage');
  return (
    <div className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-md p-2 pr-4 rounded-full border border-white/10">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg">
        <Trophy className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-white font-bold text-sm leading-tight">{cityName}</h2>
        <p className="text-white/60 text-[10px] uppercase tracking-wider">{t('level')} {level}</p>
      </div>
    </div>
  );
}

// Check if there's a saved game in localStorage
function hasSavedGame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.grid && parsed.gridSize && parsed.stats;
    }
  } catch {
    return false;
  }
  return false;
}

// Load saved cities index from localStorage
function loadSavedCities(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as SavedCityMeta[];
      }
    }
  } catch {
    return [];
  }
  return [];
}

// Inner Content Component to use GameContext
function HomePageContent() {
  const t = useTranslations('HomePage');
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  const [hasCurrentGame, setHasCurrentGame] = useState(false);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const { state, setActivePanel } = useGame(); // Use GameContext
  const isMobile = isMobileDevice || isSmallScreen;

  useEffect(() => {
    const checkSavedGame = () => {
      setIsChecking(false);
      setSavedCities(loadSavedCities());
      setHasCurrentGame(hasSavedGame());
    };
    requestAnimationFrame(checkSavedGame);
  }, []);

  const startNewGame = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowGame(true);
  };

  const continueGame = () => {
    if (hasSavedGame()) {
      setShowGame(true);
    }
  };

  const handleExitGame = () => {
    setShowGame(false);
    setSavedCities(loadSavedCities());
  };

  const loadSavedCity = (cityId: string) => {
    try {
      const saved = localStorage.getItem(SAVED_CITY_PREFIX + cityId);
      if (saved) {
        localStorage.setItem(STORAGE_KEY, saved);
        setShowGame(true);
      }
    } catch {
      console.error('Failed to load saved city');
    }
  };

  const loadExampleCity = async () => {
    const { default: exampleState } = await import('@/resources/example_state_8.json');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exampleState));
    setShowGame(true);
  };

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 flex items-center justify-center">
        <div className="text-white/90 text-lg font-medium">{t('loading')}</div>
      </main>
    );
  }

  if (showGame) {
    return (
      <main className="h-screen w-screen overflow-hidden">
        <Game onExit={handleExitGame} />
      </main>
    );
  }

  const firstCity = savedCities[0];
  const cityName = firstCity?.cityName || 'MyCity';
  const cityLevel = Math.floor((firstCity?.population || 0) / 1000) + 1;

  if (isMobile) {
    return (
       <main className="min-h-screen bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 flex flex-col p-4 safe-area-top safe-area-bottom overflow-y-auto">
        {/* Mobile Header */}
        <div className="flex justify-between items-start mb-4">
          <UserProfile cityName={cityName} level={cityLevel} />
          <LanguageSelector variant="game" />
        </div>

        {/* Mobile City Preview */}
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-radial from-white/30 to-transparent blur-3xl scale-150" />
            <Image
              src="/truncgil-mycity-icon.png"
              alt="Truncgil MyCity"
              width={200}
              height={200}
              className="object-contain relative z-10 drop-shadow-2xl animate-float"
              priority
            />
          </div>
        </div>
        
        {/* Mobile Main Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {hasCurrentGame && (
            <button onClick={continueGame} className="flex flex-col items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/20">
              <Play className="w-6 h-6 text-white" />
              <span className="text-xs text-white font-medium">{t('continue')}</span>
            </button>
          )}
          <button onClick={startNewGame} className="flex flex-col items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/20">
            <Sparkles className="w-6 h-6 text-white" />
            <span className="text-xs text-white font-medium">{t('newGame')}</span>
          </button>
           <button onClick={() => setActivePanel('settings')} className="flex flex-col items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/20">
            <Settings className="w-6 h-6 text-white" />
            <span className="text-xs text-white font-medium">{t('settings')}</span>
          </button>
        </div>

        {/* Saved Cities Mobile */}
        {savedCities.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
              {t('savedCities')}
            </h2>
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
              {savedCities.slice(0, 3).map((city) => (
                <SavedCityCard
                  key={city.id}
                  city={city}
                  onLoad={() => loadSavedCity(city.id)}
                />
              ))}
            </div>
          </div>
        )}

        {state.activePanel === 'settings' && <SettingsPanel />}
      </main>
    );
  }

  // Desktop Layout
  return (
    <main className="min-h-screen bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 flex overflow-hidden relative">
      
      {/* Top Left: Profile */}
      <div className="absolute top-6 left-6 z-20">
        <UserProfile cityName={cityName} level={cityLevel} />
      </div>

      {/* Top Right: Language */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSelector variant="game" />
      </div>

      {/* Saved Cities Panel (Floating on Left) */}
      {savedCities.length > 0 && (
        <div className="absolute top-24 left-6 z-20 w-64 bg-slate-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              {t('savedCities')}
            </h2>
            <div className="flex flex-col gap-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {savedCities.slice(0, 4).map((city) => (
                <SavedCityCard
                  key={city.id}
                  city={city}
                  onLoad={() => loadSavedCity(city.id)}
                />
              ))}
            </div>
        </div>
      )}

      {/* Center - City View */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {/* Animated Sky Background */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes float-cloud {
              0% { transform: translateX(-200px); opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateX(120vw); opacity: 0; }
            }
            .cloud-anim {
              animation: float-cloud linear infinite;
            }
          `}} />
          
          <div className="cloud-anim absolute top-20 left-0 w-48 h-24 bg-white/20 rounded-full blur-2xl" style={{ animationDuration: '45s', animationDelay: '0s' }} />
          <div className="cloud-anim absolute top-40 -left-20 w-64 h-32 bg-white/15 rounded-full blur-3xl" style={{ animationDuration: '60s', animationDelay: '-20s' }} />
          <div className="cloud-anim absolute top-10 left-1/2 w-32 h-16 bg-white/25 rounded-full blur-xl" style={{ animationDuration: '50s', animationDelay: '-10s' }} />
          
          <SkyAnimation />
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-1 select-none pointer-events-none">
          <Image
            src="/truncgil-mycity3.png"
            alt="Truncgil MyCity Logo"
            width={512}
            height={100}
            className="object-contain drop-shadow-lg"
            priority
          />
        </div>
       
        {/* City Island */}
        <div className="relative z-10 -mt-20">
          <Image
            src="/truncgil-mycity-icon.png"
            alt="City Preview"
            width={900}
            height={900}
            className="object-contain drop-shadow-2xl animate-float"
            priority
          />
        </div>
      </div>

      {/* Bottom Dock Menu */}
      <TooltipProvider delayDuration={0}>
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 bg-slate-900/30 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
          {hasCurrentGame ? (
              <MenuButton 
                icon={Play} 
                label={t('continue')} 
                onClick={continueGame}
                variant="primary"
              />
            ) : null}
            <MenuButton 
              icon={Sparkles} 
              label={t('newGame')} 
              onClick={startNewGame}
              variant={hasCurrentGame ? undefined : "primary"}
            />
            <MenuButton 
              icon={Trophy} 
              label={t('exampleCity')} 
              onClick={loadExampleCity}
            />
            <MenuButton 
              icon={ShoppingBag} 
              label={t('shop')} 
            />
            <MenuButton 
              icon={Settings} 
              label={t('settings')} 
              onClick={() => setActivePanel('settings')}
            />
        </div>
      </TooltipProvider>
      
      {state.activePanel === 'settings' && <SettingsPanel />}

    </main>
  );
}

export default function HomePage() {
  return (
    <GameProvider>
      <HomePageContent />
    </GameProvider>
  );
}
