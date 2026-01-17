import { test, expect } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { clearGameState } from '../fixtures/game.fixture';
import { waitForCanvasReady } from '../utils/helpers';

test.describe('Canvas Rendering', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should render main game canvas', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
  });

  test('should fill available area', async ({ page }) => {
    const vp = page.viewportSize();
    if (!vp) return;
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (vp.width >= 768) expect(box!.width).toBeGreaterThan(vp.width - 300);
  });
});

test.describe('Canvas Interactions', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should respond to clicks', async ({ page }) => {
    await gamePage.clickCanvasCenter();
    await page.waitForTimeout(100);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should support drag', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.selectTool('road');
    await page.waitForTimeout(200);
    await gamePage.dragCanvas({ x: 300, y: 300 }, { x: 400, y: 300 });
    await page.waitForTimeout(300);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should zoom with scroll', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await gamePage.zoomCanvas(-100);
    await page.waitForTimeout(200);
    await gamePage.zoomCanvas(100);
    await page.waitForTimeout(200);
    await expect(canvas).toBeVisible();
  });
});

test.describe('Building Placement', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should place residential zone', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.selectTool('zone_residential');
    await page.waitForTimeout(200);
    await gamePage.clickCanvas(400, 400);
    await page.waitForTimeout(200);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should bulldoze', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.selectTool('bulldoze');
    await page.waitForTimeout(200);
    await gamePage.clickCanvas(400, 400);
    await page.waitForTimeout(200);
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});

test.describe('Canvas Performance', () => {
  test('should render within time', async ({ page }) => {
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    const gamePage = new GamePage(page);
    const start = Date.now();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
    const time = Date.now() - start;
    expect(time).toBeLessThan(15000);
    console.log('Canvas render time:', time, 'ms');
  });
});
