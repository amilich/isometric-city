import { test, expect } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { clearGameState } from '../fixtures/game.fixture';
import { waitForCanvasReady } from '../utils/helpers';

test.describe('Budget Panel', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should open budget panel', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.openPanel('budget');
    await expect(page.getByText(/budget|funding|expenses|income/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Statistics Panel', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should open statistics panel', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.openPanel('statistics');
    await expect(page.getByText(/statistics|population|history/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Advisors Panel', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should open advisors panel', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.openPanel('advisors');
    await expect(page.getByText(/advisor|advice|message/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Settings Panel', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should open settings panel', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.openPanel('settings');
    await expect(page.getByText(/settings|options|save|load/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Panel Toggle', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should toggle panel', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.openPanel('budget');
    await page.waitForTimeout(300);
    await gamePage.openPanel('budget');
    await page.waitForTimeout(300);
    await expect(gamePage.gameCanvas).toBeVisible();
  });
});
