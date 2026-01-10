import { test, expect, devices } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { clearGameState } from '../fixtures/game.fixture';
import { waitForCanvasReady, VIEWPORTS } from '../utils/helpers';

test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Landing Page', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should render landing page on mobile', async () => {
    await expect(gamePage.title).toBeVisible();
    await expect(gamePage.continueButton).toBeVisible();
    await expect(gamePage.coopButton).toBeVisible();
  });

  test('should use compact layout', async () => {
    const continueBox = await gamePage.continueButton.boundingBox();
    const coopBox = await gamePage.coopButton.boundingBox();
    if (continueBox && coopBox) {
      expect(coopBox.y).toBeGreaterThanOrEqual(continueBox.y + continueBox.height - 5);
    }
  });

  test('should have touch-friendly buttons', async () => {
    const box = await gamePage.continueButton.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(40);
  });
});

test.describe('Mobile Game Layout', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should hide desktop sidebar on mobile', async () => {
    await expect(gamePage.sidebar).not.toBeVisible();
  });

  test('should render game canvas', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      const vp = page.viewportSize();
      if (vp) expect(box.width).toBeGreaterThan(vp.width * 0.5);
    }
  });
});

test.describe('Mobile Touch', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should respond to tap', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.tap('canvas', { position: { x: box.width / 2, y: box.height / 2 } });
      await page.waitForTimeout(200);
      await expect(canvas).toBeVisible();
    }
  });
});

test.describe('Responsive Breakpoints', () => {
  test('should handle tablet viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    const gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await expect(gamePage.title).toBeVisible();
  });

  test('should handle desktop to mobile resize', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
    await expect(gamePage.sidebar).toBeVisible();
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500);
    await expect(gamePage.sidebar).not.toBeVisible();
  });
});

test.describe('Mobile Performance', () => {
  test('should load game within 15 seconds', async ({ page }) => {
    const gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    const start = Date.now();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
    const time = Date.now() - start;
    console.log('Mobile game load time:', time, 'ms');
    expect(time).toBeLessThan(15000);
  });
});
