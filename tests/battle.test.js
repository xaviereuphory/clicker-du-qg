// Battle de beat : données, mises, partition, jugement des frappes, gains et pertes, sauvegarde.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abandonBattle, advanceRun, battleBlock, battlePayout, battleRivals, battleStakes, battleTarget, createChart,
  createRun, createState, deserialize, genreById, genreFor, pickBpm, songAt, songBars, swingAt, finishBattle, rivalLevel, runAccuracy, runDone, serialize, startBattle, tapRun, tick,
} from '../src/game/index.js';
import { loadData } from './helpers.js';

const data = loadData();
const fixed = (value) => () => value; // hasard contrôlé

/** Une partie où la carte est ouverte et Toronto (rival MC Condo) est à portée. */
function onMap(overrides = {}) {
  const state = createState(data, 'xavier');
  Object.assign(state, {
    tierIndex: data.map.unlockTier, mapUnlocked: true, money: 10000, totalEarned: 50000, fans: 5000, peakFans: 5000, time: 1000,
  }, overrides);
  state.conquered.montreal = true;
  return state;
}

/** Joue toute la partition : `hit(note)` dit à quel décalage frapper (null = laisser passer). */
function play(chart, hit) {
  const run = createRun(chart);
  for (const note of chart.notes) {
    const offset = hit(note);
    if (offset !== null) tapRun(run, data, note.lane, note.t + offset);
  }
  advanceRun(run, data, chart.duration);
  return run;
}

test('battle.json : réglages valides', () => {
  const b = data.battle;
  assert.ok(b.bpm.min > 0 && b.bpm.max >= b.bpm.min && b.beats > 0 && b.leadInBeats >= 0, 'battle.json : bpm, beats, leadInBeats');
  assert.ok(Number.isInteger(b.lanes) && b.lanes >= 2, 'battle.json : au moins 2 pistes');
  assert.equal(b.lanes, 4, 'battle.json : 4 pistes, 4 instruments');
  for (const g of b.genres) {
    assert.equal(g.instruments.length, b.lanes, `battle.json/${g.id} : un instrument par piste`);
    const ids = g.instruments.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `battle.json/${g.id} : instruments en double`);
    for (const i of g.instruments) {
      assert.match(i.id, /^[a-z0-9-]+$/, `battle.json/${g.id} : instrument « ${i.id} »`);
      assert.equal(typeof i.name, 'string', `battle.json/${g.id}/instruments/${i.id}.name`);
      assert.ok((data.sounds.effects[i.sound] ?? []).length > 0, `battle.json/${g.id}/instruments/${i.id} : son « ${i.sound} » vide ou absent de sounds.json`);
      assert.ok([undefined, 'chord', 'arpeggio', 'root'].includes(i.tuned), `battle.json/${g.id}/instruments/${i.id}.tuned : "chord", "arpeggio", "root" ou rien`);
    }
  }
    // Le décompte fait une mesure de 4 temps, et la battle finit au bout d'une mesure.
  assert.equal(b.leadInBeats, 4, 'battle.json : le décompte dure une mesure (4 temps)');
  assert.equal(b.beats % 4, 0, 'battle.json : beats doit faire un nombre entier de mesures');
  assert.ok(b.windows.perfect > 0 && b.windows.good > b.windows.perfect, 'battle.json : 0 < perfect < good');
  assert.ok(b.windows.good < 30 / b.bpm.max, 'battle.json : la fenêtre « good » doit rester sous un demi-temps, même au tempo le plus rapide');
  assert.ok(b.points.perfect === 1 && b.points.good > 0 && b.points.good < 1, 'battle.json : points');
  assert.ok(b.stakes.length > 0 && b.stakes.every((s) => s > 0 && s <= 0.5), 'battle.json : mises entre 0 et 50 % du cash');
  assert.ok(b.cooldownSeconds >= 0 && typeof b.allowDuringFailOut === 'boolean', 'battle.json : cooldownSeconds, allowDuringFailOut');
  assert.ok(b.payout.atTarget > 1 && b.payout.perfect >= b.payout.atTarget, 'battle.json : payout');
  for (const [key, { easiest, hardest }] of Object.entries(b.difficulty)) {
    assert.ok(easiest >= 0 && hardest <= 1 && easiest <= hardest, `battle.json : difficulty.${key}`);
  }
  assert.ok(b.difficulty.target.hardest < 1, 'battle.json : le rival le plus fort doit rester battable');
  // Une battle dure de 15 à 30 s, du tempo le plus lent au plus rapide.
  for (const bpm of [b.bpm.min, b.bpm.max]) {
    const seconds = (b.leadInBeats + b.beats) * 60 / bpm;
    assert.ok(seconds >= 15 && seconds <= 30, `battle.json : à ${bpm} BPM, une battle dure ${seconds.toFixed(1)} s`);
  }
});

