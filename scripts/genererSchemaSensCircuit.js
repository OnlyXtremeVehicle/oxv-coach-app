/**
 * Génère le schéma de sens de parcours de Bouteville, DEPUIS la géométrie réelle
 * du dépôt. Rien n'est dessiné à main levée : chaque flèche est posée sur un
 * point calculé du tracé, orientée par la tangente locale.
 */
const fs = require('fs');

const geo = JSON.parse(
  fs.readFileSync('C:/Users/Julie/OneDrive/Desktop/oxv-app/src/circuit/data/bouteville.geojson', 'utf8')
);
const C = geo.features.find((f) => f.geometry.type === 'LineString').geometry.coordinates;
const [F_LON, F_LAT] = geo.features.find((f) => f.properties.type === 'start_finish').geometry.coordinates;

const DEG = Math.PI / 180;
const phi = F_LAT * DEG;
const M_LAT = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const M_LON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);

// Repère métrique local, origine = coin sud-ouest de l'emprise
const lons = C.map((p) => p[0]), lats = C.map((p) => p[1]);
const LON0 = Math.min(...lons), LAT0 = Math.min(...lats);
const toM = ([lon, lat]) => [(lon - LON0) * M_LON, (lat - LAT0) * M_LAT];
const P = C.map(toM);
const FIN = toM([F_LON, F_LAT]);

const W_M = Math.max(...P.map((p) => p[0]));
const H_M = Math.max(...P.map((p) => p[1]));

// --- Cadrage SVG ------------------------------------------------------------
const PAD = 96;
const SIDE = 860;
const SCALE = Math.min((SIDE - 2 * PAD) / W_M, (SIDE - 2 * PAD) / H_M);
const OX = (SIDE - W_M * SCALE) / 2;
const OY = (SIDE - H_M * SCALE) / 2;
// y écran croît vers le bas, la latitude vers le haut : on retourne.
const X = (m) => OX + m[0] * SCALE;
const Y = (m) => SIDE - (OY + m[1] * SCALE);
const pt = (m) => `${X(m).toFixed(1)},${Y(m).toFixed(1)}`;

// --- Abscisse curviligne ----------------------------------------------------
const cum = [0];
for (let i = 1; i < P.length; i++) {
  cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
}
const TOTAL = cum[cum.length - 1];

/** Point + tangente (en degrés écran) à l'abscisse s, dans le SENS DU TRACÉ. */
function aLAbscisse(s) {
  s = ((s % TOTAL) + TOTAL) % TOTAL;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const a = P[i - 1], b = P[i];
  const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // angle écran : atan2(dy_ecran, dx_ecran) ; dy_ecran = -(dy_metrique)
  const ang = (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180) / Math.PI;
  return { m, ang };
}

// Abscisse de la ligne d'arrivée (projection du point déclaré sur le tracé)
let sFin = 0, dFin = Infinity;
for (let i = 1; i < P.length; i++) {
  const a = P[i - 1], b = P[i];
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  let t = L2 === 0 ? 0 : ((FIN[0] - a[0]) * vx + (FIN[1] - a[1]) * vy) / L2;
  t = Math.max(0, Math.min(1, t));
  const d = Math.hypot(a[0] + t * vx - FIN[0], a[1] + t * vy - FIN[1]);
  if (d < dFin) { dFin = d; sFin = cum[i - 1] + t * Math.hypot(vx, vy); }
}

// --- Éléments dessinés ------------------------------------------------------
const trace = P.map(pt).join(' ');

// Chevrons de sens, tous les 330 m, à partir de la ligne
const CHEVRONS = [];
for (let s = sFin + 165; s < sFin + TOTAL; s += 330) {
  const { m, ang } = aLAbscisse(s);
  CHEVRONS.push({ x: X(m), y: Y(m), ang });
}

// Repères numérotés, dans l'ordre de parcours depuis la ligne
const REPERES = [1, 2, 3, 4, 5].map((n) => {
  const s = sFin + (n * TOTAL) / 6;
  const { m, ang } = aLAbscisse(s);
  return { n, x: X(m), y: Y(m), ang, km: (((n * TOTAL) / 6) / 1000).toFixed(1) };
});

// La porte : segment perpendiculaire au cap, demi-largeur 25 m (× 3 pour la lisibilité)
const CAP = 336.6;
const capRad = CAP * DEG;
// cap 0 = nord ; en écran, nord = -y
const capX = Math.sin(capRad), capY = -Math.cos(capRad);
const perpX = -capY, perpY = capX;
const GATE_PX = 25 * SCALE * 3;
const fx = X(FIN), fy = Y(FIN);
const gate = {
  x1: fx - perpX * GATE_PX, y1: fy - perpY * GATE_PX,
  x2: fx + perpX * GATE_PX, y2: fy + perpY * GATE_PX,
};
// Grande flèche de franchissement.
//
// DÉCALÉE latéralement de 17 px : posée sur l'axe, elle recouvrait le tracé
// exactement là où le lecteur cherche à voir la piste. À côté, elle dit la même
// chose et laisse voir ce qu'elle commente.
const FL = 110;
const OFF = 17;
const ox = perpX * OFF, oy = perpY * OFF;
const fleche = {
  x1: fx + ox - capX * FL * 0.35, y1: fy + oy - capY * FL * 0.35,
  x2: fx + ox + capX * FL * 0.6, y2: fy + oy + capY * FL * 0.6,
};

