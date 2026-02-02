'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Sprite sheet configuration matching the original game
const SPRITE_SHEETS = [
  { id: 'trees', src: '/assets/coaster/trees.webp', cols: 6, rows: 6 },
  { id: 'food', src: '/assets/coaster/food.webp', cols: 5, rows: 6 },
  { id: 'stations', src: '/assets/coaster/stations.webp', cols: 5, rows: 6 },
  { id: 'shops', src: '/assets/coaster/shops.webp', cols: 5, rows: 6 },
  { id: 'fountains', src: '/assets/coaster/fountains.webp', cols: 5, rows: 6 },
  { id: 'rides_small', src: '/assets/coaster/rides_small.webp', cols: 5, rows: 6 },
  { id: 'rides_large', src: '/assets/coaster/rides_large.webp', cols: 5, rows: 6 },
  { id: 'path_furniture', src: '/assets/coaster/path_furniture.webp', cols: 5, rows: 6 },
  { id: 'queue_elements', src: '/assets/coaster/queue_elements.webp', cols: 5, rows: 6 },
  { id: 'theme_classic', src: '/assets/coaster/theme_classic.webp', cols: 5, rows: 6 },
  { id: 'theme_modern', src: '/assets/coaster/theme_modern.webp', cols: 5, rows: 6 },
  { id: 'infrastructure', src: '/assets/coaster/infrastructure.webp', cols: 5, rows: 6 },
];

// Tool categories for the sidebar
const TOOL_CATEGORIES = [
  {
    name: 'Basic',
    tools: [
      { id: 'select', name: 'Select', icon: '👆' },
      { id: 'bulldoze', name: 'Bulldoze', icon: '🚜' },
      { id: 'path', name: 'Path', icon: '🛤️' },
      { id: 'queue', name: 'Queue', icon: '🚧' },
    ],
  },
  {
    name: 'Trees',
    tools: [
      { id: 'tree_oak', name: 'Oak Tree', icon: '🌳' },
      { id: 'tree_maple', name: 'Maple Tree', icon: '🍁' },
      { id: 'tree_pine', name: 'Pine Tree', icon: '🌲' },
      { id: 'tree_palm', name: 'Palm Tree', icon: '🌴' },
      { id: 'tree_cherry', name: 'Cherry Tree', icon: '🌸' },
      { id: 'bush_hedge', name: 'Hedge', icon: '🌿' },
      { id: 'flowers_bed', name: 'Flowers', icon: '🌸' },
    ],
  },
  {
    name: 'Furniture',
    tools: [
      { id: 'bench_wooden', name: 'Bench', icon: '🪑' },
      { id: 'bench_metal', name: 'Metal Bench', icon: '🪑' },
      { id: 'lamp_victorian', name: 'Lamp', icon: '💡' },
      { id: 'lamp_modern', name: 'Modern Lamp', icon: '💡' },
      { id: 'trash_can_basic', name: 'Trash Can', icon: '🗑️' },
      { id: 'trash_can_fancy', name: 'Fancy Bin', icon: '🗑️' },
    ],
  },
  {
    name: 'Food',
    tools: [
      { id: 'food_hotdog', name: 'Hot Dogs', icon: '🌭' },
      { id: 'food_burger', name: 'Burgers', icon: '🍔' },
      { id: 'food_icecream', name: 'Ice Cream', icon: '🍦' },
      { id: 'drink_soda', name: 'Drinks', icon: '🥤' },
      { id: 'snack_popcorn', name: 'Popcorn', icon: '🍿' },
    ],
  },
  {
    name: 'Shops',
    tools: [
      { id: 'shop_souvenir', name: 'Souvenirs', icon: '🎁' },
      { id: 'shop_toys', name: 'Toys', icon: '🧸' },
      { id: 'restroom', name: 'Restroom', icon: '🚻' },
      { id: 'first_aid', name: 'First Aid', icon: '🏥' },
    ],
  },
  {
    name: 'Rides',
    tools: [
      { id: 'ride_carousel', name: 'Carousel', icon: '🎠' },
      { id: 'ride_teacups', name: 'Teacups', icon: '☕' },
      { id: 'ride_ferris_classic', name: 'Ferris Wheel', icon: '🎡' },
      { id: 'ride_bumper_cars', name: 'Bumper Cars', icon: '🚗' },
      { id: 'ride_drop_tower', name: 'Drop Tower', icon: '🗼' },
      { id: 'ride_log_flume', name: 'Log Flume', icon: '🛶' },
    ],
  },
  {
    name: 'Fountains',
    tools: [
      { id: 'fountain_small_1', name: 'Small Fountain', icon: '⛲' },
      { id: 'fountain_medium_1', name: 'Medium Fountain', icon: '💧' },
      { id: 'fountain_large_1', name: 'Large Fountain', icon: '⛲' },
      { id: 'pond_small', name: 'Pond', icon: '🐟' },
    ],
  },
  {
    name: 'Coaster',
    tools: [
      { id: 'coaster_station', name: 'Station', icon: '🚉' },
      { id: 'coaster_track_straight', name: 'Straight Track', icon: '➖' },
      { id: 'coaster_track_turn_left', name: 'Turn Left', icon: '↩️' },
      { id: 'coaster_track_turn_right', name: 'Turn Right', icon: '↪️' },
      { id: 'coaster_track_slope_up', name: 'Slope Up', icon: '⬆️' },
      { id: 'coaster_track_slope_down', name: 'Slope Down', icon: '⬇️' },
    ],
  },
];

