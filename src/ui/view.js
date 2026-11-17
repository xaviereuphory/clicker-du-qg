// Affichage : lit l'état du jeu et met à jour la page. Ne modifie jamais
// l'état directement ; les clics passent par les fonctions `actions` reçues.
//
// Images (volet B), cherchées par id ; un remplaçant s'affiche si le fichier manque :
//   assets/images/personnages/<id>-sheet.png  feuille de sprites (npm run sprites ; perso créé : sprites.js)
//   assets/images/qg/fond.png                 le décor du QG (npm run sprites)
//   assets/images/<sprite>                    objet d'une pièce isométrique (decor.json, greenhouse.json ; voir room-view.js)
//   assets/images/animaux/<idAnimal>.png      animal de compagnie : 2 images de 28 × 20 (npm run sprites)

import {
  battleCooldownLeft, battleRivals, beatValue, beatsPerSecond, cannabisPrice, equipmentCost, formatDuration, formatMoney, formatNumber, getModifiers,
  gramsPerSecond, incomePerSecond, isAvailable, isConquered, isOverdosed, isUnlocked, jointCost,
  netHypePerSecond, petCost, petLevel, producerCost, promoCost, quality, samplesCost, serreRoom, strainCost, studioRoom,
} from '../game/index.js';
import { createRoomView } from './room-view.js';
import { serreTheme, studioTheme } from './room-themes.js';
import { characterOf } from '../game/index.js';
import { sheetUrl } from './sprites.js';

const formatGrams = (grams) => `${formatNumber(grams)} g`;

