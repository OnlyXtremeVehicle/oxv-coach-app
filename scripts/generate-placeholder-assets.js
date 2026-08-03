/**
 * Génère les assets placeholders OXV Mirror (icône, splash, adaptive icon).
 *
 * PLACEHOLDER : visuel provisoire en attendant les définitifs.
 * Insigne stylisé bouclier-casque (visière + V + X central), rouge OXV
 * sur fond noir profond. Les définitifs doivent être produits par
 * un designer avant la soumission App Store (semaine 14).
 *
 * Usage :
 *   npm i -D sharp && node scripts/generate-placeholder-assets.js
 *
 * ---
 *
 * POURQUOI `sharp` N'EST PLUS UNE DÉPENDANCE DU PROJET
 *
 * Le build EAS iOS n°32 (03/08/2026) a échoué en phase « Install
 * dependencies » : `sharp@0.34.5` n'a pas trouvé de binaire précompilé
 * utilisable sur le builder macOS, a tenté une compilation depuis les sources
 * via node-gyp, et a réclamé `node-addon-api` qui n'était pas là.
 *
 *     npm error command sh -c node install/check.js || npm run build
 *     npm error sharp: Attempting to build from source via node-gyp
 *     npm error sharp: Please add node-addon-api to your dependencies
 *
 * Or ce paquet ne sert QU'À CE SCRIPT — un générateur de visuels provisoires,
 * lancé à la main, jamais par le build. Le laisser en devDependency mettait une
 * compilation native sur le chemin critique de chaque build, pour une image que
 * personne ne regénère.
 *
 * Il s'installe donc à la demande. Le jour où les visuels définitifs arrivent,
 * ce script disparaît avec eux.
 */

/* eslint-disable */
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error(
    "sharp n'est pas installé — il ne fait plus partie des dépendances du projet.
" +
      'Pour lancer ce script :  npm i -D sharp && node scripts/generate-placeholder-assets.js
' +
      "(voir l'en-tête du fichier : il mettait une compilation native sur le chemin de chaque build EAS)"
  );
  process.exit(1);
}
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
