# Registre Véhicule OXV — document canonique

Version 1.2 — 26/08/2026
**Supersede les versions 1.0 et 1.1 du 26/08/2026.** En cas de divergence, la présente version prime.

Modifications v1.1 → v1.2 : manifeste signé sur les empreintes (§5.4), signature arbitrée sur terminal opérateur (§5.1), mécanisme du trou et refus tracé (§2.5), restitution des journées non validées dans le PDF et à la cession (§6.2, §6.4), tables `validations_constat` et `refus_constat` (§3.1), clause CGV (§7.5).

---

## 1. Objet

Le Registre Véhicule OXV est un dossier factuel, rattaché à un véhicule, qui consigne ce qui s'est passé lors de chaque journée de piste : identité administrative, état photographique constaté à l'entrée et à la sortie, journal de roulage, déclarations d'entretien du pilote.

Il est exportable en PDF horodaté et transférable à l'acquéreur du véhicule.

### 1.1 Ce que le registre fait

Il supprime la décote d'incertitude. À la revente, un acheteur ne pénalise pas l'usage circuit en tant que tel : il pénalise l'absence de traçabilité. Nombre de sessions inconnu, intensité inconnue, entretien invérifiable, incident possible non déclaré. Un véhicule documenté n'encaisse pas cette pénalité forfaitaire.

### 1.2 Ce que le registre ne fait pas — contrainte absolue

**OXV n'affirme jamais, sous aucune forme, que rouler sur circuit augmente la valeur d'un véhicule.** L'affirmation est fausse et constituerait une pratique commerciale trompeuse (art. L121-1 du code de la consommation).

Interdits éditoriaux, sur le site, dans l'app, dans les pièces imprimées et dans les argumentaires :

- toute estimation de prix, cote, valorisation ou fourchette de valeur
- toute mention de « plus-value », « valorisation », « investissement », « rendement »
- toute notation, score, indice ou appréciation de l'état du véhicule
- toute comparaison entre véhicules

Formulation autorisée : « Le registre documente l'usage de votre véhicule. » Rien au-delà.

### 1.3 Articulation avec la doctrine miroir

Le registre est une restitution, pas une prescription. Il énonce des faits datés et horodatés. Il ne conseille pas, ne note pas, ne recommande pas. Valeur absente : « — », jamais zéro.

---

## 2. Règles d'éligibilité

### 2.1 Droit d'accès

Le droit au registre est ouvert par l'**achat** d'une offre Signature ou Heritage. Il n'est pas attaché à la journée.

Un membre détenteur du droit bénéficie du registre sur **l'intégralité de ses journées de la fenêtre en cours**, journées Access comprises. Access seul n'ouvre aucun droit.

### 2.2 Fenêtre de validité

Le droit court du **premier jour du mois de la première journée du calendrier annuel** au **dernier jour du mois de la dernière journée du calendrier annuel**.

Exemple : calendrier du 6 avril au 17 octobre → droit ouvert du 1er avril au 31 octobre inclus.

Fenêtre identique pour tous les membres d'une même année d'exploitation, recalculée chaque année à la publication du calendrier. Un nouvel achat Signature ou Heritage rouvre le droit sur la fenêtre suivante.

Hors fenêtre, le registre reste **consultable et exportable** — seule l'alimentation cesse.

### 2.3 Capture universelle, restitution différenciée

La séquence photographique entrée/sortie est exécutée sur **tous les véhicules présents**, Access compris, sans distinction d'offre.

Justification : le constat d'entrée est la protection en responsabilité d'OXV sur chaque journée, indépendamment de la formule achetée. Il ne peut pas être conditionné à un niveau de gamme.

### 2.4 Rattachement de l'objet

Le registre est rattaché au **véhicule**, identifié par son VIN. Un membre possédant plusieurs véhicules dispose d'autant de registres distincts. À la cession, le registre est transférable au nouvel acquéreur.

### 2.5 Journées non validées — le trou

Une journée n'entre au registre que si le constat d'entrée a été signé par le pilote.

En l'absence de signature, la journée est **consignée comme non validée**. Elle apparaît dans le registre avec la mention « — · constat non validé » et n'ouvre ni planche, ni comparatif.

Trois causes possibles, toutes tracées et horodatées :