const $ = (id) => document.getElementById(id);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function describeEffect({ stat, multiply }, texts) {
  const label = texts.stats[stat] ?? stat;
  if (multiply >= 2 && Number.isInteger(multiply)) return `${label} ×${multiply}`;
  const pct = Math.round((multiply - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct} % ${label}`;
}

/**
 * Personnage animé (respiration) à partir de sa feuille de sprites :
 * 2 images de 32 × 48 par ligne, ligne 0 = vue de face. La taille vient de
 * la variable CSS --s (héritée du parent si `scale` n'est pas donné).
 */
function spriteOr(src, name, fallback, scale) {
  if (!src) return fallback;
  const sprite = document.createElement('div');
  sprite.className = 'sprite';
  sprite.setAttribute('role', 'img');
  sprite.setAttribute('aria-label', name);
  if (scale) sprite.style.setProperty('--s', scale);
  const probe = new Image();
  probe.addEventListener('error', () => sprite.replaceWith(fallback), { once: true });
  probe.src = src;
  sprite.style.backgroundImage = `url("${src}")`;
  return sprite;
}

/** Animal de compagnie animé (2 images de 28 × 20, la queue bouge). */
function petImage(id, name) {
  const pet = document.createElement('span');
  pet.className = 'pet-sprite';
  pet.setAttribute('role', 'img');
  pet.setAttribute('aria-label', name);
  pet.style.backgroundImage = `url("assets/images/animaux/${id}.png")`;
  return pet;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---- Sélection de personnage --------------------------------------------

/** onPick(id) : un personnage préfait ; onCreate() : ouvrir l'écran « Créer mon perso ». */
export function showCharacterSelect(data, onPick, onCreate) {
  $('game-screen').hidden = true;
  $('select-screen').hidden = false;
  const list = $('character-list');
  list.replaceChildren();

  for (const character of data.characters) {
    const card = el('button', 'character-card');
    card.type = 'button';
    card.dataset.character = character.id;
    if (character.color) card.style.setProperty('--stage', character.color); // couleur de fond de la carte (facultative)
    const portrait = el('div', 'character-portrait');
    portrait.append(spriteOr(sheetUrl(data, character.id), character.name, document.createTextNode(character.name[0]), 3));
    const effects = el('ul', 'character-effects');
    for (const effect of character.effects) effects.append(el('li', '', describeEffect(effect, data.texts)));
    card.append(
      portrait,
      el('p', 'character-name', character.name),
      el('p', 'character-strength', character.strength),
      el('p', 'character-description', character.description),
      effects,
    );
    card.addEventListener('click', () => onPick(character.id));
    list.append(card);
  }

  // La carte « Créer mon perso » (src/ui/creator-view.js, data/creation.json).
  if (onCreate && data.creation) {
    const card = el('button', 'character-card character-card-create');
    card.type = 'button';
    const portrait = el('div', 'character-portrait');
    portrait.append(el('span', 'character-create-icon', '✨'));
    card.append(
      portrait,
      el('p', 'character-name', 'Ton perso'),
      el('p', 'character-strength', 'Sur mesure'),
      el('p', 'character-description', `Ton look, ${data.creation.points} points de talent à placer et un signe particulier tiré au hasard.`),
    );
    card.addEventListener('click', () => onCreate());
    list.append(card);
  }
}

// ---- Écran de jeu ---------------------------------------------------------

export function createGameView(data, actions, fx) {
  $('select-screen').hidden = true;
  $('game-screen').hidden = false;

  // ---- Achats : un bouton trop cher reste cliquable pour montrer le refus (animation 34) ----
  let lastState = null;
  const needs = new Map(); // bouton → { priceEl, cost, resource, format, locked }

  function setBuyable(button, priceEl, { cost, wallet, resource = 'money', format = formatMoney, locked = false, done = false }) {
    button.disabled = done;
    const short = !done && (locked || wallet < cost);
    if (short) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
    needs.set(button, { priceEl, cost, resource, format, locked });
  }

  function tryBuy(button, buy) {
    if (button.getAttribute('aria-disabled') !== 'true') return buy();
    const need = needs.get(button);
    if (!need || !lastState) return undefined;
    if (need.locked) return fx.play('ui_refuse', { target: need.priceEl });
    const have = need.resource === 'grams' ? lastState.grams : lastState.money;
    if (have >= need.cost) return buy();
    return fx.play('ui_refuse', { target: need.priceEl, text: `il manque ${need.format(need.cost - have)}` });
  }

  const buyRow = (buy) => (row) => tryBuy(row.button, () => buy(row.def.id));
  const producerRows = data.producers.map((def) => shopRow(def, buyRow(actions.buyProducer)));
  const upgradeRows = data.upgrades.map((def) => shopRow(def, buyRow(actions.buyUpgrade), 'installé'));
  const equipmentRows = data.greenhouse.equipment.map((def) => shopRow(def, buyRow(actions.buyEquipment)));
  const strainRows = data.greenhouse.strains.map((def) => shopRow(def, buyRow(actions.buyStrain)));
  const petRows = (data.pets ?? []).map((def) => {
    const row = shopRow(def, buyRow(actions.buyPet));
    row.button.prepend(petImage(def.id, def.name));
    // Bouton « à côté de moi » : choisir quel animal se tient près du personnage.
    row.follow = el('button', 'pet-follow', 'à côté de moi');
    row.follow.type = 'button';
    row.follow.hidden = true;
    row.follow.onclick = () => actions.setCompanion(def.id);
    row.li.append(row.follow);
    row.effect.textContent = `par niveau : ${def.effects.map((e) => describeEffect(e, data.texts)).join(', ')}`;
    return row;
  });
  const rowsByEvent = {
    buyProducer: producerRows, buyUpgrade: upgradeRows, buyEquipment: equipmentRows, buyStrain: strainRows,
    adoptPet: petRows, treatPet: petRows,
  };
  $('shop-producers').replaceChildren(...producerRows.map((r) => r.li));
  $('shop-upgrades').replaceChildren(...upgradeRows.map((r) => r.li));
  $('shop-equipment').replaceChildren(...equipmentRows.map((r) => r.li));
  $('shop-strains').replaceChildren(...strainRows.map((r) => r.li));
  $('shop-pets').replaceChildren(...petRows.map((r) => r.li));
  for (const row of upgradeRows) {
    row.effect.textContent = row.def.effects.map((e) => describeEffect(e, data.texts)).join(', ');
  }
  for (const row of strainRows) {
    row.effect.textContent = `par niveau : ${row.def.effects.map((e) => describeEffect(e, data.texts)).join(', ')}`;
  }

  const game = $('game-screen');
  function selectTab(name) {
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('is-active', t.dataset.tab === name);
    for (const panel of document.querySelectorAll('.shop')) panel.hidden = panel.dataset.panel !== name;
  }
  for (const tab of document.querySelectorAll('.tab')) tab.onclick = () => selectTab(tab.dataset.tab);

  // Les lieux (barre du bas) : studio, serre, carte, classement — la même partie.
  const SHOP_TITLES = { studio: 'La boutique', serre: 'La serre', carte: 'Le monde' };
  function setScene(name) {
    if (name !== 'studio') studio?.stopEditing();
    if (name !== 'serre') serre?.stopEditing();
    closeSheet();
    game.dataset.scene = name;
    for (const t of document.querySelectorAll('.scene-tab')) t.classList.toggle('is-active', t.dataset.scene === name);
    $(`tab-${name}`)?.classList.remove('is-new');
    if (name === 'studio' || name === 'serre') selectTab(name === 'serre' ? 'equipment' : 'producers');
    $('nav-shop-label').textContent = name === 'carte' ? 'Monde' : 'Boutique';
    $('nav-shop').querySelector('.nav-icon').textContent = name === 'carte' ? '🌍' : '🛒';
    $('sheet-shop-title').textContent = SHOP_TITLES[name] ?? SHOP_TITLES.studio;
    fitScenes();
    if (lastState) update(lastState);
    window.scrollTo({ top: 0 });
    fx.sceneShown(name);
  }
  for (const t of document.querySelectorAll('.scene-tab')) {
    t.onclick = () => {
      // Lieu verrouillé : on dit quand il s'ouvre, au lieu d'un bouton mort.
      if (t.getAttribute('aria-disabled') === 'true') return toast(t.dataset.lockedText ?? 'Pas encore débloqué.');
      return setScene(t.dataset.scene);
    };
  }

  // ---- Panneaux qui montent du bas : boutique, QGram, réglages ----
  let openSheetId = null;
  let lockedSheet = false; // une question d'événement attend une réponse : on ne ferme pas
  let unread = 0;
  function openSheet(id, { locked = false } = {}) {
    if (openSheetId === id) {
      lockedSheet = locked;
      return true;
    }
    if (lockedSheet) return false;
    closeSheet(true);
    lockedSheet = locked;
    const sheet = $(id);
    openSheetId = id;
    sheet.hidden = false;
    sheet.classList.remove('is-closing');
    sheet.classList.add('is-open');
    $('sheet-backdrop').hidden = false;
    document.body.classList.add('has-sheet');
    sheet.querySelector('.sheet-close')?.focus({ preventScroll: true });
    if (id === 'sheet-feed') {
      unread = 0;
      renderBadge('feed-badge', 0);
    }
    return true;
  }
  function closeSheet(instant = false, { force = false } = {}) {
    if (!openSheetId || (lockedSheet && !force)) return;
    lockedSheet = false;
    const sheet = $(openSheetId);
    openSheetId = null;
    $('sheet-backdrop').hidden = true;
    document.body.classList.remove('has-sheet');
    sheet.classList.remove('is-open');
    if (instant || fx.motion.reduced) {
      sheet.hidden = true;
      return;
    }
    sheet.classList.add('is-closing');
    const done = () => {
      clearTimeout(fallback);
      if (openSheetId !== sheet.id) sheet.hidden = true;
      sheet.classList.remove('is-closing');
    };
    // Si l'animation ne se termine jamais (onglet en arrière-plan), on ferme quand même.
    const fallback = setTimeout(done, 400);
    sheet.addEventListener('animationend', done, { once: true });
  }
  $('nav-shop').onclick = () => {
    if (game.dataset.scene === 'classement') setScene('studio');
    openSheet('sheet-shop');
  };
  $('open-feed').onclick = () => openSheet('sheet-feed');
  $('open-settings').onclick = () => openSheet('sheet-settings');
  $('hud-avatar').onclick = () => openSheet('sheet-settings');
  $('sheet-backdrop').onclick = () => closeSheet();
  for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => closeSheet();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSheet();
  });

  function renderBadge(id, count) {
    const badge = $(id);
    badge.hidden = count <= 0;
    badge.textContent = count > 9 ? '9+' : String(count);
  }

  // Bulle de notification en haut de la scène (le dernier message QGram).
  let toastTimer = null;
  function toast(text, kind = '', handle = '') {
    const node = $('toast');
    node.className = `toast ${kind}`;
    node.replaceChildren();
    if (handle) node.append(el('span', 'feed-handle', handle));
    node.append(document.createTextNode(text));
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (fx.motion.reduced) {
        node.hidden = true;
        return;
      }
      node.classList.add('is-leaving');
      node.addEventListener('animationend', () => { node.hidden = true; }, { once: true });
    }, 3200);
  }

  // Cibles de clic : l'enfoncement (animation 01) part au pointerdown, plus rapide au doigt ;
  // au clavier (event.detail = 0), il part avec le clic. La logique reste sur `click`.
  const tonearm = document.querySelector('.deck .tonearm');
  function clickTarget(button, action, arm = null) {
    button.addEventListener('pointerdown', (event) => {
      if (event.button === 0 && !button.disabled) fx.play('click_squash', { target: button, arm });
    });
    button.onclick = (event) => {
      if (event.detail === 0) fx.play('click_squash', { target: button, arm });
      action(event);
    };
    return button;
  }
  const beatButton = clickTarget($('beat-button'), actions.click, tonearm);
  const harvestButton = clickTarget($('harvest-button'), actions.harvest);
  const showButton = clickTarget($('show-button'), actions.playShow);

  $('buy-cannabis').onclick = () => tryBuy($('buy-cannabis'), actions.buyCannabis);
  $('roll-joint').onclick = () => tryBuy($('roll-joint'), actions.rollJoint);
  $('territory-start').onclick = () => actions.startCampaign(selectedTerritory);
  $('territory-promo').onclick = () => tryBuy($('territory-promo'), actions.runPromo);
  $('territory-samples').onclick = () => tryBuy($('territory-samples'), actions.giveSamples);
  $('territory-battle').onclick = () => actions.openBattle(selectedTerritory);
  $('reset').onclick = () => actions.reset();

  // Flatter l'animal : des cœurs qui montent (purement pour le plaisir).
  $('qg-pet').onclick = (event) => {
    actions.petPet();
    if (fx.motion.reduced) return;
    const pet = $('qg-pet');
    const rect = pet.getBoundingClientRect();
    const box = scene.getBoundingClientRect();
    const heart = el('span', 'pet-heart', '❤');
    const keyboard = !event.clientX && !event.clientY;
    heart.style.left = `${(keyboard ? rect.left + rect.width / 2 : event.clientX) - box.left + (Math.random() - 0.5) * 16}px`;
    heart.style.top = `${(keyboard ? rect.top : event.clientY) - box.top - 12}px`;
    scene.append(heart);
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
    pet.classList.remove('is-petted');
    void pet.offsetWidth; // relance l'animation de saut
    pet.classList.add('is-petted');
  };
  $('toggle-sound').onclick = () => actions.toggleSound();

  const { maxHigh, overdose } = data.balance.cannabis;
  $('overdose-marker').style.setProperty('--at', `${(overdose.threshold / maxHigh) * 100}%`);
  $('overdose-marker').hidden = !overdose.enabled;

  // Les scènes sont dessinées en 160 × 100 pixels : --s = taille d'un pixel à l'écran.
  const scene = $('qg');
  const scenes = [scene, $('serre'), $('carte'), $('classement')];
  function fitScenes() {
    // Le studio isométrique donne sa propre largeur en pixels (data-width).
    for (const s of scenes) if (s.clientWidth && s.classList.contains('scene')) s.style.setProperty('--s', s.clientWidth / Number(s.dataset.width || 160));
  }
  const observer = new ResizeObserver(fitScenes);
  // Le QG et la serre : des pièces isométriques avec leur mode Édition (src/ui/room-view.js).
  const describe = (effect) => describeEffect(effect, data.texts);
  const studio = createRoomView(data, {
    room: studioRoom, scene, canvases: { back: $('qg-room'), front: $('qg-room-front') }, prefix: 'studio',
    theme: studioTheme, labels: { the: 'le studio', of: 'du studio' },
    character: $('qg-character'), pet: $('qg-pet'), walkers: true, actions: actions.studio, toast: (text) => toast(text),
    describe, onPet: () => actions.petPet(),
  });
  const serre = createRoomView(data, {
    room: serreRoom, scene: $('serre'), canvases: { back: $('serre-room'), front: $('serre-room-front') }, prefix: 'serre',
    theme: serreTheme, labels: { the: 'la serre', of: 'de la serre' },
    character: $('serre-character'), actions: actions.serre, toast: (text) => toast(text), describe,
  });
  for (const s of scenes) observer.observe(s);
  fitScenes();

  // ---- La carte : liens entre territoires, marqueurs, liste ----
  const territories = data.map.territories;
  let selectedTerritory = territories.find((t) => t.requires.includes(data.map.startTerritory))?.id;
  const svgNS = 'http://www.w3.org/2000/svg';
  const links = [];
  for (const t of territories) {
    for (const r of t.requires) {
      const from = territories.find((x) => x.id === r);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
      line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
      $('carte-links').append(line);
      links.push({ line, from: r, to: t.id });
    }
  }
  const markers = territories.map((t, i) => {
    const marker = el('button', 'marker');
    marker.type = 'button';
    marker.title = t.name;
    marker.style.left = `${(t.x / 160) * 100}%`;
    marker.style.top = `${t.y}%`;
    marker.textContent = t.id === data.map.startTerritory ? '⌂' : String(i);
    const label = el('span', 'marker-label', t.name);
    marker.append(label);
    marker.onclick = () => selectTerritory(t.id);
    $('carte-markers').append(marker);
    return { t, marker, label };
  });
  const listRows = territories.map((t) => {
    const li = el('li');
    const button = el('button');
    button.type = 'button';
    const state = el('span', 't-state');
    button.append(el('span', '', t.name), state);
    button.onclick = () => selectTerritory(t.id);
    li.append(button);
    $('territory-list').append(li);
    return { t, button, state };
  });

  function selectTerritory(id) {
    selectedTerritory = id;
    if (lastState) update(lastState);
  }

  startTicker(data.texts.ticker ?? []);

  let qgKey = '';
  let spinKey = '';

  function update(state) {
    lastState = state;
    studio.update(state);
    serre.update(state);
    const mods = getModifiers(state, data);
    const tier = data.tiers[state.tierIndex];
    const nextTier = data.tiers[state.tierIndex + 1];
    const bps = beatsPerSecond(state, data, mods);

    $('stat-money').textContent = formatMoney(state.money);
    $('stat-income').textContent = formatMoney(incomePerSecond(state, data, mods));
    $('stat-beat-value').textContent = formatMoney(beatValue(state, data, mods));
    $('stat-bps').textContent = formatNumber(bps);
    $('stat-tier').textContent = tier.name;
    updateGreenhouse(state, mods);
    updateMap(state, mods);

    // Le vinyle tourne plus vite quand la production monte (par paliers, pour éviter les saccades).
    const spin = ['6s', '4s', '3s', '2s', '1.4s', '1s', '.7s'][Math.min(6, Math.floor(Math.log10(1 + bps * 3)))];
    if (spin !== spinKey) {
      spinKey = spin;
      beatButton.style.setProperty('--spin', spin);
    }

    // Fans : la barre est relative au niveau de référence ; le repère montre le seuil de fail out.
    const { fail } = data.balance;
    const scale = Math.max(state.fansReference, fail.minReferenceFans);
    $('fans-fill').style.width = `${Math.min(100, (state.fans / scale) * 100)}%`;
    $('fans-ref').style.left = `${fail.enterRatio * 100}%`;
    $('fans-ref').hidden = state.fansReference < fail.minReferenceFans;
    $('fans-count').textContent = formatNumber(state.fans);
    $('next-tier').textContent = nextTier
      ? `Prochain palier : ${nextTier.name} à ${formatNumber(nextTier.fansRequired)} abonnés`
      : 'Palier maximum. Légende du sous-sol.';

    $('high-fill').style.setProperty('--pct', `${(state.high / maxHigh) * 100}%`);
    $('quality').textContent = `beats ×${quality(state, data, mods).toFixed(2)}`;
    const price = cannabisPrice(state, data, mods);
    $('cannabis-price').textContent = formatMoney(price);
    setBuyable($('buy-cannabis'), $('cannabis-price'), { cost: price, wallet: state.money });

    const overdosed = isOverdosed(state, data);
    fx.setMood(state.failOut ? 'fail' : state.high > 0 ? 'zen' : 'normal');
    $('status-fail').hidden = !state.failOut;
    $('status-fail-text').hidden = !state.failOut;
    $('status-overdose').hidden = !overdosed;
    scene.style.setProperty('--high', (state.high / maxHigh).toFixed(2));
    scene.classList.toggle('is-overdosed', overdosed);
    scene.classList.toggle('is-failing', state.failOut);

    for (const row of producerRows) {
      const owned = state.producers[row.def.id] ?? 0;
      row.owned.textContent = owned > 0 ? `×${owned}` : '';
      row.effect.textContent = `+${formatNumber(row.def.beatsPerSecond * mods.bps)} beats/s chacun`;
      updateCost(row, { cost: producerCost(row.def, owned), wallet: state.money, unlocked: isUnlocked(row.def, state) });
    }
    for (const row of upgradeRows) {
      const bought = Boolean(state.upgrades[row.def.id]);
      row.owned.textContent = bought ? '✓' : '';
      updateCost(row, { cost: row.def.cost, wallet: state.money, unlocked: isUnlocked(row.def, state), done: bought });
    }
    for (const row of petRows) {
      const level = petLevel(state, row.def.id);
      const unlocked = isUnlocked(row.def, state);
      row.owned.textContent = level > 0 ? `amitié niv. ${level}` : '';
      updateCost(row, { cost: petCost(row.def, level), wallet: state.money, unlocked });
      if (unlocked) row.cost.textContent = `${level > 0 ? 'gâterie' : 'adopter'} · ${row.cost.textContent}`;
      row.follow.hidden = level === 0;
      row.follow.disabled = state.companion === row.def.id;
      row.follow.textContent = state.companion === row.def.id ? '✓ à côté de toi' : 'à côté de moi';
    }

    renderEffects(state);

    // Badge de la boutique : combien d'articles on peut acheter maintenant.
    const place = game.dataset.scene;
    const shopRows = place === 'serre' ? [...equipmentRows, ...strainRows] : [...producerRows, ...upgradeRows, ...petRows];
    const affordable = place === 'carte' ? 0 : shopRows.filter((row) => !row.button.disabled && row.button.getAttribute('aria-disabled') !== 'true').length;
    if (affordable !== shopBadge) {
      shopBadge = affordable;
      renderBadge('shop-badge', affordable);
    }

    // Le QG n'est reconstruit que quand les upgrades achetés changent.
    const key = `${state.characterId}|${Object.keys(state.upgrades).join(',')}|${state.companion}`;
    if (key !== qgKey) {
      qgKey = key;
      renderQg(state);
    }
  }

  /** Lieu verrouillé tant que le palier n'est pas atteint : cadenas, et un message au toucher. */
  function updateSceneTab(id, unlocked, icon, label, tierIndex) {
    const tab = $(id);
    if (tab.dataset.unlocked === String(unlocked)) return;
    tab.dataset.unlocked = String(unlocked);
    tab.classList.toggle('is-locked', !unlocked);
    if (unlocked) tab.removeAttribute('aria-disabled');
    else tab.setAttribute('aria-disabled', 'true');
    tab.querySelector('.nav-icon').textContent = unlocked ? icon : '🔒';
    tab.dataset.lockedText = `${label} : se débloque au palier « ${data.tiers[tierIndex].name} ».`;
    tab.setAttribute('aria-label', unlocked ? label : tab.dataset.lockedText);
  }

  function updateMap(state, mods) {
    const unlocked = state.mapUnlocked;
    updateSceneTab('tab-carte', unlocked, '🗺️', 'La carte', data.map.unlockTier);
    $('chip-territories').hidden = !unlocked;
    if (!unlocked) return;
    const conqueredCount = territories.filter((t) => isConquered(state, t.id)).length;
    $('stat-territories').textContent = `${conqueredCount}/${territories.length}`;
    if (game.dataset.scene !== 'carte') return;

    const statusOf = (t) => {
      if (isConquered(state, t.id)) return 'conquered';
      if (state.campaign === t.id) return 'campaign';
      return isAvailable(state, data, t) ? 'available' : 'locked';
    };
    for (const { t, marker, label } of markers) {
      const status = statusOf(t);
      marker.className = `marker is-${status}${t.id === selectedTerritory ? ' is-selected' : ''}`;
      label.hidden = !(t.id === selectedTerritory || status === 'campaign');
    }
    for (const { line, from, to } of links) {
      const done = isConquered(state, from) && isConquered(state, to);
      line.setAttribute('class', done ? 'is-done' : isConquered(state, from) ? 'is-open' : '');
    }
    const STATE_LABEL = { conquered: '✓ conquis', campaign: '▶ campagne', available: 'ouvert', locked: '🔒' };
    for (const row of listRows) {
      row.state.textContent = STATE_LABEL[statusOf(row.t)];
      row.button.classList.toggle('is-selected', row.t.id === selectedTerritory);
    }

    // Fiche du territoire sélectionné.
    const t = territories.find((x) => x.id === selectedTerritory) ?? territories[0];
    const status = statusOf(t);
    $('territory-name').textContent = t.name;
    $('territory-status').textContent = {
      conquered: '✓ Territoire conquis',
      campaign: '▶ Campagne en cours',
      available: 'Ouvert à la conquête',
      locked: `🔒 Conquiers d'abord ${t.requiresAll ? '' : 'un de ces territoires : '}${t.requires.map((id) => territories.find((x) => x.id === id).name).join(t.requiresAll ? ' et ' : ', ')}`,
    }[status];
    $('territory-description').textContent = t.description;
    $('territory-rival').textContent = t.rival ? `Rival : ${t.rival} (−${formatNumber(t.defense)} hype/s)` : '';
    $('territory-bonus').textContent = t.effects.length
      ? `Bonus : ${t.effects.map((e) => describeEffect(e, data.texts)).join(', ')}`
      : '';
    const showProgress = t.hype > 0 && status !== 'locked';
    $('territory-progress').hidden = !showProgress;
    if (showProgress) {
      const hype = isConquered(state, t.id) ? t.hype : (state.hype[t.id] ?? 0);
      $('territory-fill').style.width = `${(hype / t.hype) * 100}%`;
      $('territory-hype').textContent = `${formatNumber(hype)} / ${formatNumber(t.hype)} hype`;
      const rate = netHypePerSecond(state, data, t, mods);
      const rateEl = $('territory-rate');
      rateEl.textContent = status === 'conquered' ? '' : `${rate >= 0 ? '+' : ''}${formatNumber(Math.max(rate, 0))}/s`;
      rateEl.classList.toggle('rate-blocked', status !== 'conquered' && rate <= 0);
      if (status !== 'conquered' && rate <= 0) rateEl.textContent = 'bloqué par le rival';
    }
    $('territory-start').hidden = status !== 'available';
    $('territory-start-label').textContent = state.campaign ? 'Déplacer la campagne ici' : 'Lancer la campagne';
    $('territory-boosts').hidden = status !== 'campaign';
    if (status === 'campaign') {
      const promo = promoCost(state, data, t, mods);
      $('promo-cost').textContent = formatMoney(promo);
      setBuyable($('territory-promo'), $('promo-cost'), { cost: promo, wallet: state.money });
      $('territory-samples').hidden = !state.greenhouseUnlocked;
      const samples = samplesCost(state, data, t, mods);
      $('samples-cost').textContent = formatGrams(samples);
      setBuyable($('territory-samples'), $('samples-cost'), { cost: samples, wallet: state.grams, resource: 'grams', format: formatGrams });
    }

    // Battle de beat contre le rival d'un territoire ouvert (src/ui/battle-view.js).
    const canBattle = battleRivals(state, data).some((x) => x.id === t.id);
    $('territory-battle').hidden = !canBattle;
    if (canBattle) {
      $('territory-battle-label').textContent = `⚔️ Battle contre ${t.rival}`;
      const wait = battleCooldownLeft(state, data, t.id);
      $('territory-battle-note').textContent = wait > 0 ? `revanche ${formatDuration(wait)}` : 'mise ton cash';
    }

    const campaign = territories.find((x) => x.id === state.campaign);
    showButton.disabled = !campaign;
    $('show-hint').textContent = campaign ? `chaque show donne de la hype à ${campaign.name}` : 'choisis un territoire et lance une campagne';
  }

  function updateGreenhouse(state, mods) {
    const unlocked = state.greenhouseUnlocked;
    updateSceneTab('tab-serre', unlocked, '🌿', 'La serre', data.greenhouse.unlockTier);
    $('chip-grams').hidden = !unlocked;
    $('roll-joint').hidden = !unlocked;
    if (!unlocked) return;

    const gps = gramsPerSecond(state, data, mods);
    $('stat-grams').textContent = `${formatGrams(state.grams)} (+${formatGrams(gps)}/s)`;
    const joint = jointCost(state, data, mods);
    $('joint-cost').textContent = formatGrams(joint);
    setBuyable($('roll-joint'), $('joint-cost'), { cost: joint, wallet: state.grams, resource: 'grams', format: formatGrams });

    for (const row of equipmentRows) {
      const owned = state.equipment[row.def.id] ?? 0;
      row.owned.textContent = owned > 0 ? `×${owned}` : '';
      row.effect.textContent = `+${formatGrams(row.def.gramsPerSecond * mods.grow)}/s chacun`;
      updateCost(row, { cost: equipmentCost(row.def, owned), wallet: state.money });
    }
    for (const row of strainRows) {
      const level = state.strains[row.def.id] ?? 0;
      row.owned.textContent = level > 0 ? `niv. ${level}` : '';
      updateCost(row, { cost: strainCost(row.def, level), wallet: state.grams, resource: 'grams', format: formatGrams });
    }
    // L'équipement et les variétés sont dans la serre isométrique (room-view.js).
  }

  function updateCost(row, { cost, wallet, unlocked = true, done = false, resource = 'money', format = formatMoney }) {
    row.li.classList.toggle('is-locked', !unlocked && !done);
    row.li.classList.toggle('is-done', done);
    row.cost.classList.remove('too-expensive');
    if (done) {
      row.cost.textContent = 'installé au QG';
    } else if (!unlocked) {
      row.cost.textContent = `🔒 palier « ${data.tiers[row.def.requiresTier]?.name ?? '?'} »`;
    } else {
      row.cost.textContent = format(cost);
      row.cost.classList.toggle('too-expensive', wallet < cost);
    }
    setBuyable(row.button, row.cost, { cost, wallet, resource, format, locked: !unlocked, done });
  }

  function renderQg(state) {
    const character = characterOf(state, data); // préfait ou créé par le joueur
    const sheet = sheetUrl(data, character.id);
    for (const id of ['hud-face', 'career-face']) {
      $(id).dataset.character = character.id;
      $(id).style.backgroundImage = sheet ? `url("${sheet}")` : '';
    }
    $('career-name').textContent = `${character.name} · ${character.strength}`;
    const fallback = el('div', 'qg-character-fallback', character.name[0]);
    $('qg-character').replaceChildren(spriteOr(sheet, character.name, fallback));
    $('serre-character').replaceChildren(spriteOr(sheet, character.name, fallback.cloneNode(true)));
    // Les objets achetés sont dans la pièce isométrique (studio-view.js).

    // L'animal de compagnie, assis à côté du personnage et tourné vers lui.
    const pet = (data.pets ?? []).find((p) => p.id === state.companion && petLevel(state, p.id) > 0);
    const petSlot = $('qg-pet');
    petSlot.hidden = !pet;
    if (pet) {
      petSlot.setAttribute('aria-label', `Flatter ${pet.name}`);
      petSlot.title = pet.name;
      petSlot.replaceChildren(petImage(pet.id, pet.name));
    }
  }

  function startTicker(lines) {
    const text = $('ticker-text');
    if (!lines.length) return;
    let index = 0;
    const show = () => {
      text.textContent = lines[index % lines.length];
      text.style.setProperty('--ticker-duration', `${Math.max(10, text.textContent.length * 0.22)}s`);
      index += 1;
    };
    text.addEventListener('animationiteration', show);
    show();
  }

  function showMessage(text, kind = '') {
    if (!text) return;
    const list = $('messages');
    const li = el('li', kind);
    if (kind === 'fan') li.append(el('span', 'feed-handle', pick(data.texts.fanHandles ?? ['@fan'])));
    li.append(document.createTextNode(text));
    list.prepend(li);
    while (list.children.length > 30) list.lastElementChild.remove();
    // Hors du téléphone ouvert : bulle sur la scène (si rien ne la cache) et compteur de non-lus.
    if (openSheetId !== 'sheet-feed') {
      if (!openSheetId) toast(text, kind, li.querySelector('.feed-handle')?.textContent ?? '');
      unread += 1;
      renderBadge('feed-badge', unread);
    }
  }

  // ---- Événements à la BitLife : la carte, les choix, le résultat ----
  const LOWER_IS_BETTER = new Set(['churn', 'cannabisDecay', 'cannabisPrice']);
  function describeChange(change) {
    const sign = (n) => (n < 0 ? '−' : '+');
    switch (change.resource) {
      case 'money': return `${sign(change.delta)}${formatMoney(Math.abs(change.delta))}`;
      case 'fans': return `${sign(change.delta)}${formatNumber(Math.abs(change.delta))} abonnés`;
      case 'grams': return `${sign(change.delta)}${formatGrams(Math.abs(change.delta))}`;
      case 'high': return 'stash saisi : zen à 0';
      case 'hype': return `${sign(change.delta)}${formatNumber(Math.abs(change.delta))} hype`;
      case 'buff': return `${data.texts.stats[change.stat] ?? change.stat} ×${change.multiply} pendant ${change.seconds} s`;
      default: return '';
    }
  }
  function isGood(change) {
    if (change.resource === 'buff') return LOWER_IS_BETTER.has(change.stat) ? change.multiply < 1 : change.multiply > 1;
    return change.delta > 0;
  }

  /** Affiche un événement : question (avec ses choix), résultat d'un choix, ou événement direct. */
  function showEvent(gameEvent, onChoose) {
    const def = data.events?.list.find((e) => e.id === gameEvent.id);
    if (!def) return;
    const prompt = gameEvent.type === 'eventPrompt';
    const sheet = $('sheet-event');
    sheet.dataset.tone = prompt ? def.tone : gameEvent.tone ?? def.tone;
    $('event-title').textContent = def.title;
    $('event-icon').textContent = def.icon;
    $('event-text').textContent = prompt ? def.text : gameEvent.text ?? def.text;
    const visible = (c) => describeChange(c) && (c.resource === 'buff' || Math.abs(c.delta) >= 0.5);
    $('event-changes').replaceChildren(...(gameEvent.changes ?? []).filter(visible).map((c) => {
      const li = el('li', isGood(c) ? 'is-up' : 'is-down', describeChange(c));
      return li;
    }));
    const buttons = prompt
      ? def.choices.map((choice, i) => {
        const button = el('button', 'btn', choice.label);
        button.type = 'button';
        button.onclick = () => onChoose(i);
        return button;
      })
      : [Object.assign(el('button', 'btn btn-ok', 'OK'), { type: 'button', onclick: () => closeSheet(false, { force: true }) })];
    $('event-choices').replaceChildren(...buttons);
    openSheet('sheet-event', { locked: prompt });
    buttons[0]?.focus({ preventScroll: true });
  }

  let effectsKey = '';
  function renderEffects(state) {
    const active = state.events?.active.filter((b) => b.until > state.time) ?? [];
    const key = active.map((b) => `${b.stat}${b.multiply}${Math.ceil(b.until - state.time)}`).join('|');
    if (key === effectsKey) return;
    effectsKey = key;
    $('stat-effects').replaceChildren(...active.map((b) => {
      const good = LOWER_IS_BETTER.has(b.stat) ? b.multiply < 1 : b.multiply > 1;
      const chip = el('span', `stat stat-effect${good ? '' : ' is-down'}`);
      chip.append(el('span', 'stat-label', `${data.events.list.find((e) => e.id === b.source)?.icon ?? '⚡'} ${data.texts.stats[b.stat] ?? b.stat}`), `×${b.multiply} · ${Math.ceil(b.until - state.time)} s`);
      return chip;
    }));
  }

  function setFansTrend(direction) {
    const trend = $('fans-trend');
    trend.className = `trend ${direction}`;
    trend.textContent = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
  }

  function setSaveStatus(text) {
    $('save-status').textContent = text;
  }

  function setSoundLabel(enabled) {
    $('toggle-sound').textContent = enabled ? 'Couper le son' : 'Activer le son';
  }

  function announceGreenhouse() {
    $('tab-serre').classList.add('is-new');
  }

  let shopBadge = -1;

  function announceMap() {
    $('tab-carte').classList.add('is-new');
  }

  /** Où trouver les éléments de la page pour les animations (src/ui/fx/fx.js). */
  const anchors = {
    counter: () => $('stat-money'),
    coinSource: () => (game.dataset.scene === 'studio' ? beatButton : scenes.find((s) => s.offsetParent)),
    isFailing: () => Boolean(lastState?.failOut),
    characters: () => [$('qg-character'), $('serre-character')],
    character: () => ({ studio: $('qg-character'), serre: $('serre-character') })[game.dataset.scene] ?? null,
    scene: () => scenes.find((s) => s.offsetParent) ?? scene,
    currentScene: () => game.dataset.scene,
    tierChip: () => document.querySelector('.chip-tier'),
    shopRow: (type, id) => rowsByEvent[type]?.find((row) => row.def.id === id),
    territoriesChip: () => $('chip-territories'),
    flagMapTab: () => announceMap(),
    selectTerritory,
    marker: (id) => markers.find((m) => m.t.id === id)?.marker,
    hypeFill: () => $('territory-fill'),
    territoryCard: () => document.querySelector('.card-territory'),
    territoryBonus: () => $('territory-bonus'),
    openedLinks: (id) => links
      .filter((link) => link.from === id && lastState && !isConquered(lastState, link.to)
        && isAvailable(lastState, data, territories.find((t) => t.id === link.to)))
      .map((link) => ({ line: link.line, marker: markers.find((m) => m.t.id === link.to)?.marker })),
  };

  return {
    update, showMessage, showEvent, studio, setFansTrend, setSaveStatus, setSoundLabel, announceGreenhouse, announceMap, setScene, openSheet, closeSheet,
    beatButton, harvestButton, showButton, anchors,
  };
}

/** Ligne de boutique (aussi utilisée par la démo des animations). `stampText` : tampon d'achat unique. */
export function shopRow(def, onBuy, stampText = '') {
  const li = el('li');
  const button = el('button', 'shop-item');
  button.type = 'button';
  const owned = el('span', 'shop-item-owned');
  const effect = el('span', 'shop-item-effect');
  const cost = el('span', 'shop-item-cost');
  button.append(el('span', 'shop-item-name', def.name), owned, el('span', 'shop-item-desc', def.description), effect, cost);
  li.append(button);
  const row = { def, li, button, owned, effect, cost, stamp: null };
  if (stampText) {
    row.stamp = el('span', 'shop-stamp', stampText);
    li.append(row.stamp);
  }
  button.addEventListener('click', () => onBuy(row));
  return row;
}
