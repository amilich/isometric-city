import { Page, Locator, expect } from '@playwright/test';

export type ToolName = 'select' | 'bulldoze' | 'road' | 'zone_residential' | 'zone_commercial' | 'zone_industrial';
export type PanelName = 'budget' | 'statistics' | 'advisors' | 'settings';

export class GamePage {
  readonly page: Page;
  readonly title: Locator;
  readonly continueButton: Locator;
  readonly coopButton: Locator;
  readonly loadExampleButton: Locator;
  readonly githubLink: Locator;
  readonly spriteGallery: Locator;
  readonly gameCanvas: Locator;
  readonly sidebar: Locator;
  readonly topBar: Locator;
  readonly exitButton: Locator;
  readonly exitDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1').filter({ hasText: /IsoCity/i });
    this.continueButton = page.getByRole('button', { name: /continue|new game/i });
    this.coopButton = page.getByRole('button', { name: /co-op/i });
    this.loadExampleButton = page.getByRole('button', { name: /load example/i });
    this.githubLink = page.getByRole('link', { name: /github/i });
    this.spriteGallery = page.locator('canvas').first();
    this.gameCanvas = page.locator('canvas').first();
    this.sidebar = page.locator('.w-56.bg-sidebar');
    this.topBar = page.locator('.h-14.bg-card');
    this.exitButton = page.locator('button[title*="Exit"]');
    this.exitDialog = page.getByRole('dialog');
  }

  async goto() { await this.page.goto('/'); await this.page.waitForLoadState('networkidle'); }
  async startNewGame() { await this.continueButton.click(); await this.page.waitForSelector('canvas', { state: 'visible', timeout: 15000 }); }
  async loadExample() { await this.loadExampleButton.click(); await this.page.waitForSelector('canvas', { state: 'visible', timeout: 15000 }); }
  async openCoopModal() { await this.coopButton.click(); await this.page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 }); }
  async selectTool(tool: ToolName) { await this.page.getByRole('button', { name: new RegExp(tool.replace('zone_', ''), 'i') }).first().click(); }
  async openPanel(panel: PanelName) { await this.sidebar.locator(`button[title="${panel.charAt(0).toUpperCase() + panel.slice(1)}"]`).click(); }
  async clickCanvasCenter() { const b = await this.gameCanvas.boundingBox(); if (b) await this.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
  async clickCanvas(x: number, y: number) { const b = await this.gameCanvas.boundingBox(); if (b) await this.page.mouse.click(b.x + x, b.y + y); }
  async dragCanvas(s: { x: number; y: number }, e: { x: number; y: number }) { const b = await this.gameCanvas.boundingBox(); if (b) { await this.page.mouse.move(b.x + s.x, b.y + s.y); await this.page.mouse.down(); await this.page.mouse.move(b.x + e.x, b.y + e.y, { steps: 10 }); await this.page.mouse.up(); } }
  async zoomCanvas(d: number) { const b = await this.gameCanvas.boundingBox(); if (b) { await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await this.page.mouse.wheel(0, d); } }
  async clickExit() { await this.exitButton.click(); await expect(this.exitDialog).toBeVisible(); }
  async exitWithoutSaving() { await this.exitDialog.getByRole('button', { name: /exit without saving/i }).click(); }
  async saveAndExit() { await this.exitDialog.getByRole('button', { name: /save.*exit/i }).click(); }
  async expectGameLoaded() { await expect(this.gameCanvas).toBeVisible(); await expect(this.sidebar).toBeVisible(); }
  async expectLandingPage() { await expect(this.title).toBeVisible(); await expect(this.continueButton).toBeVisible(); }
}