| Cause | Traitement |
|---|---|
| Refus explicite du pilote | Enregistré dans `refus_constat`, motif libre facultatif |
| Contestation du constat | Journée suspendue jusqu'à arbitrage du responsable de journée |
| Capture incomplète ou défaillance | Enregistré comme incident technique, imputé à OXV |

**Le trou porte sur la journée entière**, entrée et sortie. Sans constat d'entrée signé, les vues de sortie n'ont aucune référence : la comparaison est nulle et n'est pas produite.

**Le refus est tracé, jamais absent.** Un trou sans cause consignée ressemble à une défaillance d'OXV. Un trou avec refus horodaté est une décision documentée du pilote. La distinction est essentielle à la cession du véhicule.

---

## 3. Schéma de données Supabase

### 3.1 Tables

```sql
create table vehicules (
  id                uuid primary key default gen_random_uuid(),
  vin               text not null unique,
  immatriculation   text,
  marque            text,
  modele            text,
  millesime         int,
  histovec_statut   text,                 -- 'concordant' | 'non_verifie' | 'ecart'
  histovec_date     timestamptz,
  proprietaire_id   uuid references membres(id),
  cree_le           timestamptz not null default now()
);

create table registre_droits (
  id                uuid primary key default gen_random_uuid(),
  membre_id         uuid not null references membres(id),
  origine_achat_id  uuid not null references commandes(id),
  offre             text not null check (offre in ('signature','heritage')),
  fenetre_debut     date not null,
  fenetre_fin       date not null,
  cree_le           timestamptz not null default now()
);

create table presences_vehicule (
  id                uuid primary key default gen_random_uuid(),
  vehicule_id       uuid not null references vehicules(id),
  journee_id        uuid not null references journees(id),
  pilote_id         uuid not null references membres(id),
  offre_journee     text not null check (offre_journee in ('access','signature','heritage','b2b')),
  statut            text not null default 'en_cours'
                    check (statut in ('en_cours','validee','non_validee','suspendue')),
  km_entree         int,
  km_sortie         int,
  tours             int,
  duree_piste_s     int,
  incident_declare  boolean not null default false,
  incident_texte    text,
  unique (vehicule_id, journee_id)
);

create table captures (
  id                uuid primary key default gen_random_uuid(),
  presence_id       uuid not null references presences_vehicule(id),
  phase             text not null check (phase in ('entree','sortie')),
  vue               text not null,
  storage_path      text not null,
  sha256            text not null,        -- calculé sur le fichier COMPRESSÉ, cf. §11.1
  largeur_px        int not null,
  poids_octets      int not null,
  pris_le           timestamptz not null,
  operateur_id      uuid references membres(id),
  unique (presence_id, phase, vue)
);

-- Manifeste signé : scelle les 12 empreintes, pas seulement l'instant
create table validations_constat (
  id                uuid primary key default gen_random_uuid(),
  presence_id       uuid not null references presences_vehicule(id),
  phase             text not null check (phase in ('entree','sortie')),
  manifeste_json    jsonb not null,       -- [{vue, sha256}] × 12, ordre figé
  manifeste_sha256  text not null,        -- empreinte du manifeste lui-même
  signature_path    text not null,        -- tracé de signature, PNG
  signe_le          timestamptz not null,
  operateur_id      uuid not null references membres(id),
  unique (presence_id, phase)
);

create table refus_constat (
  id                uuid primary key default gen_random_uuid(),
  presence_id       uuid not null references presences_vehicule(id),
  nature            text not null check (nature in ('refus','contestation','incident_technique')),
  motif             text,                 -- factuel, sans qualification de responsabilité
  consigne_le       timestamptz not null default now(),
  operateur_id      uuid not null references membres(id),
  arbitre_le        timestamptz,
  arbitrage         text                  -- 'validee' | 'non_validee'
);

create table entretiens_declares (
  id                uuid primary key default gen_random_uuid(),
  vehicule_id       uuid not null references vehicules(id),
  nature            text not null,
  date_intervention date not null,
  km                int,
  intervenant       text,
  justificatif_path text,
  declare_le        timestamptz not null default now()
);

create table registres_exports (
  id                uuid primary key default gen_random_uuid(),
  vehicule_id       uuid not null references vehicules(id),
  storage_path      text not null,
  sha256            text not null,
  perimetre_debut   date not null,
  perimetre_fin     date not null,
  genere_le         timestamptz not null default now()
);

create table transferts_vehicule (
  id                uuid primary key default gen_random_uuid(),
  vehicule_id       uuid not null references vehicules(id),
  cedant_id         uuid not null references membres(id),
  acquereur_email   text not null,
  jeton             text not null unique,
  active_le         timestamptz,
  cree_le           timestamptz not null default now()
);
```

