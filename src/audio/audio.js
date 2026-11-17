// Audio : joue les sons déclarés dans data/sounds.json (volet C).
// Chaque événement du jeu (click, buyUpgrade, failStart...) peut avoir
// plusieurs variantes ; une est choisie au hasard (jamais deux fois la même
// de suite). Un fichier manquant est simplement ignoré, le jeu reste jouable sans son.
//
// Les effets passent par la Web Audio API (docs/prochaines-phases.md, partie 4) :
// pas de latence au clic, des sons qui se superposent, et surtout des sons
// programmés à un instant précis de l'horloge audio. La battle de beat s'en sert
// pour que la batterie tombe pile quand une note touche la ligne :
//   audio.now()                          horloge audio en secondes (ou l'horloge de la page sans Web Audio)
//   audio.latency()                      délai entre l'horloge et le haut-parleur, en secondes
//   audio.play(type, { rate, volume })   joue tout de suite (rate : 2 = une octave plus haut)
//   audio.playAt(type, quand, options)   joue à l'instant `quand` de audio.now() ; renvoie de quoi l'arrêter
//   await audio.ready()                  attend que le son soit débloqué et les fichiers prêts
// La musique d'ambiance reste un simple <audio> en boucle.

const BASE = 'assets/audio/';

export function createAudio(sounds, { enabled = true } = {}) {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const ctx = Context ? new Context({ latencyHint: 'interactive' }) : null;
  const master = ctx?.createGain();
  if (master) {
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
  }
  const buffers = new Map(); // fichier → AudioBuffer
  const lastVariant = new Map();
  const music = new Audio();
  music.loop = true;
  music.volume = 0.5;
  let currentMood = null;
  let unlocked = false; // les navigateurs bloquent le son avant la première interaction

  // Tous les effets sont petits : on les charge et décode d'avance.
  const files = [...new Set(Object.values(sounds.effects ?? {}).flat())];
  const loading = ctx
    ? Promise.all(files.map(async (file) => {
      try {
        const response = await fetch(BASE + file);
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        buffers.set(file, await new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)));
      } catch { /* fichier manquant ou illisible : ignoré */ }
    }))
    : Promise.resolve();

  function pickBuffer(eventType) {
    const variants = (sounds.effects?.[eventType] ?? []).filter((f) => buffers.has(f));
    if (!variants.length) return null;
    let i = Math.floor(Math.random() * variants.length);
    if (variants.length > 1 && variants[i] === lastVariant.get(eventType)) i = (i + 1) % variants.length;
    lastVariant.set(eventType, variants[i]);
    return buffers.get(variants[i]);
  }

  function playAt(eventType, when, { rate = 1, volume = 1 } = {}) {
    if (!ctx || !enabled || !unlocked) return null;
    const buffer = pickBuffer(eventType);
    if (!buffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    let node = source;
    if (volume !== 1) {
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      node = gain;
    }
    node.connect(master);
    source.start(Math.max(when, ctx.currentTime));
    return { stop: () => { try { source.stop(); } catch { /* déjà fini */ } } };
  }

  function play(eventType, options) {
    return playAt(eventType, ctx?.currentTime ?? 0, options);
  }

  /** Horloge en secondes : celle de la carte son quand elle tourne, sinon celle de la page. */
  function now() {
    return ctx && ctx.state === 'running' ? ctx.currentTime : performance.now() / 1000;
  }

  function latency() {
    if (!ctx || ctx.state !== 'running') return 0;
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }

  /** Attend (au plus une demi-seconde) que le son soit débloqué et les fichiers décodés. */
  async function ready() {
    if (!ctx) return;
    const timeout = new Promise((resolve) => setTimeout(resolve, 500));
    await Promise.race([Promise.all([loading, ctx.resume().catch(() => {})]), timeout]);
  }

  /** Change la musique selon l'ambiance : normal, cannabis, baisse, echec. */
  function setMood(mood) {
    if (mood === currentMood) return;
    currentMood = mood;
    const file = sounds.music?.[mood] ?? sounds.music?.normal;
    if (!file) {
      music.pause();
      music.removeAttribute('src');
      return;
    }
    music.src = BASE + file;
    if (enabled && unlocked) music.play().catch(() => {});
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    ctx?.resume().catch(() => {});
    if (enabled && music.src) music.play().catch(() => {});
  }

  function setEnabled(value) {
    enabled = value;
    if (master) master.gain.value = enabled ? 1 : 0;
    if (!enabled) music.pause();
    else if (unlocked && music.src) music.play().catch(() => {});
  }

  return {
    play, playAt, now, latency, ready, setMood, unlock, setEnabled,
    get enabled() { return enabled; },
    get running() { return Boolean(ctx) && ctx.state === 'running'; },
  };
}
