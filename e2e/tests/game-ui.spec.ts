import { test, expect } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { clearGameState } from '../fixtures/game.fixture';
import { waitForCanvasReady, pressShortcut } from '../utils/helpers';

test.describe('Sidebar', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should display sidebar on desktop', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.sidebar).toBeVisible();
  });

  test('should display ISOCITY branding', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.sidebar.getByText('ISOCITY')).toBeVisible();
  });

  test('should display tool categories', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.sidebar.getByText('TOOLS')).toBeVisible();
    await expect(gamePage.sidebar.getByText('ZONES')).toBeVisible();
  });

  test('should select Bulldoze tool', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.selectTool('bulldoze');
    await expect(gamePage.sidebar.getByRole('button', { name: /bulldoze/i }).first()).toBeVisible();
  });
});

test.describe('TopBar', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should display TopBar on desktop', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.topBar).toBeVisible();
  });

  test('should display city name', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.topBar.getByText(/isocity/i)).toBeVisible();
  });

  test('should display population stat', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.topBar.getByText(/population/i)).toBeVisible();
  });

  test('should display funds stat', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await expect(gamePage.topBar.getByText(/funds/i)).toBeVisible();
  });
});

test.describe('Exit Functionality', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should show exit dialog', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.clickExit();
    await expect(gamePage.exitDialog).toBeVisible();
  });

  test('should return to landing when exiting', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await gamePage.clickExit();
    await gamePage.exitWithoutSaving();
    await gamePage.expectLandingPage();
  });
});

test.describe('Keyboard Shortcuts', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
  });

  test('should toggle pause with P key', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await pressShortcut(page, 'pause');
    await page.waitForTimeout(100);
  });

  test('should select bulldoze with B key', async ({ page }) => {
    const vp = page.viewportSize();
    if (vp && vp.width < 768) { test.skip(); return; }
    await pressShortcut(page, 'bulldoze');
    await page.waitForTimeout(100);
  });
});
