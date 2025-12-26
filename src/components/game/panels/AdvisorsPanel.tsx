'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AdvisorIcon,
  InfoIcon,
  PowerIcon,
  WaterIcon,
  MoneyIcon,
  SafetyIcon,
  HealthIcon,
  EducationIcon,
  EnvironmentIcon,
  JobsIcon,
} from '@/components/ui/Icons';

const ADVISOR_ICON_MAP: Record<string, React.ReactNode> = {
  power: <PowerIcon size={18} />,
  water: <WaterIcon size={18} />,
  cash: <MoneyIcon size={18} />,
  shield: <SafetyIcon size={18} />,
  hospital: <HealthIcon size={18} />,
  education: <EducationIcon size={18} />,
  environment: <EnvironmentIcon size={18} />,
  planning: <AdvisorIcon size={18} />,
  jobs: <JobsIcon size={18} />,
};

export function AdvisorsPanel() {
  const t = useTranslations('Game.Panels');
  const { state, setActivePanel } = useGame();
  const { advisorMessages, stats } = state;
  
  const avgRating = (stats.happiness + stats.health + stats.education + stats.safety + stats.environment) / 5;
  const grade = avgRating >= 90 ? 'A+' : avgRating >= 80 ? 'A' : avgRating >= 70 ? 'B' : avgRating >= 60 ? 'C' : avgRating >= 50 ? 'D' : 'F';
  const gradeColor = avgRating >= 70 ? 'text-green-400' : avgRating >= 50 ? 'text-amber-400' : 'text-red-400';
  
  const resolveMessage = (msg: string) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.key) {
        return t(`AdvisorsContent.${parsed.key}`, parsed.params);
      }
    } catch (e) {
      // Fallback
    }
    return msg;
  };

  const resolveAdvisorName = (name: string) => {
    if (name.startsWith('Advisors.')) {
        return t(`AdvisorsContent.${name}`);
    }
    return name;
  };

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[500px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle>{t('CityAdvisors')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-4 bg-primary/10 border-primary/30">
            <div 
              className={`w-16 h-16 flex items-center justify-center text-3xl font-black rounded-md ${gradeColor} bg-primary/20`}
            >
              {grade}
            </div>
            <div>
              <div className="text-foreground font-semibold">{t('AdvisorsContent.GeneralEvaluation')}</div>
              <div className="text-muted-foreground text-sm">{t('AdvisorsContent.GeneralEvaluationDesc')}</div>
            </div>
          </Card>
          
          <ScrollArea className="max-h-[350px]">
            <div className="space-y-3">
              {advisorMessages.length === 0 ? (
                <Card className="text-center py-8 text-muted-foreground bg-primary/10 border-primary/30">
                  <AdvisorIcon size={32} className="mx-auto mb-3 opacity-50" />
                  <div className="text-sm">{t('AdvisorsContent.NoIssuesTitle')}</div>
                  <div className="text-xs mt-1">{t('AdvisorsContent.NoIssuesDesc')}</div>
                </Card>
              ) : (
                advisorMessages.map((advisor, i) => (
                  <Card key={i} className={`p-3 bg-primary/10 border-primary/30 ${
                    advisor.priority === 'critical' ? 'border-l-2 border-l-red-500' :
                    advisor.priority === 'high' ? 'border-l-2 border-l-amber-500' :
                    advisor.priority === 'medium' ? 'border-l-2 border-l-yellow-500' : ''
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg text-muted-foreground">
                        {ADVISOR_ICON_MAP[advisor.icon] || <InfoIcon size={18} />}
                      </span>
                      <span className="text-foreground font-medium text-sm">{resolveAdvisorName(advisor.name)}</span>
                      <Badge 
                        variant={
                          advisor.priority === 'critical' ? 'destructive' :
                          advisor.priority === 'high' ? 'destructive' : 'secondary'
                        }
                        className="ml-auto text-[10px]"
                      >
                        {advisor.priority}
                      </Badge>
                    </div>
                    {advisor.messages.map((msg, j) => (
                      <div key={j} className="text-muted-foreground text-sm leading-relaxed">{resolveMessage(msg)}</div>
                    ))}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
