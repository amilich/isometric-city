import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROME_PATH =
  process.env.CHROME_PATH ??
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  process.env.PUPPETEER_CHROMIUM_EXECUTABLE_PATH ??
  '/usr/bin/google-chrome';

function parseMoney(text) {
  const digits = String(text ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function parseIntSafe(text) {
  const match = String(text ?? '').match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function parseWave(text) {
  // TopBar renders "N/FINAL", so take the first number.
  const first = String(text ?? '').split('/')[0] ?? '';
  return parseIntSafe(first);
}

async function waitForButtonText(page, text, timeoutMs = 30_000) {
  await page.waitForFunction(
    (t) => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some((b) => (b.textContent ?? '').trim() === t);
    },
    { timeout: timeoutMs },
    text
  );
}

async function clickButtonText(page, text) {
  await page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find((b) => (b.textContent ?? '').trim() === t);
    if (!btn) throw new Error(`Button not found: ${t}`);
    (btn).click();
  }, text);
}

async function getText(page, selector) {
  const text = await page.$eval(selector, (el) => el.textContent ?? '');
  return text.trim();
}

async function main() {
  const outDir =
    process.env.E2E_SCREENSHOT_DIR ?? path.join(os.tmpdir(), `isotower-e2e-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Screenshots: ${outDir}`);

  try {
    await fs.access(CHROME_PATH);
  } catch {
    throw new Error(
      `Chrome/Chromium not found at "${CHROME_PATH}". Set CHROME_PATH to your browser executable path (e.g. /usr/bin/google-chrome).`
    );
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1365, height: 768 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(45_000);

  async function snap(name) {
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  }

  // Basic route smoke checks (ensures we didn't break other games).
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  console.log('OK /');
  await snap('01-home');
  await page.goto(`${BASE_URL}/coaster`, { waitUntil: 'networkidle2' });
  console.log('OK /coaster');
  await snap('02-coaster');

  // Tower smoke: load example run, play 1 wave, verify money increases, verify persistence via Continue.
  await page.goto(`${BASE_URL}/tower`, { waitUntil: 'networkidle2' });
  await waitForButtonText(page, 'Load Example');
  await snap('03-tower-landing');
  await clickButtonText(page, 'Load Example');

  await page.waitForSelector('[data-testid="tower-start-wave"]');
  await page.waitForSelector('[data-testid="tower-canvas"]');
  await snap('04-tower-in-game');

  // Speed up the simulation to reduce flakiness/time.
  await page.waitForSelector('button[title="3x Speed"]');
  await page.click('button[title="3x Speed"]');

  const wave0 = parseWave(await getText(page, '[data-testid="tower-wave"]'));
  const money0 = parseMoney(await getText(page, '[data-testid="tower-money"]'));
  console.log(`Tower initial wave=${wave0} money=${money0}`);

  await page.click('[data-testid="tower-start-wave"]');
  await snap('05-tower-wave-started');

  // Wait until the wave number increments, then until the wave returns to Ready.
  await page.waitForFunction(
    (prevWave) => {
      const el = document.querySelector('[data-testid="tower-wave"]');
      if (!el) return false;
      const next = Number((el.textContent ?? '').replace(/[^0-9-]/g, '')) || 0;
      return next >= prevWave + 1;
    },
    { timeout: 45_000 },
    wave0
  );

  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="tower-wave-label"]');
      const label = (el?.textContent ?? '').toLowerCase();
      return label.includes('ready');
    },
    { timeout: 90_000 }
  );

  const wave1 = parseWave(await getText(page, '[data-testid="tower-wave"]'));
  const money1 = parseMoney(await getText(page, '[data-testid="tower-money"]'));
  console.log(`Tower after wave wave=${wave1} money=${money1}`);
  await snap('06-tower-wave-complete');

  if (wave1 < wave0 + 1) {
    throw new Error(`Wave did not increment (expected >= ${wave0 + 1}, got ${wave1})`);
  }
  if (money1 <= money0) {
    throw new Error(`Money did not increase (expected > ${money0}, got ${money1})`);
  }

  // Persistence: go back to landing and use Continue.
  await page.goto(`${BASE_URL}/tower`, { waitUntil: 'networkidle2' });
  await waitForButtonText(page, 'Continue');
  await snap('07-tower-landing-continue');
  await clickButtonText(page, 'Continue');

  await page.waitForSelector('[data-testid="tower-wave"]');
  const waveAfterContinue = parseWave(await getText(page, '[data-testid="tower-wave"]'));
  console.log(`Tower continue wave=${waveAfterContinue}`);
  await snap('08-tower-continue-restored');
  if (waveAfterContinue !== wave1) {
    throw new Error(`Continue did not restore wave (expected ${wave1}, got ${waveAfterContinue})`);
  }

  // Quick UI check: settings dialog opens.
  await page.waitForSelector('button[title="Settings"]');
  await page.click('button[title="Settings"]');
  await page.waitForFunction(() => (document.body.textContent ?? '').includes('Run Settings'), { timeout: 15_000 });
  await snap('09-tower-settings-open');
  await page.keyboard.press('Escape');
  console.log('OK settings dialog');

  // Save hygiene: deleting the run should also clear autosave (so Continue disappears).
  await page.goto(`${BASE_URL}/tower`, { waitUntil: 'networkidle2' });
  await waitForButtonText(page, 'Continue');
  await snap('10-tower-landing-before-delete');
  await page.waitForSelector('button[aria-label="Delete run"], button[title="Delete run"]');
  await page.click('button[aria-label="Delete run"], button[title="Delete run"]');
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const primary = btns.find((b) => (b.textContent ?? '').trim() === 'Continue' || (b.textContent ?? '').trim() === 'New Run');
    return (primary?.textContent ?? '').trim() === 'New Run';
  });
  await snap('11-tower-landing-after-delete');
  console.log('OK delete clears continue');

  // Simulation regression check: final wave should reach victory.
  const smoke = await fetch(`${BASE_URL}/api/tower-smoke?waves=20`).then((r) => r.json());
  if (smoke?.waveState !== 'victory') {
    throw new Error(`Expected victory from /api/tower-smoke?waves=20, got ${String(smoke?.waveState)}`);
  }
  console.log('OK victory smoke');

  const gameOverSmoke = await fetch(`${BASE_URL}/api/tower-smoke?waves=20&noTowers=1&maxTicks=4000`).then((r) => r.json());
  if (gameOverSmoke?.waveState !== 'game_over') {
    throw new Error(`Expected game_over from /api/tower-smoke?noTowers=1, got ${String(gameOverSmoke?.waveState)}`);
  }
  console.log('OK game over smoke');

  await browser.close();
  console.log('PASS tower-e2e-smoke');
}

main().catch((err) => {
  console.error('FAIL tower-e2e-smoke');
  console.error(err);
  process.exitCode = 1;
});

