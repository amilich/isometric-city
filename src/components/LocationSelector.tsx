'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Location {
  name: string;
  lat: number;
  lng: number;
}

const PRESET_LOCATIONS: Location[] = [
  { name: 'New York', lat: 40.7, lng: -74.0 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'London', lat: 51.5, lng: -0.1 },
  { name: 'Dublin', lat: 53.3498, lng: -6.2603 },
  { name: 'Tokyo', lat: 35.7, lng: 139.8 },
  { name: 'Sydney', lat: -33.9, lng: 151.2 },
];

interface LocationSelectorProps {
  onSelectLocation: (lat: number, lng: number) => void;
  onStartRandom: () => void;
  isMobile?: boolean;
  disabled?: boolean;
  busyLabel?: string;
}

export function LocationSelector({
  onSelectLocation,
  onStartRandom,
  isMobile = false,
  disabled = false,
  busyLabel,
}: LocationSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');

  const handleCustomLocation = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid latitude and longitude');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      alert('Latitude must be between -90 and 90');
      return;
    }
    
    if (lng < -180 || lng > 180) {
      alert('Longitude must be between -180 and 180');
      return;
    }
    
    onSelectLocation(lat, lng);
  };

  const buttonClass = isMobile
    ? 'w-full py-4 text-lg font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300'
    : 'w-64 py-6 text-xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300';

  const presetButtonClass = isMobile
    ? 'w-full py-3 text-sm font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300'
    : 'w-64 py-4 text-base font-light tracking-wide bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none transition-all duration-300';

  return (
    <div className="flex flex-col gap-3">
      <Button 
        onClick={onStartRandom}
        className={buttonClass}
        disabled={disabled}
      >
        {disabled ? (busyLabel ?? 'Starting…') : 'Start Random City'}
      </Button>
      
      <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1 mt-2">
        Start on Earth
      </div>
      
      {PRESET_LOCATIONS.map((location) => (
        <Button
          key={location.name}
          onClick={() => onSelectLocation(location.lat, location.lng)}
          variant="outline"
          className={presetButtonClass}
          disabled={disabled}
        >
          Start in {location.name}
        </Button>
      ))}
      
      {!showCustom ? (
        <Button
          onClick={() => setShowCustom(true)}
          variant="outline"
          className={presetButtonClass}
          disabled={disabled}
        >
          Custom Location
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            type="number"
            placeholder="Latitude (-90 to 90)"
            value={customLat}
            onChange={(e) => setCustomLat(e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/40 rounded-none"
            step="any"
            disabled={disabled}
          />
          <Input
            type="number"
            placeholder="Longitude (-180 to 180)"
            value={customLng}
            onChange={(e) => setCustomLng(e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/40 rounded-none"
            step="any"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleCustomLocation}
              variant="outline"
              className="flex-1 py-2 text-sm font-light bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
              disabled={disabled}
            >
              Start
            </Button>
            <Button
              onClick={() => {
                setShowCustom(false);
                setCustomLat('');
                setCustomLng('');
              }}
              variant="outline"
              className="flex-1 py-2 text-sm font-light bg-white/5 hover:bg-white/15 text-white/60 hover:text-white border border-white/15 rounded-none"
              disabled={disabled}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

