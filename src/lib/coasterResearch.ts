import { msg } from 'gt-next';
import { ResearchItem } from '@/games/coaster/types';

const RESEARCH_ITEMS: ResearchItem[] = [
  {
    id: 'coaster_wooden',
    name: msg('Wooden Coaster'),
    category: 'coasters',
    cost: 800,
    progress: 0,
    unlocked: false,
  },
  {
    id: 'coaster_steel',
    name: msg('Steel Coaster'),
    category: 'coasters',
    cost: 1200,
    progress: 0,
    unlocked: false,
  },
];

export function createResearchItems(): ResearchItem[] {
  return RESEARCH_ITEMS.map((item) => ({ ...item }));
}

export function mergeResearchItems(existingItems: ResearchItem[]): ResearchItem[] {
  const existingMap = new Map(existingItems.map((item) => [item.id, item]));
  return RESEARCH_ITEMS.map((item) => {
    const existing = existingMap.get(item.id);
    if (!existing) return { ...item };
    return {
      ...existing,
      id: item.id,
      name: item.name,
      category: item.category,
      cost: item.cost,
    };
  });
}

export function isResearchUnlocked(items: ResearchItem[], id: string): boolean {
  return items.find((item) => item.id === id)?.unlocked ?? false;
}
