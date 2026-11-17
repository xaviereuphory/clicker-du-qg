// La carte : conquérir l'industrie musicale, territoire par territoire.
//   - Débloquée à un palier de carrière (data/map.json → unlockTier).
//   - Une campagne à la fois. La hype monte toute seule grâce aux fans
//     (racine carrée du nombre de fans), plus vite avec des shows (clics),
//     de la promo ($) et des échantillons (g). Promo et échantillons coûtent
//     une minute de revenu, puis deux fois plus à chaque usage sur le même territoire.
//   - Certains territoires ont un rival qui fait baisser la hype chaque seconde.
//   - Un territoire conquis donne un bonus permanent et ouvre ses voisins.

import { getModifiers } from './modifiers.js';
import { incomePerSecond } from './economy.js';
import { gramsPerSecond } from './greenhouse.js';

const territory = (data, id) => data.map.territories.find((t) => t.id === id);

export function isConquered(state, id) {
  return Boolean(state.conquered[id]);
}

/** Un territoire est ouvert quand un de ses voisins requis est conquis (ou tous, si requiresAll). */
export function isAvailable(state, data, t) {
  if (!state.mapUnlocked || isConquered(state, t.id)) return false;
  if (t.requires.length === 0) return true;
  const done = t.requires.map((id) => isConquered(state, id));
  return t.requiresAll ? done.every(Boolean) : done.some(Boolean);
}

export function hypePerSecond(state, data, mods = getModifiers(state, data)) {
  return Math.sqrt(state.fans) * data.map.hypePerSqrtFan * mods.hype;
}

/** Hype nette pour un territoire : ce que les fans apportent moins la défense du rival. */
export function netHypePerSecond(state, data, t, mods = getModifiers(state, data)) {
  return hypePerSecond(state, data, mods) - (t.defense ?? 0);
}

export function showHype(state, data, mods = getModifiers(state, data)) {
  return (1 + hypePerSecond(state, data, mods) * data.map.showShareOfRate) * mods.hype;
}

export function promoCost(state, data, t, mods = getModifiers(state, data)) {
  const p = data.map.promo;
  const base = Math.max(p.minCost, incomePerSecond(state, data, mods) * p.incomeSeconds);
  return Math.ceil(base * p.growth ** (state.promoUses[t.id] ?? 0));
}

export function samplesCost(state, data, t, mods = getModifiers(state, data)) {
  const p = data.map.samples;
  const base = Math.max(p.minCost, gramsPerSecond(state, data, mods) * p.growSeconds);
  return Math.ceil(base * p.growth ** (state.sampleUses[t.id] ?? 0));
}

export function campaignTerritory(state, data) {
  return state.campaign ? territory(data, state.campaign) : null;
}

/**
 * Ajoute de la hype à un territoire ouvert (campagne en cours ou non) ; le conquiert si la barre
 * est pleine. Sert à la campagne et aux battles de beat gagnées contre un rival.
 */
export function addTerritoryHype(state, data, id, amount) {
  const t = territory(data, id);
  if (!t || isConquered(state, id)) return [];
  state.hype[id] = Math.min(t.hype, Math.max(0, (state.hype[id] ?? 0) + amount));
  if (state.hype[id] < t.hype) return [];
  state.conquered[id] = true;
  if (state.campaign === id) state.campaign = '';
  return [{ type: 'territoryConquered', id, name: t.name }];
}

/** Ajoute de la hype à la campagne en cours. */
function addHype(state, data, amount) {
  return state.campaign ? addTerritoryHype(state, data, state.campaign, amount) : [];
}

// ---- Actions -----------------------------------------------------------

export function startCampaign(state, data, id) {
  const t = territory(data, id);
  if (!t || !isAvailable(state, data, t) || state.campaign === id) return [];
  state.campaign = id; // la hype déjà accumulée ailleurs reste acquise
  return [{ type: 'campaignStart', id, name: t.name, rival: t.rival ?? null }];
}

export function playShow(state, data) {
  if (!state.campaign) return [];
  const hype = showHype(state, data);
  return [{ type: 'show', hype }, ...addHype(state, data, hype)];
}

export function runPromo(state, data) {
  const t = campaignTerritory(state, data);
  if (!t) return [];
  const cost = promoCost(state, data, t);
  if (state.money < cost) return [];
  state.money -= cost;
  state.promoUses[t.id] = (state.promoUses[t.id] ?? 0) + 1;
  return [{ type: 'promo', cost }, ...addHype(state, data, t.hype * data.map.promo.share)];
}

export function giveSamples(state, data) {
  const t = campaignTerritory(state, data);
  if (!t) return [];
  const cost = samplesCost(state, data, t);
  if (state.grams < cost) return [];
  state.grams -= cost;
  state.sampleUses[t.id] = (state.sampleUses[t.id] ?? 0) + 1;
  return [{ type: 'samples', cost }, ...addHype(state, data, t.hype * data.map.samples.share)];
}

/** Appelé à chaque tick : déblocage de la carte et progression de la campagne. */
export function tickConquest(state, data, dt, mods) {
  const events = [];
  if (!state.mapUnlocked && state.tierIndex >= data.map.unlockTier) {
    state.mapUnlocked = true;
    events.push({ type: 'mapUnlock' });
  }
  const t = campaignTerritory(state, data);
  if (t) events.push(...addHype(state, data, netHypePerSecond(state, data, t, mods) * dt));
  return events;
}
