'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GameProvider } from '@/context/GameContext';
import Game from '@/components/Game';

// Isometric building SVG for hero
function IsometricCity() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.4))' }}>
      <defs>
        <linearGradient id="grass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a7c3f" />
          <stop offset="100%" stopColor="#3d6634" />
        </linearGradient>
        <linearGradient id="residential" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="commercial" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="industrial" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      
      {/* Ground tiles */}
      <polygon points="200,250 280,210 200,170 120,210" fill="url(#grass)" />
      <polygon points="280,210 360,170 280,130 200,170" fill="url(#grass)" />
      <polygon points="120,210 200,170 120,130 40,170" fill="url(#grass)" />
      <polygon points="200,170 280,130 200,90 120,130" fill="url(#grass)" />
      
      {/* Residential building */}
      <g transform="translate(40, 100)">
        <polygon points="40,70 80,50 80,20 40,40" fill="#22c55e" />
        <polygon points="0,50 40,70 40,40 0,20" fill="#16a34a" />
        <polygon points="0,20 40,40 80,20 40,0" fill="#4ade80" />
        <rect x="10" y="25" width="8" height="8" fill="#fef08a" opacity="0.8" />
        <rect x="25" y="25" width="8" height="8" fill="#fef08a" opacity="0.8" />
        <rect x="10" y="38" width="8" height="8" fill="#fef08a" opacity="0.8" />
      </g>
      
      {/* Commercial building (tall) */}
      <g transform="translate(200, 30)">
        <polygon points="40,140 80,120 80,30 40,50" fill="#3b82f6" />
        <polygon points="0,120 40,140 40,50 0,30" fill="#2563eb" />
        <polygon points="0,30 40,50 80,30 40,10" fill="#60a5fa" />
        {/* Windows */}
        {[0, 20, 40, 60, 80].map((y, i) => (
          <g key={i}>
            <rect x="48" y={40 + y} width="6" height="8" fill="#bfdbfe" opacity="0.9" />
            <rect x="60" y={40 + y} width="6" height="8" fill="#bfdbfe" opacity="0.9" />
          </g>
        ))}
      </g>
      
      {/* Industrial building */}
      <g transform="translate(280, 80)">
        <polygon points="30,80 60,65 60,35 30,50" fill="#f59e0b" />
        <polygon points="0,65 30,80 30,50 0,35" fill="#d97706" />
        <polygon points="0,35 30,50 60,35 30,20" fill="#fbbf24" />
        {/* Smokestack */}
        <rect x="40" y="5" width="8" height="30" fill="#6b7280" />
        <ellipse cx="44" cy="5" rx="4" ry="2" fill="#9ca3af" />
        {/* Smoke */}
        <ellipse cx="44" cy="-5" rx="6" ry="4" fill="#d1d5db" opacity="0.5">
          <animate attributeName="cy" values="-5;-15;-5" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
        </ellipse>
      </g>
      
      {/* Trees */}
      <g transform="translate(100, 170)">
        <rect x="8" y="15" width="4" height="10" fill="#78350f" />
        <ellipse cx="10" cy="12" rx="8" ry="10" fill="#22c55e" />
      </g>
      <g transform="translate(300, 180)">
        <rect x="8" y="15" width="4" height="10" fill="#78350f" />
        <ellipse cx="10" cy="12" rx="8" ry="10" fill="#16a34a" />
      </g>
      
      {/* Roads */}
      <polygon points="200,250 220,240 200,230 180,240" fill="#4b5563" />
      <line x1="200" y1="235" x2="200" y2="245" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  );
}

// Animated stats display
function AnimatedStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// Feature card component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
      <CardHeader>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

// Icons for features
function ZoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SimulationIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function ServiceIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-5 5" />
    </svg>
  );
}

const STORAGE_KEY = 'isocity-game-state';

// Check if there's a saved game in localStorage
function hasSavedGame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.grid && parsed.gridSize && parsed.stats;
    }
  } catch (e) {
    return false;
  }
  return false;
}

