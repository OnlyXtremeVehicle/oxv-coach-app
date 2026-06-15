/**
 * Genere src/legal/legalDocuments.ts depuis docs/juridique/.
 * Texte legal embarque pour consultation in-app (RGPD).
 * Usage : node scripts/genlegal.js && npm run format
 */
const fs = require('fs');
const docs = [
  { slug: 'pacte', title: 'Pacte de pilotage', file: 'docs/juridique/01_PACTE_DE_PILOTAGE.md' },
  { slug: 'cgu', title: "Conditions générales d'utilisation", file: 'docs/juridique/02_CGU_APP_OXV_MIRROR.md' },
  { slug: 'confidentialite', title: 'Politique de confidentialité', file: 'docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md' },
];
let out = '/* eslint-disable */\n';
out += '// GENERE — ne pas editer a la main. Source : docs/juridique/.\n';
out += '// Re-generer : node scripts/genlegal.js && npm run format\n\n';
out += 'export interface LegalDocument {\n  slug: string;\n  title: string;\n  body: string;\n}\n\n';
out += 'export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {\n';
for (const d of docs) {
  const body = fs.readFileSync(d.file, 'utf8');
  out += '  ' + d.slug + ': { slug: ' + JSON.stringify(d.slug) + ', title: ' + JSON.stringify(d.title) + ', body: ' + JSON.stringify(body) + ' },\n';
}
out += '};\n';
fs.writeFileSync('src/legal/legalDocuments.ts', out);
console.log('OK', fs.statSync('src/legal/legalDocuments.ts').size, 'octets');
