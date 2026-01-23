import { test, expect } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { clearGameState } from '../fixtures/game.fixture';
import { waitForIdle, waitForCanvasReady } from '../utils/helpers';

test.describe('Landing Page', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await waitForIdle(page);
  });

  test('should display the IsoCity title', async ({ page }) => {
    await expect(gamePage.title).toBeVisible();
    await expect(page).toHaveTitle(/ISOCITY|IsoCity/i);
  });

  test('should display New Game button', async () => {
    await expect(gamePage.continueButton).toBeVisible();
  });

  test('should display Co-op button', async () => {
    await expect(gamePage.coopButton).toBeVisible();
  });

  test('should display Load Example button', async () => {
    await expect(gamePage.loadExampleButton).toBeVisible();
  });

  test('should render sprite gallery canvas', async ({ page }) => {
    await waitForCanvasReady(page, 'canvas');
    await expect(gamePage.spriteGallery).toBeVisible();
    const box = await gamePage.spriteGallery.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
  });

  test('should display GitHub link', async () => {
    await expect(gamePage.githubLink).toBeVisible();
    const href = await gamePage.githubLink.getAttribute('href');
    expect(href).toContain('github.com');
  });

  test('should start new game when clicking button', async ({ page }) => {
    await gamePage.startNewGame();
    await waitForCanvasReady(page, 'canvas');
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) await expect(gamePage.sidebar).toBeVisible();
  });

  test('should load example city', async ({ page }) => {
    await gamePage.loadExample();
    await waitForCanvasReady(page, 'canvas');
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 768) await expect(gamePage.sidebar).toBeVisible();
  });

  test('should open Co-op modal', async ({ page }) => {
    await gamePage.openCoopModal();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
  });
});
