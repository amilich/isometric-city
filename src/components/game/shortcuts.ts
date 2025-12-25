export const KEYBOARD_SHORTCUTS = {
  // Tools
  BULLDOZE: { key: 'b', label: 'B' },
  SELECT: { key: 'Escape', label: 'Esc' }, // Contextual, but often resets to select
  
  // Controls
  PAUSE: { key: 'p', label: 'P' },
  SEARCH: { key: 'k', meta: true, label: '⌘K' }, // CommandMenu
  HELP: { key: '?', label: '?' },
  
  // Future/Suggested
  ROAD: { key: 'r', label: 'R' },
  RESIDENTIAL: { key: '1', label: '1' },
  COMMERCIAL: { key: '2', label: '2' },
  INDUSTRIAL: { key: '3', label: '3' },
} as const;
