'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { GameProvider } from '@/context/GameContext';
import Game from '@/components/Game';
import { useMobile } from '@/hooks/useMobile';
import { getSpritePack, getSpriteCoords, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
import { SavedCityMeta } from '@/types/game';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
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

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';

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

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

// Sprite Gallery component that renders sprites using canvas (like SpriteTestPanel)
function SpriteGallery({ count = 16, cols = 4, cellSize = 120 }: { count?: number; cols?: number; cellSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filteredSheet, setFilteredSheet] = useState<HTMLCanvasElement | null>(null);
  const spritePack = useMemo(() => getSpritePack(DEFAULT_SPRITE_PACK_ID), []);
  
  // Get random sprite keys from the sprite order, pre-validated to have valid coords
  const randomSpriteKeys = useMemo(() => {
    // Filter to only sprites that have valid building type mappings
    const validSpriteKeys = spritePack.spriteOrder.filter(spriteKey => {
      // Check if this sprite key has a building type mapping
      const hasBuildingMapping = Object.values(spritePack.buildingToSprite).includes(spriteKey);
      return hasBuildingMapping;
    });
    const shuffled = shuffleArray([...validSpriteKeys]);
    return shuffled.slice(0, count);
  }, [spritePack.spriteOrder, spritePack.buildingToSprite, count]);
  
  // Load and filter sprite sheet
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      const filtered = filterBackgroundColor(img);
      setFilteredSheet(filtered);
    };
    img.src = spritePack.src;
  }, [spritePack.src]);
  
  // Pre-compute sprite data with valid coords
  const spriteData = useMemo(() => {
    if (!filteredSheet) return [];
    
    const sheetWidth = filteredSheet.width;
    const sheetHeight = filteredSheet.height;
    
    return randomSpriteKeys.map(spriteKey => {
      const buildingType = Object.entries(spritePack.buildingToSprite).find(
        ([, value]) => value === spriteKey
      )?.[0] || spriteKey;
      
      const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, spritePack);
      return coords ? { spriteKey, coords } : null;
    }).filter((item): item is { spriteKey: string; coords: { sx: number; sy: number; sw: number; sh: number } } => item !== null);
  }, [filteredSheet, randomSpriteKeys, spritePack]);
  
  // Draw sprites to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filteredSheet || spriteData.length === 0) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rows = Math.ceil(spriteData.length / cols);
    const padding = 10;
    
    const canvasWidth = cols * cellSize;
    const canvasHeight = rows * cellSize;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    
    // Clear canvas (transparent)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw each sprite
    spriteData.forEach(({ coords }, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cellX = col * cellSize;
      const cellY = row * cellSize;
      
      // Draw cell background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cellX + 2, cellY + 2, cellSize - 4, cellSize - 4, 4);
      ctx.fill();
      ctx.stroke();
      
      // Calculate destination size preserving aspect ratio
      const maxSize = cellSize - padding * 2;
      const aspectRatio = coords.sh / coords.sw;
      let destWidth = maxSize;
      let destHeight = destWidth * aspectRatio;
      
      if (destHeight > maxSize) {
        destHeight = maxSize;
        destWidth = destHeight / aspectRatio;
      }
      
      // Center sprite in cell
      const drawX = cellX + (cellSize - destWidth) / 2;
      const drawY = cellY + (cellSize - destHeight) / 2 + destHeight * 0.1; // Slight offset down
      
      // Draw sprite
      ctx.drawImage(
        filteredSheet,
        coords.sx, coords.sy, coords.sw, coords.sh,
        Math.round(drawX), Math.round(drawY),
        Math.round(destWidth), Math.round(destHeight)
      );
    });
  }, [filteredSheet, spriteData, cols, cellSize]);
  
  return (
    <canvas
      ref={canvasRef}
      className="opacity-80 hover:opacity-100 transition-opacity"
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

// Menu Button Component
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
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
        ${variant === 'primary' 
          ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50' 
          : active 
            ? 'bg-white/15 text-white' 
            : 'bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'
        }
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

// Daily Mission Item
function MissionItem({ 
  completed, 
  text 
}: { 
  completed: boolean; 
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {completed ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-white/30 flex-shrink-0" />
      )}
      <span className={`text-sm ${completed ? 'text-emerald-400 line-through' : 'text-white/80'}`}>
        {text}
      </span>
    </div>
  );
}

// News Card Component
function NewsCard({ 
  title, 
  image,
  badge 
}: { 
  title: string; 
  image?: string;
  badge?: number;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 aspect-[16/10]">
      {image && (
        <Image 
          src={image} 
          alt={title}
          fill
          className="object-cover opacity-80"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h4 className="text-white font-bold text-sm">{title}</h4>
      </div>
      {badge && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">{badge}</span>
        </div>
      )}
    </div>
  );
}

// User Profile Component
function UserProfile({ cityName, level }: { cityName: string; level: number }) {
  const t = useTranslations('HomePage');
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg">
        <Trophy className="w-6 h-6 text-white" />
      </div>
      <div>
        <h2 className="text-white font-bold text-lg">{cityName}</h2>
        <p className="text-white/60 text-sm">{t('level')} {level}</p>
      </div>
    </div>
  );
}

const SAVED_CITY_PREFIX = 'isocity-city-';