test('les rivaux : plus de défense, plus dur à battre', () => {
  assert.equal(rivalLevel(data, 'toronto'), 0, 'MC Condo est le plus faible');
  assert.equal(rivalLevel(data, 'la-lune'), 1, 'les extraterrestres sont les plus forts');
  assert.ok(battleTarget(data, 'toronto') < battleTarget(data, 'new-york'));
  assert.ok(battleTarget(data, 'new-york') < battleTarget(data, 'la-lune'));
});

test('on ne défie que les rivaux des territoires ouverts', () => {
  const state = onMap();
  assert.deepEqual(battleRivals(state, data).map((t) => t.id), ['toronto']);
  assert.equal(battleBlock(state, data, 'toronto'), '');
  assert.equal(battleBlock(state, data, 'quebec'), 'rival', 'Québec n\'a pas de rival');
  assert.equal(battleBlock(state, data, 'new-york'), 'rival', 'New York n\'est pas encore ouvert');
  assert.deepEqual(battleRivals(onMap({ mapUnlocked: false }), data), [], 'carte fermée');
  state.conquered.toronto = true;
  assert.equal(battleBlock(state, data, 'toronto'), 'rival', 'territoire déjà conquis');
});

test('pas de battle pendant un événement, sans cash ou pendant une autre battle', () => {
  const waiting = onMap();
  waiting.events.pending = 'police';
  assert.equal(battleBlock(waiting, data, 'toronto'), 'event');
  assert.equal(battleBlock(onMap({ money: 50 }), data, 'toronto'), 'money');
  const state = onMap();
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  assert.equal(battleBlock(state, data, 'toronto'), 'busy');
});

test('fail out et revanche : selon battle.json', () => {
  // Réglages stricts : pas de battle en fail out, 2 min avant la revanche.
  const strict = { ...data, battle: { ...data.battle, allowDuringFailOut: false, cooldownSeconds: 120 } };
  assert.equal(battleBlock(onMap({ failOut: true }), strict, 'toronto'), 'failOut');
  const state = onMap();
  startBattle(state, strict, 'toronto', 0, fixed(0.3));
  finishBattle(state, strict, 1);
  assert.equal(battleBlock(state, strict, 'toronto'), 'cooldown');
  state.time += 120;
  assert.equal(battleBlock(state, strict, 'toronto'), '');

  // Réglages souples (ceux du jeu pour l'instant, le temps de tester) : on relance quand on veut.
  const loose = { ...data, battle: { ...data.battle, allowDuringFailOut: true, cooldownSeconds: 0 } };
  assert.equal(battleBlock(onMap({ failOut: true }), loose, 'toronto'), '');
  const again = onMap();
  startBattle(again, loose, 'toronto', 0, fixed(0.3));
  finishBattle(again, loose, 0);
  assert.equal(battleBlock(again, loose, 'toronto'), '', 'revanche tout de suite');
});

test('la mise : une part du cash, jamais plus de la moitié', () => {
  const stakes = battleStakes(onMap({ money: 10000 }), data);
  assert.deepEqual(stakes.map((s) => s.amount), data.battle.stakes.map((s) => Math.floor(10000 * s)));
  assert.ok(stakes.every((s) => s.amount <= 5000));
});

test('le tempo : tiré entre 88 et 130 BPM, et chaque tempo a exactement un genre', () => {
  const { bpm, genres } = data.battle;
  assert.equal(bpm.min, 88);
  assert.equal(bpm.max, 130);
  assert.equal(pickBpm(data, fixed(0)), 88);
  assert.equal(pickBpm(data, fixed(0.9999)), 130);
  for (let x = bpm.min; x <= bpm.max; x += 1) {
    const matching = genres.filter((g) => x >= g.bpm.min && x <= g.bpm.max);
    assert.equal(matching.length, 1, `${x} BPM : ${matching.length} genres (il en faut exactement un)`);
    assert.equal(genreFor(data, x).id, matching[0].id);
  }
  assert.equal(genreFor(data, 90).id, 'boom-bap');
  assert.equal(genreFor(data, 105).id, 'afrobeats');
  assert.equal(genreFor(data, 124).id, 'house');
});

