'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import TowerGame from '@/components/tower/Game';
import { TowerProvider } from '@/context/TowerContext';
import { T, Var, Num, useGT } from 'gt-next';
import {
  deleteTowerStateFromStorage,
  loadTowerStateFromStorage,
  readSavedRunsIndex,
  removeSavedRunMeta,
  TOWER_AUTOSAVE_KEY,
  TOWER_SAVED_RUN_PREFIX,
  writeSavedRunsIndex,
} from '@/games/tower/saveUtils';
import { decompressFromUTF16, compressToUTF16 } from 'lz-string';
import { createTowerExampleState } from '@/games/tower/lib/exampleState';

// Background color to filter from sprite sheets (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt((r - BACKGROUND_COLOR.r) ** 2 + (g - BACKGROUND_COLOR.g) ** 2 + (b - BACKGROUND_COLOR.b) ** 2);
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function hasAutosave(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(TOWER_AUTOSAVE_KEY);
    if (!saved) return false;
    let jsonString = decompressFromUTF16(saved);
    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) jsonString = saved;
      else return false;
    }
    const parsed = JSON.parse(jsonString);
    return Boolean(parsed?.grid && parsed?.gridSize);
  } catch {
    return false;
  }
}

function shuffleArray<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SpriteGallery({ count = 15, cols = 3, cellSize = 96 }: { count?: number; cols?: number; cellSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sheets, setSheets] = useState<Map<string, HTMLCanvasElement>>(new Map());

  // Load tower + enemy sheets for the gallery.
  useEffect(() => {
    const load = async () => {
      const results = await Promise.all(
        [
          { id: 'towers', src: '/assets/tower/towers.webp' },
          { id: 'enemies', src: '/assets/tower/enemies.webp' },
        ].map(
          (sheet) =>
            new Promise<{ id: string; canvas: HTMLCanvasElement } | null>((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ id: sheet.id, canvas: filterBackgroundColor(img) });
              img.onerror = () => resolve(null);
              img.src = sheet.src;
            })
        )
      );
      const map = new Map<string, HTMLCanvasElement>();
      for (const r of results) {
        if (r) map.set(r.id, r.canvas);
      }
      setSheets(map);
    };
    load();
  }, []);

  const picks = useMemo(() => {
    const cols = 5;
    const rows = 6;
    const cells: { sheetId: 'towers' | 'enemies'; row: number; col: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ sheetId: 'towers', row: r, col: c });
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ sheetId: 'enemies', row: r, col: c });
    return shuffleArray(cells).slice(0, count);
  }, [count]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const towers = sheets.get('towers');
    const enemies = sheets.get('enemies');
    if (!canvas || !towers || !enemies) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rows = Math.ceil(picks.length / cols);
    const pad = 10;

    const w = cols * cellSize;
    const h = rows * cellSize;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    picks.forEach((p, i) => {
      const cx = (i % cols) * cellSize;
      const cy = Math.floor(i / cols) * cellSize;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.fillRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);
      ctx.strokeRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);

      const srcCanvas = p.sheetId === 'towers' ? towers : enemies;
      const cellW = srcCanvas.width / 5;
      const cellH = srcCanvas.height / 6;
      const sx = p.col * cellW;
      const sy = p.row * cellH;
      const maxSize = cellSize - pad * 2;
      const aspect = cellH / cellW;
      let dw = maxSize;
      let dh = dw * aspect;
      if (dh > maxSize) {
        dh = maxSize;
        dw = dh / aspect;
      }

      const dx = cx + (cellSize - dw) / 2;
      const dy = cy + (cellSize - dh) / 2 + dh * 0.1;
      ctx.drawImage(srcCanvas, sx, sy, cellW, cellH, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    });
  }, [sheets, picks, cols, cellSize]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} className="opacity-80 hover:opacity-100 transition-opacity" />;
}

