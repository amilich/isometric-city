import { Page } from '@playwright/test';

export async function waitForIdle(page: Page, timeout = 5000) {
  await Promise.all([page.waitForLoadState('networkidle', { timeout }), page.waitForTimeout(300)]);
}

export async function waitForCanvasReady(page: Page, selector = 'canvas', timeout = 15000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
  await page.waitForFunction((sel) => { const c = document.querySelector(sel) as HTMLCanvasElement; return c && c.width > 0 && c.height > 0; }, selector, { timeout });
}

export const VIEWPORTS = { desktop: { width: 1920, height: 1080 }, laptop: { width: 1366, height: 768 }, tablet: { width: 768, height: 1024 }, mobile: { width: 375, height: 667 }, mobileL: { width: 414, height: 896 } } as const;

export const SHORTCUTS = { pause: 'p', bulldoze: 'b', escape: 'Escape' } as const;
export async function pressShortcut(page: Page, s: keyof typeof SHORTCUTS) { await page.keyboard.press(SHORTCUTS[s]); }