export default function HomePage() {
  const [showGame, setShowGame] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const [cityName, setCityName] = useState('New City');
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing game on mount and auto-load if exists
  useEffect(() => {
    if (hasSavedGame()) {
      // Auto-load into game if there's a saved state
      setShowGame(true);
    }
    setIsLoading(false);
  }, []);

  // Animated population counter
  const [animatedPop, setAnimatedPop] = useState(0);
  useEffect(() => {
    if (showGame || isLoading) return; // Don't animate if showing game or loading
    const target = 1000000;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedPop(target);
        clearInterval(timer);
      } else {
        setAnimatedPop(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [showGame, isLoading]);

  // Show loading state briefly
  if (isLoading) {
    return (
      <main className="min-h-screen hero-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-4 animate-pulse">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <polygon points="12,2 22,8 12,14 2,8" />
              <polygon points="2,8 12,14 12,22 2,16" opacity="0.7" />
              <polygon points="22,8 12,14 12,22 22,16" opacity="0.4" />
            </svg>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  if (showGame) {
    return (
      <GameProvider>
        <main className="h-screen w-screen overflow-hidden">
          <Game />
        </main>
      </GameProvider>
    );
  }

  return (
    <main className="min-h-screen hero-gradient overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 py-6 px-8">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">ISOCITY</span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-primary border-primary/50">
              v1.0
            </Badge>
            <Button variant="ghost" onClick={() => setShowGame(true)}>
              Continue Game
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0">
                Isometric City Builder
              </Badge>
              <h1 className="text-5xl lg:text-7xl font-black tracking-tight">
                Build Your
                <br />
                <span className="text-gradient">Dream City</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Zone districts, manage resources, and watch your metropolis grow in this immersive isometric city builder. 
                Balance budgets, provide services, and keep your citizens happy.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8 h-14 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                onClick={() => setShowNewGame(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                New City
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 h-14"
                onClick={() => setShowGame(true)}
              >
                Continue Playing
              </Button>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border/50">
              <AnimatedStat label="Max Population" value={animatedPop.toLocaleString()} color="text-green-400" />
              <AnimatedStat label="Building Types" value="25+" color="text-blue-400" />
              <AnimatedStat label="Achievements" value="10" color="text-amber-400" />
            </div>
          </div>

          {/* Right - Isometric illustration */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent blur-2xl" />
            <div className="relative animate-float">
              <IsometricCity />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">City Building Features</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to build and manage a thriving metropolis
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<ZoneIcon />}
            title="Zoning System"
            description="Zone residential, commercial, and industrial areas. Watch buildings grow based on demand and conditions."
          />
          <FeatureCard
            icon={<SimulationIcon />}
            title="Live Simulation"
            description="Dynamic simulation with population growth, job markets, and evolving buildings based on city conditions."
          />
          <FeatureCard
            icon={<ServiceIcon />}
            title="City Services"
            description="Build police, fire, hospitals, and schools. Manage coverage to keep citizens safe and educated."
          />
          <FeatureCard
            icon={<ChartIcon />}
            title="Economy & Stats"
            description="Balance budgets, adjust taxes, and track historical statistics. Unlock achievements as your city grows."
          />
        </div>
      </section>

      {/* Zone types showcase */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-green-500/10 border-green-500/30 hover:border-green-500/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-green-500" />
                <CardTitle className="text-green-400">Residential</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Houses and apartments for your citizens. From small homes to towering high-rises as density increases.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-blue-500" />
                <CardTitle className="text-blue-400">Commercial</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Shops, offices, and malls providing jobs and services. Essential for a thriving economy.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-amber-500" />
                <CardTitle className="text-amber-400">Industrial</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Factories and warehouses creating jobs. Be mindful of pollution affecting nearby areas.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div>Built with Next.js, React, and shadcn/ui</div>
          <div>Drag to place buildings - Alt+Drag to pan - Scroll to zoom</div>
        </div>
      </footer>

      {/* New Game Dialog */}
      <Dialog open={showNewGame} onOpenChange={setShowNewGame}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Start New City</DialogTitle>
            <DialogDescription>
              Configure your new city and begin building your metropolis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="cityName">City Name</Label>
              <Input
                id="cityName"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="Enter city name..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowNewGame(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowNewGame(false);
              setShowGame(true);
            }}>
              Start Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