export default function TowerPage() {
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const [startFresh, setStartFresh] = useState(false);
  const [loadRunId, setLoadRunId] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState(() => [] as ReturnType<typeof readSavedRunsIndex>);

  useEffect(() => {
    const check = () => {
      setSavedRuns(readSavedRunsIndex());
      setHasSaved(hasAutosave());
      setIsChecking(false);
    };
    requestAnimationFrame(check);
  }, []);

  const handleExitGame = () => {
    setShowGame(false);
    setStartFresh(false);
    setLoadRunId(null);
    setSavedRuns(readSavedRunsIndex());
    setHasSaved(hasAutosave());
    window.history.replaceState({}, '', '/tower');
  };

  const deleteRun = (id: string) => {
    deleteTowerStateFromStorage(`${TOWER_SAVED_RUN_PREFIX}${id}`);
    const autosave = loadTowerStateFromStorage(TOWER_AUTOSAVE_KEY);
    if (autosave?.id === id) {
      deleteTowerStateFromStorage(TOWER_AUTOSAVE_KEY);
    }
    const updated = removeSavedRunMeta(id, savedRuns);
    writeSavedRunsIndex(updated);
    setSavedRuns(updated);
    setHasSaved(hasAutosave());
  };

  const gt = useGT();

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <T><div className="text-white/60">Loading...</div></T>
      </main>
    );
  }

  if (showGame) {
    return (
      <TowerProvider startFresh={startFresh} loadRunId={loadRunId}>
        <main className="h-screen w-screen overflow-hidden">
          <TowerGame onExit={handleExitGame} />
        </main>
      </TowerProvider>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-6 sm:p-8">
      <div className="max-w-7xl w-full grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="flex flex-col items-center lg:items-start justify-center space-y-8 lg:space-y-12">
          <T>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-wider text-white/90">
              IsoTower Defense
            </h1>
          </T>

          <div className="flex flex-col gap-3 w-full max-w-72">
            <Button
              onClick={() => {
                setStartFresh(!hasSaved);
                setLoadRunId(null);
                setShowGame(true);
              }}
              className="w-full py-7 text-xl sm:text-2xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
            >
              {hasSaved ? gt('Continue') : gt('New Run')}
            </Button>

            {hasSaved && (
              <Button
                onClick={() => {
                  setStartFresh(true);
                  setLoadRunId(null);
                  setShowGame(true);
                }}
                variant="outline"
                className="w-full py-7 text-xl sm:text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/60 hover:text-white border border-white/20 rounded-none transition-all duration-300"
              >
                <T>New Run</T>
              </Button>
            )}

            <Button
              onClick={() => {
                try {
                  const example = createTowerExampleState();
                  localStorage.setItem(TOWER_AUTOSAVE_KEY, compressToUTF16(JSON.stringify(example)));
                  setStartFresh(false);
                  setLoadRunId(null);
                  setShowGame(true);
                } catch (e) {
                  console.error('Failed to load example state:', e);
                }
              }}
              variant="outline"
              className="w-full py-7 text-xl sm:text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/40 hover:text-white/60 border border-white/10 rounded-none transition-all duration-300"
            >
              <T>Load Example</T>
            </Button>

            <T>
              <a href="/" className="w-full text-center py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200">
                Back to IsoCity
              </a>
            </T>
            <T>
              <a href="/coaster" className="w-full text-center py-2 text-sm font-light tracking-wide text-white/40 hover:text-white/70 transition-colors duration-200">
                Back to IsoCoaster
              </a>
            </T>
          </div>

          {savedRuns.length > 0 && (
            <div className="w-full max-w-72">
              <T><h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Saved Runs</h2></T>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {savedRuns.slice(0, 8).map((run) => (
                  <div key={run.id} className="relative group">
                    <button
                      onClick={() => {
                        setStartFresh(false);
                        setLoadRunId(run.id);
                        setShowGame(true);
                      }}
                      className="w-full text-left p-3 pr-10 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-none transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium truncate group-hover:text-white/90 text-sm flex-1">{run.name}</h3>
                        <T><span className="text-xs px-1.5 py-0.5 bg-indigo-500/20 text-indigo-200 rounded shrink-0">W<Var>{run.wave}</Var></span></T>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                        <span>$<Num>{run.money}</Num></span>
                        <T><span>♥ <Var>{run.lives}</Var></span></T>
                        <span>{run.gridSize}×{run.gridSize}</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRun(run.id);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 right-1.5 p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all duration-200"
                      title={gt('Remove from list')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center lg:justify-end">
          <SpriteGallery />
        </div>
      </div>
    </main>
  );
}

