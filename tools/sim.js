'use strict';
/* =========================================================================
   DUNGEONMESS · Simulador de equilibrio
   Juega partidas con el piloto automático, compra mejoras del árbol con una
   política sencilla (la más barata disponible) y mide hasta dónde se llega.
   Se usa desde tools/simulador.html o desde Node.
   ========================================================================= */
(function (G) {
  G.simulateRun = function (meta, opts) {
    opts = opts || {};
    const s = G.newRun(meta, { sim: true, autopilot: true, seed: opts.seed, startFloor: opts.startFloor || 1 });
    const dt = opts.dt || 1 / 30, maxTime = opts.maxTime || 5400;
    const floors = [];
    let last = s.floor, t0 = 0, g0 = 0, stuck = false;
    while (!s.over && s.time < maxTime) {
      G.step(s, dt);
      if (s.floor !== last) {
        floors.push({ floor: last, time: +(s.time - t0).toFixed(1), lvl: s.player.lvl, gold: Math.round(s.goldEarned - g0), real: +((s.goldEarned - g0) / G.econ(last)).toFixed(1) });
        last = s.floor; t0 = s.time; g0 = s.goldEarned;
      }
      if (s.floorTime > 420) { stuck = true; break; }
    }
    const timedOut = !s.over;
    if (!s.over) G.abandon(s);
    const hands = s.player.hands;
    const bought = {};
    for (const c of s.purchases) bought[c] = (bought[c] || 0) + 1;
    return {
      floor: s.floor, startFloor: s.startFloor, time: Math.round(s.time), kills: s.kills, souls: Math.floor(s.souls),
      lvl: s.player.lvl, stuck, timedOut, floors, gold: Math.floor(s.goldEarned), bought, shops: s.shopVisits,
      comps: s.companions.map(c => c.type + c.lvl), relics: Object.keys(s.player.relics), compDamage: Math.round(s.compDamage), goldSrc: s.goldSrc, compShare: s.dmgTotal ? Math.round(100 * s.compDamage / s.dmgTotal) : 0,
      weapons: [hands.L && hands.L.name, hands.R && hands.R !== hands.L ? hands.R.name : null].filter(Boolean),
      killedBy: s.killedBy || null,
    };
  };

  G.buyGreedy = function (meta, exclude) {
    const bought = [];
    for (;;) {
      let best = null, bc = Infinity;
      for (const n of G.SKILLS) {
        if (n.id === 'root' || (exclude && exclude.includes(n.id))) continue;
        if (G.skillState(meta, n) !== 'available') continue;
        const c = G.skillCost(n, G.lvl(meta, n.id));
        if (c <= meta.souls && c < bc) { bc = c; best = n; }
      }
      if (!best) break;
      G.buySkill(meta, best.id);
      bought.push(best.id);
    }
    return bought;
  };

  G.simulateCampaign = function (opts) {
    opts = opts || {};
    const meta = G.emptyMeta();
    const runs = [];
    const n = opts.runs || 30;
    for (let i = 0; i < n; i++) {
      const optsF = G.startFloorOptions(meta);
      const startFloor = optsF[optsF.length - 1];
      const r = G.simulateRun(meta, { seed: (opts.seed || 1000) + i * 7919, startFloor, dt: opts.dt, maxTime: opts.maxTime });
      r.run = i + 1;
      r.boughtTree = G.buyGreedy(meta, ["f7"]).length;
      r.bank = meta.souls;
      r.best = meta.bestFloor;
      runs.push(r);
      if (opts.onRun) opts.onRun(r);
    }
    return { runs, meta };
  };
})(window.G);
