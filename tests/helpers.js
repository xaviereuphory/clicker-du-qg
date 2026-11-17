import fs from 'node:fs';

const root = new URL('../data/', import.meta.url);

export function loadData() {
  const read = (name) => JSON.parse(fs.readFileSync(new URL(`${name}.json`, root), 'utf8'));
  return {
    balance: read('balance'),
    characters: read('characters'),
    producers: read('producers'),
    upgrades: read('upgrades'),
    tiers: read('tiers'),
    texts: read('texts'),
    sounds: read('sounds'),
    greenhouse: read('greenhouse'),
    map: read('map'),
    fx: read('fx'),
    online: read('online'),
    events: read('events'),
    pets: read('pets'),
    decor: read('decor'),
    creation: read('creation'),
    battle: read('battle'),
  };
}

/** Avance le temps par pas d'une seconde et retourne tous les événements. */
export function run(tick, state, data, seconds) {
  const events = [];
  for (let i = 0; i < seconds; i += 1) events.push(...tick(state, data, 1));
  return events;
}
