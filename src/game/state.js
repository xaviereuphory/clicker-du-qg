// L'état complet d'une partie. Tout ce qui est ici est sauvegardé.

import { emptyStudio } from './studio.js';
import { emptyBattles } from './battle.js';

export const SAVE_VERSION = 1;

/**
 * `characterId` : un personnage de data/characters.json, ou un perso créé ('p-…', voir creation.js).
 * `custom` : pour un perso créé, ses talents, son signe particulier et son nom.
 */
export function createState(data, characterId, now = Date.now(), custom = null) {
  return {
    version: SAVE_VERSION,
    characterId,
    custom, // null, ou { name, skills: { idTalent: points }, trait } (perso créé)
    money: data.balance.startMoney,
    totalEarned: 0,
    totalBeats: 0,
    fans: 0,
    peakFans: 0, // record absolu, sert aux paliers de carrière
    fansReference: 0, // niveau de fans « normal » auquel on compare pour le fail out
    high: 0, // niveau de cannabis actif, de 0 à balance.cannabis.maxHigh
    tolerance: 0, // fait monter le prix du cannabis, redescend avec le temps
    producers: {}, // { idProducteur: nombre possédé }
    upgrades: {}, // { idUpgrade: true }
    tierIndex: 0,
    // Animaux de compagnie (data/pets.json)
    pets: {}, // { idAnimal: niveau d'amitié (1 = adopté) }
    companion: '', // animal à côté du personnage ('' = aucun)
    // La serre (débloquée à un palier de carrière)
    greenhouseUnlocked: false,
    grams: 0,
    totalGrams: 0,
    equipment: {}, // { idÉquipement: nombre possédé }
    strains: {}, // { idVariété: niveau }
    // La carte (débloquée à un palier de carrière)
    mapUnlocked: false,
    conquered: { [data.map?.startTerritory ?? 'quartier']: true }, // { idTerritoire: true }
    campaign: '', // territoire en cours de conquête ('' = aucun)
    hype: {}, // { idTerritoire: hype accumulée }
    promoUses: {}, // { idTerritoire: nombre de campagnes promo }
    sampleUses: {}, // { idTerritoire: nombre de distributions d'échantillons }
    // Événements à la BitLife (data/events.json)
    events: {
      nextAt: 0, // secondes de jeu (state.time) du prochain événement ; 0 = pas encore planifié
      pending: '', // id d'un événement qui attend la réponse du joueur
      active: [], // effets temporaires : [{ stat, multiply, until, source }]
      last: {}, // { idÉvénement: state.time de la dernière fois }
    },
    // Battles de beat contre les rivaux de la carte (src/game/battle.js, data/battle.json)
    battles: emptyBattles(), // { pending, last: { idTerritoire: state.time }, wins, losses, best }
    // Éditeur de studio (src/game/studio.js) : le plan de la pièce isométrique
    studio: emptyStudio(), // { layout: [{ id, x, y, rot }], stored: [id] }
    serre: emptyStudio(), // la serre isométrique, même forme (vide tant que la serre est fermée)
    failOut: false,
    broke: false,
    time: 0, // secondes jouées
    lastSeen: now,
  };
}
