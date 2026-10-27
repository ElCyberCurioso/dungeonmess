'use strict';
/* =========================================================================
   DUNGEONMESS · Efectos de sonido sintetizados con Web Audio (sin archivos)
   ========================================================================= */
(function (G) {
  let ac = null, master = null, noiseBuf = null, enabled = true;
  const last = {};

  function ensure() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.22; master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return !!ac;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, q, delay) {
    const t = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
  }
  const LIB = {
    swing: () => noise(0.09, 0.18, 1600, 0.8),
    heavy: () => noise(0.16, 0.25, 700, 0.7),
    shoot: () => { noise(0.05, 0.12, 2600, 2); tone(520, 0.06, 'triangle', 0.05, -200); },
    magic: () => tone(660, 0.18, 'sine', 0.08, 440),
    hit: () => tone(170, 0.07, 'square', 0.07, -60),
    crit: () => { tone(420, 0.09, 'square', 0.08, 300); noise(0.06, 0.12, 3000, 1.5); },
    hurt: () => { tone(140, 0.2, 'sawtooth', 0.12, -70); noise(0.12, 0.14, 500, 0.8); },
    kill: () => noise(0.14, 0.14, 900, 0.6),
    block: () => tone(980, 0.05, 'square', 0.06, -300),
    pickup: () => { tone(520, 0.07, 'triangle', 0.1); tone(780, 0.1, 'triangle', 0.09, 0, 0.06); },
    potion: () => { tone(400, 0.12, 'sine', 0.1, 300); tone(700, 0.12, 'sine', 0.06, 200, 0.08); },
    level: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.08, 0, i * 0.07)); },
    stairs: () => { noise(0.5, 0.12, 300, 0.5); tone(220, 0.5, 'sine', 0.08, -110); },
    boss: () => { tone(70, 1.2, 'sawtooth', 0.09, -20); tone(105, 1.2, 'sawtooth', 0.05, -30); },
    slam: () => { noise(0.35, 0.3, 160, 0.6); tone(60, 0.35, 'sine', 0.2, -25); },
    bossdown: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, 0, i * 0.1)); },
    death: () => { tone(330, 0.9, 'sawtooth', 0.09, -260); noise(0.8, 0.12, 400, 0.4); },
    dash: () => noise(0.12, 0.1, 1200, 0.6),
    buy: () => { tone(660, 0.08, 'triangle', 0.09); tone(990, 0.14, 'triangle', 0.07, 0, 0.07); },
    click: () => tone(700, 0.04, 'triangle', 0.05),
    eshoot: () => tone(300, 0.08, 'triangle', 0.04, -100),
    coin: () => { tone(1320 + Math.random() * 180, 0.06, 'square', 0.025); tone(1980, 0.08, 'triangle', 0.03, 0, 0.04); },
    chest: () => { noise(0.18, 0.12, 500, 0.7); [660, 880, 1100].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, 0, 0.08 + i * 0.06)); },
    melt: () => { noise(0.3, 0.1, 2400, 0.5); tone(240, 0.3, 'sawtooth', 0.04, 300); },
    reroll: () => { noise(0.25, 0.1, 900, 0.5); tone(520, 0.12, 'triangle', 0.06, 200, 0.1); },
    fairy: () => { tone(1568, 0.1, 'sine', 0.04); tone(2093, 0.14, 'sine', 0.035, 0, 0.07); },
    deny: () => tone(150, 0.12, 'square', 0.05, -30),
  };
  G.Audio = {
    unlock: () => { if (enabled) ensure(); },
    setEnabled(v) { enabled = !!v; if (enabled && ac) ensure(); },
    play(name, minGap) {
      if (!enabled || !LIB[name]) return;
      const now = performance.now();
      if (last[name] && now - last[name] < (minGap || 45)) return;
      last[name] = now;
      if (!ensure()) return;
      try { LIB[name](); } catch (e) { /* audio no disponible */ }
    },
  };
})(window.G);
