'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadImage } from '@/components/game/imageLoader';

// Preload custom building sprite images
// Note: Background removal is now done server-side by fal.ai
function preloadCustomBuildingImages(buildings: CustomBuilding[]): void {
  buildings.forEach((building) => {
    if (building.spriteUrl) {
      loadImage(building.spriteUrl).catch((err) => {
        console.warn(`Failed to preload custom building sprite: ${building.name}`, err);
      });
    }
  });
}

// Custom building type
export interface CustomBuilding {
  id: string;
  name: string;
  description: string;
  category: 'residential' | 'commercial' | 'industrial' | 'service' | 'recreation';
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

// Context value type
interface CustomBuildingsContextValue {
  customBuildings: CustomBuilding[];
  selectedCustomBuildingId: string | null;
  isCustomBuildingMode: boolean;
  addCustomBuilding: (building: CustomBuilding) => void;
  removeCustomBuilding: (id: string) => void;
  selectCustomBuilding: (id: string | null) => void;
  getCustomBuilding: (id: string) => CustomBuilding | undefined;
  clearSelection: () => void;
}

// Storage key for localStorage
const STORAGE_KEY = 'isocity-custom-buildings';

// Create context
const CustomBuildingsContext = createContext<CustomBuildingsContextValue | null>(null);

// Validate a custom building has required fields to prevent NaN/undefined errors
function isValidCustomBuilding(b: unknown): b is CustomBuilding {
  if (!b || typeof b !== 'object') return false;
  const obj = b as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.spriteUrl === 'string' &&
    typeof obj.size === 'number' && obj.size >= 1 && obj.size <= 4 &&
    typeof obj.cost === 'number' &&
    typeof obj.stats === 'object' && obj.stats !== null
  );
}

// Load custom buildings from localStorage
function loadCustomBuildings(): CustomBuilding[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Filter out any corrupted/invalid entries
        return parsed.filter(isValidCustomBuilding);
      }
    }
  } catch (e) {
    console.error('Failed to load custom buildings:', e);
  }
  return [];
}

// Save custom buildings to localStorage
function saveCustomBuildings(buildings: CustomBuilding[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildings));
  } catch (e) {
    console.error('Failed to save custom buildings:', e);
  }
}

// Provider component
export function CustomBuildingsProvider({ children }: { children: React.ReactNode }) {
  const [customBuildings, setCustomBuildings] = useState<CustomBuilding[]>([]);
  const [selectedCustomBuildingId, setSelectedCustomBuildingId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Load from localStorage on mount and preload sprite images
  useEffect(() => {
    if (!hasLoadedRef.current) {
      const loaded = loadCustomBuildings();
      setCustomBuildings(loaded);
      hasLoadedRef.current = true;
      
      // Preload sprite images for faster rendering
      if (loaded.length > 0) {
        preloadCustomBuildingImages(loaded);
      }
    }
  }, []);

  // Save to localStorage when buildings change
  useEffect(() => {
    if (hasLoadedRef.current) {
      saveCustomBuildings(customBuildings);
    }
  }, [customBuildings]);

  // Add a new custom building
  const addCustomBuilding = useCallback((building: CustomBuilding) => {
    // Preload the sprite image (background already removed by fal.ai)
    if (building.spriteUrl) {
      loadImage(building.spriteUrl).catch((err) => {
        console.warn(`Failed to preload sprite for ${building.name}:`, err);
      });
    }
    
    setCustomBuildings((prev) => {
      // Check if ID already exists
      const existingIndex = prev.findIndex((b) => b.id === building.id);
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIndex] = building;
        return updated;
      }
      // Add new
      return [...prev, building];
    });
  }, []);

  // Remove a custom building
  const removeCustomBuilding = useCallback((id: string) => {
    setCustomBuildings((prev) => prev.filter((b) => b.id !== id));
    // Clear selection if we're removing the selected building
    setSelectedCustomBuildingId((prev) => (prev === id ? null : prev));
  }, []);

  // Select a custom building for placement
  const selectCustomBuilding = useCallback((id: string | null) => {
    setSelectedCustomBuildingId(id);
  }, []);

  // Get a custom building by ID
  const getCustomBuilding = useCallback((id: string) => {
    return customBuildings.find((b) => b.id === id);
  }, [customBuildings]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedCustomBuildingId(null);
  }, []);

  // Computed: is a custom building currently selected?
  const isCustomBuildingMode = selectedCustomBuildingId !== null;

  const value: CustomBuildingsContextValue = {
    customBuildings,
    selectedCustomBuildingId,
    isCustomBuildingMode,
    addCustomBuilding,
    removeCustomBuilding,
    selectCustomBuilding,
    getCustomBuilding,
    clearSelection,
  };

  return (
    <CustomBuildingsContext.Provider value={value}>
      {children}
    </CustomBuildingsContext.Provider>
  );
}

// Hook to use custom buildings context
export function useCustomBuildings() {
  const ctx = useContext(CustomBuildingsContext);
  if (!ctx) {
    throw new Error('useCustomBuildings must be used within a CustomBuildingsProvider');
  }
  return ctx;
}

// Optional hook that returns null if not in provider (for optional usage)
export function useCustomBuildingsOptional() {
  return useContext(CustomBuildingsContext);
}
