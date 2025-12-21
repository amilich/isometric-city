'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { hasGeminiApiKey } from '@/lib/gemini';
import { getAdvisorResponse, CityState } from '@/lib/advisor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Build city state for the advisor API
function buildCityState(state: ReturnType<typeof useGame>['state']): CityState {
  let unpowered = 0;
  let unwatered = 0;
  let abandoned = 0;

  for (const row of state.grid) {
    for (const tile of row) {
      if (tile.zone !== 'none' && tile.building.type !== 'grass') {
        if (!tile.building.powered) unpowered++;
        if (!tile.building.watered) unwatered++;
      }
      if (tile.building.abandoned) abandoned++;
    }
  }

  return {
    cityName: state.cityName,
    year: state.year,
    month: state.month,
    population: state.stats.population,
    money: state.stats.money,
    income: state.stats.income,
    expenses: state.stats.expenses,
    happiness: state.stats.happiness,
    health: state.stats.health,
    education: state.stats.education,
    safety: state.stats.safety,
    environment: state.stats.environment,
    demand: state.stats.demand,
    issues: { unpowered, unwatered, abandoned },
  };
}

export function AdvisorsPanel() {
  const { state, setActivePanel } = useGame();
  const { advisorMessages, stats } = state;

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check for API key on mount
  useEffect(() => {
    setHasApiKey(hasGeminiApiKey());
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const avgRating =
    (stats.happiness + stats.health + stats.education + stats.safety + stats.environment) / 5;
  const grade =
    avgRating >= 90
      ? 'A+'
      : avgRating >= 80
        ? 'A'
        : avgRating >= 70
          ? 'B'
          : avgRating >= 60
            ? 'C'
            : avgRating >= 50
              ? 'D'
              : 'F';
  const gradeColor =
    avgRating >= 70 ? 'text-green-400' : avgRating >= 50 ? 'text-amber-400' : 'text-red-400';

  const sendMessage = async (userMessage?: string) => {
    if (!hasGeminiApiKey()) {
      setError('Please configure your Gemini API key in Settings');
      return;
    }

    setIsLoading(true);
    setError(null);

    if (userMessage) {
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    }

    try {
      const cityState = buildCityState(state);
      const responseText = await getAdvisorResponse(cityState, userMessage, messages);
      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get advice';
      if (message.includes('API key')) {
        setHasApiKey(false);
        setError('Invalid API key');
      } else {
        setError('Failed to get advice. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[500px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle>City Advisors</DialogTitle>
        </DialogHeader>

        <Card className="flex items-center gap-4 p-4 bg-primary/10 border-primary/30">
          <div
            className={`w-16 h-16 flex items-center justify-center text-3xl font-black rounded-md ${gradeColor} bg-primary/20`}
          >
            {grade}
          </div>
          <div>
            <div className="text-foreground font-semibold">Overall City Rating</div>
            <div className="text-muted-foreground text-sm">
              Based on happiness, health, education, safety & environment
            </div>
          </div>
        </Card>

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="alerts" className="flex-1">
              Alerts {advisorMessages.length > 0 && `(${advisorMessages.length})`}
            </TabsTrigger>
            <TabsTrigger value="ask" className="flex-1">
              Ask Advisor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-4">
                {advisorMessages.length === 0 ? (
                  <Card className="text-center py-8 text-muted-foreground bg-primary/10 border-primary/30">
                    <AdvisorIcon size={32} className="mx-auto mb-3 opacity-50" />
                    <div className="text-sm">No urgent issues to report!</div>
                    <div className="text-xs mt-1">Your city is running smoothly.</div>
                  </Card>
                ) : (
                  advisorMessages.map((advisor, i) => (
                    <Card
                      key={i}
                      className={`p-3 bg-primary/10 border-primary/30 ${
                        advisor.priority === 'critical'
                          ? 'border-l-2 border-l-red-500'
                          : advisor.priority === 'high'
                            ? 'border-l-2 border-l-amber-500'
                            : advisor.priority === 'medium'
                              ? 'border-l-2 border-l-yellow-500'
                              : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg text-muted-foreground">
                          {ADVISOR_ICON_MAP[advisor.icon] || <InfoIcon size={18} />}
                        </span>
                        <span className="text-foreground font-medium text-sm">{advisor.name}</span>
                        <Badge
                          variant={
                            advisor.priority === 'critical'
                              ? 'destructive'
                              : advisor.priority === 'high'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="ml-auto text-[10px]"
                        >
                          {advisor.priority}
                        </Badge>
                      </div>
                      {advisor.messages.map((msg, j) => (
                        <div key={j} className="text-muted-foreground text-sm leading-relaxed">
                          {msg}
                        </div>
                      ))}
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ask">
            {!hasApiKey ? (
              <Card className="text-center py-8 text-muted-foreground bg-primary/10 border-primary/30">
                <AdvisorIcon size={32} className="mx-auto mb-3 opacity-50" />
                <div className="text-sm mb-3">Configure your Gemini API key to chat with your advisor</div>
                <Button variant="outline" size="sm" onClick={() => setActivePanel('settings')}>
                  Open Settings
                </Button>
              </Card>
            ) : (
              <div className="flex flex-col h-[280px]">
                <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
                  {messages.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground text-sm mb-3">
                        Ask your city advisor for guidance
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendMessage()}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Thinking...' : 'Get advice on current situation'}
                      </Button>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary/20 ml-8 text-foreground'
                            : 'bg-muted mr-4 text-muted-foreground'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))
                  )}
                  {isLoading && messages.length > 0 && (
                    <div className="text-muted-foreground text-sm animate-pulse p-2">
                      Advisor is thinking...
                    </div>
                  )}
                </div>

                {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your city..."
                    disabled={isLoading}
                    className="flex-1 text-sm"
                  />
                  <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
                    Send
                  </Button>
                </form>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