export default function CoasterWasmPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing WASM...');
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState({ cash: 50000, guests: 0, rating: 500, time: 'Year 1, Mar 1, 09:00' });
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Basic');

  // Load sprite image
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }, []);

  // Initialize game
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoadingMessage('Loading WASM module...');
        
        // Dynamic import of WASM module
        const wasm = await import('../../../wasm/pkg/isocoaster_wasm');
        await wasm.default();
        
        if (!mounted) return;
        
        setLoadingMessage('Creating game...');
        
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas not found');
        }
        
        // Set canvas size
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth - 240;
        const height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // Create game instance
        const game = new wasm.Game(canvas, 50, dpr); // 50x50 grid
        gameRef.current = game;
        
        // Load sprite sheets
        setLoadingMessage('Loading sprites...');
        
        for (const sheet of SPRITE_SHEETS) {
          try {
            const img = await loadImage(sheet.src);
            game.load_sprite_sheet(sheet.id, img, sheet.cols, sheet.rows);
          } catch (e) {
            console.warn(`Failed to load sprite sheet ${sheet.id}:`, e);
          }
        }
        
        // Load water texture
        try {
          const waterImg = await loadImage('/assets/water.png');
          game.load_water_texture(waterImg);
        } catch (e) {
          console.warn('Failed to load water texture:', e);
        }
        
        if (!mounted) return;
        
        setLoadingMessage('Starting game loop...');
        
        // Start game loop
        let lastTick = performance.now();
        const tickInterval = 50; // 50ms per tick at normal speed
        
        function gameLoop(time: number) {
          if (!mounted || !gameRef.current) return;
          
          const game = gameRef.current;
          
          // Tick based on speed
          const currentSpeed = game.get_speed();
          if (currentSpeed > 0) {
            const interval = tickInterval / currentSpeed;
            if (time - lastTick >= interval) {
              game.tick();
              lastTick = time;
            }
          }
          
          // Always render
          try {
            game.render();
          } catch (e) {
            console.error('Render error:', e);
          }
          
          // Update stats every 500ms
          if (Math.floor(time / 500) !== Math.floor((time - 16) / 500)) {
            setStats({
              cash: game.get_cash(),
              guests: game.get_guest_count(),
              rating: game.get_park_rating(),
              time: game.get_time_string(),
            });
            setSpeed(game.get_speed());
          }
          
          animationRef.current = requestAnimationFrame(gameLoop);
        }
        
        animationRef.current = requestAnimationFrame(gameLoop);
        setLoading(false);
        
      } catch (e) {
        console.error('Init error:', e);
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [loadImage]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && gameRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth - 240;
        const height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        gameRef.current.resize(width, height, dpr);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_mouse_down(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_mouse_move(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_mouse_up(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (gameRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        gameRef.current.handle_wheel(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  // Handle tool selection
  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    if (gameRef.current) {
      gameRef.current.set_tool(toolId);
    }
  };

  // Handle speed change
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (gameRef.current) {
      gameRef.current.set_speed(newSpeed);
    }
  };

  if (error) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-red-950 via-red-900 to-red-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl text-white mb-4">Error Loading Game</h1>
          <p className="text-red-300 mb-8">{error}</p>
          <a href="/coaster" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded">
            Go to Regular Version
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 flex">
      {/* Sidebar */}
      <div className="w-60 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white">IsoCoaster</h1>
          <p className="text-xs text-slate-400">WebAssembly Edition</p>
        </div>

        {/* Stats */}
        <div className="p-4 border-b border-slate-700 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Cash:</span>
            <span className="text-green-400">${stats.cash.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Guests:</span>
            <span className="text-blue-400">{stats.guests}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Rating:</span>
            <span className="text-yellow-400">{stats.rating}</span>
          </div>
          <div className="text-xs text-slate-500 text-center pt-1">
            {stats.time}
          </div>
        </div>

        {/* Speed controls */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`flex-1 py-1 text-sm rounded ${
                  speed === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {s === 0 ? '⏸' : '▶'.repeat(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="flex-1 overflow-y-auto">
          {TOOL_CATEGORIES.map(category => (
            <div key={category.name} className="border-b border-slate-700">
              <button
                onClick={() => setExpandedCategory(
                  expandedCategory === category.name ? null : category.name
                )}
                className="w-full p-3 flex justify-between items-center text-sm text-slate-300 hover:bg-slate-700"
              >
                <span>{category.name}</span>
                <span className="text-slate-500">
                  {expandedCategory === category.name ? '▼' : '▶'}
                </span>
              </button>
              
              {expandedCategory === category.name && (
                <div className="pb-2 px-2">
                  {category.tools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolSelect(tool.id)}
                      className={`w-full p-2 text-left text-sm rounded flex items-center gap-2 ${
                        selectedTool === tool.id
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{tool.icon}</span>
                      <span>{tool.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <a
            href="/coaster"
            className="block text-center text-sm text-slate-400 hover:text-white"
          >
            ← Back to Regular Version
          </a>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex flex-col items-center justify-center z-50">
            <h1 className="text-4xl font-light text-white mb-8">IsoCoaster WASM</h1>
            <div className="text-white/60 mb-4">{loadingMessage}</div>
            <div className="w-64 h-2 bg-white/10 rounded overflow-hidden">
              <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="block"
          style={{ cursor: selectedTool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>
    </div>
  );
}