### 3.2 Règle de visibilité

Une présence est restituée au pilote si et seulement si :

```
presences_vehicule.pilote_id = membre courant
ET EXISTE registre_droits d tel que
    d.membre_id = pilote_id
    ET journee.date ENTRE d.fenetre_debut ET d.fenetre_fin
```

À implémenter en RLS Postgres, jamais côté client. Les captures existent pour toutes les présences ; seule leur restitution est conditionnée.

**Immuabilité.** Aucune mise à jour ni suppression sur `captures` et `validations_constat` après insertion. À imposer par politique RLS, pas par convention applicative. Le pilote consulte, il ne modifie pas.

### 3.3 Conservation

- Captures : 5 ans à compter de la journée
- Exports PDF : sans limite tant que le véhicule est actif au registre
- Après cession : accès du cédant en lecture seule sur le périmètre antérieur

---

## 4. Protocole terrain — 12 vues figées

Séquence identique à chaque passage, entrée et sortie. Aucune vue supplémentaire, aucune vue omise.

| # | Code | Vue |
|---|------|-----|
| 1 | `3q_av_g` | Trois-quarts avant gauche |
| 2 | `3q_av_d` | Trois-quarts avant droit |
| 3 | `3q_ar_g` | Trois-quarts arrière gauche |
| 4 | `3q_ar_d` | Trois-quarts arrière droit |
| 5 | `face_av` | Face avant |
| 6 | `face_ar` | Face arrière |
| 7 | `flanc_g` | Flanc gauche |
| 8 | `flanc_d` | Flanc droit |
| 9 | `jante_av_g` | Jante et pneumatique avant gauche |
| 10 | `jante_ar_d` | Jante et pneumatique arrière droit |
| 11 | `pare_brise` | Pare-brise, plein cadre |
| 12 | `compteur` | Compteur, kilométrage lisible |

**Budget temps : 90 s par véhicule**, signature comprise. Vingt pilotes → 30 min à l'accueil, 30 min en sortie.

**Consignes.** Véhicule à l'arrêt, moteur coupé. Distance constante, environ 2 m pour les vues 1 à 8. Aucun retraitement, aucun filtre, aucun recadrage après capture.

---

## 5. PWA administrateur

`app.oxvehicle.fr/admin/capture` — application web progressive, aucune installation, fonctionne sur tout terminal doté d'un appareil photo.

### 5.1 Parcours — arbitré

1. Scan du QR de la fiche pilote → présence résolue, véhicule rattaché
2. Sélection de la phase : entrée ou sortie
3. Saisie du kilométrage
4. Douze cadres guidés, gabarit superposé, avance automatique
5. Calcul des douze empreintes SHA-256 sur le terminal
6. Planche de contrôle présentée au pilote, reprise possible vue par vue
7. **Signature du pilote sur le terminal opérateur** — scelle le manifeste, cf. §5.4
8. Enregistrement et mise en file d'upload

**La signature a lieu au point de capture, sur le terminal opérateur.** Elle est native hors ligne et instantanée, sans dépendance au réseau du paddock ni transfert entre terminaux. C'est le seul geste qui se déroule hors de l'application du pilote.

Le pilote consulte ensuite l'intégralité du dossier dans son application : planche, empreintes, comparatif, historique. Il ne peut rien modifier.

**Aucun enregistrement sans signature.** Sans validation, la présence bascule en `non_validee` ou `suspendue` selon la cause, cf. §2.5.

### 5.2 Mode dégradé — obligatoire dès V0

Capture, calcul d'empreintes et signature intégralement fonctionnels hors ligne : stockage IndexedDB, file d'attente persistant à la fermeture d'onglet et au redémarrage, reprise automatique au retour de connexion, indicateur d'état permanent.

### 5.3 Intégrité

