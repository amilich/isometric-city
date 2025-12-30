import React from 'react';
import { useGame } from '@/context/GameContext';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { SCENARIOS } from '@/data/scenarios';

export function ScenarioHUD() {
  const { state } = useGame();
  
  if (state.gameMode !== 'scenario' || !state.scenarioObjectives) {
    return null;
  }

  const scenario = SCENARIOS.find(s => s.id === state.activeScenarioId);

  // Calculate time left
  let timeLeftString = '';
  let isUrgent = false;
  
  if (scenario?.timeLimit) {
      let targetYear = scenario.timeLimit.year;
      if (targetYear < 2000) targetYear += 2024; // Base year adjustment logic matches context
      
      const yearsLeft = targetYear - state.year;
      const monthsLeft = scenario.timeLimit.month - state.month;
      
      let totalMonthsLeft = yearsLeft * 12 + monthsLeft;
      
      if (totalMonthsLeft < 0) {
          timeLeftString = 'Süre Doldu!';
          isUrgent = true;
      } else {
          const y = Math.floor(totalMonthsLeft / 12);
          const m = totalMonthsLeft % 12;
          timeLeftString = `${y} Yıl ${m} Ay`;
          if (totalMonthsLeft < 6) isUrgent = true;
      }
  }

  return (
    <Card className="absolute top-20 right-4 w-64 bg-background/90 backdrop-blur border-border/50 shadow-lg p-3 z-40 pointer-events-auto">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center border-b border-border/50 pb-1">
            <h3 className="font-bold text-sm text-primary truncate pr-2">
            {scenario?.name || 'Senaryo'}
            </h3>
            {timeLeftString && (
                <div className={`flex items-center gap-1 text-[10px] font-mono whitespace-nowrap ${isUrgent ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                    <Clock size={10} />
                    {timeLeftString}
                </div>
            )}
        </div>
        
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {state.scenarioObjectives.map((obj) => (
            <div key={obj.id} className={`text-xs flex gap-2 items-start ${obj.isCompleted ? 'text-muted-foreground opacity-70' : ''}`}>
              <div className="mt-0.5">
                {obj.isCompleted ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : (
                  <Circle size={14} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{obj.description}</p>
                {!obj.isCompleted && (
                   <div className="w-full bg-secondary h-1.5 rounded-full mt-1 overflow-hidden">
                     <div 
                        className="bg-primary h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((obj.currentValue || 0) / obj.targetValue) * 100)}%` }}
                     />
                   </div>
                )}
                {!obj.isCompleted && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {obj.type === 'money' ? '₺' : ''}{obj.currentValue?.toLocaleString()} / {obj.targetValue?.toLocaleString()}
                    </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