// Échelle : 500 m
const ECH_PX = 500 * SCALE;

/**
 * Où poser le cartouche de la ligne d'arrivée ?
 *
 * Le placer à vue, c'est le poser sur le tracé une fois sur deux — et une
 * légende illisible sur le schéma qui décide du sens de parcours n'est pas un
 * détail. On cherche donc le point de la toile le PLUS ÉLOIGNÉ de la
 * polyligne, des repères et des autres cartouches, par balayage.
 */
const OCCUPES = [
  ...P.map((m) => [X(m), Y(m)]),
  ...REPERES.map((r) => [r.x, r.y]),
  [SIDE - 62, 58],                 // rose des vents
  [56 + ECH_PX / 2, SIDE - 46],    // échelle
];
let callout = { x: SIDE / 2, y: SIDE / 2, d: -1 };
for (let gx = 150; gx <= SIDE - 240; gx += 8) {
  for (let gy = 90; gy <= SIDE - 110; gy += 8) {
    let dmin = Infinity;
    for (const [ox, oy] of OCCUPES) {
      const d = Math.hypot(gx - ox, gy - oy);
      if (d < dmin) dmin = d;
      if (dmin < callout.d) break;
    }
    if (dmin > callout.d) callout = { x: gx, y: gy, d: dmin };
  }
}
// Le trait de rappel s'arrête au bord du disque de la ligne, pas dessus.
const lx = callout.x - fx, ly = callout.y - fy;
const lLen = Math.hypot(lx, ly) || 1;
const rappel = {
  x1: fx + (lx / lLen) * 13,
  y1: fy + (ly / lLen) * 13,
  x2: callout.x - (lx / lLen) * 30,
  y2: callout.y - (ly / lLen) * 30,
};

