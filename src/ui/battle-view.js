// Écran de la battle de beat (bottom sheet #sheet-battle) : choix de la mise, partie, résultat.
// La logique (partition, jugement, gains) est dans src/game/battle.js ; ici, on dessine les notes
// qui tombent et on transmet les frappes. La mise et le résultat passent par `actions` :
//   actions.start(idTerritoire, indexMise) → l'événement battleStart (avec la partition), ou null
//   actions.finish(précision)              → les événements battleWin / battleLose (+ conquête)
//   actions.getState()                     → l'état du jeu, pour les mises et les blocages
// `audio` (src/audio/audio.js) donne l'horloge et joue les sons.
//
// Chaque battle a son tempo (88 à 130 BPM) et le genre qui va avec : boom bap, afrobeats
// ou house (data/battle.json → genres ; src/game/battle.js choisit).
// Son et image calés : le métronome du genre est programmé d'avance sur l'horloge audio
// (décompte 1-2-3-4 aux baguettes, puis charleston swingué en boom bap, shaker 3-3-2 en
// afrobeats, charleston fermé et ouvert en house), et l'image lit la même horloge. Une note touche
// la ligne exactement quand le temps sonne. Pas de batterie de fond : c'est le joueur qui
// joue le beat avec les 4 pads, les instruments du genre (data/battle.json → genres → instruments). Tout suit la grille
// d'accords de la chanson (song, chords ; demi-tons autour du do des fichiers son) : le
// piano joue l'accord de la mesure (tuned: "chord"), le kick sa fondamentale
// (tuned: "root"). Une note ratée ne fait aucun bruit.

import {
  advanceRun, genreById, songAt, swingAt, battleBlock, battleCooldownLeft, battlePayout, battleStakes, battleTarget, createRun, formatDuration,
  formatMoney, formatNumber, runAccuracy, runDone, tapRun,
} from '../game/index.js';

const $ = (id) => document.getElementById(id);
// Une touche par piste, de gauche à droite : A S D F, J K L ;, les flèches ou 1 2 3 4.
const LANE_KEYS = [['a', 'j', 'arrowleft', '1'], ['s', 'k', 'arrowdown', '2'], ['d', 'l', 'arrowup', '3'], ['f', ';', 'arrowright', '4']];
// Icône de chaque instrument (même id que data/battle.json). Pas d'émoji de grosse caisse : on la dessine.
const KICK_ICON = '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" shape-rendering="crispEdges">'
  + '<rect x="6" y="4" width="20" height="2" fill="#241a2e"/><rect x="4" y="6" width="24" height="20" fill="#241a2e"/>'
  + '<rect x="6" y="26" width="20" height="2" fill="#241a2e"/><rect x="6" y="6" width="20" height="20" fill="#ff7eb6"/>'
  + '<rect x="8" y="8" width="16" height="16" fill="#fbf4e6"/><rect x="11" y="13" width="10" height="6" fill="#ff8a5b"/>'
  + '<rect x="2" y="28" width="4" height="2" fill="#6b5a72"/><rect x="26" y="28" width="4" height="2" fill="#6b5a72"/></svg>';
const ICONS = {
  kick: KICK_ICON, 'caisse-claire': '🥁', rhodes: '🎹', contrebasse: '🎻', // boom bap
  rimshot: '🥁', guitare: '🎸', conga: '🪘', // afrobeats
  clap: '👏', piano: '🎹', basse: '🎛️', // house
};
const LOOKAHEAD_BEATS = 2.5; // une note apparaît en haut 2,5 temps avant de toucher la ligne
const LINE = 0.86; // hauteur de la ligne de frappe, en part de la piste
const JUDGE_TEXT = { perfect: 'Parfait !', good: 'Bien', stray: 'Dans le vide', miss: 'Raté' };
const BLOCK_TEXT = {
  rival: 'Pas de rival à défier ici.',
  busy: 'Une battle est déjà en cours.',
  failOut: 'Pas de battle pendant un fail out : remonte la pente d\'abord.',
  event: 'Réponds d\'abord à l\'événement en cours.',
  money: 'Pas assez de cash pour cette mise.',
};
const pct = (x) => `${Math.round(x * 100)} %`;

