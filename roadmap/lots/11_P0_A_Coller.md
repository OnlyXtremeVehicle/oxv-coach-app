# À coller dans Claude Code — P0.1

*Un seul lot. Aucun chiffre affiché ne change : on remplit trois colonnes qui
sont vides depuis leur création.*

---

## Contexte à donner à Claude Code

> Trois colonnes de `telemetry_frames` — `heading_accuracy`, `speed_accuracy`,
> `pdop` — ont été créées par la migration `telemetry_frames_add_accuracy_fields`
> et ne sont **jamais écrites** : zéro valeur sur les 26 999 trames de la seule
> capture réelle (Bouteville, 12/08/2026). Or `heading` est nul sur 100 % de ces
> trames parce que le boîtier laisse le bit 5 des *Fix Status Flags* à zéro, et
> `heading_accuracy` est précisément le champ qui dirait si le cap écarté était
> exploitable.
>
> Les offsets du parseur ont été vérifiés un par un contre le *RaceBox BLE
> Protocol Description rev 8* : ils sont tous justes. Il ne s'agit donc pas de
> corriger une lecture, mais d'**écrire trois champs déjà disponibles**.
>
> Contrainte : ne change aucun calcul, aucun seuil, aucune valeur affichée.

---

## 1 · `src/ubx/parser.ts`

Chercher :

```ts
    motion: {
      speed: (dv.getUint32(54, LE) * 3.6) / 1000,
      heading: dv.getUint32(58, LE) / 1e5,
      headingValid: (fixStatusFlags & 0x20) !== 0,
    },
```

Remplacer par :

```ts
    motion: {
      speed: (dv.getUint32(54, LE) * 3.6) / 1000,
      // Précision de vitesse (charge utile 56 → +6 = 62, en mm/s) et précision
      // de cap (charge utile 60 → +6 = 66, en degrés × 1e5), rev 8 p. 5-6.
      // Elles ne changent aucun calcul : elles rendent décidable la question
      // « le cap écarté par le drapeau était-il exploitable ? ».
      speedAccuracy: dv.getUint32(62, LE) / 1000,
      heading: dv.getUint32(58, LE) / 1e5,
      headingValid: (fixStatusFlags & 0x20) !== 0,
      headingAccuracy: dv.getUint32(66, LE) / 1e5,
      // PDOP (charge utile 64 → +6 = 70, facteur 100).
      pdop: dv.getUint16(70, LE) / 100,
    },
```

---

## 2 · `src/types/telemetry.ts`

Chercher :

```ts
  motion: {
    speed: number;
    heading: number;
    headingValid: boolean;
  };
```

Remplacer par :

```ts
  motion: {
    speed: number;
    /** Erreur estimée de la vitesse, en m/s. Optionnel : les fixtures de test
     *  antérieures ne le portent pas. */
    speedAccuracy?: number;
    heading: number;
    headingValid: boolean;
    /** Erreur estimée du cap, en degrés. C'est ce champ qui dit si un cap
     *  écarté par `headingValid` était malgré tout exploitable. */
    headingAccuracy?: number;
    /** Position Dilution of Precision. */
    pdop?: number;
  };
```

---

## 3 · `src/services/captureFrameMapping.ts`

Chercher :

```ts
  speed_ms: number | null;
  heading: number | null;
```

Remplacer par :

```ts
  speed_ms: number | null;
  speed_accuracy: number | null;
  heading: number | null;
  heading_accuracy: number | null;
  pdop: number | null;
```

Puis chercher :

```ts
    speed_ms: frame.motion.speed / 3.6,
    heading: frame.motion.headingValid ? frame.motion.heading : null,
```

Remplacer par :

```ts
    speed_ms: frame.motion.speed / 3.6,
    speed_accuracy: frame.motion.speedAccuracy ?? null,
    // Le cap reste conditionné au drapeau du constructeur : on n'invente pas une
    // validité qu'il ne déclare pas. La PRÉCISION, elle, est écrite dans tous les
    // cas — c'est elle qui dira si le cap écarté était exploitable.
    heading: frame.motion.headingValid ? frame.motion.heading : null,
    heading_accuracy: frame.motion.headingAccuracy ?? null,
    pdop: frame.motion.pdop ?? null,
```

---

## 4 · Le test

Ajouter à `src/ubx/__tests__/parser.test.ts` un cas sur le **paquet d'exemple du
constructeur**, qui est publié dans la documentation rev 8 et dont les valeurs
attendues sont données :

```
B5 62 FF 01 50 00 A0 E7 0C 07 E6 07 01 0A 08 33
08 37 19 00 00 00 2A AD 4D 0E 03 01 EA 0B C6 93
E1 0D 3B 37 6F 19 61 8C 09 00 0F 01 09 00 9C 03
00 00 2C 07 00 00 23 00 00 00 00 00 00 00 D0 00
00 00 88 A9 DD 00 2C 01 00 59 FD FF 71 00 CE 03
2F FF 56 00 FC FF 06 DB
```

Attendus publiés : vitesse 0,126 km/h · cap 0° · **précision de vitesse
0,208 m/s** · **précision de cap 145,26856°** · **PDOP 3** · GForceY 0,113 g ·
Rotation Z 0,04 °/s · batterie 89 % · 11 satellites.

Ce paquet est aussi la démonstration du besoin : cap à 0°, drapeau à zéro,
et une précision de 145° qui explique pourquoi.

---

## 5 · Ce qu'il ne faut PAS faire dans ce lot

- Ne pas dériver le cap depuis la trajectoire. C'est un autre chantier (P7).
- Ne pas relâcher `headingValid`. Tant qu'on n'a pas mesuré `heading_accuracy`
  sur une séance réelle, changer la condition serait deviner.
- Ne pas toucher aux seuils du QDI ni à `QDI_ALGO_VERSION`. Décision fondateur.
- Ne pas modifier `INSIGHTS_JEU_ESSAI` ni les gardes de moteurs de démonstration :
  elles fonctionnent.

---

## 6 · Recette

```
npx tsc --noEmit
npm test -- parser captureFrameMapping
```

Puis, après la prochaine capture réelle :

```sql
select count(*) n, count(heading) cap_valides,
       round(avg(heading_accuracy),1) precision_cap_moy,
       round(avg(speed_accuracy),3) precision_vitesse_moy,
       round(avg(pdop),2) pdop_moy
from telemetry_frames where session_id = '<la séance>';
```
