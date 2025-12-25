import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const args = new Set(process.argv.slice(2));
const SHOULD_WRITE_AVIF = args.has('--avif');

const PROJECT_ROOT = process.cwd();
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public', 'assets');

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listPngFiles(dir) {
  /** @type {string[]} */
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listPngFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) continue;

    if (/\.png$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

async function isUpToDate(inputPath, outputPath) {
  if (!(await fileExists(outputPath))) return false;
  const [inStat, outStat] = await Promise.all([fs.stat(inputPath), fs.stat(outputPath)]);
  return outStat.mtimeMs >= inStat.mtimeMs;
}

async function optimizeOne(inputPath) {
  const webpPath = inputPath.replace(/\.png$/i, '.webp');
  const avifPath = inputPath.replace(/\.png$/i, '.avif');

  const webpUpToDate = await isUpToDate(inputPath, webpPath);
  const avifUpToDate = SHOULD_WRITE_AVIF ? await isUpToDate(inputPath, avifPath) : true;

  if (webpUpToDate && avifUpToDate) return { webp: false, avif: false };

  const pipeline = sharp(inputPath, { limitInputPixels: false });

  const wrote = { webp: false, avif: false };

  if (!webpUpToDate) {
    await pipeline
      .clone()
      .webp({
        quality: 82,
        effort: 4,
      })
      .toFile(webpPath);
    wrote.webp = true;
  }

  if (SHOULD_WRITE_AVIF && !avifUpToDate) {
    await pipeline
      .clone()
      .avif({
        quality: 50,
        effort: 4,
      })
      .toFile(avifPath);
    wrote.avif = true;
  }

  return wrote;
}

async function main() {
  const assetsDirExists = await fileExists(ASSETS_DIR);
  if (!assetsDirExists) {
    console.error(`No assets directory found at: ${ASSETS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const pngFiles = await listPngFiles(ASSETS_DIR);

  let wroteWebp = 0;
  let wroteAvif = 0;

  for (const inputPath of pngFiles) {
    const result = await optimizeOne(inputPath);
    if (result.webp) wroteWebp += 1;
    if (result.avif) wroteAvif += 1;
  }

  const summary = [
    `Optimized ${pngFiles.length} PNG(s) in public/assets`,
    `wrote ${wroteWebp} WebP`,
    SHOULD_WRITE_AVIF ? `wrote ${wroteAvif} AVIF` : 'AVIF disabled',
  ].join(' | ');

  console.log(summary);
}

await main();
