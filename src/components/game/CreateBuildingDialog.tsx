'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
import { BuildingCategory, CustomBuilding } from '@/types/game';
import { generateBuildingSprite, editBuildingSprite, loadReferenceSprites, MAX_CUSTOM_BUILDINGS } from '@/lib/customBuildings';
import { hasGeminiApiKey } from '@/lib/gemini';

// Constants
const MAX_BUILDING_NAME_LENGTH = 20;

const CATEGORIES: { value: BuildingCategory; label: string }[] = [
  { value: 'recreation', label: 'Recreation' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
];

// BuildingForm subcomponent - handles initial form input
interface BuildingFormProps {
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  size: 1 | 2;
  setSize: (size: 1 | 2) => void;
  category: BuildingCategory;
  setCategory: (category: BuildingCategory) => void;
  isGenerating: boolean;
  progressText: string;
  error: string | null;
  hasApiKey: boolean;
  onGenerate: () => void;
}

function BuildingForm({
  name,
  setName,
  description,
  setDescription,
  size,
  setSize,
  category,
  setCategory,
  isGenerating,
  progressText,
  error,
  hasApiKey,
  onGenerate,
}: BuildingFormProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          Create Custom Building
          <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Experimental</span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-sm text-yellow-200">
            Gemini API key required. Configure it in Settings.
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Building Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Crystal Tower"
            maxLength={MAX_BUILDING_NAME_LENGTH}
            disabled={isGenerating}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Prompt</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="futuristic glass skyscraper with solar panels"
            disabled={isGenerating}
          />
        </div>

        {/* Size */}
        <div className="space-y-2">
          <Label>Size</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={size === 1 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSize(1)}
              disabled={isGenerating}
            >
              1x1
            </Button>
            <Button
              type="button"
              variant={size === 2 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSize(2)}
              disabled={isGenerating}
            >
              2x2
            </Button>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                type="button"
                variant={category === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategory(cat.value)}
                disabled={isGenerating}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        {/* Generate Button */}
        <Button
          className="w-full"
          onClick={onGenerate}
          disabled={isGenerating || !hasApiKey || !name.trim() || !description.trim()}
        >
          {isGenerating ? progressText || 'Generating...' : 'Generate Building'}
        </Button>
      </div>
    </>
  );
}

// BuildingPreview subcomponent - handles preview and modification
interface BuildingPreviewProps {
  name: string;
  previewImage: string;
  modifications: string;
  setModifications: (modifications: string) => void;
  isGenerating: boolean;
  progressText: string;
  error: string | null;
  onStartOver: () => void;
  onModify: () => void;
  onAccept: () => void;
}

function BuildingPreview({
  name,
  previewImage,
  modifications,
  setModifications,
  isGenerating,
  progressText,
  error,
  onStartOver,
  onModify,
  onAccept,
}: BuildingPreviewProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          Preview: {name}
          <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Experimental</span>
        </DialogTitle>
        <DialogDescription>
          Review your building or request modifications
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Preview Image */}
        <div className="flex justify-center p-4 bg-muted/50 rounded-lg">
          <img
            src={previewImage}
            alt="Building preview"
            className="max-h-48 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Modifications Input */}
        <div className="space-y-2">
          <Label htmlFor="modifications">Request Changes (optional)</Label>
          <Input
            id="modifications"
            value={modifications}
            onChange={(e) => setModifications(e.target.value)}
            placeholder="make it taller, add more windows..."
            disabled={isGenerating}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        {/* Progress */}
        {isGenerating && progressText && (
          <div className="text-sm text-muted-foreground text-center">{progressText}</div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onStartOver}
            disabled={isGenerating}
          >
            Start Over
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onModify}
            disabled={isGenerating || !modifications.trim()}
          >
            {isGenerating ? 'Modifying...' : 'Modify'}
          </Button>
          <Button
            className="flex-1"
            onClick={onAccept}
            disabled={isGenerating}
          >
            Accept
          </Button>
        </div>
      </div>
    </>
  );
}

// Main component - orchestrates state and renders appropriate subcomponent
interface CreateBuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuildingCreated: (building: CustomBuilding) => boolean;
  customBuildingCount: number;
}

export function CreateBuildingDialog({
  open,
  onOpenChange,
  onBuildingCreated,
  customBuildingCount,
}: CreateBuildingDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState<1 | 2>(1);
  const [category, setCategory] = useState<BuildingCategory>('recreation');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [modifications, setModifications] = useState('');

  // Check if API key is configured
  useEffect(() => {
    setHasApiKey(hasGeminiApiKey());
  }, [open]);

  // Reset to form view
  const handleStartOver = useCallback(() => {
    setPreviewImage(null);
    setModifications('');
    setError(null);
  }, []);

  // Generate initial sprite
  const handleGenerate = useCallback(async () => {
    if (!name.trim() || !description.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (customBuildingCount >= MAX_CUSTOM_BUILDINGS) {
      setError(`Maximum ${MAX_CUSTOM_BUILDINGS} custom buildings allowed. Delete some to create more.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressText('Loading reference sprites...');

    try {
      const referenceImages = await loadReferenceSprites();
      const imageDataUrl = await generateBuildingSprite(
        description,
        size,
        referenceImages,
        setProgressText
      );
      setPreviewImage(imageDataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
      setProgressText('');
    }
  }, [name, description, size, customBuildingCount]);

  // Apply modifications to current image
  const handleModify = useCallback(async () => {
    if (!previewImage || !modifications.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const base64 = previewImage.split(',')[1];
      const newImageDataUrl = await editBuildingSprite(
        base64,
        modifications,
        setProgressText
      );
      setPreviewImage(newImageDataUrl);
      setModifications('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification failed');
    } finally {
      setIsGenerating(false);
      setProgressText('');
    }
  }, [previewImage, modifications]);

  // Accept and save the building
  const handleAccept = useCallback(() => {
    if (!previewImage) return;

    const building: CustomBuilding = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      imageDataUrl: previewImage,
      size,
      category,
      createdAt: Date.now(),
    };

    const success = onBuildingCreated(building);
    if (!success) {
      setError('Failed to save building. Storage may be full - try removing some custom buildings.');
      return;
    }

    // Reset and close
    setName('');
    setDescription('');
    setSize(1);
    setCategory('recreation');
    setPreviewImage(null);
    setModifications('');
    onOpenChange(false);
  }, [previewImage, name, description, size, category, onBuildingCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {previewImage ? (
          <BuildingPreview
            name={name}
            previewImage={previewImage}
            modifications={modifications}
            setModifications={setModifications}
            isGenerating={isGenerating}
            progressText={progressText}
            error={error}
            onStartOver={handleStartOver}
            onModify={handleModify}
            onAccept={handleAccept}
          />
        ) : (
          <BuildingForm
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            size={size}
            setSize={setSize}
            category={category}
            setCategory={setCategory}
            isGenerating={isGenerating}
            progressText={progressText}
            error={error}
            hasApiKey={hasApiKey}
            onGenerate={handleGenerate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
