// Vérifie les fichiers de data/ : utile quand les autres volets les modifient.
// Lancer `npm test` après avoir touché un JSON.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../src/game/index.js';
import { loadData } from './helpers.js';
import fs from 'node:fs';
import { validateCharacter } from '../scripts/personnages.js';
import { CHARACTERS as HAND_DRAWN } from '../scripts/sprites/characters.js';

const data = loadData();

function checkIds(list, file) {
  const ids = list.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${file} : identifiants en double`);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/, `${file} : id « ${id} » (minuscules, chiffres, tirets)`);
}

function checkEffects(effects, where) {
  assert.ok(Array.isArray(effects), `${where} : "effects" doit être une liste`);
  for (const e of effects) {
    assert.ok(STATS.includes(e.stat), `${where} : stat inconnue « ${e.stat} » (permises : ${STATS.join(', ')})`);
    assert.ok(typeof e.multiply === 'number' && e.multiply > 0, `${where} : "multiply" doit être un nombre positif`);
  }
}

test('characters.json', () => {
  checkIds(data.characters, 'characters.json');
  for (const c of data.characters) {
    for (const key of ['name', 'strength', 'description']) assert.equal(typeof c[key], 'string', `${c.id}.${key}`);
    checkEffects(c.effects, `characters.json/${c.id}`);
    assert.deepEqual(validateCharacter(c, STATS), [], `characters.json/${c.id}`);
    if (c.color !== undefined) assert.match(c.color, /^#[0-9a-f]{6}$/i, `${c.id}.color`);
  }
});

test('characters.json : chaque personnage a un dessin et une planche générée', () => {
  const sprites = JSON.parse(fs.readFileSync(new URL('../assets/images/personnages/sprites.json', import.meta.url), 'utf8'));
  for (const c of data.characters) {
    assert.ok(c.look || HAND_DRAWN.some((h) => h.id === c.id), `${c.id} : ni fiche "look" ni dessin à la main (scripts/sprites/characters.js)`);
    assert.equal(sprites.sheets[c.id], `${c.id}-sheet.png`, `${c.id} : planche absente de sprites.json, lancer npm run sprites`);
    assert.ok(fs.existsSync(new URL(`../assets/images/personnages/${c.id}-sheet.png`, import.meta.url)), `${c.id}-sheet.png manquant : lancer npm run sprites`);
  }
});

test('producers.json', () => {
  checkIds(data.producers, 'producers.json');
  for (const p of data.producers) {
    assert.ok(p.baseCost > 0 && p.costGrowth > 1 && p.beatsPerSecond > 0, `producers.json/${p.id} : nombres`);
    assert.ok(p.requiresTier >= 0 && p.requiresTier < data.tiers.length, `producers.json/${p.id} : requiresTier`);
  }
});

test('upgrades.json', () => {
  checkIds(data.upgrades, 'upgrades.json');
  for (const u of data.upgrades) {
    assert.ok(u.cost > 0, `upgrades.json/${u.id} : cost`);
    assert.ok(u.requiresTier >= 0 && u.requiresTier < data.tiers.length, `upgrades.json/${u.id} : requiresTier`);
    checkEffects(u.effects, `upgrades.json/${u.id}`);
  }
});

test('tiers.json', () => {
  checkIds(data.tiers, 'tiers.json');
  assert.equal(data.tiers[0].fansRequired, 0, 'le premier palier commence à 0 fan');
  for (let i = 1; i < data.tiers.length; i += 1) {
    assert.ok(data.tiers[i].fansRequired > data.tiers[i - 1].fansRequired, `tiers.json : ordre croissant (${data.tiers[i].id})`);
  }
  for (const t of data.tiers) checkEffects(t.effects, `tiers.json/${t.id}`);
});

test('texts.json : chaque statistique a un libellé', () => {
  for (const stat of STATS) assert.equal(typeof data.texts.stats[stat], 'string', `texts.json/stats.${stat}`);
  for (const [key, list] of Object.entries(data.texts.messages)) assert.ok(Array.isArray(list), `texts.json/messages.${key}`);
});

test('sounds.json : chemins relatifs à assets/audio', () => {
  for (const [key, list] of Object.entries(data.sounds.effects)) {
    assert.ok(Array.isArray(list), `sounds.json/effects.${key}`);
    for (const file of list) {
      assert.match(file, /^(effets|musique)\/.+\.(m4a|mp3|ogg)$/, `sounds.json : « ${file} »`);
      assert.ok(fs.existsSync(new URL(`../assets/audio/${file}`, import.meta.url)), `sounds.json : fichier manquant « ${file} »`);
    }
  }
});

test('balance.json : le fail out peut toujours se terminer', () => {
  const { fans, fail } = data.balance;
  assert.ok(
    fail.referenceDecayPerSecond > fans.churnPerSecond * fail.churnMultiplier,
    'fail.referenceDecayPerSecond doit être plus grand que fans.churnPerSecond × fail.churnMultiplier',
  );
  assert.ok(fail.enterRatio < fail.exitRatio && fail.exitRatio <= 1, 'fail : enterRatio < exitRatio <= 1');
});

test('greenhouse.json', () => {
  const gh = data.greenhouse;
  assert.ok(gh.unlockTier >= 0 && gh.unlockTier < data.tiers.length, 'greenhouse.json : unlockTier');
  checkIds(gh.equipment, 'greenhouse.json/equipment');
  for (const e of gh.equipment) {
    assert.ok(e.baseCost > 0 && e.costGrowth > 1 && e.gramsPerSecond > 0, `greenhouse.json/equipment/${e.id} : nombres`);
  }
  checkIds(gh.strains, 'greenhouse.json/strains');
  for (const s of gh.strains) {
    assert.ok(s.cost > 0 && s.costGrowth > 1, `greenhouse.json/strains/${s.id} : cost, costGrowth`);
    checkEffects(s.effects, `greenhouse.json/strains/${s.id}`);
  }
});

test('map.json', () => {
  const map = data.map;
  assert.ok(map.unlockTier >= 0 && map.unlockTier < data.tiers.length, 'map.json : unlockTier');
  checkIds(map.territories, 'map.json/territories');
  const ids = new Set(map.territories.map((t) => t.id));
  assert.ok(ids.has(map.startTerritory), 'map.json : startTerritory doit exister');
  for (const t of map.territories) {
    const where = `map.json/territories/${t.id}`;
    assert.ok(t.x >= 0 && t.x < 160 && t.y >= 0 && t.y < 100, `${where} : x de 0 à 159, y de 0 à 99`);
    for (const r of t.requires) assert.ok(ids.has(r), `${where} : requires « ${r} » n'existe pas`);
    if (t.id !== map.startTerritory) {
      assert.ok(t.requires.length > 0, `${where} : il faut au moins un voisin dans requires`);
      assert.ok(t.hype > 0, `${where} : hype`);
    }
    assert.ok((t.defense ?? 0) >= 0, `${where} : defense`);
    checkEffects(t.effects, where);
  }
});

