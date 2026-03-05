import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceIcon = path.join(__dirname, '..', 'public', 'icon.png');
const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
];

async function generateIcons() {
  console.log('Generating icons from:', sourceIcon);
  
  // Check if source icon exists
  if (!fs.existsSync(sourceIcon)) {
    console.error(`Error: Source icon not found at ${sourceIcon}`);
    process.exit(1);
  }
  
  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);
    await sharp(sourceIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .ensureAlpha()  // Ensure RGBA format
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`Generated: ${name} (${size}x${size})`);
  }
  
  // For macOS .icns and Windows .ico, we'll create placeholder files
  // In production, you'd use proper tools to generate these
  const icon512 = path.join(iconsDir, 'icon.png');
  const icon256 = path.join(iconsDir, '128x128@2x.png');
  
  // Copy 512 as a placeholder for icns (macOS uses folder-based icons in dev)
  if (fs.existsSync(icon512)) {
    fs.copyFileSync(icon512, path.join(iconsDir, 'icon.icns'));
    console.log('Created placeholder: icon.icns');
  } else {
    console.warn('Warning: icon.png not found, skipping icon.icns');
  }
  
  // For .ico, we'll use the 256 version as a placeholder
  if (fs.existsSync(icon256)) {
    fs.copyFileSync(icon256, path.join(iconsDir, 'icon.ico'));
    console.log('Created placeholder: icon.ico');
  } else {
    console.warn('Warning: 128x128@2x.png not found, skipping icon.ico');
  }
  
  console.log('Done!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
