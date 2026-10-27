'use strict';
/* =========================================================================
   DUNGEONMESS · Motor de juego
   Sin dependencias del DOM: se puede ejecutar en el navegador o en el
   simulador (tools/simulador.html) para equilibrar la dificultad.
   ========================================================================= */
(function (G) {
  const TAU = Math.PI * 2;
  const clamp = G.clamp, angDiff = G.angDiff;

  /* =================== Progresión persistente =================== */
  G.emptyMeta = () => ({
    v: 1, souls: 0, totalSouls: 0, bestFloor: 0, runs: 0, kills: 0, skills: {},
    settings: { sound: true, auto: true, autoBoons: true, startFloor: 1 },
  });
  G.loadMeta = function () {
    try {
      let raw = localStorage.getItem(G.SAVE_KEY);
      if (!raw) {
        // Migración desde el nombre anterior del juego
        for (const k of G.OLD_SAVE_KEYS || []) {
          const old = localStorage.getItem(k);
          if (old) { raw = old; localStorage.setItem(G.SAVE_KEY, old); break; }
        }
      }
      if (!raw) return G.emptyMeta();
      const base = G.emptyMeta(), data = JSON.parse(raw);
      const m = Object.assign(base, data);
      m.settings = Object.assign(G.emptyMeta().settings, data.settings || {});
      m.skills = data.skills || {};
      return m;
    } catch (e) { return G.emptyMeta(); }
  };
  G.saveMeta = function (meta) { try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(meta)); } catch (e) { /* almacenamiento no disponible */ } };

  G.lvl = (meta, id) => meta.skills[id] || 0;
  G.skillCost = (node, l) => Math.round(node.cost[0] * Math.pow(node.cost[1], l));
  G.skillState = function (meta, node) {
    if (node.id === 'root') return 'owned';
    if (G.lvl(meta, node.id) >= node.max) return 'maxed';
    const [rid, rl] = node.req;
    if (rid !== 'root' && G.lvl(meta, rid) < rl) return 'locked';
    return 'available';
  };
  G.buySkill = function (meta, id) {
    const node = G.SKILL_MAP[id];
    if (!node || G.skillState(meta, node) !== 'available') return false;
    const c = G.skillCost(node, G.lvl(meta, id));
    if (meta.souls < c) return false;
    meta.souls -= c;
    meta.skills[id] = G.lvl(meta, id) + 1;
    return true;
  };
  G.refundAll = function (meta) {
    let total = 0;
    for (const n of G.SKILLS) { const l = G.lvl(meta, n.id); for (let i = 0; i < l; i++) total += G.skillCost(n, i); }
    meta.souls += total; meta.skills = {};
    return total;
  };
  G.maxStartFloor = function (meta) {
    const l = G.lvl(meta, 'f5');
    if (!l) return 1;
    return Math.max(1, Math.min(1 + 3 * l, meta.bestFloor));
  };
  G.startFloorOptions = function (meta) {
    const max = G.maxStartFloor(meta), out = [];
    for (let f = 1; f <= max; f += 3) out.push(f);
    return out;
  };

  G.xpFor = l => Math.round(10 * Math.pow(1.22, l - 1) + 6 * l);
  G.threat = f => Math.pow(G.BAL.enemyHp, f - 1);

  /* =================== Armas =================== */
  G.WEAPON_IDS = Object.keys(G.WEAPONS);
  G.randomWeaponId = function (rng, filter) {
    const ids = G.WEAPON_IDS.filter(id => !filter || filter(G.WEAPONS[id]));
    let tot = 0; for (const id of ids) tot += G.WEAPONS[id].weight || 1;
    let t = rng() * tot;
    for (const id of ids) { t -= G.WEAPONS[id].weight || 1; if (t <= 0) return id; }
    return ids[ids.length - 1];
  };
  G.rollRarity = function (s, bonus) {
    const lv = (s.stats ? s.stats.rarity : 0) + (bonus || 0), f = s.floor;
    const w = G.RARITIES.map(r => r.weight);
    w[1] *= 1 + 0.15 * lv + 0.02 * f;
    w[2] *= 1 + 0.30 * lv + 0.04 * f;
    w[3] *= 1 + 0.45 * lv + 0.05 * f;
    let t = w.reduce((a, b) => a + b, 0) * s.rng();
    for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; }
    return 0;
  };
  G.weaponName = function (w) {
    const b = G.WEAPONS[w.base];
    if (!b) return w.name;
    const adj = w.affixes.map(id => G.AFFIX_MAP[id].forms[b.g]);
    if (!adj.length) return b.name;
    if (adj.length === 1) return b.name + ' ' + adj[0];
    const last = adj[adj.length - 1];
    const y = /^h?[iíIÍ]/.test(last) ? ' e ' : ' y ';
    return b.name + ' ' + adj.slice(0, -1).join(', ') + y + last;
  };
  G.makeWeapon = function (s, baseId, ilvl, rar) {
    const b = G.WEAPONS[baseId], R = G.RARITIES[rar];
    const w = Object.assign({}, b);
    w.uid = s.uid++; w.base = baseId; w.rarity = rar; w.ilvl = ilvl; w.affixes = [];
    if (b.kind === 'shield') { w.block = Math.min(0.5, b.block + 0.05 * rar); w.armor = b.armor + 6 * rar; }
    else w.dmg = b.dmg * R.mult * Math.pow(G.BAL.weaponGrowth, ilvl - 1) * s.rng.range(0.92, 1.08);
    const pool = G.AFFIXES.filter(a => a.kinds.includes(b.kind));
    for (let i = 0; i < R.affixes && pool.length; i++) {
      const a = pool.splice(Math.floor(s.rng() * pool.length), 1)[0];
      a.apply(w); w.affixes.push(a.id);
    }
    w.name = G.weaponName(w);
    return w;
  };
  function randomWeapon(s, ilvl, rarityBonus) {
    return G.makeWeapon(s, G.randomWeaponId(s.rng), ilvl, G.rollRarity(s, rarityBonus));
  }

  /* Rasgos legibles de un arma, para la ficha de recogida. */
  G.weaponTraits = function (w) {
    const t = [];
    if (w.kind === 'shield') {
      t.push(`Bloquea el ${Math.round(w.block * 100)}% de los golpes (reduce su daño un 75%)`);
      t.push(`+${w.armor} de armadura`);
    }
    if (w.shots > 1) t.push(`${w.shots} proyectiles por disparo`);
    if (w.pierce) t.push(`Atraviesa ${w.pierce} ${w.pierce === 1 ? 'enemigo' : 'enemigos'}`);
    if (w.homing) t.push('Proyectil teledirigido');
    if (w.aoe) t.push('Explota en área');
    if (w.stun) t.push(`${Math.round(w.stun * 100)}% de aturdir`);
    if (w.crit) t.push(`+${Math.round(w.crit * 100)}% de crítico`);
    if (w.base === 'lanza') t.push('Estocada de largo alcance');
    for (const id of w.affixes) t.push(G.AFFIX_MAP[id].desc);
    return [...new Set(t)];
  };

  /* =================== Estadísticas =================== */
  function shieldOf(p) {
    const L = p.hands.L, R = p.hands.R;
    let best = null;
    for (const w of [L, R]) if (w && w.kind === 'shield' && (!best || w.block > best.block)) best = w;
    return best;
  }
  function isDual(p) {
    const L = p.hands.L, R = p.hands.R;
    return !!(L && R && L !== R && L.kind !== 'shield' && R.kind !== 'shield');
  }
  function computeStats(s) {
    const meta = s.meta, p = s.player, b = p.boons, old = s.stats;
    const L = id => G.lvl(meta, id), B = id => b[id] || 0, RL = id => (p.relics[id] ? 1 : 0);
    const st = {
      maxHp: 100 * (1 + 0.08 * L('v1')) * (1 + 0.15 * B('robustez')),
      armor: 3 * L('v2') + 8 * B('piel'),
      regen: 0.002 * L('v4') + 0.005 * B('regen'),
      move: 3.7 * (1 + 0.03 * L('v3') + 0.07 * B('pies') + 0.12 * RL('alas')),
      dmg: 1 + 0.10 * B('fuerza'),
      melee: 1 + 0.06 * L('a1'),
      ranged: 1 + 0.06 * L('p1'),
      twoHand: (1 + 0.08 * L('a4')) * (1 + 0.30 * RL('gigante')),
      twoHandRange: 1 + 0.15 * RL('gigante'),
      dual: (0.85 + 0.05 * L('d1')) * (1 + 0.25 * RL('gemelos')),
      atkSpd: 1 + 0.04 * L('d2') + 0.08 * B('celeridad') + 0.15 * RL('reloj'),
      crit: 0.05 + 0.03 * L('p3') + 0.06 * B('ojo') + 0.08 * RL('trebol'),
      dualCrit: 0.03 * L('d3'),
      critMult: 1.6 + 0.10 * L('p6') + 0.25 * B('mortal'),
      lifesteal: 0.02 * B('sanguijuela') + 0.03 * RL('colmillo'),
      meleeLeech: 0.01 * L('a3'),
      meleeRange: 1 + 0.06 * L('a2') + 0.12 * B('filo'),
      pspeed: 1 + 0.10 * L('p2'),
      prange: 1 + 0.05 * L('p2'),
      pierce: L('p4') + B('puntas'),
      extraShot: 0.06 * L('p5'),
      whirl: 0.04 * L('a5'),
      stun: 0.05 * L('a6'),
      tempest: 0.04 * L('d4'),
      dodge: 0.02 * L('v5'),
      dashCd: 2.4 * (1 - 0.08 * L('v5')) * (1 - 0.4 * RL('alas')),
      souls: 1 + 0.10 * L('f1'),
      rarity: L('f2') + 2 * RL('trebol'),
      xp: 1 + 0.10 * L('f3'),
      drops: 1 + 0.15 * L('f4'),
      // Economía, mercado y compañeros
      gold: 1 + 0.10 * L('c3') + 0.30 * RL('bolsa'),
      discount: 0.05 * L('c2'),
      potionCap: 2 + L('c4'),
      compPow: 1 + 0.15 * L('c5'),
      compSlots: 1 + L('c6'),
      visR: G.BAL.visRadius + 3 * RL('cuervo'),
      killHeal: 0.02 * RL('caliz'),
      blast: RL('brasas'),
      spikes: RL('espinas'),
      chill: 0.25 * RL('escarcha'),
    };
    const sh = shieldOf(p);
    st.block = sh ? sh.block : 0;
    st.thorns = sh ? (sh.thorns || 0) : 0;
    if (sh) st.armor += sh.armor;
    st.dualActive = isDual(p);
    s.stats = st;
    if (old && old.maxHp !== st.maxHp) p.hp = Math.min(st.maxHp, p.hp * st.maxHp / old.maxHp);
  }
  G.computeStats = computeStats;

  function attackSlots(p) {
    const L = p.hands.L, R = p.hands.R, out = [];
    if (L && L === R) { out.push(['B', L]); return out; }
    if (L && L.kind !== 'shield') out.push(['L', L]);
    if (R && R.kind !== 'shield') out.push(['R', R]);
    if (!out.length) out.push([R && R.kind === 'shield' && !L ? 'L' : 'R', G.FISTS]);
    return out;
  }
  G.attackSlots = attackSlots;
  function effRange(s, w) {
    const st = s.stats, two = w.hands === 2 ? st.twoHandRange : 1;
    return w.range * two * (w.kind === 'melee' ? st.meleeRange : st.prange);
  }
  G.effRange = effRange;

  /* Daño por segundo estimado de un arma con las estadísticas actuales. */
  G.weaponDps = function (s, w, dual) {
    if (!w || w.kind === 'shield') return 0;
    const st = s.stats;
    let d = w.dmg * (w.kind === 'melee' ? st.melee : st.ranged) * (w.hands === 2 ? st.twoHand : 1) * (dual ? st.dual : 1);
    const shots = (w.shots || 1) + (w.kind === 'ranged' ? st.extraShot : 0);
    const crit = Math.min(1, st.crit + (w.crit || 0) + (dual ? st.dualCrit : 0));
    d *= 1 + crit * (st.critMult - 1);
    if (w.aoe) d *= 1.35;
    if (w.pierce) d *= 1 + 0.15 * w.pierce;
    if (w.burn) d *= 1 + w.burn;
    return d * shots * st.dmg * st.atkSpd / w.cd;
  };
  G.loadoutDps = function (s, hands) {
    const L = hands.L, R = hands.R;
    if (L && L === R) return G.weaponDps(s, L, false);
    const dual = !!(L && R && L.kind !== 'shield' && R.kind !== 'shield');
    let d = 0;
    if (L) d += G.weaponDps(s, L, dual);
    if (R) d += G.weaponDps(s, R, dual);
    return d || G.weaponDps(s, G.FISTS, false);
  };
  G.loadoutScore = function (s, hands) {
    const dps = G.loadoutDps(s, hands);
    let sh = null;
    for (const w of [hands.L, hands.R]) if (w && w.kind === 'shield' && (!sh || w.block > sh.block)) sh = w;
    return dps * (sh ? 1 + sh.block * 1.2 + sh.armor / 100 : 1);
  };
  /* Opciones para equipar un arma del suelo y cómo quedaría el daño por segundo. */
  G.equipOptions = function (s, w) {
    const cur = s.player.hands, is2 = !!(cur.L && cur.L === cur.R), opts = [];
    if (w.hands === 2) opts.push({ slot: 'B', hands: { L: w, R: w }, drops: is2 ? [cur.L] : [cur.L, cur.R].filter(Boolean) });
    else {
      opts.push({ slot: 'L', hands: { L: w, R: is2 ? null : cur.R }, drops: is2 ? [cur.L] : [cur.L].filter(Boolean) });
      opts.push({ slot: 'R', hands: { L: is2 ? null : cur.L, R: w }, drops: is2 ? [cur.R] : [cur.R].filter(Boolean) });
    }
    for (const o of opts) { o.dps = G.loadoutDps(s, o.hands); o.score = G.loadoutScore(s, o.hands); }
    return opts;
  };
  G.bestSlotFor = function (s, w) {
    let bs = G.loadoutScore(s, s.player.hands) * 1.05, best = null;
    for (const o of G.equipOptions(s, w)) if (o.score > bs) { bs = o.score; best = o.slot; }
    return best;
  };

  /* =================== Partida =================== */
  G.newRun = function (meta, opts) {
    opts = opts || {};
    const seed = opts.seed != null ? opts.seed : (Math.random() * 2147483647) | 0;
    const s = {
      meta, sim: !!opts.sim, attract: !!opts.attract, rng: G.makeRng(seed), uid: 1,
      t: 0, time: 0, floorTime: 0, floor: 1, startFloor: Math.max(1, opts.startFloor || 1), maxFloor: 0,
      kills: 0, souls: 0, enemies: [], proj: [], eproj: [], items: [], fx: [], parts: [], texts: [], events: [],
      pendingLevels: 0, choices: null, over: false, paused: false, shake: 0,
      autopilot: !!opts.autopilot, input: { mx: 0, my: 0, dash: false },
      near: null, onStairs: false, boss: null, stairsLocked: false, stats: null,
      gold: 0, goldEarned: 0, goldPop: 0, goldPopT: 0, companions: [], shop: false, shopVisits: 0,
      rerolls: 0, tomesBought: 0, purchases: [], compDamage: 0, goldSrc: {},
    };
    const p = s.player = {
      x: 0, y: 0, r: 0.3, hp: 1, lvl: 1, xp: 0, xpNext: G.xpFor(1), boons: {},
      hands: { L: null, R: null }, cd: { L: 0, R: 0.25, B: 0 }, anim: { L: 0, R: 0, B: 0 }, aim: { L: 0, R: 0, B: 0 },
      facing: 0, atkT: 0, dashT: 0, dashCd: 0, ddx: 1, ddy: 0, dx: 1, dy: 0, iframes: 0, hurtT: 0,
      revives: [], moving: false, walkT: 0, potions: 0, relics: {},
    };
    const v6 = G.lvl(meta, 'v6');
    if (v6) p.revives.push(v6 === 1 ? 0.3 : 0.5);
    s.floor = s.startFloor;
    computeStats(s);
    p.hands.R = G.makeWeapon(s, 'espada', s.startFloor, 0);
    let extraDrop = null;
    const ars = G.lvl(meta, 'f6');
    if (ars) {
      const w = G.makeWeapon(s, G.randomWeaponId(s.rng, b => b.kind !== 'shield'), s.startFloor, Math.min(3, ars));
      if (w.hands === 2) { extraDrop = p.hands.R; p.hands.L = p.hands.R = w; } else p.hands.L = w;
    }
    if (s.startFloor > 1) s.pendingLevels = s.startFloor - 1;
    computeStats(s);
    p.hp = s.stats.maxHp;
    p.potions = Math.min(s.stats.potionCap, 1 + G.lvl(meta, 'c4'));
    s.gold = Math.round(40 * G.lvl(meta, 'c1') * G.econ(s.startFloor));
    if (s.startFloor > 1) {
      // Atajo: la partida empieza en el mercado anterior al piso elegido, con oro para equiparse
      s.floor = s.startFloor - 1;
      s.gold += Math.round(G.BAL.shortcutGold * (s.startFloor - 1) * G.econ(s.startFloor - 1));
      enterShop(s);
    } else enterFloor(s, s.startFloor);
    if (extraDrop) dropWeapon(s, extraDrop);
    return s;
  };

  /* Deja el estado listo para un mapa nuevo (piso normal o mercado). */
  function resetLevel(s, m) {
    s.map = m; s.floorTime = 0;
    s.flow = new Int16Array(m.w * m.h).fill(-1);
    s.flowT = 0; s.flowTile = -1; s.visT = 0; s.visTile = -1;
    s.enemies.length = 0; s.proj.length = 0; s.eproj.length = 0; s.items.length = 0;
    s.fx.length = 0; s.parts.length = 0; s.texts.length = 0;
    s.boss = null; s.stairsLocked = false; s.near = null; s.onStairs = false; s.ap = null;
    const p = s.player;
    p.x = m.start.x + 0.5; p.y = m.start.y + 0.5; p.dashT = 0; p.iframes = 1;
    placeCompanions(s);
  }

  function enterFloor(s, floor) {
    s.floor = floor; s.maxFloor = Math.max(s.maxFloor, floor); s.shop = false;
    const m = G.genFloor(floor, (s.rng() * 2147483647) | 0);
    resetLevel(s, m);
    const p = s.player, rng = s.rng;
    const isBoss = floor % 5 === 0;

    const types = Object.keys(G.ENEMIES).filter(k => G.ENEMIES[k].w && G.ENEMIES[k].min <= floor);
    const eliteP = Math.min(G.BAL.eliteMax, G.BAL.eliteBase + G.BAL.eliteFloor * (floor - 1));
    for (const room of m.rooms) {
      if (room === m.startRoom || (isBoss && room === m.stairsRoom)) continue;
      if (rng() < 0.12) continue;
      const n = Math.min(7, rng.int(1, 2 + Math.floor(floor * 0.2)));
      for (let i = 0; i < n; i++) {
        const t = pickWeighted(rng, types, k => G.ENEMIES[k].w);
        const pos = randomTileIn(s, room);
        if (pos) spawnEnemy(s, t, pos.x, pos.y, rng() < eliteP);
      }
    }
    if (isBoss) spawnBoss(s);

    const nW = 1 + (rng() < 0.6 ? 1 : 0) + (rng() < 0.25 ? 1 : 0);
    for (let i = 0; i < nW; i++) {
      const pos = randomTileIn(s, rng.pick(m.rooms));
      if (pos) addItem(s, { kind: 'weapon', w: randomWeapon(s, floor) }, pos.x, pos.y);
    }
    if (floor === 1 && s.startFloor === 1 && !s.attract) {
      // Tutorial: una honda junto al inicio para descubrir las dos manos
      const tx = Math.floor(p.x + 1.7), ty = Math.floor(p.y);
      const pos = G.walk(m, tx, ty) ? { x: tx + 0.5, y: ty + 0.5 } : randomTileIn(s, m.startRoom);
      if (pos) addItem(s, { kind: 'weapon', w: G.makeWeapon(s, 'honda', 1, 0) }, pos.x, pos.y);
    }
    const nP = rng.int(1, 2);
    for (let i = 0; i < nP; i++) {
      const pos = randomTileIn(s, rng.pick(m.rooms));
      if (pos) addItem(s, { kind: 'potion' }, pos.x, pos.y);
    }
    // Cofres con oro
    const nC = (rng() < G.BAL.chestChance ? 1 : 0) + (rng() < 0.15 ? 1 : 0);
    const chestRooms = m.rooms.filter(r => r !== m.startRoom);
    for (let i = 0; i < nC && chestRooms.length; i++) {
      const pos = randomTileIn(s, rng.pick(chestRooms));
      if (pos) addItem(s, { kind: 'chest', open: false }, pos.x, pos.y);
    }
    if (s.stats.visR > G.BAL.visRadius) {
      // Ojo del cuervo: las escaleras aparecen en el mapa desde el principio
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = m.stairs.x + dx, y = m.stairs.y + dy;
        if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.seen[y * m.w + x] = 1;
      }
    }
    G.computeVis(m, p.x, p.y, s.stats.visR);
    s.events.push({ type: 'floor', floor });
  }

  /* =================== Mercado =================== */
  function enterShop(s) {
    s.shop = true; s.rerolls = 0; s.shopVisits++;
    const m = G.genShop();
    resetLevel(s, m);
    addItem(s, { kind: 'merchant' }, m.merchant.x, m.merchant.y);
    for (const [cat, x, y] of m.slots) addItem(s, stockItem(s, cat, { kind: 'shop' }), x, y);
    s.events.push({ type: 'shop', floor: s.floor });
  }
  function ownComp(s, type) { return s.companions.find(c => c.type === type) || null; }
  G.ownComp = ownComp;
  function stockItem(s, cat, it) {
    const rng = s.rng, p = s.player, prev = it.relic;
    it.cat = cat; it.sold = false; it.empty = false;
    delete it.w; delete it.relic; delete it.boon; delete it.comp;
    if (cat === 'weapon') it.w = G.makeWeapon(s, G.randomWeaponId(rng), s.floor, Math.max(1, G.rollRarity(s, 2)));
    else if (cat === 'relic') {
      const shown = s.items.filter(o => o.kind === 'shop' && o.cat === 'relic' && !o.sold && o !== it).map(o => o.relic);
      let pool = G.RELICS.filter(r => !p.relics[r.id] && !shown.includes(r.id));
      if (pool.length > 1 && prev) pool = pool.filter(r => r.id !== prev);
      if (pool.length) it.relic = rng.pick(pool).id; else { it.sold = true; it.empty = true; }
    } else if (cat === 'tome') {
      const pool = G.BOONS.filter(b => (p.boons[b.id] || 0) < b.max);
      if (pool.length) it.boon = rng.pick(pool).id; else { it.sold = true; it.empty = true; }
    } else if (cat === 'companion') {
      const owned = s.companions.filter(c => c.lvl < G.COMPANION_MAX_LVL).map(c => c.type);
      it.comp = owned.length && rng() < 0.5 ? rng.pick(owned) : rng.pick(G.COMPANION_IDS);
    } else if (cat === 'potion') it.stock = G.SHOP.potionStock;
    else if (cat === 'heal') it.stock = 1;
    return it;
  }
  /* Oro por enemigo: crece con la economía pero se reparte entre más enemigos en pisos hondos. */
  G.goldDensity = f => 1 / (1 + 0.15 * (f - 1));
  G.goldPerEnemy = f => G.econ(f) * G.goldDensity(f);
  G.weaponValue = w => G.SHOP.weaponBase * G.SHOP.rarityPrice[w.rarity] * G.econ(w.ilvl);
  /* Fundir: poco oro y casi plano por rareza, para que no sea la fuente principal. */
  G.meltValue = (s, w) => Math.max(1, Math.round(G.SHOP.weaponBase * G.SHOP.meltRarity[w.rarity] * G.econ(w.ilvl) * G.goldDensity(w.ilvl) * s.stats.gold));
  G.shopPrice = function (s, it) {
    const e = G.econ(s.floor);
    let base = 0;
    switch (it.cat) {
      case 'weapon': base = G.weaponValue(it.w); break;
      case 'relic': base = G.RELIC_MAP[it.relic].price * e * (1 + 0.3 * Object.keys(s.player.relics).length); break;
      case 'tome': base = G.SHOP.tome * e * (1 + 0.3 * s.tomesBought); break;
      case 'companion': {
        const own = ownComp(s, it.comp);
        base = G.COMPANIONS[it.comp].price * e * (own ? 0.7 * Math.pow(1.5, own.lvl - 1) : 1);
        break;
      }
      case 'potion': base = G.SHOP.potion * e; break;
      case 'heal': base = G.SHOP.heal * e; break;
      case 'reroll': base = G.SHOP.reroll * e * (1 + 0.5 * s.rerolls); break;
    }
    return Math.max(1, Math.round(base * (1 - s.stats.discount)));
  };
  G.rerollPrice = s => G.shopPrice(s, { cat: 'reroll' });
  /* Devuelve null si se puede comprar o el motivo por el que no. */
  G.shopCheck = function (s, it) {
    const p = s.player, st = s.stats;
    if (it.sold) return 'Agotado';
    if (it.cat === 'potion' && p.potions >= st.potionCap) return 'Cinturón lleno';
    if (it.cat === 'heal' && p.hp >= st.maxHp) return 'Ya tienes toda la vida';
    if (it.cat === 'companion') { const own = ownComp(s, it.comp); if (own && own.lvl >= G.COMPANION_MAX_LVL) return 'Nivel máximo'; }
    const price = G.shopPrice(s, it);
    if (s.gold < price) return `Te faltan ${G.fmt(price - s.gold)} de oro`;
    return null;
  };
  /* Compañero que se iría si compras uno nuevo con todos los huecos ocupados. */
  G.compReplaced = (s, type) => (ownComp(s, type) || s.companions.length < s.stats.compSlots ? null : s.companions[0]);
  G.buy = function (s, itemId, slot) {
    const it = s.items.find(i => i.id === itemId && i.kind === 'shop');
    if (!it || s.over || G.shopCheck(s, it)) return false;
    const p = s.player, price = G.shopPrice(s, it);
    s.gold -= price;
    switch (it.cat) {
      case 'weapon': equipWeapon(s, it.w, slot); it.sold = true; break;
      case 'relic': p.relics[it.relic] = true; it.sold = true; computeStats(s); break;
      case 'tome':
        p.boons[it.boon] = (p.boons[it.boon] || 0) + 1;
        if (it.boon === 'fenix') p.revives.push(0.4);
        s.tomesBought++; it.sold = true; computeStats(s);
        if (it.boon === 'robustez') p.hp = Math.min(s.stats.maxHp, p.hp + s.stats.maxHp * 0.3);
        break;
      case 'companion': addCompanion(s, it.comp); it.sold = true; break;
      case 'potion': p.potions++; if (--it.stock <= 0) it.sold = true; break;
      case 'heal': p.hp = s.stats.maxHp; if (--it.stock <= 0) it.sold = true; break;
    }
    s.purchases.push(it.cat);
    s.events.push({ type: 'buy', cat: it.cat });
    return true;
  };
  G.reroll = function (s) {
    if (!s.shop || s.over) return false;
    const price = G.rerollPrice(s);
    if (s.gold < price) return false;
    s.gold -= price; s.rerolls++;
    for (const it of s.items) if (it.kind === 'shop' && !it.sold && ['weapon', 'relic', 'tome', 'companion'].includes(it.cat)) stockItem(s, it.cat, it);
    s.events.push({ type: 'reroll' });
    return true;
  };

  /* =================== Oro, cofres y pociones =================== */
  function spawnCoins(s, x, y, total, n) {
    total = Math.max(1, Math.round(total));
    n = Math.max(1, Math.min(n || 1, total));
    const per = Math.floor(total / n);
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? total - per * (n - 1) : per;
      const a = s.rng() * TAU, sp = n > 1 ? s.rng.range(1.6, 3.8) : 0.5;
      addItem(s, { kind: 'gold', v, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0 }, x, y);
    }
  }
  function gainGold(s, v, x, y, src) {
    s.gold += v; s.goldEarned += v;
    s.goldSrc[src || 'coin'] = (s.goldSrc[src || 'coin'] || 0) + v;
    if (x != null) addText(s, x, y - 0.3, '+' + G.fmt(v), 'gold');
    else s.goldPop += v;
  }
  function openChest(s, it) {
    it.open = true;
    const rng = s.rng, f = s.floor;
    spawnCoins(s, it.x, it.y, 15 * G.econ(f) * s.stats.gold * rng.range(0.85, 1.25), 5);
    if (rng() < 0.3) addItem(s, { kind: 'potion' }, it.x + 0.35, it.y + 0.3);
    if (rng() < 0.15) addItem(s, { kind: 'weapon', w: randomWeapon(s, f, 1) }, it.x - 0.35, it.y + 0.3);
    s.events.push({ type: 'chest' });
  }
  G.melt = function (s, itemId) {
    const idx = s.items.findIndex(i => i.id === itemId && i.kind === 'weapon');
    if (idx < 0 || s.over) return false;
    const it = s.items[idx];
    s.items.splice(idx, 1);
    gainGold(s, G.meltValue(s, it.w), it.x, it.y, 'melt');
    if (!s.sim) for (let i = 0; i < 10; i++) { const a = Math.random() * TAU; particle(s, it.x, it.y, Math.cos(a) * 2.5, Math.sin(a) * 2.5 - 1, i % 2 ? '#f0c35a' : '#f08a3c', 0.45, 0.06); }
    if (s.near === it) s.near = null;
    s.events.push({ type: 'melt' });
    return true;
  };
  G.drinkPotion = function (s) {
    const p = s.player, st = s.stats;
    if (s.over || p.potions <= 0 || p.hp >= st.maxHp) return false;
    p.potions--;
    const heal = st.maxHp * G.BAL.potionHeal;
    p.hp = Math.min(st.maxHp, p.hp + heal);
    addText(s, p.x, p.y - 0.6, '+' + G.fmt(heal), 'heal');
    s.events.push({ type: 'potion' });
    return true;
  };

  function pickWeighted(rng, arr, wf) {
    let tot = 0; for (const a of arr) tot += wf(a);
    let t = rng() * tot;
    for (const a of arr) { t -= wf(a); if (t <= 0) return a; }
    return arr[arr.length - 1];
  }
  function randomTileIn(s, room) {
    const m = s.map, rng = s.rng;
    for (let i = 0; i < 24; i++) {
      const tx = rng.int(room.x, room.x + room.w - 1), ty = rng.int(room.y, room.y + room.h - 1);
      if (!G.walk(m, tx, ty)) continue;
      if (tx === m.stairs.x && ty === m.stairs.y) continue;
      if (Math.hypot(tx + 0.5 - s.player.x, ty + 0.5 - s.player.y) < 3) continue;
      return { x: tx + 0.5, y: ty + 0.5 };
    }
    return null;
  }
  function addItem(s, it, x, y) {
    if (G.solidAt(s.map, x, y)) { x = Math.floor(x) + 0.5; y = Math.floor(y) + 0.5; }
    it.id = s.uid++; it.x = x; it.y = y; it.t = s.rng() * 10;
    s.items.push(it);
    return it;
  }
  function freeSpotNear(s, x, y, dist) {
    const m = s.map, p = s.player;
    const base = Math.atan2(-p.dy, -p.dx);
    for (let i = 0; i < 12; i++) {
      const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6);
      const nx = x + Math.cos(a) * dist, ny = y + Math.sin(a) * dist;
      if (!G.solidAt(m, nx, ny) && !G.solidAt(m, nx + 0.25, ny) && !G.solidAt(m, nx - 0.25, ny) &&
          !G.solidAt(m, nx, ny + 0.25) && !G.solidAt(m, nx, ny - 0.25)) return { x: nx, y: ny };
    }
    return { x, y };
  }
  function dropWeapon(s, w) {
    const p = s.player, pos = freeSpotNear(s, p.x, p.y, 1.05);
    return addItem(s, { kind: 'weapon', w, dropped: true }, pos.x, pos.y);
  }

  function spawnEnemy(s, type, x, y, elite) {
    const d = G.ENEMIES[type], f = s.floor;
    const hpM = Math.pow(G.BAL.enemyHp, f - 1), dmgM = Math.pow(G.BAL.enemyDmg, f - 1);
    const e = {
      id: s.uid++, type, d, x, y, r: d.r * (elite ? 1.25 : 1),
      hp: d.hp * hpM * (elite ? 2.6 : 1), dmg: d.dmg * dmgM * (elite ? 1.35 : 1),
      spd: d.spd * (1 + Math.min(0.2, 0.008 * (f - 1))) * s.rng.range(0.92, 1.08),
      cd: s.rng.range(0.3, 1.0), wind: 0, aggro: false, losT: s.rng() * 0.2, hasLos: false,
      stun: 0, slow: 0, slowT: 0, burnDps: 0, burnT: 0, kbx: 0, kby: 0, vx: 0, vy: 0,
      elite, flash: 0, anim: s.rng() * 10, phase: s.rng() * TAU, face: s.rng() * TAU,
      strafe: s.rng() < 0.5 ? 1 : -1, lunge: 0,
      xp: d.xp * (1 + G.BAL.xpFloorGrowth * (f - 1)) * (elite ? 3 : 1),
      soul: d.xp * G.BAL.soulPerXp * (1 + G.BAL.soulFloorGrowth * (f - 1)) * (elite ? 3 : 1),
    };
    e.maxHp = e.hp;
    s.enemies.push(e);
    return e;
  }

  function spawnBoss(s) {
    const m = s.map, tier = Math.floor(s.floor / 5) - 1;
    const B = G.BOSSES[tier % G.BOSSES.length], cycle = Math.floor(tier / G.BOSSES.length);
    const hpM = Math.pow(G.BAL.enemyHp, s.floor - 1), dmgM = Math.pow(G.BAL.enemyDmg, s.floor - 1);
    let x = m.stairs.x + 0.5, y = m.stairs.y - 1.5;
    if (G.solidAt(m, x, y)) y = m.stairs.y + 0.5;
    const e = {
      id: s.uid++, type: 'boss', d: B, boss: B, x, y, r: B.r,
      hp: B.hp * hpM, dmg: B.dmg * dmgM, spd: B.spd,
      cd: 1, wind: 0, aggro: false, losT: 0, hasLos: false, stun: 0, slow: 0, slowT: 0,
      burnDps: 0, burnT: 0, kbx: 0, kby: 0, vx: 0, vy: 0, elite: false, flash: 0, anim: 0, phase: 0, face: Math.PI / 2,
      patT: 2.2, act: null, strafe: 1, lunge: 0,
      xp: 60 * (1 + G.BAL.xpFloorGrowth * (s.floor - 1)), soul: 0,
      name: B.name + (cycle > 0 ? ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(8, cycle - 1)] : ''),
    };
    e.maxHp = e.hp;
    s.enemies.push(e);
    s.boss = e; s.stairsLocked = true;
  }

  /* =================== Bucle principal =================== */
  G.step = function (s, dt) {
    if (s.over || s.paused) return;
    if (s.sim) s.events.length = 0;
    if (s.pendingLevels > 0 && !s.choices) makeChoices(s);
    if (s.choices) {
      const auto = s.sim || s.attract || (s.autopilot && s.meta.settings.autoBoons);
      if (!auto) return;
      G.chooseBoon(s, autoBoonPick(s));
      if (s.choices) return;
    }
    s.t += dt; s.time += dt; s.floorTime += dt;
    s.shake = Math.max(0, s.shake - dt * 1.6);
    const p = s.player, m = s.map;

    // Entrada (teclado/joystick o piloto automático)
    let mx = s.input.mx, my = s.input.my, wantDash = s.input.dash;
    s.input.dash = false;
    if (s.autopilot) {
      const a = autopilot(s, dt);
      if (s.over || s.floorChanged) { s.floorChanged = false; return; }
      if (Math.abs(mx) + Math.abs(my) < 0.1) { mx = a.mx; my = a.my; }
      wantDash = wantDash || a.dash;
    }
    const st = s.stats;
    let len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; len = 1; }
    p.iframes -= dt; p.hurtT -= dt; p.dashCd -= dt; p.atkT -= dt;
    if (len > 0.1) { p.dx = mx / len; p.dy = my / len; }
    if (wantDash && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = 0.2; p.dashCd = st.dashCd; p.iframes = Math.max(p.iframes, 0.3);
      if (len > 0.1) { p.ddx = mx / len; p.ddy = my / len; } else { p.ddx = Math.cos(p.facing); p.ddy = Math.sin(p.facing); }
      s.events.push({ type: 'dash' });
    }
    let vx, vy;
    if (p.dashT > 0) { p.dashT -= dt; vx = p.ddx * 11; vy = p.ddy * 11; if (!s.sim && Math.random() < 0.6) particle(s, p.x, p.y, 0, 0, '#5fae9c', 0.25, 0.08); }
    else { vx = mx * st.move; vy = my * st.move; }
    p.moving = vx * vx + vy * vy > 0.04;
    if (p.moving) { p.walkT += dt; if (p.atkT <= 0) p.facing = turnTo(p.facing, Math.atan2(vy, vx), dt * 14); }
    moveCircle(m, p, vx * dt, vy * dt);

    if (st.regen > 0 && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + st.regen * st.maxHp * dt);

    // Visión y campo de persecución
    const ti = Math.floor(p.y) * m.w + Math.floor(p.x);
    s.visT -= dt;
    if (!s.shop && (ti !== s.visTile || s.visT <= 0)) { G.computeVis(m, p.x, p.y, st.visR); s.visTile = ti; s.visT = 0.25; }
    s.flowT -= dt;
    if (ti !== s.flowTile || s.flowT <= 0) { G.bfsField(m, Math.floor(p.x), Math.floor(p.y), 0, s.flow); s.flowTile = ti; s.flowT = 0.5; }

    playerAttacks(s, dt);
    updateCompanions(s, dt);
    updateEnemies(s, dt);
    if (s.over) return;
    updateProjectiles(s, dt);
    updateEnemyProjectiles(s, dt);
    if (s.over) return;
    updateItems(s, dt);

    const sd = Math.hypot(p.x - (m.stairs.x + 0.5), p.y - (m.stairs.y + 0.5));
    s.onStairs = !s.stairsLocked && sd < 0.8;
    if (s.onStairs && s.autopilot && s.ap && s.ap.goal === 'stairs') G.descend(s);
    if (!s.sim) updateFx(s, dt);
  };

  function turnTo(a, b, k) { return a + clamp(angDiff(b, a), -k, k); }

  /* ¿Adónde llevan las escaleras actuales? */
  G.nextStop = s => (!s.shop && G.isShopAfter(s.floor) ? 'shop' : 'floor');
  G.descend = function (s) {
    if (!s.onStairs || s.over) return false;
    const st = s.stats, p = s.player;
    if (s.shop) enterFloor(s, s.floor + 1);
    else {
      s.souls += s.floor * st.souls;
      p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.15);
      if (G.isShopAfter(s.floor)) enterShop(s); else enterFloor(s, s.floor + 1);
    }
    s.floorChanged = true;
    s.events.push({ type: 'descend', floor: s.floor, shop: s.shop });
    return true;
  };

  /* =================== Movimiento y colisiones =================== */
  function collideWalls(m, e) {
    const r = e.r;
    if (G.solidAt(m, e.x, e.y)) {
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      let best = null, bd = 9;
      for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
        if (!ax && !ay) continue;
        if (!G.walk(m, tx + ax, ty + ay)) continue;
        const cx = clamp(e.x, tx + ax, tx + ax + 1), cy = clamp(e.y, ty + ay, ty + ay + 1);
        const d = Math.hypot(cx - e.x, cy - e.y);
        if (d < bd) { bd = d; best = [cx, cy]; }
      }
      if (!best) return;
      e.x = best[0]; e.y = best[1];
    }
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r), y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (G.walk(m, tx, ty)) continue;
        const cx = clamp(e.x, tx, tx + 1), cy = clamp(e.y, ty, ty + 1);
        const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
        if (d2 < r * r && d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; e.x += dx * k; e.y += dy * k; }
      }
    }
  }
  function moveCircle(m, e, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) { e.x += sx; e.y += sy; collideWalls(m, e); }
  }

  /* =================== Ataques del jugador =================== */
  function findTarget(s, reach) {
    const p = s.player, m = s.map;
    let best = null, bd = Infinity;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d > reach || d >= bd) continue;
      if (!m.vis[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
      if (!e.hasLos && d > 0.6) continue;
      bd = d; best = e;
    }
    return best;
  }
  function rollDamage(s, w) {
    const st = s.stats;
    let d = w.dmg * st.dmg * (w.kind === 'melee' ? st.melee : st.ranged) * (w.hands === 2 ? st.twoHand : 1) * (st.dualActive ? st.dual : 1);
    if (w === G.FISTS) d *= Math.pow(G.BAL.weaponGrowth, s.floor - 1);
    const cc = st.crit + (w.crit || 0) + (st.dualActive ? st.dualCrit : 0);
    const crit = s.rng() < cc;
    if (crit) d *= st.critMult;
    return { dmg: d * s.rng.range(0.9, 1.1), crit };
  }
  function playerAttacks(s, dt) {
    const p = s.player, st = s.stats;
    p.anim.L -= dt; p.anim.R -= dt; p.anim.B -= dt;
    const slots = attackSlots(p);
    for (const [k, w] of slots) {
      p.cd[k] -= dt * st.atkSpd;
      if (p.cd[k] > 0) continue;
      const reach = effRange(s, w);
      const t = findTarget(s, reach);
      if (!t) { p.cd[k] = 0; continue; }
      if (w.kind === 'melee') meleeAttack(s, k, w, t, reach); else rangedAttack(s, k, w, t);
      p.cd[k] = w.cd;
      p.atkT = 0.5;
      if (slots.length === 2 && st.tempest > 0) {
        const other = slots[0][0] === k ? slots[1][0] : slots[0][0];
        p.cd[other] -= st.tempest;
      }
    }
  }
  function meleeAttack(s, k, w, t, reach) {
    const p = s.player, st = s.stats;
    const dir = Math.atan2(t.y - p.y, t.x - p.x);
    const whirl = st.whirl > 0 && s.rng() < st.whirl;
    const half = whirl ? Math.PI : (w.arc * Math.PI / 360);
    for (const e of s.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d - e.r > reach) continue;
      if (!whirl && Math.abs(angDiff(Math.atan2(dy, dx), dir)) > half + Math.atan2(e.r, Math.max(d, 0.2))) continue;
      if (e !== t && !e.hasLos && d > 1.2) continue;
      hitEnemy(s, e, rollDamage(s, w), w, Math.atan2(dy, dx));
    }
    p.facing = dir; p.aim[k] = dir; p.anim[k] = 0.2;
    if (!s.sim) s.fx.push({ type: 'swing', x: p.x, y: p.y, dir, half, reach, t: 0, dur: 0.18, color: G.RARITIES[w.rarity || 0].color, thrust: w.arc <= 40, whirl });
    s.events.push({ type: 'swing', heavy: w.hands === 2 });
  }
  function rangedAttack(s, k, w, t) {
    const p = s.player, st = s.stats;
    const spd = w.pspeed * st.pspeed;
    const lead = Math.min(0.6, Math.hypot(t.x - p.x, t.y - p.y) / spd);
    const dir = Math.atan2(t.y + t.vy * lead - p.y, t.x + t.vx * lead - p.x);
    let shots = w.shots || 1;
    if (st.extraShot > 0 && s.rng() < st.extraShot) shots++;
    const spread = (w.spread || 9) * Math.PI / 180;
    const life = effRange(s, w) / spd * 1.15;
    for (let i = 0; i < shots; i++) {
      const a = dir + (shots === 1 ? 0 : (i - (shots - 1) / 2) * spread);
      const roll = rollDamage(s, w);
      s.proj.push({
        x: p.x + Math.cos(a) * 0.35, y: p.y + Math.sin(a) * 0.35, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        r: w.aoe ? 0.18 : 0.11, dmg: roll.dmg, crit: roll.crit, pierce: (w.pierce || 0) + st.pierce, hit: [],
        life, w, homing: w.homing || 0, aoe: w.aoe || 0, icon: w.icon, color: G.RARITIES[w.rarity || 0].color, spin: 0,
      });
    }
    p.facing = dir; p.aim[k] = dir; p.anim[k] = 0.14;
    s.events.push({ type: 'shoot', icon: w.icon });
  }

  function hitEnemy(s, e, roll, w, dir, scale) {
    if (e.dead) return;
    const st = s.stats, p = s.player;
    let d = roll.dmg * (scale || 1);
    if (w.kind === 'ranged' && e.d.rangedRes) d *= 1 - e.d.rangedRes;
    e.hp -= d; e.flash = 0.1; e.aggro = true;
    addText(s, e.x, e.y - e.r - 0.15, G.fmt(d), roll.crit ? 'crit' : 'dmg');
    const kb = (w.kb || 0) * (1 - (e.d.kbres || 0)) * (e.boss ? 0.12 : 1);
    if (kb > 0) { e.kbx += Math.cos(dir) * kb * 2.6; e.kby += Math.sin(dir) * kb * 2.6; }
    const own = w.kind === 'melee' || w.kind === 'ranged';   // golpe del héroe (no de compañeros ni explosiones)
    if (w.kind === 'comp') s.compDamage += d;
    s.dmgTotal = (s.dmgTotal || 0) + d;
    const stunC = (w.stun || 0) + (w.kind === 'melee' ? st.stun : 0);
    if (stunC > 0 && s.rng() < stunC) { e.stun = e.boss ? 0.2 : 0.7; e.wind = 0; }
    const slow = Math.max(w.slow || 0, own ? st.chill : 0);
    if (slow) { e.slow = Math.max(slow, e.slowT > 0 ? e.slow : 0); e.slowT = 1.5; }
    if (w.burn) { e.burnDps = Math.max(e.burnT > 0 ? e.burnDps : 0, d * w.burn / 2); e.burnT = 2; }
    const leech = own ? st.lifesteal + (w.lifesteal || 0) + (w.kind === 'melee' ? st.meleeLeech : 0) : 0;
    if (leech > 0 && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + Math.min(d * leech, st.maxHp * 0.06));
    if (!s.sim) for (let i = 0; i < (roll.crit ? 6 : 3); i++) particle(s, e.x, e.y, Math.cos(dir + (Math.random() - 0.5) * 1.6) * 4, Math.sin(dir + (Math.random() - 0.5) * 1.6) * 4, roll.crit ? '#f4b860' : '#e9dfc8', 0.25, 0.05);
    s.events.push({ type: roll.crit ? 'crit' : 'hit' });
    if (e.hp <= 0) killEnemy(s, e);
  }

  function killEnemy(s, e) {
    if (e.dead) return;
    e.dead = true; s.kills++;
    const st = s.stats, f = s.floor, rng = s.rng;
    gainXp(s, e.xp);
    s.souls += e.soul * st.souls;
    const p = s.player;
    if (st.killHeal && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + st.maxHp * st.killHeal);
    if (st.blast && !e.boss) {
      // Corona de brasas: la baja explota
      for (const o of s.enemies) {
        if (o.dead || o === e) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) - o.r <= 1.7) hitEnemy(s, o, { dmg: e.maxHp * 0.3, crit: false }, FX_W, Math.atan2(o.y - e.y, o.x - e.x));
      }
      if (!s.sim) s.fx.push({ type: 'boom', x: e.x, y: e.y, r: 1.7, t: 0, dur: 0.3, color: '#f08a3c' });
    }
    if (e.boss) spawnCoins(s, e.x, e.y, 40 * G.econ(f) * st.gold, 8);
    else if (!e.minion && (e.elite || rng() < G.BAL.goldDrop)) spawnCoins(s, e.x, e.y, (2 + e.d.xp * 0.4) * G.goldPerEnemy(f) * st.gold * rng.range(0.8, 1.2) * (e.elite ? 3 : 1), e.elite ? 3 : 1);
    if (e.boss) {
      for (let i = 0; i < 2; i++) {
        const w = G.makeWeapon(s, G.randomWeaponId(rng), f, Math.max(2, G.rollRarity(s, 2)));
        const pos = freeSpotNear(s, e.x + (i ? 0.9 : -0.9), e.y, 0.2);
        addItem(s, { kind: 'weapon', w }, pos.x, pos.y);
      }
      addItem(s, { kind: 'potion' }, e.x, e.y + 0.6);
      s.souls += 6 * f * st.souls;
      s.boss = null; s.stairsLocked = false;
      s.shake = 0.7;
      s.events.push({ type: 'bossdown' });
    } else {
      if ((e.elite && rng() < 0.5) || rng() < G.BAL.weaponDrop * st.drops) addItem(s, { kind: 'weapon', w: randomWeapon(s, f, e.elite ? 1 : 0) }, e.x, e.y);
      if (rng() < (e.elite ? 0.5 : G.BAL.potionDrop * st.drops)) addItem(s, { kind: 'potion' }, e.x + 0.25, e.y + 0.2);
    }
    if (e.d.split) for (let i = 0; i < e.d.split; i++) {
      const c = spawnEnemy(s, 'limito', e.x + (i ? 0.25 : -0.25), e.y, false);
      c.aggro = true; c.cd = 0.6;
    }
    if (!s.sim) {
      const col = e.boss ? e.boss.color : e.d.shape === 'slime' ? '#6fbf73' : e.d.shape === 'bat' ? '#5b4a75' : '#d8ccb2';
      for (let i = 0; i < (e.boss ? 40 : 12); i++) { const a = Math.random() * TAU, sp = 1 + Math.random() * (e.boss ? 6 : 3.5); particle(s, e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, col, 0.5 + Math.random() * 0.4, 0.06 + Math.random() * 0.06); }
    }
    s.events.push({ type: 'kill', elite: e.elite, boss: !!e.boss });
  }

  function gainXp(s, amount) {
    const p = s.player;
    p.xp += amount * s.stats.xp;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; s.pendingLevels++;
      p.xpNext = G.xpFor(p.lvl + s.pendingLevels);
      s.events.push({ type: 'levelup' });
    }
  }

  /* =================== Mejoras de nivel =================== */
  function makeChoices(s) {
    const p = s.player;
    const pool = G.BOONS.filter(b => (p.boons[b.id] || 0) < b.max && (!b.rare || s.rng() < 0.35));
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(s.rng() * pool.length), 1)[0].id);
    s.choices = out;
    s.events.push({ type: 'choices' });
  }
  G.chooseBoon = function (s, id) {
    if (!s.choices || !s.choices.includes(id)) return;
    const p = s.player;
    p.boons[id] = (p.boons[id] || 0) + 1;
    p.lvl++; s.pendingLevels = Math.max(0, s.pendingLevels - 1);
    if (id === 'fenix') p.revives.push(0.4);
    s.choices = null;
    computeStats(s);
    if (id === 'robustez') p.hp = Math.min(s.stats.maxHp, p.hp + s.stats.maxHp * 0.3);
    s.events.push({ type: 'boon', id });
  };
  G.autoBoonPick = autoBoonPick;
  function autoBoonPick(s) {
    const p = s.player, ranged = maxReach(s) >= 4;
    const base = { fenix: 100, fuerza: 10, celeridad: 10, robustez: 9, sanguijuela: 8, piel: 7, regen: 6, mortal: 6, ojo: 6, pies: 4, puntas: ranged ? 9 : 0.5, filo: ranged ? 0.5 : 5 };
    let best = s.choices[0], bs = -1;
    for (const id of s.choices) { const sc = (base[id] || 1) / (1 + 0.35 * (p.boons[id] || 0)); if (sc > bs) { bs = sc; best = id; } }
    return best;
  }

  /* =================== Equipar armas =================== */
  G.equip = function (s, itemId, slot) {
    const idx = s.items.findIndex(i => i.id === itemId && i.kind === 'weapon' && !i.dead);
    if (idx < 0) return false;
    const it = s.items[idx];
    s.items.splice(idx, 1);
    equipWeapon(s, it.w, slot);
    return true;
  };
  function equipWeapon(s, w, slot) {
    const p = s.player;
    const cur = p.hands, is2 = !!(cur.L && cur.L === cur.R), drops = [];
    if (w.hands === 2) {
      if (is2) drops.push(cur.L); else { if (cur.L) drops.push(cur.L); if (cur.R) drops.push(cur.R); }
      cur.L = cur.R = w;
    } else {
      if (slot !== 'L' && slot !== 'R') slot = cur.R && !cur.L ? 'L' : 'R';
      if (is2) { drops.push(cur.L); cur.L = cur.R = null; }
      if (cur[slot]) drops.push(cur[slot]);
      cur[slot] = w;
    }
    for (const d of drops) dropWeapon(s, d);
    p.cd.L = 0.1; p.cd.R = 0.35; p.cd.B = 0.1;
    computeStats(s);
    s.near = null;
    s.events.push({ type: 'equip', w });
  }

  /* =================== Enemigos =================== */
  function alertNearby(s, src) {
    for (const e of s.enemies) if (!e.aggro && !e.dead && Math.hypot(e.x - src.x, e.y - src.y) < 5) e.aggro = true;
  }
  function chaseDir(s, e, dx, dy, dist) {
    if (e.hasLos) return [dx / dist, dy / dist];
    const m = s.map, W = m.w, tx = Math.floor(e.x), ty = Math.floor(e.y);
    const cur = s.flow[ty * W + tx];
    if (cur < 0) return [0, 0];
    let best = cur, bx = tx, by = ty;
    const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ax, ay] of N) {
      const nx = tx + ax, ny = ty + ay;
      if (!G.walk(m, nx, ny)) continue;
      const v = s.flow[ny * W + nx];
      if (v >= 0 && v < best) { best = v; bx = nx; by = ny; }
    }
    if (best === cur) return [dx / dist, dy / dist];
    const gx = bx + 0.5 - e.x, gy = by + 0.5 - e.y, gl = Math.hypot(gx, gy) || 1;
    return [gx / gl, gy / gl];
  }
  function fireEnemy(s, e) {
    const p = s.player, n = e.d.shots || 1, spread = (e.d.spread || 10) * Math.PI / 180;
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < n; i++) {
      const a = base + (n === 1 ? 0 : (i - (n - 1) / 2) * spread);
      s.eproj.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * e.d.pspeed, vy: Math.sin(a) * e.d.pspeed,
        r: e.d.proj === 'orb' ? 0.16 : 0.1, dmg: e.dmg, life: 3.5, homing: e.d.homing || 0, kind: e.d.proj || 'arrow', src: e });
    }
    s.events.push({ type: 'eshoot' });
  }

  function updateEnemies(s, dt) {
    const p = s.player, m = s.map, rng = s.rng;
    for (const e of s.enemies) {
      if (e.dead) continue;
      e.flash -= dt; e.anim += dt; e.lunge = Math.max(0, e.lunge - dt);
      const ox = e.x, oy = e.y;
      if (e.burnT > 0) {
        e.burnT -= dt; e.hp -= e.burnDps * dt;
        e.burnTick = (e.burnTick || 0) + dt;
        if (e.burnTick > 0.5) { e.burnTick = 0; addText(s, e.x, e.y - e.r, G.fmt(e.burnDps * 0.5), 'burn'); }
        if (e.hp <= 0) { killEnemy(s, e); continue; }
      }
      if (e.slowT > 0) e.slowT -= dt;
      if (Math.abs(e.kbx) + Math.abs(e.kby) > 0.02) {
        moveCircle(m, e, e.kbx * dt, e.kby * dt);
        const f = Math.max(0, 1 - dt * 9); e.kbx *= f; e.kby *= f;
      } else { e.kbx = 0; e.kby = 0; }
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 0.001;
      e.losT -= dt;
      if (e.losT <= 0) { e.losT = 0.15 + rng() * 0.1; e.hasLos = dist < 13 && G.los(m, e.x, e.y, p.x, p.y); }
      if (e.stun > 0) { e.stun -= dt; e.vx = (e.x - ox) / dt; e.vy = (e.y - oy) / dt; continue; }
      if (!e.aggro) {
        if (e.hasLos && dist < (e.boss ? 6.5 : 7.5)) { e.aggro = true; alertNearby(s, e); if (e.boss) s.events.push({ type: 'bossaggro' }); }
        else { e.vx = 0; e.vy = 0; continue; }
      }
      e.cd -= dt;
      const spd = e.spd * (e.slowT > 0 ? 1 - e.slow : 1);
      if (!e.act || e.act.type !== 'charge') e.face = turnTo(e.face, Math.atan2(dy, dx), dt * 8);

      if (e.boss) updateBoss(s, e, dt, dist, dx, dy, spd);
      else if (e.wind > 0) {
        e.wind -= dt;
        if (e.wind <= 0) {
          if (e.d.ranged) fireEnemy(s, e);
          else if (dist <= e.d.range + p.r + e.r + 0.3) damagePlayer(s, e.dmg, e, true);
          e.cd = e.d.cd * rng.range(0.85, 1.15);
          e.lunge = 0.15;
          if (s.over) return;
        }
      } else {
        let mx = 0, my = 0;
        if (e.d.ranged) {
          if (e.hasLos && dist <= e.d.range) {
            if (e.cd <= 0) e.wind = e.d.wind;
            else if (dist < e.d.keep) { mx = -dx / dist; my = -dy / dist; }
            else { const a = e.face + Math.PI / 2 * e.strafe; mx = Math.cos(a) * 0.35; my = Math.sin(a) * 0.35; if (rng() < dt * 0.5) e.strafe *= -1; }
          } else [mx, my] = chaseDir(s, e, dx, dy, dist);
        } else {
          const reach = e.d.range + p.r + e.r;
          if (dist <= reach && e.hasLos) { if (e.cd <= 0) e.wind = e.d.wind; }
          else [mx, my] = chaseDir(s, e, dx, dy, dist);
        }
        if (e.d.erratic) { const a = Math.sin(e.anim * 6 + e.phase) * 0.9; const qx = -my, qy = mx; mx += qx * a; my += qy * a; }
        moveCircle(m, e, mx * spd * dt, my * spd * dt);
      }
      e.vx = (e.x - ox) / dt; e.vy = (e.y - oy) / dt;
    }
    separate(s);
    let j = 0;
    for (const e of s.enemies) if (!e.dead) s.enemies[j++] = e;
    s.enemies.length = j;
  }

  function separate(s) {
    const es = s.enemies, n = es.length, p = s.player;
    for (let i = 0; i < n; i++) {
      const a = es[i];
      if (a.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const b = es[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-8) continue;
        const d = Math.sqrt(d2), push = (rr - d) / d * 0.5;
        const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
        a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * wb; b.y += dy * push * wb;
      }
      const dx = a.x - p.x, dy = a.y - p.y, rr = a.r + p.r, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 1e-8) {
        const d = Math.sqrt(d2), push = (rr - d) / d;
        const wa = a.boss ? 0.15 : 0.7;
        a.x += dx * push * wa; a.y += dy * push * wa; p.x -= dx * push * (1 - wa); p.y -= dy * push * (1 - wa);
      }
    }
    for (const e of es) if (!e.dead) collideWalls(s.map, e);
    collideWalls(s.map, p);
  }

  /* --------- Jefes --------- */
  function updateBoss(s, e, dt, dist, dx, dy, spd) {
    const p = s.player, B = e.boss, rng = s.rng, m = s.map;
    const rage = e.hp < e.maxHp * 0.4 ? 1.35 : 1;
    e.patT -= dt * rage;
    if (e.act) {
      const a = e.act;
      a.t += dt;
      if (a.type === 'slam') {
        if (!a.done && a.t >= a.wind) {
          a.done = true;
          if (dist <= a.r + p.r) damagePlayer(s, e.dmg * 1.6, e, true);
          s.shake = Math.max(s.shake, 0.45);
          if (!s.sim) s.fx.push({ type: 'boom', x: e.x, y: e.y, r: a.r, t: 0, dur: 0.35, color: B.color });
          s.events.push({ type: 'slam' });
        }
        if (a.t >= a.wind + 0.35) e.act = null;
      } else if (a.type === 'charge') {
        if (a.t < a.wind * 0.75) a.ang = Math.atan2(dy, dx);
        e.face = a.ang;
        if (a.t >= a.wind && a.t < a.wind + 0.55) {
          moveCircle(m, e, Math.cos(a.ang) * 10 * dt, Math.sin(a.ang) * 10 * dt);
          if (!a.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 0.15) { a.hit = true; damagePlayer(s, e.dmg * 1.3, e, true); }
        } else if (a.t >= a.wind + 0.55) e.act = null;
      } else if (a.type === 'ring' || a.type === 'volley') {
        const interval = a.type === 'ring' ? 0.45 : 0.3;
        while (a.fired < a.waves && a.t >= a.wind + a.fired * interval) {
          if (a.type === 'ring') {
            const n = Math.min(28, 10 + Math.floor(s.floor / 5) * 2);
            for (let i = 0; i < n; i++) { const ang = (i + (a.fired % 2) * 0.5) * TAU / n; bossShot(s, e, ang, 4.2, 0.7); }
          } else {
            const base = Math.atan2(p.y - e.y, p.x - e.x);
            for (let i = -2; i <= 2; i++) bossShot(s, e, base + i * 0.16, 6, 0.6);
          }
          a.fired++;
          s.events.push({ type: 'eshoot' });
        }
        if (a.fired >= a.waves) e.act = null;
      } else if (a.type === 'summon') {
        if (a.t >= a.wind) {
          const n = 2 + Math.min(3, Math.floor(s.floor / 15));
          for (let i = 0; i < n; i++) {
            const ang = rng() * TAU, x = e.x + Math.cos(ang) * 1.6, y = e.y + Math.sin(ang) * 1.6;
            if (G.solidAt(m, x, y)) continue;
            const c = spawnEnemy(s, rng.pick(B.adds), x, y, false);
            c.aggro = true; c.xp *= 0.3; c.soul *= 0.3; c.minion = true;
          }
          e.act = null;
          s.events.push({ type: 'summon' });
        }
      }
      return;
    }
    if (e.patT <= 0) {
      const type = rng.pick(B.moves);
      e.act = { type, t: 0, wind: type === 'slam' ? 0.9 : type === 'charge' ? 0.8 : type === 'summon' ? 0.8 : 0.55,
        r: 2.6, waves: type === 'ring' ? (rage > 1 ? 3 : 2) : 3, fired: 0, ang: Math.atan2(dy, dx) };
      e.patT = B.every;
      e.wind = 0;
      return;
    }
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) { if (dist <= B.range + p.r + e.r + 0.3) damagePlayer(s, e.dmg, e, true); e.cd = B.cd; e.lunge = 0.15; }
      return;
    }
    const reach = B.range + p.r + e.r;
    if (B.keep && dist < B.keep && e.hasLos) { moveCircle(m, e, -dx / dist * spd * dt, -dy / dist * spd * dt); }
    else if (dist <= reach) { if (e.cd <= 0) e.wind = B.wind; }
    else if (!B.keep || dist > B.keep + 1.5 || !e.hasLos) { const [mx, my] = chaseDir(s, e, dx, dy, dist); moveCircle(m, e, mx * spd * dt, my * spd * dt); }
  }
  function bossShot(s, e, ang, speed, mult) {
    s.eproj.push({ x: e.x + Math.cos(ang) * e.r, y: e.y + Math.sin(ang) * e.r, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      r: 0.17, dmg: e.dmg * mult, life: 4, homing: 0, kind: 'orb', color: e.boss.color, src: e });
  }

  /* =================== Daño al jugador =================== */
  function damagePlayer(s, amount, src, melee) {
    const p = s.player, st = s.stats;
    if (s.over || p.iframes > 0 || p.dashT > 0) return;
    if (st.dodge > 0 && s.rng() < st.dodge) { addText(s, p.x, p.y - 0.55, 'Esquiva', 'info'); p.iframes = 0.15; return; }
    let d = amount;
    if (st.block > 0 && s.rng() < st.block) {
      d *= 0.25;
      addText(s, p.x, p.y - 0.75, 'Bloqueo', 'info');
      s.events.push({ type: 'block' });
      if (st.thorns && src && !src.dead) {
        const w = attackSlots(p)[0][1];
        hitEnemy(s, src, rollDamage(s, w), w, Math.atan2(src.y - p.y, src.x - p.x));
      }
    }
    d *= 100 / (100 + st.armor);
    if (melee && st.spikes && src && !src.dead) {
      // Cota de espinas: devuelves un golpe con tu arma
      const w = attackSlots(p)[0][1];
      hitEnemy(s, src, rollDamage(s, w), w, Math.atan2(src.y - p.y, src.x - p.x));
    }
    p.hp -= d; p.iframes = 0.2; p.hurtT = 0.3;
    if (!s.sim) { s.shake = Math.min(0.6, s.shake + 0.1 + 0.6 * d / st.maxHp); addText(s, p.x, p.y - 0.55, G.fmt(d), 'hurt'); }
    s.events.push({ type: 'hurt' });
    if (p.hp <= 0) {
      if (p.revives.length) {
        p.revives.sort((a, b) => b - a);
        p.hp = st.maxHp * p.revives.shift();
        p.iframes = 2;
        for (const e of s.enemies) {
          const ex = e.x - p.x, ey = e.y - p.y, dd = Math.hypot(ex, ey) || 1;
          if (dd < 4 && !e.boss) { e.kbx += ex / dd * 9; e.kby += ey / dd * 9; e.stun = 1; e.wind = 0; }
        }
        for (const b of s.eproj) b.dead = true;
        addText(s, p.x, p.y - 0.9, '¡Revives!', 'big');
        s.events.push({ type: 'revive' });
      } else {
        s.killedBy = src ? (src.name || (src.d && src.d.name) || null) : null;
        die(s, false);
      }
    }
  }

  function die(s, abandoned) {
    if (s.over) return;
    s.over = true;
    s.player.hp = Math.max(0, s.player.hp);
    const meta = s.meta, souls = Math.floor(s.souls), prevBest = meta.bestFloor;
    if (!s.attract) {
      meta.souls += souls; meta.totalSouls += souls;
      meta.bestFloor = Math.max(meta.bestFloor, s.floor);
      meta.runs++; meta.kills += s.kills;
      if (!s.sim) G.saveMeta(meta);
    }
    s.result = { floor: s.floor, kills: s.kills, souls, level: s.player.lvl, time: s.time, record: s.floor > prevBest, startFloor: s.startFloor, abandoned, gold: Math.floor(s.goldEarned) };
    s.events.push({ type: 'death', abandoned });
  }
  G.abandon = s => die(s, true);

  /* =================== Proyectiles =================== */
  function nearestEnemy(s, x, y, maxD) {
    let best = null, bd = maxD;
    for (const e of s.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function explode(s, pr, direct) {
    for (const e of s.enemies) {
      if (e.dead || e === direct) continue;
      if (Math.hypot(e.x - pr.x, e.y - pr.y) - e.r <= pr.aoe) hitEnemy(s, e, { dmg: pr.dmg * 0.75, crit: pr.crit }, pr.w, Math.atan2(e.y - pr.y, e.x - pr.x));
    }
    if (!s.sim) s.fx.push({ type: 'boom', x: pr.x, y: pr.y, r: pr.aoe, t: 0, dur: 0.3, color: '#a68be0' });
    s.events.push({ type: 'boom' });
  }
  function updateProjectiles(s, dt) {
    const m = s.map;
    for (const pr of s.proj) {
      if (pr.dead) continue;
      pr.spin += dt * 20;
      if (pr.homing) {
        pr.ht = (pr.ht || 0) - dt;
        if (pr.ht <= 0) { pr.ht = 0.15; pr.tgt = nearestEnemy(s, pr.x, pr.y, 4.5); }
        if (pr.tgt && !pr.tgt.dead) {
          const cur = Math.atan2(pr.vy, pr.vx), sp = Math.hypot(pr.vx, pr.vy);
          const na = cur + clamp(angDiff(Math.atan2(pr.tgt.y - pr.y, pr.tgt.x - pr.x), cur), -pr.homing * dt, pr.homing * dt);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      const sp = Math.hypot(pr.vx, pr.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.2)), h = dt / steps;
      for (let i = 0; i < steps && !pr.dead; i++) {
        pr.x += pr.vx * h; pr.y += pr.vy * h; pr.life -= h;
        if (G.solidAt(m, pr.x, pr.y)) {
          if (pr.aoe) explode(s, pr, null);
          pr.dead = true;
          if (!s.sim) for (let k = 0; k < 4; k++) particle(s, pr.x - pr.vx * h, pr.y - pr.vy * h, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, '#b8ad97', 0.2, 0.04);
          break;
        }
        for (const e of s.enemies) {
          if (e.dead || pr.hit.includes(e.id)) continue;
          const dx = e.x - pr.x, dy = e.y - pr.y, rr = e.r + pr.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          pr.hit.push(e.id);
          hitEnemy(s, e, { dmg: pr.dmg, crit: pr.crit }, pr.w, Math.atan2(pr.vy, pr.vx));
          if (pr.aoe) { explode(s, pr, e); pr.dead = true; break; }
          if (pr.pierce > 0) { pr.pierce--; pr.dmg *= 0.85; } else { pr.dead = true; break; }
        }
        if (!pr.dead && pr.life <= 0) { if (pr.aoe) explode(s, pr, null); pr.dead = true; }
      }
    }
    let j = 0;
    for (const pr of s.proj) if (!pr.dead) s.proj[j++] = pr;
    s.proj.length = j;
  }
  function updateEnemyProjectiles(s, dt) {
    const p = s.player, m = s.map;
    for (const b of s.eproj) {
      if (b.dead) continue;
      if (b.homing) {
        const cur = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
        const na = cur + clamp(angDiff(Math.atan2(p.y - b.y, p.x - b.x), cur), -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
      const sp = Math.hypot(b.vx, b.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.2)), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        b.x += b.vx * h; b.y += b.vy * h; b.life -= h;
        if (b.life <= 0 || G.solidAt(m, b.x, b.y)) { b.dead = true; break; }
        const dx = p.x - b.x, dy = p.y - b.y, rr = p.r + b.r;
        if (dx * dx + dy * dy < rr * rr && p.dashT <= 0) { damagePlayer(s, b.dmg, b.src); b.dead = true; break; }
      }
      if (s.over) return;
    }
    let j = 0;
    for (const b of s.eproj) if (!b.dead) s.eproj[j++] = b;
    s.eproj.length = j;
  }

  /* =================== Objetos =================== */
  const NEAR_R = { weapon: 0.85, shop: 0.95, merchant: 1.3 };
  function updateItems(s, dt) {
    const p = s.player, st = s.stats, m = s.map;
    let near = null, nd = Infinity;
    for (const it of s.items) {
      if (it.dead) continue;
      it.t += dt;
      let d = Math.hypot(it.x - p.x, it.y - p.y);
      if (it.kind === 'gold') {
        it.age += dt;
        if (it.vx || it.vy) {
          const ox = it.x, oy = it.y;
          it.x += it.vx * dt; it.y += it.vy * dt;
          if (G.solidAt(m, it.x, it.y)) { it.x = ox; it.y = oy; it.vx = it.vy = 0; }
          const f = Math.max(0, 1 - dt * 5); it.vx *= f; it.vy *= f;
          if (Math.abs(it.vx) + Math.abs(it.vy) < 0.05) it.vx = it.vy = 0;
        }
        if (it.age > 0.3 && d < 1.9) {
          const sp = (7 + (1.9 - d) * 8) * dt;
          if (d > 0.001) { it.x += (p.x - it.x) / d * Math.min(sp, d); it.y += (p.y - it.y) / d * Math.min(sp, d); }
          d = Math.hypot(it.x - p.x, it.y - p.y);
        }
        if (d < 0.4 && it.age > 0.2) { it.dead = true; gainGold(s, it.v); s.events.push({ type: 'coin' }); }
      } else if (it.kind === 'chest') {
        if (!it.open && d < 0.75) openChest(s, it);
      } else if (it.kind === 'potion') {
        if (d < 0.6) {
          if (p.potions < st.potionCap) {
            p.potions++; it.dead = true;
            addText(s, p.x, p.y - 0.6, '+1 poción', 'heal');
            s.events.push({ type: 'potionget' });
          } else if (p.hp < st.maxHp) {
            const heal = st.maxHp * 0.3;
            p.hp = Math.min(st.maxHp, p.hp + heal);
            it.dead = true;
            addText(s, p.x, p.y - 0.6, '+' + G.fmt(heal), 'heal');
            s.events.push({ type: 'potion' });
          }
        }
      } else if (NEAR_R[it.kind] && !(it.kind === 'shop' && it.sold) && d < NEAR_R[it.kind] && d < nd) { nd = d; near = it; }
    }
    let j = 0;
    for (const it of s.items) if (!it.dead) s.items[j++] = it;
    s.items.length = j;
    s.near = near;
    s.goldPopT -= dt;
    if (s.goldPop > 0 && s.goldPopT <= 0) { addText(s, p.x, p.y - 0.75, '+' + G.fmt(s.goldPop), 'gold'); s.goldPop = 0; s.goldPopT = 0.35; }
  }

  /* =================== Compañeros =================== */
  const COMP_W = { kind: 'comp', kb: 0.35, rarity: 0, icon: 'wisp' };
  const COMP_SLAM = { kind: 'comp', kb: 1.4, rarity: 0 };
  const FX_W = { kind: 'fx', kb: 0.8, rarity: 0 };
  function addCompanion(s, type) {
    const own = ownComp(s, type);
    if (own) { own.lvl++; s.events.push({ type: 'complvl', comp: own }); return own; }
    if (s.companions.length >= s.stats.compSlots) s.companions.shift();
    const d = G.COMPANIONS[type], p = s.player;
    const c = { id: s.uid++, type, d, lvl: 1, x: p.x, y: p.y, r: d.r, cd: 0.6, anim: s.rng() * 10, face: p.facing, atk: 0, tgt: null, tgtLos: false, losT: 0, lostT: 0, moving: false };
    s.companions.push(c);
    return c;
  }
  function placeCompanions(s) {
    const p = s.player;
    s.companions.forEach((c, i) => {
      c.x = p.x - 0.7; c.y = p.y + (i - (s.companions.length - 1) / 2) * 0.7;
      if (G.solidAt(s.map, c.x, c.y)) { c.x = p.x; c.y = p.y; }
      c.tgt = null; c.lostT = 0;
    });
  }
  G.compPower = (s, c) => Math.pow(G.BAL.weaponGrowth, s.floor - 1) * (1 + 0.5 * (c.lvl - 1)) * s.stats.compPow * s.stats.dmg;
  G.compHeal = (s, c) => (c.d.heal + 0.01 * (c.lvl - 1)) * s.stats.compPow;
  function glide(c, x, y, dt, k) { const f = Math.min(1, dt * k); c.x += (x - c.x) * f; c.y += (y - c.y) * f; }
  function updateCompanions(s, dt) {
    const p = s.player, m = s.map, st = s.stats, n = s.companions.length;
    if (!n) return;
    const back = Math.atan2(p.dy, p.dx) + Math.PI;
    s.companions.forEach((c, i) => {
      const d = c.d;
      c.anim += dt; c.cd -= dt; c.atk = Math.max(0, c.atk - dt);
      const spread = (i - (n - 1) / 2) * 0.95;
      const ax = p.x + Math.cos(back + spread) * 1.05, ay = p.y + Math.sin(back + spread) * 1.05;
      if (Math.hypot(c.x - p.x, c.y - p.y) > 9 || c.lostT > 1.6) { c.x = p.x; c.y = p.y; c.tgt = null; c.lostT = 0; }
      if (d.kind === 'heal') {
        glide(c, ax, ay - 0.35 + Math.sin(c.anim * 3) * 0.1, dt, 5);
        if (c.cd <= 0 && p.hp < st.maxHp && !s.shop) {
          const h = st.maxHp * G.compHeal(s, c);
          p.hp = Math.min(st.maxHp, p.hp + h); c.cd = d.cd; c.atk = 0.6;
          addText(s, p.x, p.y - 0.6, '+' + G.fmt(h), 'heal');
          s.events.push({ type: 'fairy' });
        }
        return;
      }
      const flying = d.kind === 'ranged';
      c.losT -= dt;
      if (c.losT <= 0) {
        c.losT = 0.3; c.tgt = null;
        let bd = Infinity;
        for (const e of s.enemies) {
          if (e.dead || !m.vis[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) > 7) continue;
          const de = Math.hypot(e.x - c.x, e.y - c.y);
          if (de < bd) { bd = de; c.tgt = e; }
        }
        c.tgtLos = c.tgt ? G.los(m, c.x, c.y, c.tgt.x, c.tgt.y) : false;
        if (!flying) c.lostT = G.los(m, c.x, c.y, p.x, p.y) ? 0 : c.lostT + 0.3;
      }
      const t = c.tgt && !c.tgt.dead ? c.tgt : null;
      const pow = G.compPower(s, c);
      if (flying) {
        glide(c, ax, ay - 0.3 + Math.sin(c.anim * 2.5) * 0.12, dt, 5);
        if (t) {
          c.face = Math.atan2(t.y - c.y, t.x - c.x);
          if (c.cd <= 0 && c.tgtLos && Math.hypot(t.x - c.x, t.y - c.y) <= d.range) {
            const a = c.face;
            s.proj.push({ x: c.x, y: c.y, vx: Math.cos(a) * d.pspeed, vy: Math.sin(a) * d.pspeed, r: 0.12,
              dmg: d.dmg * pow * s.rng.range(0.9, 1.1), crit: false, pierce: 0, hit: [], life: d.range / d.pspeed * 1.4,
              w: COMP_W, homing: 3.2, aoe: 0, icon: 'wisp', color: d.color, spin: 0 });
            c.cd = d.cd; c.atk = 0.25;
            s.events.push({ type: 'compshot' });
          }
        }
        return;
      }
      // Lobo y gólem: van a por el objetivo; si no hay, siguen al héroe
      let gx = ax, gy = ay;
      if (t && c.tgtLos) {
        const dist = Math.hypot(t.x - c.x, t.y - c.y);
        c.face = Math.atan2(t.y - c.y, t.x - c.x);
        if (dist <= d.range + t.r + c.r) {
          gx = c.x; gy = c.y;
          if (c.cd <= 0) {
            if (d.kind === 'slam') {
              for (const e of s.enemies) {
                if (e.dead || Math.hypot(e.x - t.x, e.y - t.y) - e.r > d.aoe) continue;
                hitEnemy(s, e, { dmg: d.dmg * pow * s.rng.range(0.9, 1.1), crit: false }, COMP_SLAM, Math.atan2(e.y - c.y, e.x - c.x));
                if (!e.dead) { e.stun = Math.max(e.stun, e.boss ? 0.15 : 0.5); e.wind = 0; }
              }
              if (!s.sim) s.fx.push({ type: 'boom', x: t.x, y: t.y, r: d.aoe, t: 0, dur: 0.3, color: d.color });
              s.events.push({ type: 'compslam' });
            } else {
              hitEnemy(s, t, { dmg: d.dmg * pow * s.rng.range(0.9, 1.1), crit: false }, COMP_W, c.face);
              s.events.push({ type: 'compbite' });
            }
            c.cd = d.cd; c.atk = 0.25;
          }
        } else { gx = t.x; gy = t.y; }
      }
      const dx = gx - c.x, dy = gy - c.y, dl = Math.hypot(dx, dy);
      if (dl > 0.12) {
        const v = Math.min(d.spd * dt, dl);
        moveCircle(m, c, dx / dl * v, dy / dl * v);
        if (!t || !c.tgtLos) c.face = Math.atan2(dy, dx);
        c.moving = true;
      } else c.moving = false;
    });
  }

  /* =================== Efectos visuales (no afectan a la lógica) =================== */
  function particle(s, x, y, vx, vy, color, life, size) {
    if (s.sim || s.parts.length > 400) return;
    s.parts.push({ x, y, vx, vy, color, life, max: life, size });
  }
  function addText(s, x, y, str, kind) {
    if (s.sim) return;
    if (s.texts.length > 90) s.texts.shift();
    s.texts.push({ x: x + (Math.random() - 0.5) * 0.35, y, str, kind, t: 0, life: kind === 'crit' || kind === 'big' ? 1.0 : 0.75 });
  }
  function updateFx(s, dt) {
    for (const f of s.fx) f.t += dt;
    s.fx = s.fx.filter(f => f.t < f.dur);
    for (const q of s.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 4; q.vy *= 1 - dt * 4; q.life -= dt; }
    s.parts = s.parts.filter(q => q.life > 0);
    for (const t of s.texts) { t.t += dt; t.y -= dt * 0.9; }
    s.texts = s.texts.filter(t => t.t < t.life);
  }

  /* =================== Piloto automático ===================
     También es el «jugador» del simulador de equilibrio. */
  function maxReach(s) {
    let r = 0;
    for (const [, w] of attackSlots(s.player)) r = Math.max(r, effRange(s, w));
    return r;
  }
  function blockedDir(s, dx, dy, dist) {
    const p = s.player, m = s.map;
    for (const k of [0.45, dist]) if (G.solidAt(m, p.x + dx * k, p.y + dy * k)) return true;
    return false;
  }
  function escapeDir(s) {
    const p = s.player, m = s.map;
    let best = [0, 0], bs = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, dx = Math.cos(a), dy = Math.sin(a);
      if (blockedDir(s, dx, dy, 1.2)) continue;
      const nx = p.x + dx * 1.2, ny = p.y + dy * 1.2;
      let sc = 0;
      for (const e of s.enemies) {
        if (e.dead || !e.aggro) continue;
        const d = Math.hypot(e.x - nx, e.y - ny);
        if (d < 8) sc += Math.min(d, 6) * (e.boss ? 2 : 1);
      }
      for (const k of [2.2, 3.2]) if (!G.solidAt(m, p.x + dx * k, p.y + dy * k)) sc += 1.5;
      if (sc > bs) { bs = sc; best = [dx, dy]; }
    }
    return best;
  }
  function pathDir(s, ap, goal, key) {
    const p = s.player, m = s.map;
    if (ap.key !== key || ap.pathT <= 0 || !ap.path) {
      ap.path = G.bfsPath(m, Math.floor(p.x), Math.floor(p.y), goal);
      ap.pathT = 0.35; ap.key = key;
    }
    const path = ap.path;
    if (!path || !path.length) return null;
    // Avanza en el camino descartando casillas ya alcanzadas
    while (path.length > 1 && Math.floor(p.x) === path[0].x && Math.floor(p.y) === path[0].y) path.shift();
    let tgt = path[0];
    for (let i = Math.min(path.length - 1, 6); i >= 1; i--) {
      const c = path[i], cx = c.x + 0.5, cy = c.y + 0.5;
      const ex = cx - p.x, ey = cy - p.y, el = Math.hypot(ex, ey) || 1, qx = -ey / el * 0.32, qy = ex / el * 0.32;
      if (G.los(m, p.x, p.y, cx, cy) && G.los(m, p.x + qx, p.y + qy, cx + qx, cy + qy) && G.los(m, p.x - qx, p.y - qy, cx - qx, cy - qy)) { tgt = c; break; }
    }
    const gx = tgt.x + 0.5 - p.x, gy = tgt.y + 0.5 - p.y, gl = Math.hypot(gx, gy);
    if (gl < 0.05) return [0, 0];
    return [gx / gl, gy / gl];
  }

  function autopilot(s, dt) {
    const p = s.player, st = s.stats, m = s.map;
    const ap = s.ap || (s.ap = { pathT: 0, path: null, key: '', goal: null, strafe: 1, strafeT: 0, stuckT: 0, lx: p.x, ly: p.y, jig: 0, jx: 0, jy: 0 });
    ap.pathT -= dt;
    const out = { mx: 0, my: 0, dash: false };

    if (p.potions > 0 && p.hp / st.maxHp < 0.35) G.drinkPotion(s);
    if (s.near && s.near.kind === 'weapon') {
      const slot = G.bestSlotFor(s, s.near.w);
      if (slot) G.equip(s, s.near.id, slot); else G.melt(s, s.near.id);
    }
    if (s.shop) return autoShop(s, ap, out);

    let tgt = null, td = Infinity;
    for (const e of s.enemies) {
      if (e.dead || !m.vis[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (!e.aggro && d > 8.5) continue;
      if (d < td) { td = d; tgt = e; }
    }
    const reach = maxReach(s), ranged = reach >= 4, hpF = p.hp / st.maxHp;
    // Atasco: si no avanza, empuja en una dirección al azar
    ap.stuckT += dt;
    if (ap.stuckT > 1.2) {
      if (Math.hypot(p.x - ap.lx, p.y - ap.ly) < 0.3 && ap.goal && ap.goal !== 'hold') { ap.jig = 0.5; const a = s.rng() * TAU; ap.jx = Math.cos(a); ap.jy = Math.sin(a); ap.path = null; }
      ap.stuckT = 0; ap.lx = p.x; ap.ly = p.y;
    }
    if (ap.jig > 0) { ap.jig -= dt; out.mx = ap.jx; out.my = ap.jy; return out; }

    if (tgt) {
      ap.goal = 'fight';
      const toward = () => tgt.hasLos ? [(tgt.x - p.x) / td, (tgt.y - p.y) / td] : (pathDir(s, ap, (x, y) => x === Math.floor(tgt.x) && y === Math.floor(tgt.y), 'e' + tgt.id) || [0, 0]);
      let d = [0, 0];
      if (ranged) {
        const want = Math.min(reach * 0.72, 6);
        if (td < want - 0.7) d = escapeDir(s);
        else if (td > reach * 0.92 || !tgt.hasLos) d = toward();
        else {
          ap.strafeT -= dt;
          if (ap.strafeT <= 0) { ap.strafeT = 1 + s.rng() * 1.5; ap.strafe *= -1; }
          const a = Math.atan2(tgt.y - p.y, tgt.x - p.x) + Math.PI / 2 * ap.strafe;
          if (!blockedDir(s, Math.cos(a), Math.sin(a), 0.8)) d = [Math.cos(a) * 0.6, Math.sin(a) * 0.6]; else ap.strafe *= -1;
          ap.goal = 'hold';
        }
      } else {
        let close = 0;
        for (const e of s.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 2.5) close++;
        if (hpF < 0.25 && close >= 3) d = escapeDir(s);
        else if (td - tgt.r > reach * 0.7 || !tgt.hasLos) d = toward();
        else ap.goal = 'hold';
      }
      // Esquivar golpes y proyectiles con la voltereta
      if (p.dashCd <= 0) {
        let danger = hpF < 0.4 && td < 1.6;
        if (!danger) for (const b of s.eproj) { const bx = p.x - b.x, by = p.y - b.y; if (bx * bx + by * by < 2.2 && bx * b.vx + by * b.vy > 0) { danger = true; break; } }
        if (!danger && tgt.boss && tgt.act && (tgt.act.type === 'slam' || tgt.act.type === 'charge') && td < 3) danger = true;
        if (danger) { d = escapeDir(s); out.dash = true; }
      }
      out.mx = d[0]; out.my = d[1];
      return out;
    }

    // Fuera de combate: pociones, armas mejores, explorar, escaleras
    const seenAt = it => m.seen[Math.floor(it.y) * m.w + Math.floor(it.x)];
    let dir = null;
    if (hpF < 0.75) {
      const pots = s.items.filter(it => it.kind === 'potion' && seenAt(it));
      if (pots.length) { ap.goal = 'potion'; dir = pathDir(s, ap, (x, y) => pots.some(it => Math.floor(it.x) === x && Math.floor(it.y) === y), 'pot'); }
    }
    if (!dir) {
      const ws = s.items.filter(it => it.kind === 'weapon' && seenAt(it));
      if (ws.length) { ap.goal = 'weapon'; dir = pathDir(s, ap, (x, y) => ws.some(it => Math.floor(it.x) === x && Math.floor(it.y) === y), 'wpn'); }
    }
    if (!dir) {
      const loot = s.items.filter(it => ((it.kind === 'chest' && !it.open) || it.kind === 'gold' || (it.kind === 'potion' && p.potions < st.potionCap)) && seenAt(it));
      if (loot.length) { ap.goal = 'loot'; dir = pathDir(s, ap, (x, y) => loot.some(it => Math.floor(it.x) === x && Math.floor(it.y) === y), 'loot'); }
    }
    if (!dir && (s.floorTime < 90 || s.stairsLocked)) {
      const W = m.w;
      ap.goal = 'explore';
      const T = m.tiles, F = G.FLOOR;
      const unseenFloor = j => !m.seen[j] && T[j] === F;
      dir = pathDir(s, ap, (x, y, i) => m.seen[i] && ((x > 0 && unseenFloor(i - 1)) || (x < W - 1 && unseenFloor(i + 1)) || (y > 0 && unseenFloor(i - W)) || (y < m.h - 1 && unseenFloor(i + W))), 'explore');
    }
    if (!dir && s.stairsLocked && s.boss) {
      ap.goal = 'boss';
      const bx = Math.floor(s.boss.x), by = Math.floor(s.boss.y);
      dir = pathDir(s, ap, (x, y) => Math.abs(x - bx) + Math.abs(y - by) <= 1, 'boss');
    }
    if (!dir && !s.stairsLocked) dir = stairsDir(s, ap);
    if (dir) { out.mx = dir[0]; out.my = dir[1]; }
    return out;
  }
  function stairsDir(s, ap) {
    const p = s.player, m = s.map;
    ap.goal = 'stairs';
    const sx = m.stairs.x, sy = m.stairs.y;
    const dd = Math.hypot(sx + 0.5 - p.x, sy + 0.5 - p.y);
    return dd < 1.2 ? [(sx + 0.5 - p.x) / (dd || 1), (sy + 0.5 - p.y) / (dd || 1)] : pathDir(s, ap, (x, y) => x === sx && y === sy, 'stairs');
  }
  /* Lista de la compra del piloto automático, por prioridad. */
  function shopWishes(s) {
    const p = s.player, st = s.stats, out = [];
    for (const it of s.items) {
      if (it.kind !== 'shop' || it.sold || G.shopCheck(s, it)) continue;
      let sc = 0;
      switch (it.cat) {
        case 'heal': sc = p.hp / st.maxHp < 0.55 ? 100 : 0; break;
        case 'companion': sc = ownComp(s, it.comp) ? 60 : s.companions.length < st.compSlots ? 85 : 0; break;
        case 'weapon': sc = G.bestSlotFor(s, it.w) ? 75 : 0; break;
        case 'relic': sc = 55; break;
        case 'tome': sc = 45; break;
        case 'potion': sc = p.potions < st.potionCap ? 30 : 0; break;
      }
      if (sc > 0) out.push([sc, it]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.map(x => x[1]);
  }
  G.shopWishes = shopWishes;
  function autoShop(s, ap, out) {
    const p = s.player;
    const goal = s.floorTime < 45 ? shopWishes(s)[0] : null;
    let dir;
    if (goal) {
      ap.goal = 'shop';
      if (s.near === goal) { G.buy(s, goal.id, goal.cat === 'weapon' ? G.bestSlotFor(s, goal.w) : null); ap.path = null; return out; }
      const dd = Math.hypot(goal.x - p.x, goal.y - p.y);
      if (dd < 0.25) return out;
      const tx = Math.floor(goal.x), ty = Math.floor(goal.y);
      dir = dd < 1.4 ? [(goal.x - p.x) / dd, (goal.y - p.y) / dd] : pathDir(s, ap, (x, y) => x === tx && y === ty, 'shop' + goal.id);
    } else dir = stairsDir(s, ap);
    if (dir) { out.mx = dir[0]; out.my = dir[1]; }
    return out;
  }
})(window.G);