export function createBattleView(data, actions, { openSheet, closeSheet, audio }) {
  const lanes = data.battle.lanes;
  let genre = data.battle.genres[0]; // genre de la battle en cours
  let instruments = genre.instruments; // les 4 instruments du genre, un par piste
  let territoryId = '';
  let shareIndex = 0;
  let run = null; // partie en cours
  let startedAt = 0; // instant de l'horloge audio où la partie commence (t = 0)
  let lag = 0; // latence de sortie : l'image attend que le son sorte du haut-parleur
  let starting = false;
  let target = 0;
  let noteEls = [];
  let frameId = 0;
  let beatShown = -1;

  // ---- Pistes et pads ----
  const laneEls = Array.from({ length: lanes }, (_, i) => {
    const lane = document.createElement('div');
    lane.className = 'battle-lane';
    lane.dataset.lane = String(i);
    lane.addEventListener('pointerdown', (event) => { event.preventDefault(); tap(i); });
    return lane;
  });
  $('battle-lanes').replaceChildren(...laneEls);
  const padEls = Array.from({ length: lanes }, (_, i) => {
    const pad = document.createElement('button');
    pad.type = 'button';
    pad.className = 'battle-pad';
    const icon = document.createElement('span');
    icon.className = 'battle-pad-icon';
    const name = document.createElement('span');
    name.className = 'battle-pad-name';
    pad.append(icon, name);
    pad.addEventListener('pointerdown', (event) => { event.preventDefault(); tap(i); });
    // Au clavier (Entrée / espace sur le pad), le clic arrive sans pointerdown.
    pad.addEventListener('click', (event) => { if (event.detail === 0) tap(i); });
    return pad;
  });

  /** Les pads prennent les instruments du genre de la battle. */
  function setInstruments(list) {
    instruments = list;
    padEls.forEach((pad, i) => {
      const instrument = list[i];
      pad.querySelector('.battle-pad-icon').innerHTML = ICONS[instrument?.id] ?? String(i + 1);
      pad.querySelector('.battle-pad-name').textContent = instrument?.name ?? `Piste ${i + 1}`;
      pad.setAttribute('aria-label', instrument?.name ?? `Piste ${i + 1}`);
      pad.dataset.instrument = instrument?.id ?? '';
      laneEls[i].dataset.instrument = instrument?.id ?? '';
    });
  }
  setInstruments(instruments);
  $('battle-pads').replaceChildren(...padEls);
  $('battle-lanes').style.setProperty('--lanes', String(lanes));
  $('battle-pads').style.setProperty('--lanes', String(lanes));

  document.addEventListener('keydown', (event) => {
    if (!run || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const lane = LANE_KEYS.findIndex((keys) => keys.includes(event.key.toLowerCase()));
    if (lane < 0 || lane >= lanes) return;
    event.preventDefault();
    tap(lane);
  });

  // ---- 1. Le choix de la mise ----
  const stakeEls = data.battle.stakes.map((share, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'battle-stake';
    button.setAttribute('role', 'radio');
    const label = document.createElement('strong');
    label.textContent = pct(share);
    button.append(label, document.createElement('span'));
    button.onclick = () => { shareIndex = i; renderSetup(); };
    return button;
  });
  $('battle-stakes').replaceChildren(...stakeEls);

  function renderSetup() {
    const state = actions.getState();
    const t = data.map.territories.find((x) => x.id === territoryId);
    if (!state || !t) return;
    const goal = battleTarget(data, territoryId);
    $('battle-title').textContent = `Battle : ${t.name}`;
    $('battle-intro').textContent = `${t.rival} défend ${t.name}. Fais plus de ${pct(goal)} de précision pour gagner. Le tempo (${data.battle.bpm.min} à ${data.battle.bpm.max} BPM) et le genre sont tirés au hasard.`;
    const stakes = battleStakes(state, data);
    stakes.forEach((s, i) => {
      const button = stakeEls[i];
      button.classList.toggle('is-selected', i === shareIndex);
      button.setAttribute('aria-checked', String(i === shareIndex));
      button.lastChild.textContent = formatMoney(s.amount);
    });
    const amount = stakes[shareIndex]?.amount ?? 0;
    const best = battlePayout(data, amount, 1, goal);
    const atGoal = battlePayout(data, amount, goal, goal);
    $('battle-odds').textContent = `Victoire : de ${formatMoney(atGoal)} à ${formatMoney(best)} (sans-faute), et +${pct(data.battle.hypeShare)} de hype à ${t.name}. Défaite : la mise est perdue.`;
    $('battle-go-stake').textContent = formatMoney(amount);
    const block = battleBlock(state, data, territoryId, shareIndex);
    $('battle-block').textContent = block === 'cooldown'
      ? `${t.rival} récupère. Revanche dans ${formatDuration(battleCooldownLeft(state, data, territoryId))}.`
      : block === 'money' ? `Il faut une mise d'au moins ${formatMoney(data.battle.minStake)}.` : BLOCK_TEXT[block] ?? '';
    $('battle-go').disabled = Boolean(block);
  }

  function showPhase(name) {
    $('battle-setup').hidden = name !== 'setup';
    $('battle-play').hidden = name !== 'play';
    $('battle-result').hidden = name !== 'result';
    $('battle-close').hidden = name === 'play';
    $('sheet-battle').dataset.phase = name;
  }

  /** Ouvre l'écran de la battle pour un territoire. */
  function open(id) {
    if (run) return;
    territoryId = id;
    shareIndex = Math.min(shareIndex, data.battle.stakes.length - 1);
    showPhase('setup');
    $('sheet-battle').dataset.tone = '';
    renderSetup();
    openSheet('sheet-battle');
  }

  // ---- 2. La partie ----
  $('battle-go').onclick = async () => {
    if (run || starting) return;
    starting = true;
    const start = actions.start(territoryId, shareIndex);
    if (!start) { starting = false; renderSetup(); return; }
    target = start.target;
    genre = genreById(data, start.chart.genre);
    setInstruments(genre.instruments);
    $('battle-title').textContent = `${genre.name} · ${start.chart.bpm} BPM`;
    $('battle-track').style.setProperty('--beat', `${Math.round(start.chart.spb * 1000)}ms`);
    $('battle-rival-name').textContent = start.rival;
    $('battle-target').textContent = pct(target);
    $('battle-accuracy').textContent = '—';
    $('battle-combo').textContent = '';
    $('battle-judge').textContent = '';
    $('battle-song').textContent = '';
    showPhase('play');
    openSheet('sheet-battle', { locked: true }); // pas de fermeture en pleine battle
    await audio.ready(); // le son débloqué et les fichiers décodés, sinon la batterie partirait en retard
    run = createRun(start.chart);
    noteEls = run.notes.map((note) => {
      const n = document.createElement('div');
      n.className = 'battle-note';
      n.hidden = true;
      laneEls[note.lane].append(n);
      return n;
    });
    beatShown = -1;
    startedAt = audio.now() + 0.25; // un quart de seconde pour programmer les sons
    lag = audio.latency();
    scheduleDrums(start.chart);
    starting = false;
    frameId = requestAnimationFrame(frame);
  };

  /** Le métronome du genre, programmé d'avance sur l'horloge audio (swing compris). */
  function scheduleDrums(chart) {
    const { spb } = chart;
    const lead = data.battle.leadInBeats;
    const bars = data.battle.beats / 4;
    for (let b = 0; b < lead; b += 1) audio.playAt('battleCount', startedAt + b * spb, { volume: b === 0 ? 1 : 0.8 });
    for (let bar = 0; bar <= bars; bar += 1) {
      const barStart = startedAt + (lead + bar * 4) * spb;
      for (const hit of genre.metronome) {
        if (bar === bars && hit.at > 0) break; // la fin : seulement le premier temps
        audio.playAt(hit.sound, barStart + swingAt(genre, hit.at) * spb, { volume: hit.volume });
      }
    }
  }

  /** Temps de la partie, en secondes : l'horloge audio, moins la latence du haut-parleur. */
  const now = () => audio.now() - startedAt - lag;

  const semitoneRate = (semitones) => 2 ** (semitones / 12);

  /** La mesure de la chanson au temps `t` de la partie (accord, section). */
  const songNow = (t) => songAt(data, genre, Math.round(t / run.chart.spb * 4) / 4 - data.battle.leadInBeats);

  /** Le son de l'instrument du pad, dans la tonalité de la mesure en cours. */
  function playInstrument(lane, t) {
    const instrument = instruments[lane];
    if (!instrument) return;
    const { notes, root } = songNow(t);
    if (instrument.tuned === 'arpeggio') {
      // Guitare highlife : les notes de l'accord égrenées vite, de la plus grave à la plus aiguë.
      const now = audio.now();
      notes.forEach((semitones, k) => audio.playAt(instrument.sound, now + k * 0.035, { rate: semitoneRate(semitones), volume: 0.45 }));
    } else if (instrument.tuned === 'chord') {
      for (const semitones of notes) audio.play(instrument.sound, { rate: semitoneRate(semitones), volume: 0.4 });
    } else if (instrument.tuned === 'root') {
      audio.play(instrument.sound, { rate: semitoneRate(root) });
    } else {
      audio.play(instrument.sound);
    }
  }

  function judge(result, lane) {
    const el = $('battle-judge');
    el.textContent = JUDGE_TEXT[result];
    el.dataset.result = result;
    el.classList.remove('is-pop');
    void el.offsetWidth; // relance l'animation
    el.classList.add('is-pop');
    const pad = padEls[lane];
    if (pad) {
      pad.dataset.result = result;
      pad.classList.remove('is-hit');
      void pad.offsetWidth;
      pad.classList.add('is-hit');
    }
  }

  function tap(lane) {
    if (!run) return;
    const { result, note } = tapRun(run, data, lane, now());
    if (note) noteEls[run.notes.indexOf(note)].hidden = true;
    playInstrument(lane, now());
    judge(result, lane);
    renderScore();
  }

  /** Précision sur les notes déjà jouées (le score final compte toutes les notes). */
  function renderScore() {
    const judged = run.notes.filter((n) => n.result);
    if (judged.length || run.strays) {
      const partial = { notes: judged, strays: run.strays };
      $('battle-accuracy').textContent = pct(runAccuracy(partial, data));
    }
    $('battle-combo').textContent = run.combo >= 4 ? `combo ×${run.combo}` : '';
  }

  function frame() {
    if (!run) return;
    const t = now();
    const { spb } = run.chart;
    const lookahead = LOOKAHEAD_BEATS * spb;

    // Décompte pendant les temps d'intro, puis la ligne bat la mesure.
    const beat = Math.floor(t / spb);
    if (beat !== beatShown) {
      beatShown = beat;
      const lead = data.battle.leadInBeats;
      if (beat >= 0 && beat < lead) {
        // Le décompte : une mesure de 4 temps, comme les baguettes.
        const el = $('battle-judge');
        el.dataset.result = 'count';
        el.textContent = String(beat + 1);
        el.classList.remove('is-pop');
        void el.offsetWidth;
        el.classList.add('is-pop');
      } else if (beat === lead) {
        $('battle-judge').textContent = '';
      }
      if (beat >= 0) {
        const song = songAt(data, genre, beat - lead);
        $('battle-song').textContent = `${song.sectionName} · ${song.chord}`;
      }
      $('battle-track').classList.toggle('is-beat', beat >= 0);
      $('battle-track').classList.toggle('is-downbeat', beat >= lead && (beat - lead) % 4 === 0);
      $('battle-track').classList.remove('is-pulse');
      void $('battle-track').offsetWidth;
      $('battle-track').classList.add('is-pulse');
    }

    for (const note of advanceRun(run, data, t)) {
      noteEls[run.notes.indexOf(note)].hidden = true;
      judge('miss', note.lane);
      renderScore();
    }
    run.notes.forEach((note, i) => {
      if (note.result) return;
      const ahead = note.t - t;
      const el = noteEls[i];
      el.hidden = ahead > lookahead;
      if (!el.hidden) el.style.top = `${(LINE * (1 - ahead / lookahead)) * 100}%`;
    });

    if (runDone(run, t)) {
      finish();
      return;
    }
    frameId = requestAnimationFrame(frame);
  }

  // ---- 3. Le résultat ----
  function finish() {
    cancelAnimationFrame(frameId);
    const accuracy = runAccuracy(run, data);
    const maxCombo = run.maxCombo;
    run = null;
    for (const el of noteEls) el.remove();
    noteEls = [];
    const events = actions.finish(accuracy) ?? [];
    const result = events.find((e) => e.type === 'battleWin' || e.type === 'battleLose');
    showResult(result, maxCombo, events.some((e) => e.type === 'territoryConquered'));
  }

  function showResult(result, maxCombo = 0, conquered = false) {
    if (!result) { closeSheet(false, { force: true }); return; }
    const won = result.type === 'battleWin';
    $('sheet-battle').dataset.tone = won ? 'good' : 'bad';
    $('battle-result-icon').textContent = won ? '🏆' : '💀';
    $('battle-result-text').textContent = result.forfeit
      ? `La battle contre ${result.rival} a été laissée en plan. Elle compte comme perdue.`
      : won
        ? `Tu as battu ${result.rival} : ${pct(result.accuracy)} contre ${pct(result.target)}.${conquered ? ` ${result.name} est à toi !` : ''}`
        : `${result.rival} gagne : ${pct(result.accuracy)} contre ${pct(result.target)}. Retourne pratiquer.`;
    const items = won
      ? [[`+${formatMoney(result.payout - result.stake)}`, 'is-up'], ...(result.hype ? [[`+${formatNumber(result.hype)} hype`, 'is-up']] : [])]
      : [[`−${formatMoney(result.stake)}`, 'is-down']];
    if (maxCombo >= 4) items.push([`combo max ×${maxCombo}`, '']);
    $('battle-changes').replaceChildren(...items.map(([text, cls]) => {
      const li = document.createElement('li');
      li.textContent = text;
      if (cls) li.className = cls;
      return li;
    }));
    showPhase('result');
    openSheet('sheet-battle', { locked: false });
    $('battle-ok').focus({ preventScroll: true });
  }
  $('battle-ok').onclick = () => closeSheet(false, { force: true });

  /** Fiche ouverte sur le choix de la mise : on garde les montants et les blocages à jour. */
  function update() {
    if (!run && !$('battle-setup').hidden && !$('sheet-battle').hidden) renderSetup();
  }

  return { open, update, showResult, get playing() { return Boolean(run); } };
}
