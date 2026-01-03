'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame, DayNightMode } from '@/context/GameContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { SpriteTestPanel } from './SpriteTestPanel';
import { SavedCityMeta } from '@/types/game';
import { 
  Download, 
  Upload, 
  Settings, 
  Palette, 
  Building2, 
  Code2, 
  Save, 
  Trash2, 
  RefreshCw,
  Eye,
  Globe,
  Monitor
} from 'lucide-react';

// Formatters...
function formatPopulation(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}K`;
  return pop.toString();
}

function formatMoney(money: number): string {
  if (money >= 1000000) return `₺${(money / 1000000).toFixed(1)}M`;
  if (money >= 1000) return `₺${(money / 1000).toFixed(1)}K`;
  return `₺${money}`;
}

export function SettingsPanel() {
  const t = useTranslations('Game.Panels');
  const { 
    state, 
    setActivePanel, 
    setDisastersEnabled, 
    newGame, 
    loadState, 
    exportState, 
    currentSpritePack, 
    availableSpritePacks, 
    setSpritePack, 
    dayNightMode, 
    setDayNightMode, 
    zoomSensitivity, 
    setZoomSensitivity, 
    getSavedCityInfo, 
    restoreSavedCity, 
    savedCities, 
    saveCity, 
    loadSavedCity, 
    deleteSavedCity, 
    renameSavedCity,
    toastNotificationsEnabled,
    setToastNotificationsEnabled
  } = useGame();

  const { disastersEnabled, cityName, gridSize, id: currentCityId } = state;
  const [activeTab, setActiveTab] = useState<'game' | 'appearance' | 'city' | 'dev'>('game');
  
  // State management for modals/inputs
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

  // URL State management for SpriteTest
  const searchParams = useSearchParams();
  const router = useRouter();
  const spriteTestFromUrl = searchParams?.get('spriteTest') === 'true';
  const [showSpriteTest, setShowSpriteTest] = useState(spriteTestFromUrl);

  // Sync saved city info
  useEffect(() => {
    setSavedCityInfo(getSavedCityInfo());
  }, [getSavedCityInfo]);

  // Handle file operations
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

    const finalData = { ...exportedData, metadata };
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

  const menuItems = [
    { id: 'game', label: t('GameSettings'), icon: Settings },
    { id: 'appearance', label: 'Görünüm', icon: Palette },
    { id: 'city', label: t('CityInfo'), icon: Building2 },
    { id: 'dev', label: t('DevTools'), icon: Code2 },
  ] as const;

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-5xl bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl h-[600px] flex flex-col md:flex-row gap-0">
        <DialogTitle className="sr-only">{t('Settings')}</DialogTitle>
        
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0">
          <h2 className="text-xl font-bold mb-6 px-2 flex items-center gap-2 text-white">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            {t('Settings')}
          </h2>
          
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                    activeTab === item.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
             <div className="text-xs text-slate-500 px-2 flex justify-between items-center">
                <span>Version 1.0.0</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-slate-950 overflow-y-auto p-8 custom-scrollbar">
          
          {/* Game Settings */}
          {activeTab === 'game' && (
            <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('GameSettings')}</h3>
                <p className="text-slate-400">Oyun deneyiminizi ve tercihlerinizi özelleştirin.</p>
              </div>
              <Separator className="bg-slate-800" />
              
              <div className="grid gap-6">
                <div className="flex items-center justify-between p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="space-y-1.5">
                    <Label className="text-base font-medium text-slate-200">{t('Disasters')}</Label>
                    <p className="text-sm text-slate-400">{t('DisastersDesc')}</p>
                  </div>
                  <Switch checked={disastersEnabled} onCheckedChange={setDisastersEnabled} />
                </div>

                <div className="flex items-center justify-between p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="space-y-1.5">
                    <Label className="text-base font-medium text-slate-200">{t('ToastNotifications')}</Label>
                    <p className="text-sm text-slate-400">{t('ToastNotificationsDesc')}</p>
                  </div>
                  <Switch checked={toastNotificationsEnabled} onCheckedChange={setToastNotificationsEnabled} />
                </div>

                <div className="flex items-center justify-between p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="space-y-1.5">
                    <Label className="text-base font-medium text-slate-200">Dil / Language</Label>
                    <p className="text-sm text-slate-400">Arayüz dilini değiştir</p>
                  </div>
                  <LanguageSelector variant="game" />
                </div>

                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium text-slate-200">{t('ZoomSensitivity')}</Label>
                    <span className="px-2.5 py-1 rounded-md bg-slate-800 text-sm font-mono text-blue-400 border border-slate-700">{zoomSensitivity}</span>
                  </div>
                  <Slider
                    value={[zoomSensitivity]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(vals) => setZoomSensitivity(vals[0])}
                    className="py-4"
                  />
                  <p className="text-sm text-slate-400">{t('ZoomSensitivityDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Görünüm</h3>
                <p className="text-slate-400">Şehrinizin görsel stilini ve temasını seçin.</p>
              </div>
              <Separator className="bg-slate-800" />

              <div className="space-y-6">
                 <div>
                    <Label className="text-base font-medium text-slate-200 mb-4 block">{t('SpritePack')}</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {availableSpritePacks.map((pack) => (
                        <button
                          key={pack.id}
                          onClick={() => setSpritePack(pack.id)}
                          className={`group relative flex items-center gap-4 p-3 rounded-xl border transition-all text-left ${
                            currentSpritePack.id === pack.id
                              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                              : 'border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 relative shadow-sm border border-white/5">
                            <Image 
                              src={pack.src} 
                              alt={pack.name}
                              fill
                              className="object-cover object-top"
                              style={{ imageRendering: 'pixelated' }}
                              unoptimized
                            />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-slate-200 group-hover:text-white">{pack.name}</div>
                            <div className="text-xs text-slate-500 mt-1 font-mono opacity-70">{pack.id}</div>
                          </div>
                          {currentSpritePack.id === pack.id && (
                             <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                          )}
                        </button>
                      ))}
                    </div>
                 </div>

                 <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                    <Label className="text-base font-medium text-slate-200 mb-4 block">{t('DayNightMode')}</Label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                      {(['auto', 'day', 'night'] as DayNightMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setDayNightMode(mode)}
                          className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            dayNightMode === mode
                              ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                          }`}
                        >
                          {mode === 'auto' && <><Monitor size={16}/> {t('ModeAuto')}</>}
                          {mode === 'day' && <><Eye size={16}/> {t('ModeDay')}</>}
                          {mode === 'night' && <><Globe size={16}/> {t('ModeNight')}</>}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* City Settings */}
          {activeTab === 'city' && (
            <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('CityInfo')}</h3>
                <p className="text-slate-400">Şehrinizi yönetin, kaydedin veya yedekleyin.</p>
              </div>
              <Separator className="bg-slate-800" />

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 flex items-center justify-between shadow-lg">
                   <div>
                      <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">{t('CityName')}</div>
                      <div className="text-3xl font-bold text-white">{cityName}</div>
                   </div>
                   <div className="text-right">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('GridSize')}</div>
                      <div className="text-xl font-mono text-slate-300 bg-slate-950/50 px-3 py-1 rounded-lg border border-slate-700/50">{gridSize} x {gridSize}</div>
                   </div>
                </div>

                <div className="col-span-2 space-y-4">
                   <div className="flex items-center justify-between">
                     <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('SavedCities')}</h4>
                     <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                        onClick={() => {
                          saveCity();
                          setSaveCitySuccess(true);
                          setTimeout(() => setSaveCitySuccess(false), 2000);
                        }}
                      >
                        {saveCitySuccess ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Kaydedildi</> : <><Save className="mr-2 h-4 w-4" /> {t('SaveCity')}</>}
                      </Button>
                   </div>
                   
                   <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {savedCities.length > 0 ? savedCities.map((city) => (
                        <div key={city.id} className="group flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800 transition-all">
                           <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-200 truncate flex items-center gap-2">
                                {city.cityName}
                                {city.id === currentCityId && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">Aktif</span>}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                 <span className="flex items-center gap-1">POP: <span className="text-slate-300">{formatPopulation(city.population)}</span></span>
                                 <span className="flex items-center gap-1"><span className="text-emerald-500">₺</span> <span className="text-emerald-400">{formatMoney(city.money).replace('₺','')}</span></span>
                              </div>
                           </div>
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700" onClick={() => loadSavedCity(city.id)}>
                                <Upload size={14} />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-950/30" onClick={() => deleteSavedCity(city.id)}>
                                <Trash2 size={14} />
                              </Button>
                           </div>
                        </div>
                      )) : (
                        <div className="text-center py-12 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                          {t('NoSavedCities')}
                        </div>
                      )}
                   </div>
                </div>

                <div className="col-span-2 pt-4">
                  {!showNewGameConfirm ? (
                    <Button variant="destructive" className="w-full bg-red-950/50 hover:bg-red-900 text-red-200 border border-red-900" onClick={() => setShowNewGameConfirm(true)}>
                      {t('NewGame')}
                    </Button>
                  ) : (
                    <div className="p-4 rounded-xl border border-red-900 bg-red-950/30 space-y-3 animate-in zoom-in-95 duration-200">
                      <p className="text-sm text-red-300 text-center font-medium">{t('NewGameConfirm')}</p>
                      <div className="flex gap-2">
                        <Button variant="ghost" className="flex-1 hover:bg-red-950/50 text-red-200" onClick={() => setShowNewGameConfirm(false)}>{t('Cancel')}</Button>
                        <Button variant="destructive" className="flex-1 bg-red-600 hover:bg-red-500" onClick={() => { newGame('Yeni Şehir', gridSize); setActivePanel('none'); }}>{t('Reset')}</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <Button variant="outline" className="border-slate-700 bg-slate-900 hover:bg-slate-800 hover:text-white" onClick={handleDownload}>
                      <Download className="mr-2 h-4 w-4" /> İndir (.tmc)
                    </Button>
                    <div className="relative">
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".tmc" className="hidden" />
                      <Button variant="outline" className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800 hover:text-white" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Yükle (.tmc)
                      </Button>
                    </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Dev Tools */}
          {activeTab === 'dev' && (
            <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
               <div>
                <h3 className="text-2xl font-bold text-white mb-2">{t('DevTools')}</h3>
                <p className="text-slate-400">Geliştirme ve test araçları.</p>
              </div>
              <Separator className="bg-slate-800" />
              
              <div className="grid grid-cols-2 gap-3">
                 <Button variant="secondary" onClick={() => setShowSpriteTest(true)} className="bg-slate-800 text-slate-200 hover:bg-slate-700">
                    Sprite Test Panel
                 </Button>
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <Button 
                      key={num} 
                      variant="outline" 
                      className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300"
                      onClick={async () => {
                        const module = await import(`@/resources/example_state${num === 1 ? '' : `_${num}`}.json`);
                        loadState(JSON.stringify(module.default));
                        setActivePanel('none');
                      }}
                    >
                      Örnek Şehir {num}
                    </Button>
                 ))}
              </div>
            </div>
          )}

        </div>
      </DialogContent>
      
      {showSpriteTest && (
        <SpriteTestPanel onClose={() => setShowSpriteTest(false)} />
      )}
    </Dialog>
  );
}