test('les genres : chanson en phrases de 4 mesures, un accord par mesure, fin sur l\'accord de départ', () => {
  const { genres, chords } = data.battle;
  const ids = genres.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'genres : identifiants en double');
  for (const [name, c] of Object.entries(chords)) {
    assert.ok(Number.isInteger(c.root) && c.notes.length >= 3 && c.notes.every(Number.isInteger), `chords.${name}`);
    assert.ok(c.notes.some((n) => (((n - c.root) % 12) + 12) % 12 === 0), `chords.${name} : la fondamentale doit être dans les notes`);
  }
  for (const g of genres) {
    const where = `genres/${g.id}`;
    assert.equal(typeof g.name, 'string', `${where}.name`);
    assert.ok(g.swing >= 0.5 && g.swing < 0.75, `${where}.swing : de 0,5 (droit) à 0,75`);
    assert.equal(data.battle.beats, songBars(g).length * 4, `${where} : beats = 4 × le nombre de mesures de la chanson`);
    for (const section of g.song.sections) {
      assert.ok([4, 8].includes(section.chords.length), `${where}/${section.name} : une phrase de 4 ou 8 mesures`);
      for (const c of section.chords) assert.ok(chords[c], `${where}/${section.name} : accord « ${c} » absent de chords`);
    }
    assert.equal(g.song.ending, g.song.sections[0].chords[0], `${where} : la fin revient à l'accord de départ`);
    // Le beat : 1 ou 2 mesures, des instruments du genre, et chaque instrument a des notes au niveau le plus facile.
    const lanes = g.instruments.map((i) => i.id);
    assert.ok([4, 8].includes(g.groove.base.length), `${where}.groove.base : 4 ou 8 temps`);
    for (const id of lanes) assert.ok(g.groove.base.includes(id), `${where}.groove.base : « ${id} » n'a aucune note au niveau facile`);
    for (const l of [...g.groove.base, ...g.groove.doubles.map((d) => d.lane), ...g.groove.offbeats.map((o) => o.lane)]) {
      assert.ok(lanes.includes(l), `${where}.groove : instrument « ${l} » inconnu`);
    }
    for (const o of g.groove.offbeats) assert.ok(o.at > 0 && o.at < 1, `${where}.groove.offbeats : at entre 0 et 1`);
    // Le métronome : une mesure, au moins un coup sur chaque temps, des sons qui existent.
    for (let beat = 0; beat < 4; beat += 1) assert.ok(g.metronome.some((h) => h.at === beat), `${where}.metronome : rien sur le temps ${beat + 1}`);
    for (const h of g.metronome) {
      assert.ok(h.at >= 0 && h.at < 4, `${where}.metronome : at de 0 à 4`);
      assert.ok((data.sounds.effects[h.sound] ?? []).length > 0, `${where}.metronome : son « ${h.sound} » vide ou absent`);
    }
  }
  const boomBap = genreById(data, 'boom-bap');
  assert.equal(songAt(data, boomBap, -4).chord, 'Cmaj7', 'pendant le décompte : le premier accord');
  assert.deepEqual([0, 4, 8, 12].map((b) => songAt(data, boomBap, b).chord), ['Cmaj7', 'Am7', 'Dm7', 'G7']);
  assert.equal(songAt(data, boomBap, 3.5).chord, 'Cmaj7', 'le « et » du 4e temps reste dans la mesure');
  assert.equal(songAt(data, boomBap, 16).sectionName, 'Refrain');
  const end = songAt(data, genreById(data, 'house'), data.battle.beats);
  assert.equal(end.ending, true);
  assert.equal(end.chord, 'Am7', 'la house finit sur la mineur');
});

