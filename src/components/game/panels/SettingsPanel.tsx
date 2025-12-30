'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame, DayNightMode } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { SpriteTestPanel } from './SpriteTestPanel';
import { SavedCityMeta } from '@/types/game';
import { Download, Upload } from 'lucide-react';

// Format a date for display
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format population for display
function formatPopulation(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}K`;
  return pop.toString();
}

// Format money for display
function formatMoney(money: number): string {
  if (money >= 1000000) return `₺${(money / 1000000).toFixed(1)}M`;
  if (money >= 1000) return `₺${(money / 1000).toFixed(1)}K`;
  return `₺${money}`;
}

export function SettingsPanel() {
  const t = useTranslations('Game.Panels');
  const { state, setActivePanel, setDisastersEnabled, newGame, loadState, exportState, currentSpritePack, availableSpritePacks, setSpritePack, dayNightMode, setDayNightMode, zoomSensitivity, setZoomSensitivity, getSavedCityInfo, restoreSavedCity, clearSavedCity, savedCities, saveCity, loadSavedCity, deleteSavedCity, renameSavedCity } = useGame();
  const { disastersEnabled, cityName, gridSize, id: currentCityId } = state;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [newCityName, setNewCityName] = useState(cityName);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [saveCitySuccess, setSaveCitySuccess] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<SavedCityMeta | null>(null);
  const [cityToRename, setCityToRename] = useState<SavedCityMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [savedCityInfo, setSavedCityInfo] = useState(getSavedCityInfo());
  
  // Refresh saved city info when panel opens
  React.useEffect(() => {
    setSavedCityInfo(getSavedCityInfo());
  }, [getSavedCityInfo]);
  
  // Initialize showSpriteTest from query parameter
  const spriteTestFromUrl = searchParams?.get('spriteTest') === 'true';
  const [showSpriteTest, setShowSpriteTest] = useState(spriteTestFromUrl);
  const lastUrlValueRef = useRef(spriteTestFromUrl);
  const isUpdatingFromStateRef = useRef(false);
  
  // Sync state with query parameter when URL changes externally
  useEffect(() => {
    const spriteTestParam = searchParams?.get('spriteTest') === 'true';
    // Only update if URL value actually changed and we're not updating from state
    if (spriteTestParam !== lastUrlValueRef.current && !isUpdatingFromStateRef.current) {
      lastUrlValueRef.current = spriteTestParam;
      setTimeout(() => setShowSpriteTest(spriteTestParam), 0);
    }
  }, [searchParams]);
  
  // Sync query parameter when showSpriteTest changes (but avoid loops)
  useEffect(() => {
    const currentParam = searchParams?.get('spriteTest') === 'true';
    if (currentParam === showSpriteTest) return; // Already in sync
    
    isUpdatingFromStateRef.current = true;
    lastUrlValueRef.current = showSpriteTest;
    
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (showSpriteTest) {
      params.set('spriteTest', 'true');
    } else {
      params.delete('spriteTest');
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
    
    // Reset flag after URL update
    setTimeout(() => {
      isUpdatingFromStateRef.current = false;
    }, 0);
  }, [showSpriteTest, searchParams, router]);
  
  const handleDownload = () => {
    const exportedString = exportState();
    let exportedData;
    try {
      exportedData = JSON.parse(exportedString);
    } catch (e) {
      console.error("Failed to parse export state", e);
      return;
    }

    const metadata = {
      author: "Trunçgil My City User",
      downloadedAt: new Date().toISOString(),
      gameVersion: "1.0",
      source: "Trunçgil My City"
    };

    const finalData = {
      ...exportedData,
      metadata
    };

    const content = "/*Trunçgil My City Structure File*/\n" + JSON.stringify(finalData, null, 2);
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = (state.cityName || 'city').replace(/[^a-z0-9]/gi, '_').toLowerCase(); 
    a.download = `${fileName}.tmc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const header = "/*Trunçgil My City Structure File*/";
      if (!content.startsWith(header)) {
        setImportError(true);
        setTimeout(() => setImportError(false), 3000);
        return;
      }

      const jsonString = content.substring(header.length).trim();
      
      try {
        const data = JSON.parse(jsonString);
        const success = loadState(JSON.stringify(data));
        if (success) {
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 2000);
          setActivePanel('none');
        } else {
          setImportError(true);
          setTimeout(() => setImportError(false), 3000);
        }
      } catch (err) {
        console.error(err);
        setImportError(true);
        setTimeout(() => setImportError(false), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[800px] w-full max-h-[85vh] overflow-y-auto flex flex-col p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl">{t('Settings')}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="game" className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="game">{t('GameSettings')}</TabsTrigger>
            <TabsTrigger value="appearance">Görünüm</TabsTrigger>
            <TabsTrigger value="city">{t('CityInfo')}</TabsTrigger>
            <TabsTrigger value="dev">{t('DevTools')}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-2">
            
            {/* Game Settings Tab */}
            <TabsContent value="game" className="mt-0 space-y-6">
              <div className="flex items-center justify-between py-2 gap-4 border-b border-border/50 pb-4">
                <div className="flex-1 min-w-0">
                  <Label className="text-base">{t('Disasters')}</Label>
                  <p className="text-muted-foreground text-sm">{t('DisastersDesc')}</p>
                </div>
                <Switch
                  checked={disastersEnabled}
                  onCheckedChange={setDisastersEnabled}
                />
              </div>

              <div className="flex items-center justify-between py-2 gap-4 border-b border-border/50 pb-4">
                <div className="flex-1 min-w-0">
                  <Label className="text-base">Dil / Language</Label>
                  <p className="text-muted-foreground text-sm">Arayüz dilini değiştir / Change interface language</p>
                </div>
                <LanguageSelector variant="game" />
              </div>

              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base">{t('ZoomSensitivity')}</Label>
                  <span className="text-sm text-muted-foreground">{zoomSensitivity}</span>
                </div>
                <Slider
                  value={[zoomSensitivity]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(vals) => setZoomSensitivity(vals[0])}
                  className="py-4"
                />
                <p className="text-muted-foreground text-sm">{t('ZoomSensitivityDesc')}</p>
              </div>
            </TabsContent>
            
            {/* Appearance Tab */}
            <TabsContent value="appearance" className="mt-0 space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">{t('SpritePack')}</Label>
                  <p className="text-muted-foreground text-sm mb-3">{t('SpritePackDesc')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableSpritePacks.map((pack) => (
                      <button
                        key={pack.id}
                        onClick={() => setSpritePack(pack.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          currentSpritePack.id === pack.id
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                            : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative shadow-sm">
                          <Image 
                            src={pack.src} 
                            alt={pack.name}
                            fill
                            className="object-cover object-top"
                            style={{ imageRendering: 'pixelated' }}
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{pack.name}</div>
                          <div className="text-xs text-muted-foreground truncate opacity-70">{pack.src.split('/').pop()}</div>
                        </div>
                        {currentSpritePack.id === pack.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Label className="text-base">{t('DayNightMode')}</Label>
                  <p className="text-muted-foreground text-sm mb-3">{t('DayNightModeDesc')}</p>
                  <div className="flex rounded-lg border border-border overflow-hidden bg-muted/20 p-1">
                    {(['auto', 'day', 'night'] as DayNightMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setDayNightMode(mode)}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                          dayNightMode === mode
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {mode === 'auto' && t('ModeAuto')}
                        {mode === 'day' && t('ModeDay')}
                        {mode === 'night' && t('ModeNight')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* City & Save Tab */}
            <TabsContent value="city" className="mt-0 space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">{t('CityName')}</span>
                  <div className="text-lg font-semibold">{cityName}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase">{t('GridSize')}</span>
                  <div className="text-lg font-semibold">{gridSize} x {gridSize}</div>
                </div>
                <div className="space-y-1 col-span-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase">{t('AutoSave')}</span>
                    <span className="text-sm font-medium text-emerald-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                      {t('AutoSaveEnabled')}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <div>
                     <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{t('SavedCities')}</div>
                     <p className="text-xs text-muted-foreground">{t('SavedCitiesDesc')}</p>
                   </div>
                   <Button
                      variant="game"
                      size="sm"
                      onClick={() => {
                        saveCity();
                        setSaveCitySuccess(true);
                        setTimeout(() => setSaveCitySuccess(false), 2000);
                      }}
                    >
                      {saveCitySuccess ? '✓' : t('SaveCity')}
                    </Button>
                </div>
                
                {savedCities.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2">
                    {savedCities.map((city) => (
                      <div
                        key={city.id}
                        className={`p-3 rounded-lg border transition-all ${
                          city.id === currentCityId
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                        }`}
                      >
                         {cityToRename?.id === city.id ? (
                            <div className="space-y-2">
                              <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                placeholder={t('NewCityNamePlaceholder')}
                                className="h-8 text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="game-secondary"
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => {
                                    setCityToRename(null);
                                    setRenameValue('');
                                  }}
                                >
                                  {t('Cancel')}
                                </Button>
                                <Button
                                  variant="game"
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => {
                                    if (renameValue.trim()) {
                                      renameSavedCity(city.id, renameValue.trim());
                                    }
                                    setCityToRename(null);
                                    setRenameValue('');
                                  }}
                                >
                                  {t('SaveCity')}
                                </Button>
                              </div>
                            </div>
                          ) : cityToDelete?.id === city.id ? (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground text-center">{t('DeleteCityConfirm')}</p>
                              <div className="flex gap-2">
                                <Button
                                  variant="game-secondary"
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => setCityToDelete(null)}
                                >
                                  {t('Cancel')}
                                </Button>
                                <Button
                                  variant="game-danger"
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => {
                                    deleteSavedCity(city.id);
                                    setCityToDelete(null);
                                  }}
                                >
                                  {t('Delete')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between mb-1">
                                <div className="font-medium text-sm truncate flex-1">
                                  {city.cityName}
                                  {city.id === currentCityId && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{t('Current')}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                                <span className="flex items-center gap-1">👥 {formatPopulation(city.population)}</span>
                                <span className="flex items-center gap-1">💰 {formatMoney(city.money)}</span>
                                <span className="flex items-center gap-1">📐 {city.gridSize}×{city.gridSize}</span>
                              </div>
                              <div className="flex gap-2">
                                {city.id !== currentCityId && (
                                  <Button
                                    variant="game"
                                    size="sm"
                                    className="flex-1 h-7 text-xs"
                                    onClick={() => {
                                      loadSavedCity(city.id);
                                      setActivePanel('none');
                                    }}
                                  >
                                    {t('Load')}
                                  </Button>
                                )}
                                <Button
                                  variant="game-secondary"
                                  size="sm"
                                  className="flex-1 h-7 text-xs"
                                  onClick={() => {
                                    setCityToRename(city);
                                    setRenameValue(city.cityName);
                                  }}
                                >
                                  {t('Rename')}
                                </Button>
                                <Button
                                  variant="game-secondary"
                                  size="sm"
                                  className="flex-1 h-7 text-xs hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => setCityToDelete(city)}
                                >
                                  {t('Delete')}
                                </Button>
                              </div>
                            </>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs text-center py-8 border border-dashed rounded-lg bg-muted/20">
                    {t('NoSavedCities')}
                  </p>
                )}
              </div>

               {savedCityInfo && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <h4 className="text-sm font-medium text-orange-500 mb-2">Önceki Kayıt</h4>
                  <Button
                    variant="game"
                    className="w-full"
                    onClick={() => {
                      restoreSavedCity();
                      setSavedCityInfo(null);
                      setActivePanel('none');
                    }}
                  >
                    {t('Restore')} {savedCityInfo.cityName}
                  </Button>
                  <p className="text-muted-foreground text-xs text-center mt-2">
                    {t('RestoreDesc')}
                  </p>
                </div>
              )}
              
              {!showNewGameConfirm ? (
                <Button
                  variant="game-danger"
                  className="w-full py-6 text-base"
                  onClick={() => setShowNewGameConfirm(true)}
                >
                  {t('NewGame')}
                </Button>
              ) : (
                <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg space-y-3">
                  <p className="text-destructive font-medium text-sm text-center">{t('NewGameConfirm')}</p>
                  <Input
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    placeholder={t('NewCityNamePlaceholder')}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="game-secondary"
                      className="flex-1"
                      onClick={() => setShowNewGameConfirm(false)}
                    >
                      {t('Cancel')}
                    </Button>
                    <Button
                      variant="game-danger"
                      className="flex-1"
                      onClick={() => {
                        newGame(newCityName || 'Yeni Şehir', gridSize);
                        setActivePanel('none');
                      }}
                    >
                      {t('Reset')}
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{t('ExportGame')}</div>
                    <Button
                      variant="game-secondary"
                      className="w-full h-auto py-2 text-xs flex items-center justify-center gap-2"
                      onClick={handleDownload}
                    >
                      <Download size={14} />
                      İndir (.tmc)
                    </Button>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{t('ImportGame')}</div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".tmc"
                        className="hidden"
                    />
                    <div className="relative">
                        <Button
                          variant="game-secondary"
                          className="w-full h-auto py-2 text-xs flex items-center justify-center gap-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={14} />
                          Yükle (.tmc)
                        </Button>
                    </div>
                     {importError && (
                      <p className="text-red-400 text-[10px] mt-1">Hata! Geçersiz dosya.</p>
                    )}
                    {importSuccess && (
                      <p className="text-green-400 text-[10px] mt-1">Başarılı!</p>
                    )}
                  </div>
              </div>

            </TabsContent>

            {/* Dev Tools Tab */}
            <TabsContent value="dev" className="mt-0 space-y-4">
               <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={() => setShowSpriteTest(true)}
                >
                  {t('OpenSpriteTest')}
                </Button>
                {/* Example Loaders */}
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState } = await import('@/resources/example_state.json');
                    loadState(JSON.stringify(exampleState));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')}
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState2 } = await import('@/resources/example_state_2.json');
                    loadState(JSON.stringify(exampleState2));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 2
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState3 } = await import('@/resources/example_state_3.json');
                    loadState(JSON.stringify(exampleState3));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 3
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState4 } = await import('@/resources/example_state_4.json');
                    loadState(JSON.stringify(exampleState4));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 4
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState5 } = await import('@/resources/example_state_5.json');
                    loadState(JSON.stringify(exampleState5));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 5
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState6 } = await import('@/resources/example_state_6.json');
                    loadState(JSON.stringify(exampleState6));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 6
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState7 } = await import('@/resources/example_state_7.json');
                    loadState(JSON.stringify(exampleState7));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 7
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState8 } = await import('@/resources/example_state_8.json');
                    loadState(JSON.stringify(exampleState8));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 8
                </Button>
                <Button
                  variant="game-secondary"
                  className="w-full"
                  onClick={async () => {
                    const { default: exampleState9 } = await import('@/resources/example_state_9.json');
                    loadState(JSON.stringify(exampleState9));
                    setActivePanel('none');
                  }}
                >
                  {t('LoadExample')} 9
                </Button>
               </div>
            </TabsContent>

          </div>
        </Tabs>
      </DialogContent>
      
      {showSpriteTest && (
        <SpriteTestPanel onClose={() => {
          setShowSpriteTest(false);
          // Query param will be cleared by useEffect above
        }} />
      )}
    </Dialog>
  );
}
