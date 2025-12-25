'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame, DayNightMode } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SpriteTestPanel } from './SpriteTestPanel';
import { SavedCityMeta } from '@/types/game';

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
  if (money >= 1000000) return `$${(money / 1000000).toFixed(1)}M`;
  if (money >= 1000) return `$${(money / 1000).toFixed(1)}K`;
  return `$${money}`;
}

export function SettingsPanel() {
  const { state, setActivePanel, setDisastersEnabled, newGame, loadState, exportState, currentSpritePack, availableSpritePacks, setSpritePack, dayNightMode, setDayNightMode, getSavedCityInfo, restoreSavedCity, clearSavedCity, savedCities, saveCity, loadSavedCity, deleteSavedCity, renameSavedCity } = useGame();
  const { disastersEnabled, cityName, gridSize, id: currentCityId } = state;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [newCityName, setNewCityName] = useState(cityName);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [saveCitySuccess, setSaveCitySuccess] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<SavedCityMeta | null>(null);
  const [cityToRename, setCityToRename] = useState<SavedCityMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importValue, setImportValue] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
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
  
  const handleCopyExport = async () => {
    const exported = exportState();
    await navigator.clipboard.writeText(exported);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };
  
  const handleImport = () => {
    setImportError(false);
    setImportSuccess(false);
    if (importValue.trim()) {
      const success = loadState(importValue.trim());
      if (success) {
        setImportSuccess(true);
        setImportValue('');
        setTimeout(() => setImportSuccess(false), 2000);
      } else {
        setImportError(true);
      }
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[400px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ayarlar</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Oyun Ayarları</div>
            
            <div className="flex items-center justify-between py-2 gap-4">
              <div className="flex-1 min-w-0">
                <Label>Afetler</Label>
                <p className="text-muted-foreground text-xs">Rastgele yangınları ve afetleri etkinleştir</p>
              </div>
              <Switch
                checked={disastersEnabled}
                onCheckedChange={setDisastersEnabled}
              />
            </div>
            
            <div className="py-2">
              <Label>Görünüm Paketi</Label>
              <p className="text-muted-foreground text-xs mb-2">Bina çizim stilini seç</p>
              <div className="grid grid-cols-1 gap-2">
                {availableSpritePacks.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSpritePack(pack.id)}
                    className={`flex items-center gap-3 p-2 rounded-md border transition-colors text-left ${
                      currentSpritePack.id === pack.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0 relative">
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
                      <div className="text-xs text-muted-foreground truncate">{pack.src}</div>
                    </div>
                    {currentSpritePack.id === pack.id && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Şehir Bilgileri</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Şehir Adı</span>
                <span className="text-foreground">{cityName}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Izgara Boyutu</span>
                <span className="text-foreground">{gridSize} x {gridSize}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Otomatik Kayıt</span>
                <span className="text-green-400">Etkin</span>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Saved Cities Section */}
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Kayıtlı Şehirler</div>
            <p className="text-muted-foreground text-xs mb-3">Birden fazla şehri kaydet ve aralarında geçiş yap</p>
            
            {/* Save Current City Button */}
            <Button
              variant="game"
              className="w-full mb-3"
              onClick={() => {
                saveCity();
                setSaveCitySuccess(true);
                setTimeout(() => setSaveCitySuccess(false), 2000);
              }}
            >
              {saveCitySuccess ? '✓ Şehir Kaydedildi!' : `Kaydet "${cityName}"`}
            </Button>
            
            {/* Saved Cities List */}
            {savedCities.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {savedCities.map((city) => (
                  <div
                    key={city.id}
                    className={`p-3 rounded-md border transition-colors ${
                      city.id === currentCityId
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    {cityToRename?.id === city.id ? (
                      <div className="space-y-2">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="Yeni şehir adı..."
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
                            İptal
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
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    ) : cityToDelete?.id === city.id ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground text-center">Bu şehri sil?</p>
                        <div className="flex gap-2">
                          <Button
                            variant="game-secondary"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => setCityToDelete(null)}
                          >
                            İptal
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
                            Sil
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-medium text-sm truncate flex-1">
                            {city.cityName}
                            {city.id === currentCityId && (
                              <span className="ml-2 text-[10px] text-primary">(mevcut)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span>Nüfus: {formatPopulation(city.population)}</span>
                          <span>{formatMoney(city.money)}</span>
                          <span>{city.gridSize}×{city.gridSize}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mb-2">
                          Kayıt {formatDate(city.savedAt)}
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
                              Yükle
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
                            Yeniden Adlandır
                          </Button>
                          <Button
                            variant="game-secondary"
                            size="sm"
                            className="flex-1 h-7 text-xs hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => setCityToDelete(city)}
                          >
                            Sil
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs text-center py-3 border border-dashed rounded-md">
                Henüz kayıtlı şehir yok.
              </p>
            )}
          </div>
          
          {/* Restore saved city button - shown if there's a saved city from before viewing a shared city */}
          {savedCityInfo && (
            <div className="space-y-2">
              <Button
                variant="game"
                className="w-full"
                onClick={() => {
                  restoreSavedCity();
                  setSavedCityInfo(null);
                  setActivePanel('none');
                }}
              >
                Geri Yükle {savedCityInfo.cityName}
              </Button>
              <p className="text-muted-foreground text-xs text-center">
                Şehriniz paylaşılan bir şehri görüntülemeden önce kaydedildi
              </p>
              <Separator />
            </div>
          )}
          
          {!showNewGameConfirm ? (
            <Button
              variant="game-danger"
              className="w-full"
              onClick={() => setShowNewGameConfirm(true)}
            >
              Yeni Oyun Başlat
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm text-center">Emin misiniz? Bu işlem tüm ilerlemeyi sıfırlayacaktır.</p>
              <Input
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                placeholder="Yeni şehir adı..."
              />
              <div className="flex gap-2">
                <Button
                  variant="game-secondary"
                  className="flex-1"
                  onClick={() => setShowNewGameConfirm(false)}
                >
                  İptal
                </Button>
                <Button
                  variant="game-danger"
                  className="flex-1"
                  onClick={() => {
                    newGame(newCityName || 'Yeni Şehir', gridSize);
                    setActivePanel('none');
                  }}
                >
                  Sıfırla
                </Button>
              </div>
            </div>
          )}
          
          <Separator />
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Oyunu Dışa Aktar</div>
            <p className="text-muted-foreground text-xs mb-2">Paylaşmak veya yedeklemek için oyun durumunu kopyala</p>
            <Button
              variant="game-secondary"
              className="w-full"
              onClick={handleCopyExport}
            >
              {exportCopied ? '✓ Kopyalandı!' : 'Oyun Durumunu Kopyala'}
            </Button>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Oyunu İçe Aktar</div>
            <p className="text-muted-foreground text-xs mb-2">Yüklemek için bir oyun durumu yapıştırın</p>
            <textarea
              className="w-full h-20 bg-background border border-border rounded-md p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Oyun durumunu buraya yapıştırın..."
              value={importValue}
              onChange={(e) => {
                setImportValue(e.target.value);
                setImportError(false);
                setImportSuccess(false);
              }}
            />
            {importError && (
              <p className="text-red-400 text-xs mt-1">Geçersiz oyun durumu. Lütfen kontrol edip tekrar deneyin.</p>
            )}
            {importSuccess && (
              <p className="text-green-400 text-xs mt-1">Oyun başarıyla yüklendi!</p>
            )}
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={handleImport}
              disabled={!importValue.trim()}
            >
              Oyun Durumunu Yükle
            </Button>
          </div>
          
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Geliştirici Araçları</div>
            <Button
              variant="game-secondary"
              className="w-full"
              onClick={() => setShowSpriteTest(true)}
            >
              Sprite Test Görünümünü Aç
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState } = await import('@/resources/example_state.json');
                loadState(JSON.stringify(exampleState));
                setActivePanel('none');
              }}
            >
              Örnek Durumu Yükle
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState2 } = await import('@/resources/example_state_2.json');
                loadState(JSON.stringify(exampleState2));
                setActivePanel('none');
              }}
            >
              Load Example State 2
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState3 } = await import('@/resources/example_state_3.json');
                loadState(JSON.stringify(exampleState3));
                setActivePanel('none');
              }}
            >
              Load Example State 3
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState4 } = await import('@/resources/example_state_4.json');
                loadState(JSON.stringify(exampleState4));
                setActivePanel('none');
              }}
            >
              Load Example State 4
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState5 } = await import('@/resources/example_state_5.json');
                loadState(JSON.stringify(exampleState5));
                setActivePanel('none');
              }}
            >
              Load Example State 5
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState6 } = await import('@/resources/example_state_6.json');
                loadState(JSON.stringify(exampleState6));
                setActivePanel('none');
              }}
            >
              Load Example State 6
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState7 } = await import('@/resources/example_state_7.json');
                loadState(JSON.stringify(exampleState7));
                setActivePanel('none');
              }}
            >
              Load Example State 7
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState8 } = await import('@/resources/example_state_8.json');
                loadState(JSON.stringify(exampleState8));
                setActivePanel('none');
              }}
            >
              Load Example State 8
            </Button>
            <Button
              variant="game-secondary"
              className="w-full mt-2"
              onClick={async () => {
                const { default: exampleState9 } = await import('@/resources/example_state_9.json');
                loadState(JSON.stringify(exampleState9));
                setActivePanel('none');
              }}
            >
              Load Example State 9
            </Button>
            <div className="mt-4 pt-4 border-t border-border">
              <Label>Gece/Gündüz Modu</Label>
              <p className="text-muted-foreground text-xs mb-2">Zaman akışını etkilemeden günün saatini değiştir</p>
              <div className="flex rounded-md border border-border overflow-hidden">
                {(['auto', 'day', 'night'] as DayNightMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDayNightMode(mode)}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      dayNightMode === mode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode === 'auto' && 'Otomatik'}
                    {mode === 'day' && 'Gündüz'}
                    {mode === 'night' && 'Gece'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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
