'use strict';
/* =========================================================================
   DUNGEONMESS · Interfaz: pantallas, HUD, controles y bucle principal
   ========================================================================= */
(function (G) {
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const R = G.createRenderer(canvas);
  const DT = 1 / 60;

  let meta = G.loadMeta();
  let run = null;        // partida en curso
  let attract = null;    // partida de demostración tras la portada
  let mode = 'title';    // title | run | tree
  let deathTimer = 0;

  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('touch');
  G.Audio.setEnabled(meta.settings.sound);
  $('version').textContent = 'v' + G.VERSION;

  const fmt = G.fmt;
  const fmtMult = x => (x < 10 ? G.dec(x, 1).replace(/,0$/, '') : fmt(x));
  const autopilotUnlocked = () => G.lvl(meta, 'f7') > 0;
  const save = () => G.saveMeta(meta);
  const show = (id, v) => { $(id).hidden = !v; };

  /* =================== Portada =================== */
  function makeAttract() {
    const am = G.emptyMeta();
    Object.assign(am.skills, { a1: 6, p1: 6, v1: 6, v2: 4, d1: 3, a4: 3 });
    return G.newRun(am, { attract: true, autopilot: true, startFloor: 1 + 3 * Math.floor(Math.random() * 4) });
  }
  function refreshTitle() {
    $('t-best').textContent = meta.bestFloor ? 'Piso ' + meta.bestFloor : '—';
    $('t-souls').textContent = fmt(meta.souls);
    $('t-runs').textContent = String(meta.runs);
    const opts = G.startFloorOptions(meta);
    if (!opts.includes(meta.settings.startFloor)) meta.settings.startFloor = opts.filter(f => f <= meta.settings.startFloor).pop() || 1;
    show('t-startfloor', opts.length > 1);
    $('sf-val').textContent = meta.settings.startFloor;
    $('sf-minus').disabled = meta.settings.startFloor <= opts[0];
    $('sf-plus').disabled = meta.settings.startFloor >= opts[opts.length - 1];
  }
  function stepStartFloor(dir) {
    const opts = G.startFloorOptions(meta), i = opts.indexOf(meta.settings.startFloor);
    meta.settings.startFloor = opts[G.clamp(i + dir, 0, opts.length - 1)];
    save(); refreshTitle(); G.Audio.play('click');
  }
  function toTitle() {
    clearTimeout(deathTimer);
    run = null; mode = 'title';
    ['hud', 'tree', 'death', 'pause', 'levelup', 'help'].forEach(id => show(id, false));
    show('title', true);
    attract = makeAttract();
    refreshTitle();
    $('btn-start').focus({ preventScroll: true });
  }

  /* =================== Partida =================== */
  function startRun() {
    clearTimeout(deathTimer);
    G.Audio.unlock();
    const opts = G.startFloorOptions(meta);
    const sf = opts.includes(meta.settings.startFloor) ? meta.settings.startFloor : 1;
    run = G.newRun(meta, { startFloor: sf, autopilot: autopilotUnlocked() && meta.settings.auto });
    mode = 'run';
    ['title', 'tree', 'death', 'pause', 'levelup', 'help'].forEach(id => show(id, false));
    show('hud', true);
    hudCache.handsSig = ''; hudCache.pickSig = ''; hudCache.partySig = ''; hudCache.potions = ''; hudCache.floor = ''; hudCache.gold = -1; luKey = '';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function descend() {
    if (run && G.descend(run)) G.Audio.play('stairs');
  }
  /* Q y E: equipar o comprar en la mano izquierda/derecha; E también compra y renueva el mercado. */
  function interact(slot) {
    if (!run || !run.near || run.over || run.choices || run.paused) return;
    const it = run.near;
    let ok = false;
    if (it.kind === 'weapon') ok = G.equip(run, it.id, it.w.hands === 2 ? 'B' : slot);
    else if (it.kind === 'shop') {
      if (it.cat === 'weapon') ok = G.buy(run, it.id, it.w.hands === 2 ? 'B' : slot);
      else if (slot === 'R') ok = G.buy(run, it.id);
      else return;
    } else if (it.kind === 'merchant') { if (slot !== 'R') return; ok = G.reroll(run); }
    if (!ok) G.Audio.play('deny', 200);
  }
  function meltNear() {
    if (!run || !run.near || run.over || run.choices || run.paused || run.near.kind !== 'weapon') return;
    G.melt(run, run.near.id);
  }
  function drink() {
    if (!run || run.over || run.paused || run.choices) return;
    if (!G.drinkPotion(run)) G.Audio.play('deny', 200);
  }
  function toggleAuto() {
    if (!run || !autopilotUnlocked()) return;
    run.autopilot = !run.autopilot;
    meta.settings.auto = run.autopilot; save();
    showToast(run.autopilot ? 'Piloto automático' : 'Control manual', run.autopilot ? 'Puedes moverte para tomar el control un momento' : null, 1600);
  }
  function setPause(v) {
    if (!run || run.over) return;
    run.paused = v;
    show('pause', v);
    if (v) {
      $('p-sound').checked = meta.settings.sound;
      $('p-autoboons').checked = meta.settings.autoBoons;
      show('p-autoboons-row', autopilotUnlocked());
      buildInventory();
      $('p-resume').focus({ preventScroll: true });
    }
  }

  /* =================== Avisos =================== */
  let toastTimer = 0;
  function showToast(main, small, ms) {
    const el = $('toast');
    el.innerHTML = '';
    el.append(document.createTextNode(main));
    if (small) { const s = document.createElement('small'); s.textContent = small; el.append(s); }
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
  }

  /* =================== Eventos del motor =================== */
  function handleEvents(s) {
    const A = G.Audio;
    for (const ev of s.events) {
      switch (ev.type) {
        case 'floor': {
          let sub = `Amenaza ×${fmtMult(G.threat(ev.floor))}`;
          if (ev.floor % 5 === 0) sub = 'Un guardián custodia las escaleras';
          else if (meta.runs === 0 && ev.floor === 1) sub = isTouch ? 'Arrastra en la mitad izquierda para moverte. Tus armas atacan solas.' : 'Muévete con WASD. Tus armas atacan solas.';
          showToast(`Piso ${ev.floor}`, sub);
          break;
        }
        case 'swing': A.play(ev.heavy ? 'heavy' : 'swing', 70); break;
        case 'shoot': A.play(ev.icon === 'wand' || ev.icon === 'staff' ? 'magic' : 'shoot', 70); break;
        case 'hit': A.play('hit', 55); break;
        case 'crit': A.play('crit', 80); break;
        case 'hurt': A.play('hurt', 140); break;
        case 'kill': A.play('kill', 70); break;
        case 'block': A.play('block'); break;
        case 'potion': A.play('potion'); break;
        case 'potionget': A.play('pickup', 120); break;
        case 'coin': A.play('coin', 55); break;
        case 'chest': A.play('chest'); break;
        case 'melt': A.play('melt'); break;
        case 'buy': A.play('buy'); break;
        case 'reroll': A.play('reroll'); break;
        case 'fairy': A.play('fairy', 400); break;
        case 'complvl': showToast(ev.comp.d.name, `Sube a nivel ${ev.comp.lvl}`, 1500); break;
        case 'shop':
          A.play('stairs');
          showToast('Mercado', run && run.shopVisits === 1 && meta.runs < 3 ? 'Acércate a una mesa para ver qué vende. El oro se pierde al caer.' : `Entre el piso ${ev.floor} y el ${ev.floor + 1}`, 2800);
          break;
        case 'equip': A.play('pickup'); break;
        case 'dash': A.play('dash'); break;
        case 'levelup': A.play('level', 400); break;
        case 'eshoot': A.play('eshoot', 110); break;
        case 'slam': A.play('slam'); break;
        case 'bossaggro': A.play('boss'); if (s.boss) showToast(s.boss.name, `Guardián del piso ${s.floor}`, 2600); break;
        case 'bossdown': A.play('bossdown'); showToast('Las escaleras se abren', 'El guardián ha caído', 2600); break;
        case 'revive': showToast('¡Revives!', null, 1600); break;
        case 'death':
          A.play('death');
          deathTimer = setTimeout(showDeath, ev.abandoned ? 150 : 1300);
          break;
      }
    }
    s.events.length = 0;
  }

  /* =================== HUD =================== */
  const hudCache = { lvl: -1, hpText: '', hpW: -1, xpW: -1, floor: '', souls: -1, kills: -1, gold: -1, potions: '', partySig: '', handsSig: '', pickSig: '', stairs: null, miniT: 0, bossW: -1, auto: null };
  const handEls = {};

  function updateHud(dt) {
    const s = run, p = s.player, st = s.stats;
    if (hudCache.lvl !== p.lvl) { hudCache.lvl = p.lvl; $('hud-lvl').textContent = p.lvl; }
    const hpText = `${fmt(Math.max(0, p.hp))} / ${fmt(st.maxHp)}`;
    if (hpText !== hudCache.hpText) { hudCache.hpText = hpText; $('hp-text').textContent = hpText; }
    const hpW = Math.round(G.clamp(p.hp / st.maxHp, 0, 1) * 1000) / 10;
    if (hpW !== hudCache.hpW) { hudCache.hpW = hpW; $('hp-fill').style.width = hpW + '%'; }
    const xpW = Math.round(G.clamp(p.xp / p.xpNext, 0, 1) * 1000) / 10;
    if (xpW !== hudCache.xpW) { hudCache.xpW = xpW; $('xp-fill').style.width = xpW + '%'; }
    const fkey = s.floor + (s.shop ? 'm' : '');
    if (hudCache.floor !== fkey) {
      hudCache.floor = fkey;
      $('hud-floor').textContent = s.shop ? 'Mercado' : 'Piso ' + s.floor;
      $('hud-threat').textContent = s.shop ? `Entre los pisos ${s.floor} y ${s.floor + 1}` : 'Amenaza ×' + fmtMult(G.threat(s.floor));
    }
    const gold = Math.floor(s.gold);
    if (gold !== hudCache.gold) { hudCache.gold = gold; $('hud-gold').textContent = fmt(gold); }
    const pkey = p.potions + '/' + st.potionCap;
    if (pkey !== hudCache.potions) {
      hudCache.potions = pkey;
      $('potion-count').textContent = pkey;
      $('btn-potion').classList.toggle('empty', p.potions <= 0);
    }
    const party = s.companions.map(c => c.type + c.lvl).join(',') + '|' + Object.keys(p.relics).join(',');
    if (party !== hudCache.partySig) { hudCache.partySig = party; buildParty(); }
    const souls = Math.floor(s.souls);
    if (souls !== hudCache.souls) { hudCache.souls = souls; $('hud-souls').textContent = fmt(souls); }
    if (s.kills !== hudCache.kills) { hudCache.kills = s.kills; $('hud-kills').textContent = fmt(s.kills); }

    hudCache.miniT -= dt;
    if (hudCache.miniT <= 0) { hudCache.miniT = 0.2; R.drawMinimap($('minimap'), s); }

    // Piloto automático
    const unlocked = autopilotUnlocked();
    show('btn-auto', unlocked);
    if (hudCache.auto !== s.autopilot) { hudCache.auto = s.autopilot; $('btn-auto').setAttribute('aria-pressed', String(!!s.autopilot)); }

    // Jefe
    const bossOn = !!(s.boss && s.boss.aggro && !s.over);
    show('boss-bar', bossOn);
    if (bossOn) {
      $('boss-name').textContent = s.boss.name;
      const bw = Math.round(G.clamp(s.boss.hp / s.boss.maxHp, 0, 1) * 1000) / 10;
      if (bw !== hudCache.bossW) { hudCache.bossW = bw; $('boss-fill').style.width = bw + '%'; }
    }

    // Manos
    const sig = handSig(p) + '|' + p.lvl + '|' + s.floor;
    if (sig !== hudCache.handsSig) { hudCache.handsSig = sig; buildHands(); }
    for (const [k, w] of G.attackSlots(p)) {
      const el = handEls[k];
      if (el) el.style.width = (G.clamp(1 - p.cd[k] / w.cd, 0, 1) * 100).toFixed(1) + '%';
    }

    // Ficha de lo que tienes delante: arma del suelo, mesa del mercado o mercader
    const near = !s.over && !s.choices && s.near;
    if (near) {
      const psig = near.id + '|' + sig + '|' + gold + '|' + pkey + '|' + party + '|' + (p.hp >= st.maxHp) + '|' + (near.sold ? 1 : 0) + '|' + (near.relic || near.boon || near.comp || '') + '|' + (near.w ? near.w.uid : '') + '|' + s.rerolls;
      if (psig !== hudCache.pickSig) { hudCache.pickSig = psig; buildCard(near); }
      show('pickup', true);
    } else { show('pickup', false); hudCache.pickSig = ''; }
    if (isTouch) {
      const lift = near ? $('pickup').offsetHeight + 12 : 0;
      if (lift !== hudCache.lift) { hudCache.lift = lift; document.body.style.setProperty('--card-lift', lift + 'px'); }
    }

    // Escaleras
    const st2 = s.onStairs && !s.over ? (G.nextStop(s) === 'shop' ? 'Bajar al mercado' : `Bajar al piso ${s.floor + 1}`) : null;
    if (st2 !== hudCache.stairs) {
      hudCache.stairs = st2;
      const b = $('btn-stairs');
      if (st2) { b.innerHTML = ''; b.append(document.createTextNode(st2 + ' ')); const k = document.createElement('kbd'); k.textContent = 'F'; b.append(k); }
      show('btn-stairs', !!st2);
    }

    // Subida de nivel
    if (s.choices && !(s.autopilot && meta.settings.autoBoons) && !s.over) openLevelup();
    else if (!$('levelup').hidden) show('levelup', false);
  }

  function handSig(p) { const h = p.hands; return (h.L ? h.L.uid : 0) + ':' + (h.R ? h.R.uid : 0); }

  function iconCanvas(w, size) {
    const cv = document.createElement('canvas'), k = 2;
    cv.width = cv.height = size * k;
    const c = cv.getContext('2d'); c.scale(k, k);
    if (w) G.drawWeaponIcon(c, w.icon, size, G.RARITIES[w.rarity].color);
    return cv;
  }

  function buildHands() {
    const s = run, p = s.player, h = p.hands, el = $('hands');
    el.innerHTML = '';
    for (const k in handEls) delete handEls[k];
    const two = h.L && h.L === h.R;
    const slot = (k, w, label) => {
      const d = document.createElement('div');
      d.className = 'hand' + (two ? ' two' : '') + (w ? '' : ' empty');
      d.append(iconCanvas(w, 44));
      const name = document.createElement('div'); name.className = 'h-name';
      name.textContent = w ? w.name : 'Mano libre';
      if (w) name.style.color = G.RARITIES[w.rarity].color;
      const m = document.createElement('div'); m.className = 'h-meta';
      if (!w) m.textContent = label;
      else if (w.kind === 'shield') m.textContent = `${label}, bloquea ${Math.round(w.block * 100)}%`;
      else m.textContent = `${label}, ${fmt(G.weaponDps(s, w, s.stats.dualActive && !two))} daño/s`;
      d.append(name, m);
      if (w && w.kind !== 'shield') {
        const cd = document.createElement('div'); cd.className = 'h-cd';
        const i = document.createElement('i'); cd.append(i); d.append(cd);
        handEls[k] = i;
      }
      el.append(d);
    };
    if (two) slot('B', h.L, 'A dos manos');
    else { slot('L', h.L, 'Izquierda'); slot('R', h.R, 'Derecha'); }
  }

  /* Lienzo con un icono dibujado por fn(c, r) centrado. */
  function drawnCanvas(size, fn) {
    const cv = document.createElement('canvas'), k = 2;
    cv.width = cv.height = size * k;
    const c = cv.getContext('2d'); c.scale(k, k); c.translate(size / 2, size / 2);
    fn(c, size * 0.42);
    return cv;
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function cardHead(card, icon, name, sub, color) {
    card.style.setProperty('--r', color);
    const head = el('div', 'pk-head'), info = el('div');
    info.append(el('div', 'pk-name', name), el('div', 'pk-sub', sub));
    head.append(icon, info);
    card.append(head);
  }
  function actionButton(key, label, extra, extraCls, why, onClick) {
    const b = el('button');
    const top = el('span');
    if (key) top.append(el('kbd', null, key), document.createTextNode(' '));
    top.append(document.createTextNode(label));
    b.append(top);
    if (extra) b.append(el('span', extraCls, extra));
    if (why) { b.disabled = true; b.append(el('span', 'why', why)); }
    b.addEventListener('click', onClick);
    return b;
  }

  function buildCard(it) {
    if (it.kind === 'weapon') buildWeaponCard(it.w, it, null);
    else if (it.kind === 'merchant') buildMerchantCard();
    else if (it.cat === 'weapon') buildWeaponCard(it.w, null, it);
    else buildShopCard(it);
  }

  function buildMerchantCard() {
    const s = run, card = $('pickup'); card.innerHTML = '';
    cardHead(card, drawnCanvas(52, (c, r) => G.drawMerchant(c, r * 0.95, 0)), 'Mercader', 'Renueva las mesas', '#b98be8');
    card.append(el('p', 'pk-desc', 'Cambia las armas, reliquias, el pergamino y el compañero que queden sin vender. Cada vez cuesta más.'));
    const price = G.rerollPrice(s), why = s.gold < price ? `Te faltan ${fmt(price - s.gold)} de oro` : null;
    const acts = el('div', 'pk-actions');
    acts.append(actionButton('E', 'Renovar existencias', `${fmt(price)} de oro`, 'cost', why, () => { if (run) G.reroll(run); }));
    card.append(acts);
  }

  function buildShopCard(it) {
    const s = run, p = s.player, st = s.stats, card = $('pickup'); card.innerHTML = '';
    const icon = drawnCanvas(52, (c, r) => G.drawShopItem(c, it, r, 0));
    let name = '', sub = '', desc = '', note = '', label = 'Comprar', color = '#f4b860';
    if (it.cat === 'relic') {
      const R = G.RELIC_MAP[it.relic]; name = R.name; sub = 'Reliquia pasiva, dura toda la partida'; desc = R.desc; color = R.color;
    } else if (it.cat === 'tome') {
      const B = G.BOON_MAP[it.boon], have = p.boons[it.boon] || 0;
      name = `Pergamino de ${B.name}`; sub = 'Mejora para esta partida'; desc = B.desc; note = have ? `Ya tienes ${have}.` : 'Aún no la tienes.';
    } else if (it.cat === 'companion') {
      const D = G.COMPANIONS[it.comp], own = G.ownComp(s, it.comp), lvl = own ? own.lvl + 1 : 1, fake = { d: D, lvl };
      name = D.name; color = D.color;
      sub = own ? `Compañero, sube a nivel ${lvl}` : 'Compañero';
      desc = D.desc + (D.kind === 'heal' ? `: un ${Math.round(G.compHeal(s, fake) * 100)}% de la vida.` : `. Unos ${fmt(D.dmg * G.compPower(s, fake))} de daño por golpe.`);
      const out = G.compReplaced(s, it.comp);
      note = 'Los compañeros son espíritus: no pueden morir.' + (out ? ` Sustituye a ${out.d.name} (nivel ${out.lvl}).` : '');
      label = own ? 'Subir de nivel' : 'Contratar';
    } else if (it.cat === 'potion') {
      name = 'Poción'; sub = 'Se guarda en el cinturón'; desc = `Cura un ${Math.round(G.BAL.potionHeal * 100)}% de la vida cuando la bebas.`;
      note = `Quedan ${it.stock}. Llevas ${p.potions} de ${st.potionCap}.`; color = '#d9533c';
    } else if (it.cat === 'heal') {
      name = 'Bendición'; sub = 'Efecto inmediato'; desc = 'Recupera toda la vida ahora mismo.'; color = '#e86a58';
    }
    cardHead(card, icon, name, sub, color);
    card.append(el('p', 'pk-desc', desc));
    if (note) card.append(el('p', 'pk-note', note));
    const price = G.shopPrice(s, it), why = G.shopCheck(s, it);
    const acts = el('div', 'pk-actions');
    acts.append(actionButton('E', label, `${fmt(price)} de oro`, 'cost', why, () => { if (run && !G.buy(run, it.id)) G.Audio.play('deny', 200); }));
    card.append(acts);
  }

  function buildWeaponCard(w, floorItem, shopItem) {
    const s = run, st = s.stats, RR = G.RARITIES[w.rarity], card = $('pickup');
    card.innerHTML = '';
    const sub = w.kind === 'shield' ? `${RR.name}, escudo de una mano` : `${RR.name}, ${G.KIND_LABEL[w.kind]}, ${w.hands === 2 ? 'a dos manos' : 'a una mano'}, nivel ${w.ilvl}`;
    cardHead(card, iconCanvas(w, 52), w.name, sub, RR.color);
    const el2 = card;
    if (w.kind !== 'shield') {
      const ul = document.createElement('ul'); ul.className = 'pk-stats';
      const perHit = w.dmg * st.dmg * (w.kind === 'melee' ? st.melee : st.ranged) * (w.hands === 2 ? st.twoHand : 1);
      const rows = [['Daño', fmt(perHit)], ['Ataques/s', G.dec(st.atkSpd / w.cd, 1)], ['Alcance', G.dec(G.effRange(s, w), 1)]];
      for (const [a, b] of rows) { const li = document.createElement('li'); li.append(document.createTextNode(a + ' ')); const bb = document.createElement('b'); bb.textContent = b; li.append(bb); ul.append(li); }
      el2.append(ul);
    }
    const traits = G.weaponTraits(w);
    if (traits.length) {
      const ul = document.createElement('ul'); ul.className = 'pk-traits';
      for (const t of traits) { const li = document.createElement('li'); li.textContent = t; ul.append(li); }
      el2.append(ul);
    }
    const price = shopItem ? G.shopPrice(s, shopItem) : 0, why = shopItem ? G.shopCheck(s, shopItem) : null;
    if (shopItem) {
      const pr = el('div', 'pk-price'); pr.append(document.createTextNode('Precio'));
      pr.append(el('b', s.gold < price ? 'poor' : '', `${fmt(price)} de oro`));
      card.append(pr);
    }
    const cur = G.loadoutDps(s, s.player.hands);
    const acts = el('div', 'pk-actions');
    for (const o of G.equipOptions(s, w)) {
      const label = (shopItem ? 'Comprar ' : '') + (o.slot === 'B' ? (shopItem ? 'a dos manos' : 'Empuñar a dos manos') : o.slot === 'L' ? (shopItem ? 'para la izquierda' : 'Mano izquierda') : (shopItem ? 'para la derecha' : 'Mano derecha'));
      const delta = o.dps - cur, rel = cur > 0 ? delta / cur : 1;
      const dtext = Math.abs(rel) < 0.01 ? 'Mismo daño/s' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} daño/s`;
      const b = actionButton(o.slot === 'L' ? 'Q' : 'E', label, dtext, 'delta ' + (Math.abs(rel) < 0.01 ? 'same' : delta > 0 ? 'up' : 'down'), why, () => {
        if (!run) return;
        if (shopItem) { if (!G.buy(run, shopItem.id, o.slot)) G.Audio.play('deny', 200); }
        else G.equip(run, floorItem.id, o.slot);
      });
      if (o.drops.length) b.append(el('span', 'pk-drop', 'Sueltas ' + o.drops.map(x => x.name).join(' y ')));
      acts.append(b);
    }
    if (floorItem) {
      const b = actionButton('X', 'Fundir', `+${fmt(G.meltValue(s, w))} de oro`, 'cost', null, () => { if (run) G.melt(run, floorItem.id); });
      b.classList.add('melt');
      acts.append(b);
    }
    card.append(acts);
  }

  /* Compañeros y reliquias bajo la barra de vida */
  function buildParty() {
    const s = run, box = $('party');
    box.innerHTML = '';
    for (const c of s.companions) {
      const chip = el('span', 'chip-comp');
      chip.title = `${c.d.name}, nivel ${c.lvl}`;
      chip.append(drawnCanvas(22, (cx, r) => G.drawCompanion(cx, c.type, r * (c.type === 'golem' ? 0.7 : 0.55), 0, 0)), document.createTextNode(String(c.lvl)));
      box.append(chip);
    }
    for (const id of Object.keys(s.player.relics)) {
      const chip = el('span', 'chip-relic');
      chip.title = `${G.RELIC_MAP[id].name}: ${G.RELIC_MAP[id].desc}`;
      chip.append(drawnCanvas(22, (cx, r) => G.drawRelic(cx, id, r)));
      box.append(chip);
    }
  }

  /* Inventario de la partida en la pantalla de pausa */
  function buildInventory() {
    const s = run, p = s.player, box = $('p-inv');
    box.innerHTML = '';
    box.append(el('h3', null, 'Esta partida'));
    const g = el('div', 'gold-line'); g.append(document.createTextNode('Oro '), el('b', null, fmt(s.gold)), document.createTextNode(`  (${fmt(s.goldEarned)} reunido)`));
    box.append(g);
    const list = (title, items, empty) => {
      box.append(el('h3', null, title));
      if (!items.length) { box.append(el('p', 'empty-line', empty)); return; }
      const ul = el('ul');
      for (const [icon, name, desc] of items) { const li = el('li'); li.append(icon, el('b', null, name), el('span', null, desc)); ul.append(li); }
      box.append(ul);
    };
    list('Compañeros', s.companions.map(c => [drawnCanvas(30, (cx, r) => G.drawCompanion(cx, c.type, r * (c.type === 'golem' ? 0.7 : 0.55), 0, 0)), `${c.d.name}, nivel ${c.lvl}`, c.d.desc]), 'Ninguno. Se contratan en el mercado.');
    list('Reliquias', Object.keys(p.relics).map(id => [drawnCanvas(30, (cx, r) => G.drawRelic(cx, id, r)), G.RELIC_MAP[id].name, G.RELIC_MAP[id].desc]), 'Ninguna. Se compran en el mercado.');
    box.append(el('h3', null, 'Mejoras'));
    const boons = Object.entries(p.boons);
    if (!boons.length) box.append(el('p', 'empty-line', 'Ninguna todavía.'));
    else { const bl = el('div', 'boon-list'); for (const [id, n] of boons) bl.append(el('span', null, n > 1 ? `${G.BOON_MAP[id].name} ×${n}` : G.BOON_MAP[id].name)); box.append(bl); }
  }

  /* =================== Subida de nivel =================== */
  let luKey = '';
  function openLevelup() {
    const s = run, key = s.choices.join(',') + '|' + s.player.lvl;
    if (key === luKey && !$('levelup').hidden) return;
    luKey = key;
    $('lu-title').textContent = `Nivel ${s.player.lvl + 1}`;
    const box = $('lu-cards'); box.innerHTML = '';
    s.choices.forEach((id, i) => {
      const b = G.BOON_MAP[id], have = s.player.boons[id] || 0;
      const card = document.createElement('button'); card.className = 'card';
      const k = document.createElement('kbd'); k.textContent = String(i + 1);
      const n = document.createElement('span'); n.className = 'c-name'; n.textContent = b.name;
      const d = document.createElement('span'); d.className = 'c-desc'; d.textContent = b.desc;
      const h = document.createElement('span'); h.className = 'c-have'; h.textContent = have ? `Ya tienes ${have}` : 'Nueva';
      card.append(k, n, d, h);
      card.addEventListener('click', () => pickBoon(id));
      box.append(card);
    });
    show('levelup', true);
  }
  function pickBoon(id) {
    if (!run || !run.choices) return;
    G.chooseBoon(run, id);
    G.Audio.play('click');
    luKey = '';
    show('levelup', false);
  }

  /* =================== Muerte =================== */
  function showDeath() {
    if (!run || !run.result) return;
    const r = run.result;
    $('d-title').textContent = r.abandoned ? `Abandonaste en el piso ${r.floor}` : `Caíste en el piso ${r.floor}`;
    let sub = r.record ? 'Nuevo récord de profundidad.' : `Tu récord sigue en el piso ${meta.bestFloor}.`;
    if (!r.abandoned && run.killedBy) sub += ` Último golpe: ${run.killedBy}.`;
    $('d-sub').textContent = sub;
    const mins = Math.floor(r.time / 60), secs = Math.floor(r.time % 60);
    const rows = [
      ['Almas ganadas', '+' + fmt(r.souls), 'souls'],
      ['Almas disponibles', fmt(meta.souls), ''],
      ['Oro reunido', fmt(r.gold || 0), ''],
      ['Pisos bajados', String(Math.max(0, r.floor - r.startFloor)), ''],
      ['Enemigos', fmt(r.kills), ''],
      ['Nivel', String(r.level), ''],
      ['Tiempo', `${mins}:${String(secs).padStart(2, '0')}`, ''],
    ];
    const dl = $('d-stats'); dl.innerHTML = '';
    for (const [a, b, cls] of rows) {
      const d = document.createElement('div'); if (cls) d.className = cls;
      const dt = document.createElement('dt'); dt.textContent = a;
      const dd = document.createElement('dd'); dd.textContent = b;
      d.append(dt, dd); dl.append(d);
    }
    ['pause', 'levelup'].forEach(id => show(id, false));
    show('death', true);
    $('d-again').focus({ preventScroll: true });
  }

  /* =================== Árbol de habilidades ===================
     El zoom escala las posiciones, no los nodos: así los textos siguen legibles. */
  const U = 118;
  const tv = { x: 0, y: 0, z: 1 };
  let selected = 'root', treeBuilt = false, resetArmed = false;
  const nodeEls = {}, lineEls = [], labelEls = [];

  function nodePos(n) {
    if (n.depth === 0) return [0, 0];
    const B = G.BRANCHES[n.branch];
    const ang = (B.angle + n.slot * 32 / n.depth) * Math.PI / 180;
    const r = [0, 1.55, 2.75, 3.95, 5.15][n.depth] * U;
    return [Math.cos(ang) * r, Math.sin(ang) * r];
  }
  function labelPos(B) { const a = B.angle * Math.PI / 180; return [Math.cos(a) * 6.6 * U, Math.sin(a) * 6.6 * U]; }
  function buildTree() {
    const world = $('tree-world'), svg = $('tree-lines');
    for (const key of Object.keys(G.BRANCHES)) {
      if (key === 'root') continue;
      const B = G.BRANCHES[key];
      const lab = document.createElement('div'); lab.className = 'branch-label';
      lab.textContent = B.name; lab.style.setProperty('--c', B.color);
      world.append(lab); labelEls.push([lab, B]);
    }
    for (const n of G.SKILLS) {
      if (!n.req) continue;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.style.setProperty('--c', G.BRANCHES[n.branch].color);
      svg.append(ln); lineEls.push([ln, n]);
    }
    for (const n of G.SKILLS) {
      const b = document.createElement('button');
      b.className = 'node' + (n.id === 'root' ? ' root' : '');
      b.style.setProperty('--c', G.BRANCHES[n.branch].color);
      b.setAttribute('aria-label', n.name);
      const lv = document.createElement('span'); lv.className = 'lv';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = n.name;
      b.append(lv, nm);
      b.addEventListener('click', () => { if (dragMoved) return; selected = n.id; resetArmed = false; refreshTree(); G.Audio.play('click'); });
      world.append(b);
      nodeEls[n.id] = b;
    }
    treeBuilt = true;
  }
  function layoutTree() {
    const z = tv.z;
    for (const n of G.SKILLS) { const [x, y] = nodePos(n); const el = nodeEls[n.id]; el.style.left = (x * z) + 'px'; el.style.top = (y * z) + 'px'; }
    for (const [lab, B] of labelEls) { const [x, y] = labelPos(B); lab.style.left = (x * z) + 'px'; lab.style.top = (y * z) + 'px'; }
    for (const [ln, n] of lineEls) {
      const [x1, y1] = nodePos(G.SKILL_MAP[n.req[0]]), [x2, y2] = nodePos(n);
      ln.setAttribute('x1', x1 * z); ln.setAttribute('y1', y1 * z); ln.setAttribute('x2', x2 * z); ln.setAttribute('y2', y2 * z);
    }
    $('tree-world').style.transform = `translate(${tv.x}px, ${tv.y}px)`;
  }
  function refreshTree() {
    $('tr-souls').textContent = fmt(meta.souls);
    for (const n of G.SKILLS) {
      const el = nodeEls[n.id], state = G.skillState(meta, n), l = G.lvl(meta, n.id);
      const cost = n.max ? G.skillCost(n, l) : 0;
      el.classList.toggle('locked', state === 'locked');
      el.classList.toggle('available', state === 'available');
      el.classList.toggle('affordable', state === 'available' && meta.souls >= cost);
      el.classList.toggle('maxed', state === 'maxed');
      el.classList.toggle('sel', n.id === selected);
      el.style.setProperty('--p', n.max ? Math.round(l / n.max * 100) : 0);
      el.querySelector('.lv').textContent = n.id === 'root' ? '' : `${l}/${n.max}`;
    }
    for (const [ln, n] of lineEls) {
      const st = G.skillState(meta, n);
      ln.classList.toggle('on', G.lvl(meta, n.id) > 0);
      ln.classList.toggle('near', G.lvl(meta, n.id) === 0 && st === 'available');
    }
    renderDetail();
  }
  function renderDetail() {
    const n = G.SKILL_MAP[selected], el = $('tree-detail'), B = G.BRANCHES[n.branch];
    el.style.setProperty('--c', B.color);
    el.innerHTML = '';
    const head = document.createElement('div'); head.className = 'td-head';
    const nm = document.createElement('span'); nm.className = 'td-name'; nm.textContent = n.name;
    head.append(nm);
    const rows = document.createElement('div'); rows.className = 'td-rows';
    const acts = document.createElement('div'); acts.className = 'td-actions';
    const row = (label, text, cls) => {
      const d = document.createElement('div'); if (cls) d.className = cls;
      if (label) { d.append(document.createTextNode(label + ' ')); const b = document.createElement('b'); b.textContent = text; d.append(b); }
      else d.textContent = text;
      rows.append(d);
    };
    if (n.id === 'root') {
      row(null, n.fx(0));
      row(null, 'Toca un nodo para ver qué hace y mejorarlo.');
      row('Récord:', meta.bestFloor ? `piso ${meta.bestFloor}` : 'aún ninguno');
      row('Almas reunidas en total:', fmt(meta.totalSouls));
      const r = document.createElement('button'); r.className = 'danger';
      r.textContent = resetArmed ? 'Pulsa otra vez para confirmar' : 'Reiniciar el árbol y recuperar las almas';
      r.addEventListener('click', () => {
        if (!resetArmed) { resetArmed = true; renderDetail(); return; }
        resetArmed = false; G.refundAll(meta); save(); G.Audio.play('buy'); refreshTree();
      });
      acts.append(r);
    } else {
      const l = G.lvl(meta, n.id), state = G.skillState(meta, n);
      const lv = document.createElement('span'); lv.className = 'td-level';
      lv.textContent = `${B.name}, nivel ${l} de ${n.max}`;
      head.append(lv);
      row('Ahora:', l > 0 ? n.fx(l) : 'sin aprender');
      if (l < n.max) row('Siguiente:', n.fx(l + 1));
      if (state === 'locked') { const req = G.SKILL_MAP[n.req[0]]; row(null, `Requiere ${req.name} a nivel ${n.req[1]}`, 'td-req'); }
      const b = document.createElement('button'); b.className = 'primary';
      if (state === 'maxed') { b.textContent = 'Nivel máximo'; b.disabled = true; }
      else {
        const cost = G.skillCost(n, l);
        if (state === 'locked') { b.textContent = `Bloqueada, cuesta ${fmt(cost)} almas`; b.disabled = true; }
        else if (meta.souls < cost) { b.textContent = `Faltan ${fmt(cost - meta.souls)} almas (cuesta ${fmt(cost)})`; b.disabled = true; }
        else b.textContent = `Mejorar por ${fmt(cost)} almas`;
        b.addEventListener('click', () => { if (G.buySkill(meta, n.id)) { save(); G.Audio.play('buy'); refreshTree(); } });
      }
      acts.append(b);
    }
    el.append(head, rows, acts);
  }
  function treeArea() {
    const vw = window.innerWidth, vh = window.innerHeight, det = $('tree-detail');
    const side = vw >= 1000;
    const top = 70, bottom = side ? 16 : (det.offsetHeight || 160) + 24, right = side ? (det.offsetWidth || 380) + 32 : 0;
    return { x: 0, y: top, w: vw - right, h: vh - top - bottom };
  }
  function fitTree() {
    const a = treeArea();
    // Extensión del árbol: nodos con su nombre y etiquetas de rama
    const ext = { l: 0, r: 0, t: 0, b: 0 };
    const grow = (x, y, mx, my) => { ext.l = Math.max(ext.l, -x + mx); ext.r = Math.max(ext.r, x + mx); ext.t = Math.max(ext.t, -y + my); ext.b = Math.max(ext.b, y + my); };
    for (const n of G.SKILLS) { const [x, y] = nodePos(n); grow(x, y, 62, 50); }
    for (const key of Object.keys(G.BRANCHES)) if (key !== 'root') { const [x, y] = labelPos(G.BRANCHES[key]); grow(x, y, 75, 22); }
    const fit = Math.min((a.w - 40) / (ext.l + ext.r), (a.h - 20) / (ext.t + ext.b));
    tv.z = G.clamp(fit, minZoom(), 1.15);
    if (fit >= minZoom()) {
      tv.x = a.x + a.w / 2 - (ext.r - ext.l) / 2 * tv.z;
      tv.y = a.y + a.h / 2 - (ext.b - ext.t) / 2 * tv.z;
    } else { tv.x = a.x + a.w / 2; tv.y = a.y + a.h / 2; }
    layoutTree();
  }
  const minZoom = () => (window.innerWidth < 700 ? 0.56 : 0.5);
  function zoomAt(f, cx, cy) {
    const nz = G.clamp(tv.z * f, minZoom() * 0.9, 1.6);
    tv.x = cx - (cx - tv.x) * nz / tv.z; tv.y = cy - (cy - tv.y) * nz / tv.z; tv.z = nz;
    layoutTree();
  }
  function applyTv() { $('tree-world').style.transform = `translate(${tv.x}px, ${tv.y}px)`; }
  function openTree() {
    clearTimeout(deathTimer);
    if (!treeBuilt) buildTree();
    mode = 'tree';
    ['title', 'death', 'hud', 'help', 'pause', 'levelup'].forEach(id => show(id, false));
    show('tree', true);
    resetArmed = false;
    refreshTree();
    requestAnimationFrame(fitTree);
  }
  // Arrastrar y hacer zoom en el árbol
  const pointers = new Map();
  let dragMoved = false, pinch0 = null;
  const view = $('tree-view');
  view.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: tv.z }; }
  });
  window.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || mode !== 'tree') return;
    const prev = pointers.get(e.pointerId), dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (Math.abs(dx) + Math.abs(dy) > 0) { tv.x += dx; tv.y += dy; applyTv(); }
      if (!dragMoved && (Math.abs(dx) + Math.abs(dy) > 3)) { dragMoved = true; view.classList.add('dragging'); }
    } else if (pointers.size === 2 && pinch0) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch0.z * d / pinch0.d) / tv.z, (a.x + b.x) / 2, (a.y + b.y) / 2);
      dragMoved = true;
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = null;
    if (!pointers.size) { view.classList.remove('dragging'); setTimeout(() => { dragMoved = false; }, 0); }
  };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  view.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });

  /* =================== Controles =================== */
  const keys = new Set();
  const modalOpen = () => !$('levelup').hidden || !$('pause').hidden || !$('help').hidden || !$('death').hidden;
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (mode === 'run' && run) {
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && !modalOpen()) e.preventDefault();
      if (!$('help').hidden) { if (k === 'escape') show('help', false); return; }
      if (!$('levelup').hidden) {
        const i = ['1', '2', '3'].indexOf(k);
        if (i >= 0 && run.choices && run.choices[i]) pickBoon(run.choices[i]);
        return;
      }
      if (k === 'escape' || k === 'p') { if (!run.over) setPause(!run.paused); return; }
      if (run.paused || run.over) return;
      if (k === ' ' || k === 'shift') run.input.dash = true;
      else if (k === 'q') interact('L');
      else if (k === 'e') interact('R');
      else if (k === 'x') meltNear();
      else if (k === 'r') drink();
      else if (k === 'f') descend();
      else if (k === 't') toggleAuto();
    } else if (k === 'escape') {
      if (!$('help').hidden) show('help', false);
      else if (mode === 'tree') toTitle();
    }
    keys.add(k);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // Joystick virtual (también funciona arrastrando con el ratón)
  let joy = null;
  const tz = $('touch-zone'), joyEl = $('joystick'), knob = joyEl.querySelector('.knob');
  const JR = 56;
  tz.addEventListener('pointerdown', e => {
    if (mode !== 'run' || !run || run.over || run.paused) return;
    G.Audio.unlock();
    if (e.pointerType !== 'mouse' && e.clientX > window.innerWidth * 0.62) return;
    joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, vx: 0, vy: 0 };
    try { tz.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
    knob.style.transform = 'translate(0px, 0px)';
    show('joystick', true);
  });
  tz.addEventListener('pointermove', e => {
    if (!joy || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0;
    const d = Math.hypot(dx, dy);
    if (d > JR) { dx = dx / d * JR; dy = dy / d * JR; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.vx = d > 6 ? dx / JR : 0;
    joy.vy = d > 6 ? dy / JR : 0;
  });
  const endJoy = e => { if (joy && e.pointerId === joy.id) { joy = null; show('joystick', false); } };
  tz.addEventListener('pointerup', endJoy);
  tz.addEventListener('pointercancel', endJoy);

  function readMove() {
    let x = 0, y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (joy) { x += joy.vx; y += joy.vy; }
    return [x, y];
  }

  /* =================== Botones =================== */
  const on = (id, fn) => $(id).addEventListener('click', e => { G.Audio.unlock(); fn(e); });
  on('btn-start', startRun);
  on('btn-tree', openTree);
  on('btn-help', () => show('help', true));
  on('h-close', () => show('help', false));
  on('sf-minus', () => stepStartFloor(-1));
  on('sf-plus', () => stepStartFloor(1));
  on('tr-close', toTitle);
  on('tz-in', () => zoomAt(1.2, window.innerWidth / 2, window.innerHeight / 2));
  on('tz-out', () => zoomAt(1 / 1.2, window.innerWidth / 2, window.innerHeight / 2));
  on('tz-fit', fitTree);
  on('btn-pause', () => setPause(true));
  on('btn-auto', toggleAuto);
  on('btn-stairs', descend);
  on('btn-dash', () => { if (run) run.input.dash = true; });
  on('btn-potion', drink);
  on('p-resume', () => setPause(false));
  on('p-help', () => show('help', true));
  on('p-quit', () => { if (run && !run.over) { show('pause', false); run.paused = false; G.abandon(run); } });
  $('p-sound').addEventListener('change', e => { meta.settings.sound = e.target.checked; G.Audio.setEnabled(meta.settings.sound); save(); });
  $('p-autoboons').addEventListener('change', e => { meta.settings.autoBoons = e.target.checked; save(); });
  on('lu-auto', () => { if (run && run.choices) pickBoon(G.autoBoonPick(run)); });
  on('d-again', startRun);
  on('d-tree', openTree);
  on('d-title-btn', toTitle);
  $('btn-dash').addEventListener('pointerdown', e => { e.preventDefault(); if (run) run.input.dash = true; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'run' && run && !run.over && !run.paused && !run.choices) setPause(true);
  });
  window.addEventListener('resize', () => { R.resize(); if (mode === 'tree') fitTree(); });

  /* =================== Bucle principal =================== */
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (mode === 'run' && run) {
      const mv = readMove();
      run.input.mx = mv[0]; run.input.my = mv[1];
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 5) { G.step(run, DT); acc -= DT; n++; }
      if (n >= 5) acc = 0;
      handleEvents(run);
      updateHud(dt);
      R.draw(run, dt);
    } else if (mode === 'title') {
      if (!attract || attract.over) attract = makeAttract();
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 3) { G.step(attract, DT); acc -= DT; n++; }
      if (n >= 3) acc = 0;
      attract.events.length = 0;
      R.draw(attract, dt);
    }
    requestAnimationFrame(frame);
  }

  // Ganchos para pruebas automáticas
  window.__dungeonmess = { get run() { return run; }, get meta() { return meta; }, startRun, openTree, toTitle, R, setMeta(m) { meta = m; save(); refreshTitle(); } };

  (function () {
    const cv = $('btn-potion').querySelector('canvas'), c = cv.getContext('2d');
    c.translate(32, 34); G.drawPotion(c, 26);
  })();

  toTitle();
  requestAnimationFrame(frame);
})(window.G);
