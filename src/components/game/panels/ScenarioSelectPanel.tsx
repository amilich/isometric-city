import React from 'react';
import { useGame } from '@/context/GameContext';
import { SCENARIOS } from '@/data/scenarios';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Target, Trophy, Clock, Users, Coins, Smile } from 'lucide-react';
import { Objective } from '@/types/scenario';

export function ScenarioSelectPanel() {
  const { state, setActivePanel, startScenario } = useGame();

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-4xl bg-[#1e293b]/95 border-slate-700 text-slate-100 p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Senaryo Seçimi</DialogTitle>
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-64 bg-slate-900/50 border-r border-slate-700 p-6 flex flex-col">
            <h2 className="text-2xl font-bold mb-1 flex items-center gap-2 text-white">
              <Target className="text-blue-500" />
              Senaryolar
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Şehir yönetimi becerilerini test et.
            </p>
            
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200 text-sm">
                <Trophy className="w-4 h-4 mb-2 text-blue-400" />
                Senaryoları tamamlayarak madalyalar kazan ve yeni özelliklerin kilidini aç.
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto bg-slate-950/30">
            <div className="grid grid-cols-1 gap-4">
              {SCENARIOS.map((scenario) => {
                const isActive = state.activeScenarioId === scenario.id;
                const difficultyColor = 
                  scenario.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  scenario.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-rose-500/20 text-rose-400 border-rose-500/30';

                return (
                  <div 
                    key={scenario.id} 
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                      isActive 
                        ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/50' 
                        : 'border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-6 p-6">
                      {/* Icon/Image Placeholder */}
                      <div className={`w-24 h-24 shrink-0 rounded-lg flex items-center justify-center text-4xl shadow-inner ${
                         scenario.difficulty === 'easy' ? 'bg-emerald-900/20' :
                         scenario.difficulty === 'medium' ? 'bg-amber-900/20' :
                         'bg-rose-900/20'
                      }`}>
                        {scenario.difficulty === 'easy' ? '🌱' : 
                         scenario.difficulty === 'medium' ? '🏗️' : '🏭'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-bold text-slate-100 group-hover:text-white transition-colors">
                            {scenario.name}
                          </h3>
                          <Badge variant="outline" className={`${difficultyColor} uppercase tracking-wider text-[10px] font-bold border`}>
                            {scenario.difficulty === 'easy' ? 'Kolay' : 
                             scenario.difficulty === 'medium' ? 'Orta' : 'Zor'}
                          </Badge>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                          {scenario.description}
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {scenario.objectives.slice(0, 4).map((obj: Objective) => ( // Use imported type
                            <div key={obj.id} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                              {obj.type === 'population' && <Users className="w-3.5 h-3.5 text-blue-400" />}
                              {obj.type === 'money' && <Coins className="w-3.5 h-3.5 text-amber-400" />}
                              {obj.type === 'happiness' && <Smile className="w-3.5 h-3.5 text-emerald-400" />}
                              {obj.type === 'building_count' && <Target className="w-3.5 h-3.5 text-purple-400" />}
                              <span className="truncate">{obj.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col justify-center gap-3 min-w-[120px]">
                        <Button 
                          onClick={() => startScenario(scenario.id)}
                          className={`w-full h-12 text-base font-bold shadow-lg transition-all ${
                            isActive 
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 text-white'
                          }`}
                          disabled={isActive}
                        >
                          {isActive ? (
                            <>Aktif Senaryo</>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2 fill-current" />
                              Oyna
                            </>
                          )}
                        </Button>
                        {scenario.initialMoney && (
                          <div className="text-center text-xs text-slate-500 font-mono">
                            Başlangıç: ₺{scenario.initialMoney.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