export default function HomePage() {
  const t = useTranslations('HomePage');
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;

  // Check for saved game after mount (client-side only)
  useEffect(() => {
    const checkSavedGame = () => {
      setIsChecking(false);
      setSavedCities(loadSavedCities());
      if (hasSavedGame()) {
        setShowGame(true);
      }
    };
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(checkSavedGame);
  }, []);

  // Handle exit from game - refresh saved cities list
  const handleExitGame = () => {
    setShowGame(false);
    setSavedCities(loadSavedCities());
  };

  // Load a saved city
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

  // Load example city
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
      <GameProvider>
        <main className="h-screen w-screen overflow-hidden">
          <Game onExit={handleExitGame} />
        </main>
      </GameProvider>
    );
  }

  // Get first saved city info for profile
  const firstCity = savedCities[0];
  const cityName = firstCity?.cityName || 'MyCity';
  const cityLevel = Math.floor((firstCity?.population || 0) / 1000) + 1;

  // Mobile landing page
  if (isMobile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 flex flex-col p-4 safe-area-top safe-area-bottom overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <UserProfile cityName={cityName} level={cityLevel} />
          <LanguageSelector variant="game" />
        </div>

        {/* City Preview */}
        <div className="flex-1 flex items-center justify-center py-4">
          <div className="relative">
            {/* Glow effect */}
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
        
        {/* Main Buttons */}
        <div className="space-y-3 mb-4">
          <MenuButton 
            icon={Play} 
            label={t('play')} 
            onClick={() => setShowGame(true)}
            variant="primary"
          />
          <MenuButton 
            icon={Sparkles} 
            label={t('exampleCity')} 
            onClick={loadExampleCity}
          />
        </div>
        
        {/* Saved Cities */}
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
      </main>
    );
  }

  // Desktop landing page - Game-style layout
  return (
    <main className="min-h-screen bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 flex overflow-hidden">
      {/* Left Sidebar - Menu */}
      <aside className="w-64 bg-slate-900/90 backdrop-blur-xl p-6 flex flex-col border-r border-white/10">
        {/* User Profile */}
        <UserProfile cityName={cityName} level={cityLevel} />
        
        {/* Language Selector */}
        <div className="mb-6">
          <LanguageSelector variant="game" />
        </div>
        
        {/* Menu Items */}
        <nav className="space-y-2 flex-1">
          <MenuButton 
            icon={Play} 
            label={t('play')} 
            onClick={() => setShowGame(true)}
            variant="primary"
          />
          <MenuButton 
            icon={Hammer} 
            label={t('build')} 
            onClick={() => setShowGame(true)}
          />
          <MenuButton 
            icon={Target} 
            label={t('quests')} 
          />
          <MenuButton 
            icon={ShoppingBag} 
            label={t('shop')} 
          />
          <MenuButton 
            icon={Settings} 
            label={t('settings')} 
          />
        </nav>
        
        {/* Saved Cities at bottom */}
        {savedCities.length > 0 && (
          <div className="mt-auto pt-4 border-t border-white/10">
            <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
              {t('savedCities')}
            </h2>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
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
      </aside>

      {/* Center - City View */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Decorative Elements */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center select-none pointer-events-none" style={{minWidth:180}}>
          <span
            className="font-extrabold"
            style={{
              color: '#FFB92C', // Gear/yellow color in logo
              fontSize: '1rem',
              letterSpacing: '0.13em',
              textTransform: 'lowercase',
              lineHeight: 1,
              textShadow: '0 1px 8px #f3c86088'
            }}
          >
            truncgil
          </span>
          <span
            className="font-black uppercase"
            style={{
              fontSize: '2.3rem',
              color: '#37D66D', // Main green bg
              letterSpacing: '0.055em',
              marginTop: '0.2em',
              lineHeight: 1,
              textShadow:
                '0 3px 18px #25A04A55, 0 1px 0px #fff, 0 0 8px #fff5'
            }}
          >
            MyCity
          </span>
        </div>
       
        
        {/* City Island */}
        <div className="relative z-10">
          <Image
            src="/truncgil-mycity-icon.png"
            alt="City Preview"
            width={1024}
            height={1024}
            className="object-contain drop-shadow-2xl animate-float"
            priority
          />
        </div>
        
        {/* Floating clouds */}
        <div className="absolute top-20 left-20 w-32 h-16 bg-white/40 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-32 right-32 w-40 h-20 bg-white/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-32 w-24 h-12 bg-white/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Right Sidebar - Info Panels */}
      <aside className="w-80 bg-slate-900/90 backdrop-blur-xl p-6 flex flex-col gap-6 border-l border-white/10">
        {/* Daily Missions */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-sky-400" />
              {t('dailyMissions')}
            </h3>
            <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
              1
            </span>
          </div>
          <div className="space-y-1">
            <MissionItem completed={false} text={t('collectMoney', { amount: '5000' })} />
            <MissionItem completed={true} text={t('collectMoney', { amount: '500' })} />
            <MissionItem completed={false} text={t('buildPark')} />
            <MissionItem completed={false} text={t('upgradeCityHall')} />
          </div>
        </div>

        {/* News & Events */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              {t('newsEvents')}
            </h3>
            <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
              1
            </span>
          </div>
          <NewsCard 
            title={t('summerFestival')}
            image="/games/IMG_6902.PNG"
            badge={1}
          />
        </div>

        {/* Chat Preview */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex-1">
          <h3 className="text-white font-bold flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
            {t('chat')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
              <div className="bg-white/10 rounded-xl rounded-tl-none p-2 text-xs text-white/80">
                Harika bir şehir!
              </div>
            </div>
          </div>
        </div>

        {/* Sprite Gallery Preview */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <SpriteGallery count={8} cols={4} cellSize={60} />
        </div>
      </aside>
    </main>
  );
}