Empreinte SHA-256 calculée sur le fichier compressé et stockée en base. Toute modification ultérieure devient détectable. C'est ce qui rend le registre opposable plutôt que déclaratif.

### 5.4 Manifeste signé — spécification

La signature doit porter sur le **contenu** des clichés, pas sur l'instant de leur prise. Une signature horodatée seule atteste d'un moment et ne résiste pas à une contestation portant sur ce qui a été montré.

Séquence :

1. Les douze clichés sont compressés localement
2. Le SHA-256 de chaque fichier compressé est calculé sur le terminal
3. Un manifeste est composé : `[{vue, sha256}]`, douze entrées, ordre figé selon §4
4. L'empreinte du manifeste lui-même est calculée
5. La planche est présentée au pilote, empreinte du manifeste affichée
6. Le pilote signe
7. Manifeste, empreinte de manifeste, tracé de signature et horodatage sont enregistrés ensemble

Le pilote signe ainsi douze fichiers identifiables, pas une action. Toute substitution ultérieure d'un cliché rompt la correspondance et devient démontrable.

---

## 6. Chaîne d'automatisation

```
Accueil    → capture entrée (12 vues) → manifeste → signature → file d'upload
Roulage    → journal de session alimenté depuis la télémétrie
Sortie     → capture sortie (12 vues) → manifeste → signature → file d'upload
Clôture J  → edge function : contrôle de complétude et de validation
J+7 max    → edge function : composition PDF → Resend
```

### 6.1 Contrôle de complétude

À la clôture, vérification par présence : 12 vues entrée, 12 vues sortie, manifeste signé pour chaque phase, kilométrages saisis.

Toute présence incomplète est signalée au portail admin. **Aucun PDF n'est généré sur un dossier incomplet** — un registre lacunaire vaut moins qu'un registre absent.

Une présence `suspendue` bloque la génération jusqu'à arbitrage du responsable de journée.

### 6.2 Composition du PDF

Chaîne HTML → Playwright/Chromium → PDF. Charte v2, ivoire, noir mat, rouge. Assertions pagination et polices via pymupdf. Millésime « 2026 » seul.

1. Couverture — véhicule, VIN, période couverte
2. Concordance HistoVec — statut et date
3. Journal de roulage — date, circuit, tours, durée. Valeur absente : « — »
4. Planche entrée — 12 vues
5. Planche sortie — 12 vues
6. Comparatif — vues 1 à 8 en vis-à-vis
7. Entretiens déclarés
8. **Journées non validées** — date, circuit, nature consignée, horodatage. Sans qualification, sans commentaire
9. Mentions — empreintes SHA-256, empreintes de manifestes, horodatages de signature, périmètre déclaratif

La section 8 n'existe que si au moins une journée est concernée. Elle énonce le fait, jamais son interprétation.

### 6.3 Transmission

Resend depuis `contact@oxvehicle.fr`, sous 7 jours. Aligné sur la boucle de preuve contractuelle partenaires.

### 6.4 Transfert à l'acquéreur

Le cédant déclenche le transfert depuis son espace. L'acquéreur reçoit un lien à jeton unique. À l'activation, il obtient l'accès complet en lecture ; le cédant conserve une lecture seule limitée au périmètre antérieur. Le transfert ne requiert pas que l'acquéreur soit membre OXV.

**Les journées non validées sont transmises.** Le registre remis à l'acquéreur comporte la section 8 à l'identique. Un registre expurgé de ses trous ne serait plus une restitution factuelle et perdrait toute valeur probante.

---

## 7. Conditions bloquantes

**7.1 Séparation NADIR / OXV.** NADIR est l'entité audiovisuelle. Si un opérateur photographie pour le compte d'OXV, cession de droits NADIR → OXV et facturation intercompany requises. Validation SAEC Lalande avant la première journée.

**7.2 Signature du constat d'entrée.** Le constat est présenté et signé par le pilote **avant qu'il ne roule**. Aucune signature a posteriori. Un constat d'entrée signé après la sortie n'est pas un constat d'entrée : le pilote connaît alors l'issue de la journée, et la validation perd toute portée. Bloquant absolu, aucun aménagement.

**7.3 RGPD.** Immatriculation, VIN et tracé de signature sont des données personnelles. Opt-in explicite au briefing, mention dédiée dans la charte du club, floutage automatique de la plaque sur toute image diffusée hors du registre. Le registre conserve la plaque en clair — c'est sa fonction probante.

