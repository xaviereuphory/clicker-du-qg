// Événements à la BitLife : de temps en temps, la vie du QG s'en mêle.
// La police saisit le stash, les impôts prennent la moitié du cash, un beat devient viral...
//   - Un événement tombe toutes les 5 à 9 minutes de jeu (data/events.json), jamais pendant
//     un fail out s'il est mauvais (on ne frappe pas quelqu'un qui est à terre).
//   - Certains s'appliquent tout de suite ; d'autres posent une question (choices) et le
//     résultat dépend du choix et du hasard (outcomes avec leurs chances).
//   - Les effets « buff » sont temporaires : ils multiplient une stat pendant N secondes.
// Rien ici ne touche à l'affichage : les fonctions renvoient des événements de jeu
//   { type: 'event' }        événement appliqué tout de suite
//   { type: 'eventPrompt' }  question en attente de réponse (state.events.pending)
//   { type: 'eventResult' }  conséquence du choix du joueur
//   { type: 'eventEnd' }     fin d'un effet temporaire
// `rng` (0 ≤ x < 1) peut être remplacé dans les tests.

import { getModifiers } from './modifiers.js';
import { incomePerSecond, beatsPerSecond } from './economy.js';

export const EFFECT_TYPES = ['money', 'fans', 'grams', 'stash', 'hype', 'buff'];

export function eventDef(data, id) {
  return data.events?.list.find((e) => e.id === id) ?? null;
}

/** L'événement peut-il arriver maintenant ? */
export function isEligible(def, state, data, mods = getModifiers(state, data)) {
  const r = def.requires ?? {};
  const config = data.events;
  if (state.failOut && def.tone === 'bad') return false;
  if (state.tierIndex < (r.minTier ?? config.minTier ?? 0)) return false;
  if (r.minMoney && state.money < r.minMoney) return false;
  if (r.minIncome && incomePerSecond(state, data, mods) < r.minIncome) return false;
  if (r.minBps && beatsPerSecond(state, data, mods) < r.minBps) return false;
  if (r.stash && !(state.high > 0 || state.grams > 0)) return false;
  if (r.greenhouse && !state.greenhouseUnlocked) return false;
  if (r.map && !state.mapUnlocked) return false;
  if (r.campaign && !state.campaign) return false;
  const last = state.events.last[def.id];
  if (last !== undefined && state.time - last < config.repeatCooldownSeconds) return false;
  return true;
}

function pickWeighted(list, weightOf, rng) {
  const total = list.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = rng() * total;
  for (const item of list) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return list[list.length - 1];
}

function scheduleNext(state, data, rng) {
  const { minGapSeconds, maxGapSeconds } = data.events;
  state.events.nextAt = state.time + minGapSeconds + rng() * (maxGapSeconds - minGapSeconds);
}

/**
 * Applique une liste d'effets et décrit ce qui a changé, pour l'affichage :
 * [{ resource: 'money' | 'fans' | 'grams' | 'high' | 'hype' | 'buff', delta, stat, multiply, seconds }]
 */
