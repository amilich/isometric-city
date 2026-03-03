'use client';

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, RefreshCw, AlertCircle, Wand2 } from 'lucide-react';
import { useCustomBuildingGenerator, BuildingAttributes, CustomBuildingResult } from '@/hooks/useCustomBuildingGenerator';
import './fal-branding.css';

// Custom building type that will be stored
export interface CustomBuilding {
  id: string;
  name: string;
  description: string;
  category: BuildingAttributes['category'];
  size: 1 | 2 | 3 | 4;
  spriteUrl: string;
  stats: {
    maxPop: number;
    maxJobs: number;
    pollution: number;
    landValue: number;
  };
  cost: number;
  createdAt: number;
}

interface CustomBuildingPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuildingCreated: (building: CustomBuilding) => void;
}

// Category display info
const CATEGORY_INFO: Record<BuildingAttributes['category'], { label: string; color: string }> = {
  residential: { label: 'Residential', color: 'text-green-400' },
  commercial: { label: 'Commercial', color: 'text-blue-400' },
  industrial: { label: 'Industrial', color: 'text-yellow-400' },
  service: { label: 'Service', color: 'text-purple-400' },
  recreation: { label: 'Recreation', color: 'text-pink-400' },
};

// Example prompts for inspiration
const EXAMPLE_PROMPTS = [
  'A cozy coffee shop with outdoor seating',
  'A futuristic solar power plant with glass dome',
  'A small Japanese temple with garden',
  'A modern art museum with abstract architecture',
  'A colorful daycare center with playground',
  'A rustic farmhouse with red barn',
  'A sleek tech startup office building',
  'A medieval blacksmith forge',
];