test('fx.json : plafonds et seuils des animations', () => {
  const { caps, quality, coins } = data.fx;
  for (const [key, value] of Object.entries(caps)) assert.ok(Number.isInteger(value) && value > 0, `fx.json/caps.${key} : entier positif`);
  assert.ok(caps.floatersVisible <= caps.floatersPool, 'fx.json : floatersVisible ne peut pas dépasser floatersPool');
  assert.ok(caps.floatersPool + caps.particles + caps.coinsInFlight <= 80, 'fx.json : 80 nœuds d\'effets au maximum (charte)');
  assert.ok(data.fx.confetti <= caps.particles, 'fx.json : les confettis viennent de la réserve de particules');
  assert.ok(quality.good > 1 && quality.big > quality.good, 'fx.json : 1 < quality.good < quality.big');
  assert.ok(coins.max >= 1 && coins.max <= caps.coinsInFlight, 'fx.json : coins.max entre 1 et caps.coinsInFlight');
  assert.ok(data.fx.mergeMs > 0 && data.fx.mergeMsDuringMajor >= data.fx.mergeMs, 'fx.json : mergeMs');
});

test('pets.json', () => {
  checkIds(data.pets, 'pets.json');
  for (const p of data.pets) {
    for (const key of ['name', 'species', 'description']) assert.equal(typeof p[key], 'string', `pets.json/${p.id}.${key}`);
    assert.ok(p.cost > 0 && p.costGrowth > 1, `pets.json/${p.id} : cost, costGrowth`);
    assert.ok(p.requiresTier >= 0 && p.requiresTier < data.tiers.length, `pets.json/${p.id} : requiresTier`);
    checkEffects(p.effects, `pets.json/${p.id}`);
  }
});