**7.4 Périmètre déclaratif.** Le constat documente un état apparent. Il ne constitue ni expertise, ni certification, ni garantie. Mention en pied de chaque page du PDF. La sécurité en piste reste la responsabilité de l'opérateur du circuit.

**7.5 Clause contractuelle.** À inscrire aux CGV et à la charte du club, à valider par SAEC Lalande :

> Chaque véhicule fait l'objet d'un constat photographique à l'entrée et à la sortie de la journée. Le constat d'entrée est présenté au pilote avant son premier passage en piste et validé par sa signature électronique. En l'absence de validation, la journée est consignée comme non validée au registre du véhicule et le véhicule n'est pas admis en piste. Le constat documente un état apparent à un instant donné ; il ne constitue ni expertise, ni certification, ni garantie.

---

## 8. Gestion opérationnelle

### 8.1 Poste opérateur

Capture d'entrée et de sortie exécutées par un **opérateur OXV**, non par le pilote. Charge intégrée au coût de la journée de piste.

Recours à l'**intérim**. Le protocole ne demande aucun jugement : douze cadres guidés, avance automatique, contrôle de complétude côté serveur. Briefing de vingt minutes.

**Récurrence conditionnée.** La première journée fait office de validation. En cas de succès, mission reconduite sur l'ensemble du calendrier avec la **même personne**, planifiée en amont. La rotation d'intérimaires est le principal risque de dérive du protocole en cours de saison.

### 8.2 Charge

| Poste | Volume |
|---|---|
| Capture entrée, signature comprise | 30 min / journée |
| Capture sortie, signature comprise | 30 min / journée |
| Contrôle de complétude et reprises | 15 min / journée |
| **Total** | **1 h 15 / journée** |

Facturation intérim : coefficient agence, durée minimale de vacation. La vacation facturée sera supérieure à la charge réelle.

**À vérifier :** la ligne doit apparaître nommément dans le classeur canonique.

### 8.3 Indicateurs de pilotage

Deux, pas davantage :

- **Taux de dossiers complets** — cible saison 1 : 95 % minimum
- **Taux de journées validées** — cible saison 1 : 98 % minimum

Un taux de validation dégradé signale un problème d'acceptation du protocole, pas un problème technique. Les deux se traitent différemment.

---

## 9. Stratégie de commercialisation

### 9.1 Principe — le registre ne se vend pas

Le registre n'est jamais une ligne tarifaire côté pilote. Dès qu'il se facture, il devient une promesse de valeur, et le risque L121-1 écarté au §1.2 réapparaît intégralement.

Il est inclus, silencieux, et fait vendre autre chose.

### 9.2 Levier principal — lever l'objection d'entrée

L'obstacle réel à la vente d'une journée GT n'est pas le prix. C'est : « je ne mets pas ma voiture sur un circuit. » Peur de l'abîmer, peur de la décoter, peur de ne pas savoir ce qui s'est passé. Cette objection tue la conversion avant que le tarif ne soit discuté.

Le registre y répond frontalement. Non pas « votre voiture prendra de la valeur » — jamais. Mais : **vous saurez exactement ce qui s'est passé, et vous pourrez le prouver.**

Sa place est **en amont**, dans l'argumentaire d'acquisition, pas en aval dans un mécanisme de montée en gamme.

Formulations validées :

- « État constaté à l'entrée, état constaté à la sortie. Documenté, horodaté, à vous. »
- « Votre véhicule repart avec son dossier. »
- « Rien n'est laissé à l'appréciation. »

### 9.3 Levier secondaire — rétention

Un véhicule totalisant plusieurs journées documentées possède une chaîne continue. Aller rouler ailleurs la rompt.

Ce levier ne s'écrit pas, ne se vend pas, ne s'annonce pas. Il opère seul, au moment où le membre choisit sa prochaine journée. Toute tentative de le verbaliser le transforme en argument de rétention agressif et le détruit.

### 9.4 Piste à instruire — assurance

Un parc dont l'usage est documenté et l'état constaté constitue un dossier différent, face à un courtier, d'un parc opaque. Levier potentiel de négociation d'une couverture collective.

**Aucune communication aux pilotes tant qu'un courtier ne l'a pas confirmé par écrit.**

