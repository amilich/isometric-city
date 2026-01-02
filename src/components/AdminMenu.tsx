'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useGame } from '@/context/GameContext';
import { Settings, DollarSign, Building, TreePine, Wrench, AlertTriangle, Eye, Bug, Shield, ShieldAlert, Zap } from 'lucide-react';
import { OverlayMode } from '@/components/game/types';

interface AdminMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;
}

export function AdminMenu({ open, onOpenChange, overlayMode, setOverlayMode }: AdminMenuProps) {
  const { state, addMoney, addNotification, expandCity, generateRandomCity, newGame, setDisastersEnabled } = useGame();
  const [moneyAmount, setMoneyAmount] = useState('10000');

  const handleAddMoney = () => {
    const amount = parseInt(moneyAmount) || 0;
    if (amount > 0) {
      addMoney(amount);
      addNotification(
        'Admin: Money Added',
        `Added $${amount.toLocaleString()} to city treasury`,
        'trophy'
      );
    }
  };

  const handleToggleDisasters = () => {
    const newState = !state.disastersEnabled;
    setDisastersEnabled(newState);
    addNotification(
      'Admin: Disasters',
      `Disasters ${newState ? 'enabled' : 'disabled'}`,
      newState ? 'disaster' : 'trophy'
    );
  };

  const handleSetOverlay = (overlay: OverlayMode) => {
    setOverlayMode(overlay);
    addNotification(
      'Admin: Debug Overlay',
      `${overlay === 'none' ? 'Disabled' : 'Enabled'} ${overlay} overlay`,
      'trophy'
    );
  };

  const handleQuickMoney = (amount: number) => {
    addMoney(amount);
    addNotification(
      'Admin: Quick Money',
      `Added $${amount.toLocaleString()} to city treasury`,
      'trophy'
    );
  };

  const handleExpandCity = () => {
    expandCity();
    addNotification(
      'Admin: City Expanded',
      'City grid expanded by 15 tiles on each side',
      'trophy'
    );
  };

  const handleGenerateCity = () => {
    if (confirm('This will replace your current city with a randomly generated one. Continue?')) {
      generateRandomCity();
      addNotification(
        'Admin: Random City',
        'Generated a new random city',
        'trophy'
      );
    }
  };

  const handleNewCity = () => {
    if (confirm('This will start a completely new city. Continue?')) {
      newGame();
      addNotification(
        'Admin: New City',
        'Started a new city',
        'trophy'
      );
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sky-400 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Admin Menu
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Administrative tools for city management
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Money Buttons */}
          <div>
            <Label className="text-slate-200 mb-2 block">Quick Money</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickMoney(10000)}
                className="border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                $10K
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickMoney(50000)}
                className="border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                $50K
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickMoney(100000)}
                className="border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                $100K
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickMoney(1000000)}
                className="border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                $1M
              </Button>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Custom Money Amount */}
          <div>
            <Label htmlFor="money-amount" className="text-slate-200">
              Custom Money Amount
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="money-amount"
                type="number"
                value={moneyAmount}
                onChange={(e) => setMoneyAmount(e.target.value)}
                placeholder="Enter amount"
                className="bg-slate-800 border-slate-600 text-slate-100"
              />
              <Button
                onClick={handleAddMoney}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Add
              </Button>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Disaster Management */}
          <div>
            <Label className="text-slate-200 mb-2 block">Disaster Management</Label>
            <div className="space-y-2">
              <Button
                onClick={handleToggleDisasters}
                className={`w-full ${state.disastersEnabled 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                {state.disastersEnabled ? (
                  <>
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    Disable Disasters
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Enable Disasters
                  </>
                )}
              </Button>
              <div className="text-xs text-slate-400 text-center">
                Current: {state.disastersEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Debug Tools */}
          <div>
            <Label className="text-slate-200 mb-2 block">Debug Overlays</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleSetOverlay('power')}
                variant="outline"
                size="sm"
                className={`border-slate-600 text-slate-200 hover:bg-slate-800 ${
                  overlayMode === 'power' ? 'bg-slate-700' : ''
                }`}
              >
                <Zap className="w-3 h-3 mr-1" />
                Power
              </Button>
              <Button
                onClick={() => handleSetOverlay('water')}
                variant="outline"
                size="sm"
                className={`border-slate-600 text-slate-200 hover:bg-slate-800 ${
                  overlayMode === 'water' ? 'bg-slate-700' : ''
                }`}
              >
                <Building className="w-3 h-3 mr-1" />
                Water
              </Button>
              <Button
                onClick={() => handleSetOverlay('fire')}
                variant="outline"
                size="sm"
                className={`border-slate-600 text-slate-200 hover:bg-slate-800 ${
                  overlayMode === 'fire' ? 'bg-slate-700' : ''
                }`}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Fire
              </Button>
              <Button
                onClick={() => handleSetOverlay('police')}
                variant="outline"
                size="sm"
                className={`border-slate-600 text-slate-200 hover:bg-slate-800 ${
                  overlayMode === 'police' ? 'bg-slate-700' : ''
                }`}
              >
                <Shield className="w-3 h-3 mr-1" />
                Police
              </Button>
              <Button
                onClick={() => handleSetOverlay('health')}
                variant="outline"
                size="sm"
                className={`border-slate-600 text-slate-200 hover:bg-slate-800 ${
                  overlayMode === 'health' ? 'bg-slate-700' : ''
                }`}
              >
                <Bug className="w-3 h-3 mr-1" />
                Health
              </Button>
              <Button
                onClick={() => handleSetOverlay('none')}
                variant="outline"
                size="sm"
                className={`border-slate-600 text-slate-200 hover:bg-slate-800 ${
                  overlayMode === 'none' ? 'bg-slate-700' : ''
                }`}
              >
                <Eye className="w-3 h-3 mr-1" />
                None
              </Button>
            </div>
            <div className="text-xs text-slate-400 text-center mt-2">
              Selected: {overlayMode}
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* City Tools */}
          <div>
            <Label className="text-slate-200 mb-2 block">City Tools</Label>
            <div className="space-y-2">
              <Button
                onClick={handleExpandCity}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Building className="w-4 h-4 mr-2" />
                Expand City Grid
              </Button>
              <Button
                onClick={handleGenerateCity}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                <TreePine className="w-4 h-4 mr-2" />
                Generate Random City
              </Button>
              <Button
                onClick={handleNewCity}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                <Wrench className="w-4 h-4 mr-2" />
                New City (Reset All)
              </Button>
            </div>
          </div>

          {/* Current Stats Display */}
          <div className="bg-slate-800 p-3 rounded-lg">
            <Label className="text-slate-200 text-sm">Current Stats</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-green-400" />
                <span className="text-slate-300">Money: ${state.stats.money.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Building className="w-3 h-3 text-blue-400" />
                <span className="text-slate-300">Pop: {state.stats.population.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <TreePine className="w-3 h-3 text-green-400" />
                <span className="text-slate-300">Grid: {state.gridSize}x{state.gridSize}</span>
              </div>
              <div className="flex items-center gap-1">
                <Settings className="w-3 h-3 text-gray-400" />
                <span className="text-slate-300">Year: {state.year}</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-red-400" />
                <span className="text-slate-300">Disasters: {state.disastersEnabled ? 'On' : 'Off'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-cyan-400" />
                <span className="text-slate-300">Overlay: {overlayMode}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}