export function CustomBuildingPanel({ open, onOpenChange, onBuildingCreated }: CustomBuildingPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [editedName, setEditedName] = useState('');
  const { step, result, error, generate, reset } = useCustomBuildingGenerator();

  // Handle generate with the current prompt
  const handleGenerate = useCallback(() => {
    if (prompt.trim()) {
      generate(prompt);
    }
  }, [prompt, generate]);

  // Handle using an example prompt
  const handleUseExample = useCallback(() => {
    const randomPrompt = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
    setPrompt(randomPrompt);
  }, []);

  // Handle confirming and adding the building
  const handleConfirm = useCallback(() => {
    if (!result) return;

    const building: CustomBuilding = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: editedName.trim() || result.attributes.suggestedName,
      description: result.prompt,
      category: result.attributes.category,
      size: result.attributes.size as 1 | 2 | 3 | 4,
      spriteUrl: result.imageUrl,
      stats: {
        maxPop: result.attributes.maxPop,
        maxJobs: result.attributes.maxJobs,
        pollution: result.attributes.pollution,
        landValue: result.attributes.landValue,
      },
      cost: result.attributes.suggestedCost,
      createdAt: Date.now(),
    };

    onBuildingCreated(building);
    
    // Reset state for next creation
    setPrompt('');
    setEditedName('');
    reset();
    onOpenChange(false);
  }, [result, editedName, onBuildingCreated, reset, onOpenChange]);

  // Handle starting over
  const handleStartOver = useCallback(() => {
    reset();
    setEditedName('');
  }, [reset]);

  // Handle dialog close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Only reset if not currently generating
      // This allows the user to close the modal and reopen to see progress
      if (step !== 'generating') {
        reset();
        setPrompt('');
        setEditedName('');
      }
    }
    onOpenChange(newOpen);
  }, [onOpenChange, reset, step]);

  // Update edited name when result changes
  React.useEffect(() => {
    if (result?.attributes.suggestedName) {
      setEditedName(result.attributes.suggestedName);
    }
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            Create Custom Building
            <svg 
              className="w-5 h-5 text-purple-400" 
              viewBox="0 0 624 624" 
              fill="currentColor" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M402.365 0C413.17 0.000231771 421.824 8.79229 422.858 19.5596C432.087 115.528 508.461 191.904 604.442 201.124C615.198 202.161 624 210.821 624 221.638V402.362C624 413.179 615.198 421.839 604.442 422.876C508.461 432.096 432.087 508.472 422.858 604.44C421.824 615.208 413.17 624 402.365 624H221.635C210.83 624 202.176 615.208 201.142 604.44C191.913 508.472 115.538 432.096 19.5576 422.876C8.80183 421.839 0 413.179 0 402.362V221.638C0 210.821 8.80183 202.161 19.5576 201.124C115.538 191.904 191.913 115.528 201.142 19.5596C202.176 8.79215 210.83 0 221.635 0H402.365ZM312 124C208.17 124 124 208.17 124 312C124 415.83 208.17 500 312 500C415.83 500 500 415.83 500 312C500 208.17 415.83 124 312 124Z"/>
            </svg>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Describe a building and <span className="text-purple-400 font-medium">fal.ai</span> will generate it for your city.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Input Step */}
          {(step === 'idle' || step === 'error') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="building-prompt" className="text-sm text-slate-300">
                  Describe your building
                </Label>
                <Input
                  id="building-prompt"
                  placeholder="e.g., A Victorian-style library with ivy-covered walls"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  autoComplete="off"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUseExample}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  Try a random example
                </Button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="w-full btn-generate text-white border-none"
              >
                Generate Building
              </Button>
            </>
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="relative">
                <svg 
                  className="fal-logo-spinner" 
                  viewBox="0 0 624 624" 
                  fill="currentColor" 
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '64px', height: '64px' }}
                >
                  <path fillRule="evenodd" clipRule="evenodd" d="M402.365 0C413.17 0.000231771 421.824 8.79229 422.858 19.5596C432.087 115.528 508.461 191.904 604.442 201.124C615.198 202.161 624 210.821 624 221.638V402.362C624 413.179 615.198 421.839 604.442 422.876C508.461 432.096 432.087 508.472 422.858 604.44C421.824 615.208 413.17 624 402.365 624H221.635C210.83 624 202.176 615.208 201.142 604.44C191.913 508.472 115.538 432.096 19.5576 422.876C8.80183 421.839 0 413.179 0 402.362V221.638C0 210.821 8.80183 202.161 19.5576 201.124C115.538 191.904 191.913 115.528 201.142 19.5596C202.176 8.79215 210.83 0 221.635 0H402.365ZM312 124C208.17 124 124 208.17 124 312C124 415.83 208.17 500 312 500C415.83 500 500 415.83 500 312C500 208.17 415.83 124 312 124Z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Generating your building...</p>
                <p className="text-sm text-slate-400 mt-1">This may take 10-30 seconds</p>
              </div>
            </div>
          )}

          {/* Preview/Complete Step */}
          {step === 'complete' && result && (
            <>
              <div className="flex gap-4">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                  <img 
                    src={result.imageUrl} 
                    alt="Generated building"
                    className="w-36 h-36 rounded-xl border-2 border-slate-600 object-cover shadow-lg"
                  />
                </div>

                {/* Name and Category */}
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="building-name" className="text-xs text-slate-400">Building Name</Label>
                    <Input
                      id="building-name"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Category</span>
                    <p className={`font-medium ${CATEGORY_INFO[result.attributes.category].color}`}>
                      {CATEGORY_INFO[result.attributes.category].label}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Size</span>
                    <p className="font-medium">{result.attributes.size}x{result.attributes.size} tiles</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-700" />

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 text-xs">Cost</span>
                  <p className="font-bold text-green-400">${result.attributes.suggestedCost.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 text-xs">Population</span>
                  <p className="font-bold text-blue-400">{result.attributes.maxPop}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 text-xs">Jobs</span>
                  <p className="font-bold text-yellow-400">{result.attributes.maxJobs}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <span className="text-slate-400 text-xs">Pollution</span>
                  <p className={`font-bold ${result.attributes.pollution < 0 ? 'text-green-400' : result.attributes.pollution > 10 ? 'text-red-400' : 'text-slate-300'}`}>
                    {result.attributes.pollution > 0 ? '+' : ''}{result.attributes.pollution}
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 col-span-2">
                  <span className="text-slate-400 text-xs">Land Value Effect</span>
                  <p className={`font-bold ${result.attributes.landValue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.attributes.landValue > 0 ? '+' : ''}{result.attributes.landValue}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleStartOver}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 bg-green-600 hover:bg-green-500"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add to City
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