test('la partition joue le beat du genre, au tempo tiré', () => {
  for (const [bpm, genreId] of [[92, 'boom-bap'], [106, 'afrobeats'], [124, 'house']]) {
    const g = genreById(data, genreId);
    const lane = (id) => g.instruments.findIndex((i) => i.id === id);
    const spb = 60 / bpm;
    const beatOf = (n) => n.t / spb - data.battle.leadInBeats;
    const easy = createChart(data, 'toronto', fixed(0.99), bpm);
    assert.equal(easy.bpm, bpm);
    assert.equal(easy.genre, genreId);
    assert.ok(Math.abs(easy.spb - spb) < 1e-12);
    assert.equal(easy.notes.length, data.battle.beats + 1, `${genreId} : sans hasard favorable, une note par temps plus l'accord de fin`);
    for (const n of easy.notes) {
      const beat = Math.round(beatOf(n));
      assert.equal(n.lane, lane(g.groove.base[beat % g.groove.base.length]), `${genreId}, temps ${beat} : mauvaise piste`);
    }
    assert.ok(easy.duration > easy.notes.at(-1).t + data.battle.windows.good, `${genreId} : la battle finit après la dernière note`);

    const hard = createChart(data, 'la-lune', fixed(0.05), bpm);
    assert.ok(hard.notes.length > easy.notes.length, `${genreId} : contretemps et notes doubles`);
    for (let i = 1; i < hard.notes.length; i += 1) assert.ok(hard.notes[i].t >= hard.notes[i - 1].t, 'notes triées');
    const seen = new Set(hard.notes.map((n) => `${n.t.toFixed(4)}:${n.lane}`));
    assert.equal(seen.size, hard.notes.length, `${genreId} : deux notes au même moment jamais sur la même piste`);
    // Sur une même piste, deux notes sont plus loin que la fenêtre de frappe (une frappe vise la plus proche).
    for (let l = 0; l < data.battle.lanes; l += 1) {
      const times = hard.notes.filter((n) => n.lane === l).map((n) => n.t);
      for (let i = 1; i < times.length; i += 1) assert.ok(times[i] - times[i - 1] > data.battle.windows.good, `${genreId} : notes trop proches sur la piste ${l}`);
    }
    // Les contretemps tombent là où le genre les met (swing compris).
    const allowed = g.groove.offbeats.map((o) => swingAt(g, o.at));
    for (const n of hard.notes) {
      const frac = beatOf(n) - Math.floor(beatOf(n) + 1e-9);
      if (frac < 1e-6 || frac > 1 - 1e-6) continue;
      assert.ok(allowed.some((a) => Math.abs(a - frac) < 1e-6), `${genreId} : contretemps à ${frac.toFixed(2)} du temps`);
    }
  }
  // Le boom bap est swingué : son « et » arrive après le milieu du temps.
  assert.ok(swingAt(genreById(data, 'boom-bap'), 0.5) > 0.5);
  assert.equal(swingAt(genreById(data, 'house'), 0.5), 0.5);
});

test('le jugement : parfait, bon, raté, et frappes dans le vide', () => {
  const chart = createChart(data, 'toronto', fixed(0.99));
  const run = createRun(chart);
  const [a, b] = chart.notes;
  assert.equal(tapRun(run, data, a.lane, a.t + 0.02).result, 'perfect');
  assert.equal(tapRun(run, data, b.lane, b.t - 0.12).result, 'good');
  assert.equal(run.combo, 2);
  assert.equal(tapRun(run, data, (b.lane + 1) % data.battle.lanes, b.t).result, 'stray', 'mauvaise piste');
  assert.equal(run.combo, 0, 'une frappe dans le vide casse le combo');
  assert.equal(tapRun(run, data, a.lane, a.t).result, 'stray', 'une note ne se frappe qu\'une fois');

  const missed = advanceRun(run, data, chart.notes[2].t + 0.3);
  assert.equal(missed.length, 1, 'la 3e note est passée sans être frappée');
  assert.equal(run.notes[2].result, 'miss');
  assert.equal(runDone(run, chart.duration - 0.01), false);
  assert.equal(runDone(run, chart.duration), true);
});

test('la précision : sans-faute = 1, rien = 0, marteler toutes les pistes ne paie pas', () => {
  const chart = createChart(data, 'new-york', fixed(0.2));
  assert.equal(runAccuracy(play(chart, () => 0), data), 1);
  assert.equal(runAccuracy(play(chart, () => null), data), 0);
  const allGood = runAccuracy(play(chart, () => 0.12), data);
  assert.ok(Math.abs(allGood - data.battle.points.good) < 1e-9);

  // Taper les 3 pistes à chaque demi-temps : toutes les notes, mais énormément de frappes dans le vide.
  const run = createRun(chart);
  const step = chart.spb / 2;
  for (let t = 0; t < chart.duration; t += step) for (let lane = 0; lane < data.battle.lanes; lane += 1) tapRun(run, data, lane, t);
  advanceRun(run, data, chart.duration);
  assert.ok(runAccuracy(run, data) < battleTarget(data, 'new-york'), 'le spam ne bat pas le rival');
});

