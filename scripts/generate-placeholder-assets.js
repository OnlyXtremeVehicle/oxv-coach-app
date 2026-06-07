/**
 * Génère les assets placeholders OXV Mirror (icône, splash, adaptive icon).
 *
 * PLACEHOLDER : visuel provisoire en attendant les définitifs.
 * Insigne stylisé bouclier-casque (visière + V + X central), rouge OXV
 * sur fond noir profond. Les définitifs doivent être produits par
 * un designer avant la soumission App Store (semaine 14).
 *
 * Usage :
 *   node scripts/generate-placeholder-assets.js
 */

/* eslint-disable */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const BG = '#050505';
const RED = '#C8102E';
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

/**
 * SVG insigne OXV stylisé — bouclier/casque + X central.
 * viewBox 800×800, insigne centré sur (400, 400), bbox ≈ 480×610.
 */
function insigneSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <g transform="translate(400,400)" fill="none"
     stroke="${RED}" stroke-width="32"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M -240,-200 Q 0,-310 240,-200" />
    <line x1="-180" y1="-160" x2="180" y2="-160" />
    <line x1="-240" y1="-200" x2="-240" y2="100" />
    <line x1="240" y1="-200" x2="240" y2="100" />
    <path d="M -240,100 L 0,300 L 240,100" />
    <line x1="-130" y1="-40" x2="130" y2="170" />
    <line x1="130" y1="-40" x2="-130" y2="170" />
  </g>
</svg>`;
}

async function composeAsset({ outPath, canvasSize, insigneSize, transparent = false }) {
  const insigne = await sharp(Buffer.from(insigneSvg()))
    .resize(insigneSize, insigneSize)
    .png()
    .toBuffer();

  const background = transparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : BG;

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background,
    },
  })
    .composite([{ input: insigne, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const stats = fs.statSync(outPath);
  console.log(`  ${path.basename(outPath).padEnd(22)} ${canvasSize}x${canvasSize}  ${(stats.size / 1024).toFixed(1)} KB`);
}

async function main() {
  console.log('Génération des placeholders OXV Mirror :');

  await composeAsset({
    outPath: path.join(ASSETS_DIR, 'icon.png'),
    canvasSize: 1024,
    insigneSize: 850,
    transparent: false,
  });

  await composeAsset({
    outPath: path.join(ASSETS_DIR, 'splash.png'),
    canvasSize: 2048,
    insigneSize: 820,
    transparent: false,
  });

  await composeAsset({
    outPath: path.join(ASSETS_DIR, 'adaptive-icon.png'),
    canvasSize: 1024,
    insigneSize: 720,
    transparent: true,
  });

  console.log('\nAssets écrits dans assets/. PLACEHOLDER — à remplacer par les visuels définitifs avant soumission stores.');
}

main().catch((err) => {
  console.error('Erreur de génération :', err);
  process.exit(1);
});
