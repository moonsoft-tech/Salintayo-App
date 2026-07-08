/**
 * Generates Android launcher icons from the official public/logo.png.
 * Run: node scripts/generate-app-icons.mjs
 */
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const logoPngPath = 'public/logo.png';
const iconPath = 'resources/icon.png';

await mkdir('resources', { recursive: true });

await sharp(logoPngPath)
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(iconPath);

console.log(`Using ${logoPngPath}`);
console.log(`Wrote ${iconPath}`);

execSync('npx capacitor-assets generate --android', { stdio: 'inherit' });
console.log('Android launcher icons generated.');
