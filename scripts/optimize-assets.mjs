/**
 * Generate WebP versions of PNG assets in `public/assets`.
 *
 * Why:
 * - PNG sprite sheets are big; WebP (lossless) is typically much smaller.
 * - We keep PNGs for fallback, but the runtime loader will prefer WebP.
 *
 * Usage:
 * - `npm run optimize-assets`
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public', 'assets');
 
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
 
function isPng(filePath) {
  return /\.png$/i.test(filePath);
}
 
function toWebpPath(pngPath) {
  return pngPath.replace(/\.png$/i, '.webp');
}
 
async function fileMtimeMs(p) {
  try {
    const stat = await fs.stat(p);
    return stat.mtimeMs;
  } catch {
    return null;
  }
}
 
async function main() {
  const startedAt = Date.now();
 
  // Validate directory exists
  try {
    const stat = await fs.stat(ASSETS_DIR);
    if (!stat.isDirectory()) {
      throw new Error(`${ASSETS_DIR} is not a directory`);
    }
  } catch (err) {
    console.error(`Assets directory not found: ${ASSETS_DIR}`);
    throw err;
  }
 
  const allFiles = await walk(ASSETS_DIR);
  const pngFiles = allFiles.filter(isPng);
 
  let converted = 0;
  let skipped = 0;
  let failed = 0;
 
  for (const pngPath of pngFiles) {
    const webpPath = toWebpPath(pngPath);
 
    const pngMtime = await fileMtimeMs(pngPath);
    const webpMtime = await fileMtimeMs(webpPath);
 
    // Skip if WebP exists and is newer than PNG.
    if (webpMtime !== null && pngMtime !== null && webpMtime >= pngMtime) {
      skipped++;
      continue;
    }
 
    try {
      await sharp(pngPath)
        // Lossless to preserve pixel-art crispness.
        .webp({ lossless: true, effort: 6 })
        .toFile(webpPath);
      converted++;
    } catch (err) {
      failed++;
      console.error(`Failed converting: ${path.relative(PROJECT_ROOT, pngPath)}`);
      console.error(err);
    }
  }
 
  const durationMs = Date.now() - startedAt;
  console.log(
    `WebP generation complete: converted=${converted}, skipped=${skipped}, failed=${failed}, duration=${durationMs}ms`
  );
 
  if (failed > 0) process.exitCode = 1;
}
 
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

