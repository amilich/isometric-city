import { test as base, Page } from '@playwright/test';

const STORAGE_KEY = 'isocity-game-state';

export async function clearGameState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('isocity-')) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  });
}

export async function mockMultiplayer(page: Page): Promise<void> {
  await page.route('**/supabase.co/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null, error: null }) });
  });
  await page.route('**/realtime/**', async (route) => { await route.abort('connectionrefused'); });
}

export function createMockRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export const test = base.extend<{ cleanPage: Page }>({
  cleanPage: async ({ page }, use) => {
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    // eslint-disable-next-line react-hooks/rules-of-hooks -- this is Playwright's use(), not React's use hook
    await use(page);
    await clearGameState(page);
  },
});

export { expect } from '@playwright/test';