test('le gain : ×1,5 au score du rival, ×3 pour un sans-faute, rien en dessous', () => {
  const target = 0.6;
  assert.equal(battlePayout(data, 1000, 0.59, target), 0);
  assert.equal(battlePayout(data, 1000, target, target), 1000 * data.battle.payout.atTarget);
  assert.equal(battlePayout(data, 1000, 1, target), 1000 * data.battle.payout.perfect);
  assert.ok(battlePayout(data, 1000, 0.8, target) > 1500 && battlePayout(data, 1000, 0.8, target) < 3000);
});

test('une battle gagnée : la mise revient multipliée et le territoire gagne de la hype', () => {
  const state = onMap({ money: 10000 });
  const [start] = startBattle(state, data, 'toronto', 1, fixed(0.3));
  assert.equal(start.type, 'battleStart');
  assert.equal(start.rival, 'MC Condo');
  assert.equal(start.stake, 2500);
  assert.equal(state.money, 7500, 'la mise est payée au début');
  assert.ok(start.chart.notes.length >= data.battle.beats);

  const [win] = finishBattle(state, data, 1);
  assert.equal(win.type, 'battleWin');
  assert.equal(win.payout, 7500);
  assert.equal(state.money, 15000);
  assert.equal(state.totalEarned, 50000 + 5000, 'seul le profit compte comme argent gagné');
  const toronto = data.map.territories.find((t) => t.id === 'toronto');
  assert.equal(state.hype.toronto, toronto.hype * data.battle.hypeShare);
  assert.equal(state.battles.wins, 1);
  assert.equal(state.battles.best, 1);
  assert.equal(state.battles.pending, null);
  assert.deepEqual(finishBattle(state, data, 1), [], 'on ne touche pas deux fois le gain');
});

test('une battle gagnée peut finir la conquête du territoire', () => {
  const toronto = data.map.territories.find((t) => t.id === 'toronto');
  const state = onMap({ campaign: 'toronto' });
  state.hype.toronto = toronto.hype * 0.95;
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  const events = finishBattle(state, data, 0.9);
  assert.deepEqual(events.map((e) => e.type), ['battleWin', 'territoryConquered']);
  assert.equal(state.conquered.toronto, true);
  assert.equal(state.campaign, '', 'la campagne est finie');
});

test('une battle perdue : la mise est perdue, le cash ne tombe jamais à zéro', () => {
  const state = onMap({ money: 10000 });
  startBattle(state, data, 'toronto', data.battle.stakes.length - 1, fixed(0.3));
  const [lose] = finishBattle(state, data, 0.2);
  assert.equal(lose.type, 'battleLose');
  assert.equal(lose.payout, 0);
  assert.equal(state.money, 5000, 'au pire, la moitié du cash');
  assert.equal(state.battles.losses, 1);
  assert.equal(state.totalEarned, 50000, 'le total gagné ne baisse pas');
});

test('une battle laissée en plan est sauvegardée, puis comptée perdue', () => {
  const state = onMap({ money: 10000 });
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  const loaded = deserialize(serialize(state), data);
  assert.deepEqual(loaded.battles.pending, state.battles.pending);
  assert.equal(loaded.battles.last.toronto, 1000);
  const [lose] = abandonBattle(loaded, data);
  assert.equal(lose.type, 'battleLose');
  assert.equal(lose.forfeit, true);
  assert.equal(loaded.money, 9000);
  assert.deepEqual(abandonBattle(loaded, data), [], 'rien à abandonner');
});

test('sauvegarde : vieille partie sans battles, ou battles abîmées', () => {
  const old = JSON.parse(serialize(onMap()));
  delete old.battles;
  assert.deepEqual(deserialize(JSON.stringify(old), data).battles, createState(data, 'xavier').battles);

  old.battles = { pending: { territory: 'atlantide', stake: 5 }, last: { toronto: 'hier', paris: 12 }, wins: -3, losses: 2.7, best: 7 };
  const repaired = deserialize(JSON.stringify(old), data).battles;
  assert.equal(repaired.pending, null, 'territoire inconnu');
  assert.deepEqual(repaired.last, { paris: 12 });
  assert.equal(repaired.wins, 0);
  assert.equal(repaired.losses, 2);
  assert.equal(repaired.best, 1);
});

test('pas de nouvel événement BitLife en pleine battle', () => {
  const state = onMap();
  state.events.nextAt = state.time + 1;
  startBattle(state, data, 'toronto', 0, fixed(0.3));
  tick(state, data, 5);
  assert.equal(state.events.pending, '');
  assert.ok(state.events.nextAt <= state.time, 'l\'événement attend la fin de la battle');
});
