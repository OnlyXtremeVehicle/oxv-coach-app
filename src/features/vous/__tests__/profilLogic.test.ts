/**
 * Tests profilLogic (V2-L4, écran Profil public) — ts-jest node, zéro rendu.
 *
 * Points verrouillés :
 *   - handle : normalisation (@, casse, espaces), erreur seulement sur saisie
 *     non vide invalide, valeur à persister (vide/inchangée/invalide → null) ;
 *   - bio : erreur uniquement au-delà de BIO_MAX ;
 *   - chips identité : numéro de course en tête PUIS véhicules, repli de nom ;
 *   - réseaux actifs : seules les clés non vides, dans l'ordre du set ;
 *   - couverture : photo de profil la PLUS RÉCENTE, repli cover véhicule, sinon
 *     undefined (jamais d'image fabriquée), les vidéos/urls nulles ignorées.
 */

import type { PilotMediaView } from '@/services/pilotMediaService';
import type { ReseauxProfil, VehiculeGarage } from '@/lib/queries/profil';

import {
  BIO_MAX,
  activeSocials,
  bioError,
  carNumberChip,
  displayName,
  handleError,
  handleToPersist,
  identityChips,
  initials,
  isHttpUrl,
  lienOuvrable,
  memberSince,
  normalizeHandle,
  pickCoverUri,
  vehicleChipLabel,
  vehiclesToChips,
} from '../profilLogic';

const vehicle = (over: Partial<VehiculeGarage> = {}): VehiculeGarage => ({
  id: 'v1',
  brand: 'Alpine',
  model: 'A110',
  year: 2019,
  ...over,
});

const media = (over: Partial<PilotMediaView>): PilotMediaView => ({
  id: 'm',
  path: 'u/m.jpg',
  type: 'photo',
  signedUrl: 'https://s/m.jpg',
  ...over,
});

describe('handle', () => {
  it('normalise @, casse et espaces', () => {
    expect(normalizeHandle('  @Gabin_46 ')).toBe('gabin_46');
  });

  it('vide → aucune erreur (le nom public est facultatif)', () => {
    expect(handleError('')).toBeNull();
    expect(handleError('   ')).toBeNull();
  });

  it('saisie non vide invalide → erreur', () => {
    expect(handleError('a')).not.toBeNull();
    expect(handleError('nom avec espace')).not.toBeNull();
  });

  it('saisie valide → aucune erreur', () => {
    expect(handleError('@Gabin-46')).toBeNull();
  });

  it('handleToPersist : vide, inchangé ou invalide → null ; changé valide → valeur', () => {
    expect(handleToPersist('', 'gabin')).toBeNull();
    expect(handleToPersist('@Gabin', 'gabin')).toBeNull(); // inchangé après normalisation
    expect(handleToPersist('a', null)).toBeNull(); // invalide
    expect(handleToPersist('  @NeoPilote ', 'gabin')).toBe('neopilote');
  });
});

describe('bio', () => {
  it('sous la limite → null', () => {
    expect(bioError('x'.repeat(BIO_MAX))).toBeNull();
  });
  it('au-delà de la limite → erreur', () => {
    expect(bioError('x'.repeat(BIO_MAX + 1))).not.toBeNull();
  });
});

describe('chips identité', () => {
  it('nom de véhicule avec repli', () => {
    expect(vehicleChipLabel(vehicle())).toBe('Alpine A110');
    expect(vehicleChipLabel(vehicle({ brand: '', model: '' }))).toBe('Véhicule');
  });

  it('mapping véhicules → chips (clé = id véhicule)', () => {
    const chips = vehiclesToChips([vehicle(), vehicle({ id: 'v2', brand: 'BMW', model: 'M2' })]);
    expect(chips).toEqual([
      { key: 'v1', label: 'Alpine A110' },
      { key: 'v2', label: 'BMW M2' },
    ]);
  });

  it('numéro de course en tête, puis véhicules', () => {
    const chips = identityChips({ vehicles: [vehicle()], carNumber: 46 });
    expect(chips[0]).toEqual({ key: 'car-number', label: 'N° 46' });
    expect(chips[1].label).toBe('Alpine A110');
  });

  it('numéro absent → pas de chip numéro', () => {
    expect(carNumberChip(null)).toBeNull();
    const chips = identityChips({ vehicles: [vehicle()], carNumber: null });
    expect(chips.every((c) => c.key !== 'car-number')).toBe(true);
  });
});