### 9.5 Ouverture B2B — saison 2

Un atelier partenaire accédant aux registres des véhicules dont le propriétaire a consenti dispose d'un flux qualifié. Cela justifie le haut de fourchette Atelier Officiel plutôt que le bas.

**Séquencement impératif :** aucune commercialisation B2B du registre en saison 1. Exécuter sur le calendrier complet, mesurer les deux taux du §8.3, corriger. Un registre vendu à un partenaire puis mal tenu détruit plus de valeur qu'il n'en crée, et il n'y aura pas de seconde chance sur ce terrain.

Ouverture en saison 2, adossée à une preuve d'exécution chiffrée.

### 9.6 Ce qui est abandonné

Le mécanisme d'upsell Access → Signature par déverrouillage rétroactif visible est **écarté**. Il contredisait le §9.1 en faisant du registre un objet de négociation tarifaire.

Le déverrouillage rétroactif reste un **fait technique** — un membre qui souscrit Signature voit apparaître son historique déjà capturé sur la fenêtre en cours. Il n'est ni mis en avant, ni utilisé comme argument.

---

## 10. Lotissement de développement

### V0 — journée de validation uniquement

PWA de capture seule : scan QR, 12 vues guidées, compression et calcul d'empreintes, manifeste, signature tactile, file d'upload offline. Rien d'autre.

PDF assemblé manuellement par script après coup.

Objet : valider le protocole terrain, le budget de 90 s signature comprise, et l'opérateur.

### V1 — après validation de la journée 1

- Contrôle de complétude et de validation automatique à la clôture
- Composition PDF par la chaîne HTML → Playwright, section 8 comprise
- Envoi Resend sous 7 jours
- Portail admin : dossiers incomplets, présences suspendues, arbitrage

### V2 — saison suivante

- Espace pilote : consultation planche, empreintes, comparatif, historique
- Transfert à l'acquéreur par jeton
- Accès partenaire B2B sous consentement

Ce lotissement permet d'échouer sur la journée 1 sans avoir dépensé la V1.

---

## 11. Contraintes techniques terrain

### 11.1 Volume et compression

480 clichés par journée. À 4 Mo bruts : 2 Go, inuploadables depuis un paddock.

Compression obligatoire **côté client, avant calcul d'empreinte et mise en file** : redimension 2 048 px sur le grand côté, JPEG qualité 80 → environ 600 Ko par cliché, 290 Mo par journée.

**L'empreinte SHA-256 se calcule sur le fichier compressé**, jamais sur l'original. Une empreinte calculée avant compression ne prouve rien, puisque le fichier stocké diffère de celui qui a été haché.

### 11.2 Réseau

Offline-first strict. Voir §5.2. Capture, empreintes et signature ne dépendent d'aucune connexion.

### 11.3 Terminal

480 captures, compression et calcul d'empreintes sur un terminal unique : chauffe, throttling, batterie épuisée avant la phase de sortie.

**Deux terminaux en alternance, ou un terminal plus batterie externe.** À budgéter avec la ligne intérim.

### 11.4 QR sur fiche pilote

Le QR de résolution de présence doit être imprimé sur les fiches pilotes en amont. À intégrer à la prochaine réimpression de la fiche pilote A5. À défaut, repli sur recherche par nom — fonctionnel mais plus lent, au détriment du budget de 90 s.

---

## 12. Points ouverts

| # | Point | Échéance |
|---|-------|----------|
| 1 | Cession de droits NADIR → OXV, validation SAEC Lalande | Avant journée 1 |
| 2 | Clause §7.5 validée par SAEC Lalande, versée aux CGV et à la charte | Avant ouverture des inscriptions |
| 3 | Ligne intérim nommée explicitement dans le classeur canonique | Prochaine mise à jour du modèle |
| 4 | QR de présence sur fiche pilote A5 | Prochaine réimpression |
| 5 | Argument registre dans l'argumentaire d'acquisition et sur le site | Après validation journée 1 |
| 6 | Valeur probante de la signature électronique simple — niveau eIDAS retenu | À instruire avec SAEC Lalande |
| 7 | Prise de contact courtier — piste assurance | Saison 1, sans communication |
| 8 | Ouverture B2B du registre | Saison 2, sur preuve chiffrée |

---

Fin de document.
