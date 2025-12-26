import { renderHook } from '@testing-library/react';
import { useGameKeyboard } from '../useGameKeyboard';
import { Tool } from '@/types/game';

// Mock dependencies
const mockSetOverlayMode = vi.fn();
const mockSetSelectedTile = vi.fn();
const mockSetActivePanel = vi.fn();
const mockSetTool = vi.fn();
const mockSetSpeed = vi.fn();

// Mock GameContext
let mockState = {
  activePanel: 'none',
  selectedTool: 'select' as Tool,
  speed: 1,
};

vi.mock('@/context/GameContext', () => ({
  useGame: () => ({
    state: mockState,
    setActivePanel: mockSetActivePanel,
    setTool: mockSetTool,
    setSpeed: mockSetSpeed,
  }),
}));

describe('useGameKeyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      activePanel: 'none',
      selectedTool: 'select',
      speed: 1,
    };
  });

  const runHook = (props: any) => {
    renderHook(() => useGameKeyboard(props));
  };

  const triggerKeyDown = (key: string) => {
    const event = new KeyboardEvent('keydown', { key });
    window.dispatchEvent(event);
  };

  it('closes overlay mode on Escape', () => {
    runHook({
      overlayMode: 'subway',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('Escape');
    expect(mockSetOverlayMode).toHaveBeenCalledWith('none');
    expect(mockSetActivePanel).not.toHaveBeenCalled();
  });

  it('closes active panel on Escape if overlay is none', () => {
    mockState.activePanel = 'budget';
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('Escape');
    expect(mockSetOverlayMode).not.toHaveBeenCalled();
    expect(mockSetActivePanel).toHaveBeenCalledWith('none');
  });

  it('deselects tile on Escape if no panel/overlay', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: { x: 0, y: 0 },
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('Escape');
    expect(mockSetSelectedTile).toHaveBeenCalledWith(null);
  });

  it('resets tool to select on Escape if nothing else active', () => {
    mockState.selectedTool = 'road';
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('Escape');
    expect(mockSetTool).toHaveBeenCalledWith('select');
  });

  it('toggles pause on Space', () => {
    mockState.speed = 1;
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown(' ');
    expect(mockSetSpeed).toHaveBeenCalledWith(0);
  });

  it('selects bulldoze on B', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('b');
    expect(mockSetTool).toHaveBeenCalledWith('bulldoze');
  });

  it('selects road on R', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('r');
    expect(mockSetTool).toHaveBeenCalledWith('road');
  });

  it('selects residential zone on 1', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('1');
    expect(mockSetTool).toHaveBeenCalledWith('zone_residential');
  });

  it('selects commercial zone on 2', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('2');
    expect(mockSetTool).toHaveBeenCalledWith('zone_commercial');
  });

  it('selects industrial zone on 3', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('3');
    expect(mockSetTool).toHaveBeenCalledWith('zone_industrial');
  });

  it('selects dezone on 4', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('4');
    expect(mockSetTool).toHaveBeenCalledWith('zone_dezone');
  });

  it('selects rail on L', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('l');
    expect(mockSetTool).toHaveBeenCalledWith('rail');
  });

  it('selects subway on M', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('m');
    expect(mockSetTool).toHaveBeenCalledWith('subway');
  });

  it('cycles services tools on S', () => {
    // First press: select first tool
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });
    triggerKeyDown('s');
    expect(mockSetTool).toHaveBeenCalledWith('police_station');

    // Second press (if first tool selected): select second tool
    mockState.selectedTool = 'police_station';
    triggerKeyDown('s');
    expect(mockSetTool).toHaveBeenCalledWith('fire_station');
  });

  it('calls onToggleHelp on "?"', () => {
    const mockOnToggleHelp = vi.fn();
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
      onToggleHelp: mockOnToggleHelp,
    });

    triggerKeyDown('?');
    expect(mockOnToggleHelp).toHaveBeenCalled();
  });

  it('cycles overlays on O', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });

    triggerKeyDown('o');
    expect(mockSetOverlayMode).toHaveBeenCalledWith('traffic');
  });

  it('cycles sports tools on A', () => {
    runHook({
      overlayMode: 'none',
      setOverlayMode: mockSetOverlayMode,
      selectedTile: null,
      setSelectedTile: mockSetSelectedTile,
    });
    triggerKeyDown('a');
    expect(mockSetTool).toHaveBeenCalledWith('basketball_courts');
  });
});
