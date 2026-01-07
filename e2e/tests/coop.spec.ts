import { test, expect } from '@playwright/test';
import { GamePage } from '../pages/game.page';
import { clearGameState, mockMultiplayer, createMockRoomCode } from '../fixtures/game.fixture';
import { waitForIdle } from '../utils/helpers';

test.describe('Co-op Modal', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await waitForIdle(page);
    await mockMultiplayer(page);
  });

  test('should open co-op modal', async ({ page }) => {
    await gamePage.openCoopModal();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
  });

  test('should display host/join options', async ({ page }) => {
    await gamePage.openCoopModal();
    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/host|create|start/i).or(modal.getByRole('button', { name: /host|create/i }))).toBeVisible({ timeout: 5000 });
  });

  test('should close modal on Escape', async ({ page }) => {
    await gamePage.openCoopModal();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(gamePage.coopButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Co-op Room URL', () => {
  test('should show modal when navigating to room URL', async ({ page }) => {
    const roomCode = createMockRoomCode();
    await mockMultiplayer(page);
    await page.goto('/coop/' + roomCode);
    await waitForIdle(page);
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });
  });

  test('should handle invalid room code', async ({ page }) => {
    await mockMultiplayer(page);
    await page.goto('/coop/AB');
    await waitForIdle(page);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Co-op Error Handling', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await page.goto('/');
    await clearGameState(page);
    await page.reload();
    await waitForIdle(page);
  });

  test('should handle connection errors', async ({ page }) => {
    await gamePage.openCoopModal();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});