export function applyEffects(state, data, effects, mods = getModifiers(state, data)) {
  const changes = [];
  for (const effect of effects ?? []) {
    switch (effect.type) {
      case 'money': {
        const before = state.money;
        if (effect.multiply !== undefined) state.money *= effect.multiply;
        if (effect.incomeSeconds) state.money += incomePerSecond(state, data, mods) * effect.incomeSeconds;
        state.money = Math.max(0, state.money);
        if (effect.incomeSeconds > 0) state.totalEarned += state.money - before; // un gain compte comme de l'argent gagné
        changes.push({ resource: 'money', delta: state.money - before });
        break;
      }
      case 'fans': {
        const before = state.fans;
        state.fans = Math.max(0, state.fans * (effect.multiply ?? 1));
        state.peakFans = Math.max(state.peakFans, state.fans);
        changes.push({ resource: 'fans', delta: state.fans - before });
        break;
      }
      case 'grams': {
        const before = state.grams;
        state.grams = Math.max(0, state.grams * (effect.multiply ?? 1) + (effect.add ?? 0));
        if (state.grams > before) state.totalGrams += state.grams - before;
        changes.push({ resource: 'grams', delta: state.grams - before });
        break;
      }
      case 'stash': {
        // Saisie : l'effet en cours disparaît (selon la part) et les grammes de la serre aussi.
        const share = effect.share ?? 1;
        const high = state.high;
        const grams = state.grams;
        state.high *= 1 - share;
        state.grams *= 1 - share;
        if (high > 0) changes.push({ resource: 'high', delta: state.high - high });
        if (grams > 0) changes.push({ resource: 'grams', delta: state.grams - grams });
        break;
      }
      case 'hype': {
        const t = state.campaign;
        if (!t) break;
        const before = state.hype[t] ?? 0;
        state.hype[t] = before * (effect.multiply ?? 1);
        changes.push({ resource: 'hype', delta: state.hype[t] - before });
        break;
      }
      case 'buff': {
        const until = state.time + effect.seconds;
        // Le même effet relancé : on prolonge au lieu d'empiler.
        const existing = state.events.active.find((b) => b.stat === effect.stat && b.multiply === effect.multiply);
        if (existing) existing.until = Math.max(existing.until, until);
        else state.events.active.push({ stat: effect.stat, multiply: effect.multiply, until, source: '' });
        changes.push({ resource: 'buff', stat: effect.stat, multiply: effect.multiply, seconds: effect.seconds });
        break;
      }
      default:
        break;
    }
  }
  return changes;
}

/** Déclenche un événement précis (aussi utilisé par la démo et les tests). */
export function triggerEvent(state, data, id, rng = Math.random) {
  const def = eventDef(data, id);
  if (!def) return [];
  state.events.last[def.id] = state.time;
  if (def.choices?.length) {
    state.events.pending = def.id;
    return [{ type: 'eventPrompt', id: def.id }];
  }
  const changes = applyEffects(state, data, def.effects);
  for (const b of state.events.active) if (!b.source) b.source = def.id;
  return [{ type: 'event', id: def.id, tone: def.tone, text: def.text, changes }];
}

/** Réponse du joueur à la question en attente. */
export function resolveEvent(state, data, choiceIndex, rng = Math.random) {
  const def = eventDef(data, state.events.pending);
  const choice = def?.choices?.[choiceIndex];
  if (!choice) return [];
  state.events.pending = '';
  const outcome = pickWeighted(choice.outcomes, (o) => o.chance, rng);
  const changes = applyEffects(state, data, outcome.effects);
  for (const b of state.events.active) if (!b.source) b.source = def.id;
  return [{ type: 'eventResult', id: def.id, choice: choiceIndex, tone: outcome.tone, text: outcome.text, changes }];
}

/** Appelé à chaque tick : fin des effets temporaires, puis peut-être un nouvel événement. */
export function tickEvents(state, data, dt, mods, rng = Math.random) {
  const config = data.events;
  if (!config) return [];
  const out = [];

  const ended = state.events.active.filter((b) => b.until <= state.time);
  if (ended.length) {
    state.events.active = state.events.active.filter((b) => b.until > state.time);
    for (const b of ended) out.push({ type: 'eventEnd', id: b.source, stat: b.stat });
  }

  if (state.events.nextAt === 0) {
    state.events.nextAt = state.time + config.firstDelaySeconds;
    return out;
  }
  // Pas de nouvel événement pendant une question en attente ni en pleine battle de beat.
  if (state.events.pending || state.battles?.pending || state.time < state.events.nextAt) return out;

  scheduleNext(state, data, rng);
  const eligible = config.list.filter((def) => isEligible(def, state, data, mods));
  if (!eligible.length) return out;
  const def = pickWeighted(eligible, (d) => d.weight ?? 1, rng);
  out.push(...triggerEvent(state, data, def.id, rng));
  return out;
}