const svg = `<svg viewBox="0 0 ${SIDE} ${SIDE + 118}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="t d">
  <title id="t">Bouteville — sens de parcours</title>
  <desc id="d">Boucle fermée de 5,913 km. Depuis la ligne d'arrivée, la piste part au nord-nord-ouest (cap 336,6 degrés) vers la pointe nord, puis revient par l'est et le sud.</desc>
  <defs>
    <marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#E8402A"/>
    </marker>
    <filter id="lueur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="#14151A"/>

  <!-- Tracé -->
  <polyline points="${trace}" fill="none" stroke="#2B2E38" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/>
  <polyline points="${trace}" fill="none" stroke="#EDE7DC" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" filter="url(#lueur)"/>

  <!-- Chevrons de sens -->
  ${CHEVRONS.map((c) => `<g transform="translate(${c.x.toFixed(1)},${c.y.toFixed(1)}) rotate(${c.ang.toFixed(1)})">
    <path d="M-9,-9.5 L13,0 L-9,9.5 L-4.5,0 Z" fill="#E8402A" stroke="#14151A" stroke-width="1.6" stroke-linejoin="round"/>
  </g>`).join('\n  ')}

  <!-- Repères d'ordre de parcours -->
  ${REPERES.map((r) => `<g>
    <circle cx="${r.x.toFixed(1)}" cy="${r.y.toFixed(1)}" r="15" fill="#14151A" stroke="#EDE7DC" stroke-width="1.6"/>
    <text x="${r.x.toFixed(1)}" y="${(r.y + 5.4).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="15" fill="#EDE7DC">${r.n}</text>
    <text x="${r.x.toFixed(1)}" y="${(r.y + 32).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="11.5" fill="#8E93A3">${r.km} km</text>
  </g>`).join('\n  ')}

  <!-- La porte d'arrivée -->
  <line x1="${gate.x1.toFixed(1)}" y1="${gate.y1.toFixed(1)}" x2="${gate.x2.toFixed(1)}" y2="${gate.y2.toFixed(1)}"
        stroke="#EDE7DC" stroke-width="5.5" stroke-linecap="round"/>
  <line x1="${fleche.x1.toFixed(1)}" y1="${fleche.y1.toFixed(1)}" x2="${fleche.x2.toFixed(1)}" y2="${fleche.y2.toFixed(1)}"
        stroke="#E8402A" stroke-width="5" marker-end="url(#fl)" filter="url(#lueur)"/>
  <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="6.5" fill="#EDE7DC"/>

  <!-- Cartouche de la ligne, posé sur le point le plus dégagé de la toile -->
  <line x1="${rappel.x1.toFixed(1)}" y1="${rappel.y1.toFixed(1)}" x2="${rappel.x2.toFixed(1)}" y2="${rappel.y2.toFixed(1)}"
        stroke="#5B6070" stroke-width="1.4" stroke-dasharray="4 4"/>
  <text x="${callout.x.toFixed(1)}" y="${callout.y.toFixed(1)}" font-family="ui-monospace,Menlo,monospace" font-size="14" fill="#EDE7DC" letter-spacing="1.8">DÉPART / ARRIVÉE</text>
  <text x="${callout.x.toFixed(1)}" y="${(callout.y + 22).toFixed(1)}" font-family="ui-monospace,Menlo,monospace" font-size="12.5" fill="#E8402A" letter-spacing="1">CAP 336,6° — NORD-NORD-OUEST</text>
  <text x="${callout.x.toFixed(1)}" y="${(callout.y + 42).toFixed(1)}" font-family="ui-monospace,Menlo,monospace" font-size="11.5" fill="#8E93A3">La flèche donne le seul sens qui compte un tour.</text>

  <!-- Nord -->
  <g transform="translate(${SIDE - 62},58)">
    <line x1="0" y1="26" x2="0" y2="-16" stroke="#8E93A3" stroke-width="2.2" marker-end="url(#fl)"/>
    <text x="0" y="45" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="13" fill="#8E93A3">N</text>
  </g>

  <!-- Échelle -->
  <g transform="translate(56,${SIDE - 46})">
    <line x1="0" y1="0" x2="${ECH_PX.toFixed(1)}" y2="0" stroke="#8E93A3" stroke-width="2.2"/>
    <line x1="0" y1="-6" x2="0" y2="6" stroke="#8E93A3" stroke-width="2.2"/>
    <line x1="${ECH_PX.toFixed(1)}" y1="-6" x2="${ECH_PX.toFixed(1)}" y2="6" stroke="#8E93A3" stroke-width="2.2"/>
    <text x="${(ECH_PX / 2).toFixed(1)}" y="-12" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="#8E93A3">500 m</text>
  </g>

  <!-- Cartouche -->
  <text x="56" y="${SIDE + 34}" font-family="ui-monospace,Menlo,monospace" font-size="17" fill="#EDE7DC" letter-spacing="2.6">BOUTEVILLE — SENS DE PARCOURS</text>
  <text x="56" y="${SIDE + 62}" font-family="ui-monospace,Menlo,monospace" font-size="12.5" fill="#8E93A3">5,913 km · boucle fermée · porte de 2 × 25 m au cap 336,6°</text>
  <text x="56" y="${SIDE + 86}" font-family="ui-monospace,Menlo,monospace" font-size="12.5" fill="#E8402A">Parcourue à l'envers : aucun tour n'est compté.</text>
  <text x="56" y="${SIDE + 108}" font-family="ui-monospace,Menlo,monospace" font-size="11" fill="#5B6070">Relevé fondateur · src/circuit/data/bouteville.geojson · vérifié le 12/08/2026</text>
</svg>`;

fs.writeFileSync('C:/Users/Julie/OneDrive/Desktop/oxv-app/docs/bouteville-sens.svg', svg, 'utf8');

console.log("cartouche pose en", callout.x, callout.y, "- a", callout.d.toFixed(0), "px du plus proche element");
console.log('ligne d\'arrivee : abscisse', sFin.toFixed(0), 'm sur', TOTAL.toFixed(0), '=', (100 * sFin / TOTAL).toFixed(1), '%');
console.log('ecart ligne/trace :', dFin.toFixed(2), 'm');
console.log('chevrons :', CHEVRONS.length, '| reperes :', REPERES.length);
console.log('emprise :', W_M.toFixed(0), 'x', H_M.toFixed(0), 'm');
// Vérification du cap dessiné contre la tangente réelle au point d'arrivée
// Conversion angle ECRAN -> cap GEOGRAPHIQUE : l'angle ecran 0 pointe vers +x
// (l'est, cap 90) et -90 vers le haut (le nord, cap 0). Donc cap = 90 + ang.
const tg = aLAbscisse(sFin + 1);
const capTrace = ((90 + tg.ang) % 360 + 360) % 360;
console.log('cap tangent au trace a la ligne :', capTrace.toFixed(1), '° (stocke : 336.6°)');
// Le vecteur de la grande fleche doit coincider avec la tangente du trace.
const tgx = Math.cos(tg.ang * DEG), tgy = Math.sin(tg.ang * DEG);
console.log('fleche dessinee   (x,y ecran) :', capX.toFixed(3), capY.toFixed(3));
console.log('tangente du trace (x,y ecran) :', tgx.toFixed(3), tgy.toFixed(3));
console.log('ecart angulaire fleche/trace  :', (Math.acos(Math.max(-1, Math.min(1, capX * tgx + capY * tgy))) / DEG).toFixed(2), '°');
REPERES.forEach((r) => console.log(`  repere ${r.n} : ${r.km} km apres la ligne`));