describe('identité', () => {
  it('displayName : nom complet, sinon @handle, sinon —', () => {
    expect(displayName({ prenom: 'Gabin', nom: 'Fillat', handle: 'g' })).toBe('Gabin Fillat');
    expect(displayName({ prenom: null, nom: null, handle: 'g' })).toBe('@g');
    expect(displayName({ prenom: null, nom: null, handle: null })).toBe('—');
  });

  it('initiales avec repli', () => {
    expect(initials({ prenom: 'Gabin', nom: 'Fillat' })).toBe('GF');
    expect(initials({ prenom: null, nom: null })).toBe('—');
  });

  it('memberSince : mois/année FR, null si absent/illisible', () => {
    expect(memberSince('2026-07-18T00:00:00Z')).toBe('Membre · depuis juillet 2026');
    expect(memberSince(null)).toBeNull();
    expect(memberSince('pas une date')).toBeNull();
  });
});

describe('réseaux', () => {
  const reseaux = (over: Partial<ReseauxProfil>): ReseauxProfil => ({
    instagram: null,
    youtube: null,
    linkedin: null,
    ...over,
  });

  it('seules les clés non vides, ordre du set', () => {
    const links = activeSocials(reseaux({ youtube: 'https://y', instagram: '  ' }));
    expect(links).toEqual([{ key: 'youtube', label: 'YouTube', url: 'https://y' }]);
  });

  it('isHttpUrl', () => {
    expect(isHttpUrl('https://x')).toBe(true);
    expect(isHttpUrl('ftp://x')).toBe(false);
  });
});

describe('couverture (données réelles)', () => {
  it('photo de profil la plus récente (dernière du tableau)', () => {
    const uri = pickCoverUri(
      [media({ id: 'a', signedUrl: 'https://a' }), media({ id: 'b', signedUrl: 'https://b' })],
      'https://veh'
    );
    expect(uri).toBe('https://b');
  });

  it('ignore vidéos et urls nulles, tombe sur la cover véhicule', () => {
    const uri = pickCoverUri(
      [media({ type: 'video', signedUrl: 'https://vid' }), media({ signedUrl: null })],
      'https://veh'
    );
    expect(uri).toBe('https://veh');
  });

  it('aucune source réelle → undefined (jamais fabriquée)', () => {
    expect(pickCoverUri([], undefined)).toBeUndefined();
    expect(pickCoverUri([media({ signedUrl: null })], '')).toBeUndefined();
  });
});

/**
 * LE HELPER QUI DÉCIDE SI UN BOUTON EXISTE.
 *
 * Sans lui, `Linking.openURL('instagram.com/x')` rejette, le `.catch()` avale,
 * et l'utilisateur touche un contrôle qui ne fait RIEN — sans message, sans
 * trace, indéfiniment. C'est le pire des états : il croit l'application cassée.
 */
describe('lienOuvrable', () => {
  it('complète le schéma manquant — personne ne tape « https:// »', () => {
    expect(lienOuvrable('instagram.com/monpseudo')).toBe('https://instagram.com/monpseudo');
    expect(lienOuvrable('cafeducircuit.fr')).toBe('https://cafeducircuit.fr');
    expect(lienOuvrable('  oxvehicle.fr/circuit  ')).toBe('https://oxvehicle.fr/circuit');
  });

  it('ne réécrit pas un schéma déjà choisi', () => {
    expect(lienOuvrable('https://x.fr')).toBe('https://x.fr');
    expect(lienOuvrable('http://x.fr')).toBe('http://x.fr');
    expect(lienOuvrable('mailto:a@b.fr')).toBe('mailto:a@b.fr');
    expect(lienOuvrable('tel:+33600000000')).toBe('tel:+33600000000');
  });

  it('une adresse électronique nue devient un mailto', () => {
    expect(lienOuvrable('accueil@cafeducircuit.fr')).toBe('mailto:accueil@cafeducircuit.fr');
  });

  it('une PHRASE n’est pas une adresse', () => {
    // Cas réel du champ « Email de contact » : « Contact : accueil@… » a été
    // saisi tel quel. Un espace suffit à trancher.
    expect(lienOuvrable('Contact : accueil@x.fr')).toBe(null);
    expect(lienOuvrable('voir avec le patron')).toBe(null);
  });

  it('ce qui ne ressemble à rien d’ouvrable rend null', () => {
    expect(lienOuvrable('brouillon')).toBe(null);
    expect(lienOuvrable('')).toBe(null);
    expect(lienOuvrable('   ')).toBe(null);
    expect(lienOuvrable(null)).toBe(null);
    expect(lienOuvrable(undefined)).toBe(null);
  });

  it('ne fabrique pas une adresse à partir d’un schéma non navigable', () => {
    // `javascript:` et `file:` ne doivent jamais être complétés ni ouverts au
    // motif qu'ils « ressemblent » à quelque chose.
    expect(lienOuvrable('javascript:alert(1)')).toBe(null);
    expect(lienOuvrable('file:///etc/passwd')).toBe(null);
  });
});
