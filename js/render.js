'use strict';
/* =========================================================================
   DUNGEONMESS · Dibujo en canvas
   Todo se dibuja con formas vectoriales: no hace falta ningún recurso externo.
   ========================================================================= */
(function (G) {
  const TAU = Math.PI * 2;
  const C = G.COLORS = {
    abyss: '#110e17',
    floor: ['#332c3c', '#352e3e', '#372f40', '#393142', '#3b3344', '#3d3446', '#3f3648', '#41384a'],
    floorMem: ['#1b1822', '#1c1923', '#1d1a24', '#1e1b25', '#1f1b26', '#201c27', '#211d28', '#221e29'],
    wallTop: ['#4a4152', '#4c4354', '#4e4556', '#504658', '#52485a', '#544a5c', '#564c5e', '#584e60'],
    wallMem: '#2a2531', wallFace: '#2a2330', wallFaceMem: '#1a1620', brick: 'rgba(8,5,12,0.4)',
    bone: '#e9dfc8', ember: '#f4b860', blood: '#c4553b', verdigris: '#5fae9c', arcane: '#a68be0', moss: '#8bb174', gold: '#f0c35a',
    metal: '#cfd3dc', metalD: '#8b90a0', wood: '#8a5a3a', woodD: '#5e3b25',
  };

  /* ---------- Iconos de armas ----------
     Dibujados desde la empuñadura (origen) hacia +x, con longitud L. */
  G.ICON_LEN = { fists: 0.3, dagger: 0.5, sword: 0.66, axe: 0.6, mace: 0.6, greatsword: 1.0, greataxe: 0.95, spear: 1.2, hammer: 0.9,
    sling: 0.5, knives: 0.48, wand: 0.55, handxbow: 0.55, bow: 0.8, recurve: 0.8, xbow: 0.85, staff: 1.0, shield: 0.55 };

  function bar(c, x0, x1, w, color) { c.fillStyle = color; c.fillRect(x0, -w / 2, x1 - x0, w); }
  function blade(c, x0, x1, w, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(x0, -w / 2); c.lineTo(x1 - w * 1.2, -w / 2); c.lineTo(x1, 0); c.lineTo(x1 - w * 1.2, w / 2); c.lineTo(x0, w / 2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x0, -w / 2, x1 - x0 - w * 1.2, w * 0.28);
  }
  const ICONS = {
    fists(c, L) {
      c.fillStyle = '#d9c7a8'; c.beginPath(); c.arc(L * 0.5, 0, L * 0.45, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(90,60,40,0.45)'; c.lineWidth = Math.max(1, L * 0.06);
      for (const y of [-0.22, 0, 0.22]) { c.beginPath(); c.moveTo(L * 0.62, y * L); c.lineTo(L * 0.9, y * L); c.stroke(); }
    },
    dagger(c, L) { bar(c, 0, L * 0.3, L * 0.13, C.woodD); bar(c, L * 0.28, L * 0.34, L * 0.38, C.metalD); blade(c, L * 0.34, L, L * 0.16, C.metal); },
    sword(c, L) { bar(c, 0, L * 0.24, L * 0.09, C.woodD); c.fillStyle = C.metalD; c.beginPath(); c.arc(0, 0, L * 0.06, 0, TAU); c.fill(); bar(c, L * 0.22, L * 0.27, L * 0.34, C.metalD); blade(c, L * 0.27, L, L * 0.11, C.metal); },
    axe(c, L) {
      bar(c, 0, L * 0.92, L * 0.08, C.wood);
      c.fillStyle = C.metal; c.beginPath(); c.moveTo(L * 0.62, -L * 0.04); c.quadraticCurveTo(L * 0.6, -L * 0.34, L * 0.92, -L * 0.36); c.quadraticCurveTo(L * 0.8, -L * 0.15, L * 0.9, L * 0.02); c.lineTo(L * 0.62, L * 0.04); c.closePath(); c.fill();
    },
    mace(c, L) {
      bar(c, 0, L * 0.72, L * 0.08, C.wood);
      c.fillStyle = C.metalD; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.moveTo(L * 0.82 + Math.cos(a) * L * 0.24, Math.sin(a) * L * 0.24); c.lineTo(L * 0.82 + Math.cos(a + 0.4) * L * 0.12, Math.sin(a + 0.4) * L * 0.12); c.lineTo(L * 0.82 + Math.cos(a - 0.4) * L * 0.12, Math.sin(a - 0.4) * L * 0.12); c.fill(); }
      c.fillStyle = C.metal; c.beginPath(); c.arc(L * 0.82, 0, L * 0.15, 0, TAU); c.fill();
    },
    greatsword(c, L) { bar(c, 0, L * 0.2, L * 0.07, C.woodD); bar(c, L * 0.19, L * 0.23, L * 0.36, C.metalD); blade(c, L * 0.23, L, L * 0.12, C.metal); },
    greataxe(c, L) {
      bar(c, 0, L, L * 0.06, C.wood);
      c.fillStyle = C.metal;
      for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(L * 0.66, sgn * L * 0.03); c.quadraticCurveTo(L * 0.62, sgn * L * 0.34, L * 0.88, sgn * L * 0.34); c.quadraticCurveTo(L * 0.8, sgn * L * 0.16, L * 0.9, sgn * L * 0.03); c.closePath(); c.fill(); }
    },
    spear(c, L) { bar(c, 0, L * 0.84, L * 0.045, C.wood); c.fillStyle = C.metal; c.beginPath(); c.moveTo(L * 0.8, -L * 0.06); c.lineTo(L, 0); c.lineTo(L * 0.8, L * 0.06); c.closePath(); c.fill(); },
    hammer(c, L) { bar(c, 0, L * 0.86, L * 0.06, C.wood); c.fillStyle = C.metalD; c.fillRect(L * 0.68, -L * 0.2, L * 0.26, L * 0.4); c.fillStyle = C.metal; c.fillRect(L * 0.7, -L * 0.18, L * 0.08, L * 0.36); },
    sling(c, L) { c.strokeStyle = '#a88a63'; c.lineWidth = Math.max(1, L * 0.05); c.beginPath(); c.moveTo(0, -L * 0.05); c.quadraticCurveTo(L * 0.5, -L * 0.25, L * 0.78, 0); c.quadraticCurveTo(L * 0.5, L * 0.25, 0, L * 0.05); c.stroke(); c.fillStyle = '#7a6046'; c.beginPath(); c.ellipse(L * 0.8, 0, L * 0.14, L * 0.11, 0, 0, TAU); c.fill(); c.fillStyle = '#a7a2a8'; c.beginPath(); c.arc(L * 0.82, 0, L * 0.07, 0, TAU); c.fill(); },
    knives(c, L) { for (const a of [-0.35, 0, 0.35]) { c.save(); c.rotate(a); bar(c, 0, L * 0.3, L * 0.1, C.woodD); blade(c, L * 0.3, L, L * 0.12, C.metal); c.restore(); } },
    wand(c, L, col) { bar(c, 0, L * 0.82, L * 0.06, '#6b4a33'); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = L * 0.4; c.beginPath(); c.arc(L * 0.88, 0, L * 0.1, 0, TAU); c.fill(); c.shadowBlur = 0; },
    handxbow(c, L) {
      bar(c, 0, L * 0.85, L * 0.11, C.wood);
      c.strokeStyle = C.metalD; c.lineWidth = Math.max(1.5, L * 0.07); c.beginPath(); c.arc(L * 0.42, 0, L * 0.4, -0.95, 0.95); c.stroke();
      c.strokeStyle = C.bone; c.lineWidth = 1; c.beginPath(); c.moveTo(L * 0.42 + Math.cos(-0.95) * L * 0.4, Math.sin(-0.95) * L * 0.4); c.lineTo(L * 0.42, 0); c.lineTo(L * 0.42 + Math.cos(0.95) * L * 0.4, Math.sin(0.95) * L * 0.4); c.stroke();
    },
    bow(c, L) {
      c.strokeStyle = C.wood; c.lineWidth = Math.max(2, L * 0.06); c.beginPath(); c.arc(-L * 0.05, 0, L * 0.55, -1.05, 1.05); c.stroke();
      c.strokeStyle = C.bone; c.lineWidth = 1; c.beginPath(); c.moveTo(-L * 0.05 + Math.cos(-1.05) * L * 0.55, Math.sin(-1.05) * L * 0.55); c.lineTo(-L * 0.05 + Math.cos(1.05) * L * 0.55, Math.sin(1.05) * L * 0.55); c.stroke();
    },
    recurve(c, L) {
      c.strokeStyle = '#6e4630'; c.lineWidth = Math.max(2, L * 0.06); c.beginPath();
      c.moveTo(L * 0.05, -L * 0.52); c.quadraticCurveTo(L * 0.2, -L * 0.42, L * 0.15, -L * 0.3); c.quadraticCurveTo(L * 0.55, 0, L * 0.15, L * 0.3); c.quadraticCurveTo(L * 0.2, L * 0.42, L * 0.05, L * 0.52); c.stroke();
      c.strokeStyle = C.bone; c.lineWidth = 1; c.beginPath(); c.moveTo(L * 0.05, -L * 0.52); c.lineTo(L * 0.05, L * 0.52); c.stroke();
    },
    xbow(c, L) {
      bar(c, 0, L, L * 0.12, C.woodD);
      c.strokeStyle = C.metal; c.lineWidth = Math.max(2, L * 0.08); c.beginPath(); c.arc(L * 0.5, 0, L * 0.5, -0.9, 0.9); c.stroke();
      c.strokeStyle = C.bone; c.lineWidth = 1; c.beginPath(); c.moveTo(L * 0.5 + Math.cos(-0.9) * L * 0.5, Math.sin(-0.9) * L * 0.5); c.lineTo(L * 0.5, 0); c.lineTo(L * 0.5 + Math.cos(0.9) * L * 0.5, Math.sin(0.9) * L * 0.5); c.stroke();
    },
    staff(c, L, col) {
      bar(c, 0, L * 0.86, L * 0.06, '#5e4232');
      c.strokeStyle = '#8a6a4e'; c.lineWidth = Math.max(1, L * 0.04); c.beginPath(); c.moveTo(L * 0.8, -L * 0.1); c.quadraticCurveTo(L * 0.9, -L * 0.14, L * 0.98, -L * 0.05); c.moveTo(L * 0.8, L * 0.1); c.quadraticCurveTo(L * 0.9, L * 0.14, L * 0.98, L * 0.05); c.stroke();
      c.fillStyle = col; c.shadowColor = col; c.shadowBlur = L * 0.35; c.beginPath(); c.arc(L * 0.93, 0, L * 0.08, 0, TAU); c.fill(); c.shadowBlur = 0;
    },
    shield(c, L, col) {
      c.fillStyle = '#6b5a4a'; c.strokeStyle = col; c.lineWidth = Math.max(1.5, L * 0.08);
      c.beginPath(); c.moveTo(L * 0.25, -L * 0.42); c.quadraticCurveTo(L * 0.62, -L * 0.42, L * 0.62, -L * 0.1); c.quadraticCurveTo(L * 0.6, L * 0.25, L * 0.25, L * 0.5); c.quadraticCurveTo(-L * 0.1, L * 0.25, -L * 0.12, -L * 0.1); c.quadraticCurveTo(-L * 0.12, -L * 0.42, L * 0.25, -L * 0.42); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = C.metal; c.beginPath(); c.arc(L * 0.25, -L * 0.02, L * 0.09, 0, TAU); c.fill();
    },
  };
  G.drawWeapon = function (c, icon, L, col) { (ICONS[icon] || ICONS.sword)(c, L, col || C.bone); };
  G.drawWeaponIcon = function (c, icon, size, col) {
    c.save();
    const f = G.ICON_LEN[icon] || 0.6, L = size * (0.55 + f * 0.45) * 1.05;
    if (icon === 'shield') { c.translate(size * 0.38, size * 0.5); G.drawWeapon(c, icon, size * 0.9, col); }
    else if (icon === 'fists') { c.translate(size * 0.2, size * 0.5); G.drawWeapon(c, icon, size * 0.6, col); }
    else if (icon === 'bow' || icon === 'recurve') { c.translate(size * 0.32, size * 0.5); G.drawWeapon(c, icon, size * 0.85, col); }
    else { c.translate(size / 2 - Math.cos(-Math.PI / 4) * L / 2, size / 2 - Math.sin(-Math.PI / 4) * L / 2); c.rotate(-Math.PI / 4); G.drawWeapon(c, icon, L, col); }
    c.restore();
  };

  /* ---------- Oro, pociones, reliquias, pergaminos y compañeros ----------
     Todas se dibujan centradas en el origen con un radio r. */
  G.drawCoin = function (c, x, y, r) {
    c.fillStyle = '#9a6a1c'; c.beginPath(); c.ellipse(x, y + r * 0.18, r, r * 0.8, 0, 0, TAU); c.fill();
    c.fillStyle = '#f0c35a'; c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffe39a'; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.2, r * 0.35, r * 0.22, -0.4, 0, TAU); c.fill();
  };
  G.drawPotion = function (c, r) {
    c.fillStyle = '#7a2f25'; c.beginPath(); c.arc(0, r * 0.3, r * 0.68, 0, TAU); c.fill();
    c.fillStyle = '#d9533c'; c.beginPath(); c.arc(0, r * 0.38, r * 0.52, 0, TAU); c.fill();
    c.fillStyle = '#cfc6b2'; c.fillRect(-r * 0.2, -r * 0.62, r * 0.4, r * 0.48);
    c.fillStyle = '#8a5a3a'; c.fillRect(-r * 0.24, -r * 0.82, r * 0.48, r * 0.24);
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.arc(-r * 0.2, r * 0.18, r * 0.16, 0, TAU); c.fill();
  };
  G.drawHeal = function (c, r) {
    c.save();
    c.shadowColor = '#f0c35a'; c.shadowBlur = r * 0.9;
    c.fillStyle = '#e86a58';
    c.beginPath(); c.moveTo(0, r * 0.75);
    c.bezierCurveTo(-r * 1.1, 0, -r * 0.7, -r * 0.85, 0, -r * 0.35);
    c.bezierCurveTo(r * 0.7, -r * 0.85, r * 1.1, 0, 0, r * 0.75); c.fill();
    c.restore();
    c.strokeStyle = '#f0c35a'; c.lineWidth = Math.max(1.5, r * 0.12);
    c.beginPath(); c.moveTo(0, -r * 0.05); c.lineTo(0, r * 0.4); c.moveTo(-r * 0.22, r * 0.17); c.lineTo(r * 0.22, r * 0.17); c.stroke();
  };
  G.drawTome = function (c, r, col) {
    c.fillStyle = '#e9dfc8'; c.fillRect(-r * 0.62, -r * 0.7, r * 1.3, r * 1.4);
    c.fillStyle = col || '#8a3f6b'; c.fillRect(-r * 0.72, -r * 0.78, r * 1.3, r * 1.45);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-r * 0.72, -r * 0.78, r * 0.18, r * 1.45);
    c.strokeStyle = '#f0c35a'; c.lineWidth = Math.max(1, r * 0.09);
    c.beginPath(); c.arc(r * 0.02, -r * 0.05, r * 0.3, 0, TAU); c.moveTo(r * 0.02, -r * 0.45); c.lineTo(r * 0.02, r * 0.35); c.stroke();
  };
  const RELIC_ICONS = {
    bolsa(c, r, k) {
      c.fillStyle = '#8a5a3a'; c.beginPath(); c.moveTo(-r * 0.3, -r * 0.45); c.quadraticCurveTo(-r * 0.95, r * 0.1, -r * 0.6, r * 0.65); c.lineTo(r * 0.6, r * 0.65); c.quadraticCurveTo(r * 0.95, r * 0.1, r * 0.3, -r * 0.45); c.closePath(); c.fill();
      c.fillStyle = k; c.fillRect(-r * 0.38, -r * 0.55, r * 0.76, r * 0.16);
      G.drawCoin(c, 0, r * 0.15, r * 0.28);
    },
    brasas(c, r, k) {
      c.fillStyle = '#c98a3a'; c.beginPath(); c.moveTo(-r * 0.8, r * 0.5); c.lineTo(-r * 0.8, -r * 0.2); c.lineTo(-r * 0.4, r * 0.15); c.lineTo(0, -r * 0.55); c.lineTo(r * 0.4, r * 0.15); c.lineTo(r * 0.8, -r * 0.2); c.lineTo(r * 0.8, r * 0.5); c.closePath(); c.fill();
      c.fillStyle = k; c.shadowColor = k; c.shadowBlur = r * 0.6;
      for (const [x, y] of [[-r * 0.8, -r * 0.35], [0, -r * 0.72], [r * 0.8, -r * 0.35]]) { c.beginPath(); c.arc(x, y, r * 0.16, 0, TAU); c.fill(); }
      c.shadowBlur = 0;
    },
    caliz(c, r, k) {
      c.fillStyle = '#c9a24a'; c.beginPath(); c.moveTo(-r * 0.65, -r * 0.6); c.lineTo(r * 0.65, -r * 0.6); c.quadraticCurveTo(r * 0.6, r * 0.1, r * 0.1, r * 0.15); c.lineTo(r * 0.1, r * 0.5); c.lineTo(r * 0.45, r * 0.7); c.lineTo(-r * 0.45, r * 0.7); c.lineTo(-r * 0.1, r * 0.5); c.lineTo(-r * 0.1, r * 0.15); c.quadraticCurveTo(-r * 0.6, r * 0.1, -r * 0.65, -r * 0.6); c.fill();
      c.fillStyle = k; c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.58, r * 0.14, 0, 0, TAU); c.fill();
    },
    espinas(c, r, k) {
      c.fillStyle = k; c.beginPath(); c.moveTo(-r * 0.45, -r * 0.7); c.lineTo(r * 0.45, -r * 0.7); c.lineTo(r * 0.85, -r * 0.3); c.lineTo(r * 0.55, r * 0.75); c.lineTo(-r * 0.55, r * 0.75); c.lineTo(-r * 0.85, -r * 0.3); c.closePath(); c.fill();
      c.fillStyle = 'rgba(20,14,26,0.45)';
      for (let y = -0.35; y < 0.7; y += 0.28) for (let x = -0.45; x <= 0.46; x += 0.3) { c.beginPath(); c.arc(x * r, y * r, r * 0.07, 0, TAU); c.fill(); }
      c.fillStyle = '#e9dfc8'; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.85, -r * 0.3); c.lineTo(sg * r * 1.1, -r * 0.42); c.lineTo(sg * r * 0.78, -r * 0.12); c.fill(); }
    },
    alas(c, r, k) {
      c.fillStyle = '#6e4630'; c.beginPath(); c.moveTo(-r * 0.25, -r * 0.65); c.lineTo(r * 0.2, -r * 0.65); c.lineTo(r * 0.2, r * 0.3); c.lineTo(r * 0.75, r * 0.45); c.lineTo(r * 0.75, r * 0.7); c.lineTo(-r * 0.25, r * 0.7); c.closePath(); c.fill();
      c.fillStyle = k; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-r * 0.55, -r * 0.35 + i * r * 0.25, r * 0.38 - i * r * 0.08, r * 0.1, -0.5, 0, TAU); c.fill(); }
    },
    cuervo(c, r, k) {
      c.fillStyle = '#e9dfc8'; c.beginPath(); c.moveTo(-r * 0.9, 0); c.quadraticCurveTo(0, -r * 0.8, r * 0.9, 0); c.quadraticCurveTo(0, r * 0.8, -r * 0.9, 0); c.fill();
      c.fillStyle = k; c.beginPath(); c.arc(0, 0, r * 0.36, 0, TAU); c.fill();
      c.fillStyle = '#16121c'; c.beginPath(); c.ellipse(0, 0, r * 0.1, r * 0.28, 0, 0, TAU); c.fill();
    },
    gemelos(c, r, k) {
      for (const sg of [-1, 1]) {
        c.save(); c.translate(sg * r * 0.35, 0); c.rotate(sg * 0.25);
        c.fillStyle = '#a7abb8'; c.fillRect(-r * 0.3, -r * 0.55, r * 0.6, r * 0.75);
        c.fillStyle = k; c.fillRect(-r * 0.33, r * 0.2, r * 0.66, r * 0.4);
        c.restore();
      }
    },
    gigante(c, r, k) {
      c.fillStyle = '#6e4630'; c.fillRect(-r * 0.95, -r * 0.25, r * 1.9, r * 0.5);
      c.fillStyle = k; c.fillRect(-r * 0.32, -r * 0.42, r * 0.64, r * 0.84);
      c.fillStyle = '#6e4630'; c.fillRect(-r * 0.16, -r * 0.24, r * 0.32, r * 0.48);
    },
    trebol(c, r, k) {
      c.strokeStyle = '#4e6b3c'; c.lineWidth = Math.max(1.5, r * 0.12); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.2, r * 0.6, r * 0.5, r * 0.85); c.stroke();
      c.fillStyle = k; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + TAU / 8; c.beginPath(); c.arc(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34, r * 0.32, 0, TAU); c.fill(); }
    },
    reloj(c, r, k) {
      c.fillStyle = '#8a5a3a'; c.fillRect(-r * 0.6, -r * 0.8, r * 1.2, r * 0.16); c.fillRect(-r * 0.6, r * 0.64, r * 1.2, r * 0.16);
      c.fillStyle = 'rgba(233,223,200,0.35)'; c.beginPath(); c.moveTo(-r * 0.45, -r * 0.64); c.lineTo(r * 0.45, -r * 0.64); c.lineTo(0, 0); c.lineTo(r * 0.45, r * 0.64); c.lineTo(-r * 0.45, r * 0.64); c.lineTo(0, 0); c.closePath(); c.fill();
      c.fillStyle = '#f0c35a'; c.beginPath(); c.moveTo(-r * 0.25, -r * 0.3); c.lineTo(r * 0.25, -r * 0.3); c.lineTo(0, 0); c.fill(); c.beginPath(); c.moveTo(-r * 0.4, r * 0.64); c.lineTo(r * 0.4, r * 0.64); c.lineTo(0, r * 0.25); c.fill();
    },
    escarcha(c, r, k) {
      c.save(); c.shadowColor = k; c.shadowBlur = r * 0.6; c.fillStyle = k;
      c.beginPath(); c.moveTo(0, r * 0.75); c.bezierCurveTo(-r * 1.1, 0, -r * 0.7, -r * 0.85, 0, -r * 0.35); c.bezierCurveTo(r * 0.7, -r * 0.85, r * 1.1, 0, 0, r * 0.75); c.fill();
      c.restore();
      c.strokeStyle = '#e8f6ff'; c.lineWidth = Math.max(1, r * 0.08);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.3, -r * 0.05 + Math.sin(a) * r * 0.3); c.lineTo(-Math.cos(a) * r * 0.3, -r * 0.05 - Math.sin(a) * r * 0.3); c.stroke(); }
    },
    colmillo(c, r, k) {
      c.fillStyle = '#e9dfc8'; c.beginPath(); c.moveTo(-r * 0.45, -r * 0.7); c.quadraticCurveTo(-r * 0.5, r * 0.2, r * 0.1, r * 0.8); c.quadraticCurveTo(r * 0.15, 0, r * 0.45, -r * 0.7); c.closePath(); c.fill();
      c.fillStyle = k; c.beginPath(); c.arc(r * 0.12, r * 0.78, r * 0.12, 0, TAU); c.fill();
    },
  };
  G.drawRelic = function (c, id, r) { const R = G.RELIC_MAP[id]; (RELIC_ICONS[id] || RELIC_ICONS.bolsa)(c, r, R ? R.color : '#e9dfc8'); };

  G.drawCompanion = function (c, type, r, t, face) {
    const d = G.COMPANIONS[type], col = d.color;
    c.save();
    if (type === 'lobo') {
      c.rotate(face || 0);
      c.globalAlpha *= 0.92; c.shadowColor = col; c.shadowBlur = r * 1.2;
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-r * 1.1, 0); c.quadraticCurveTo(-r * 1.8, Math.sin(t * 10) * r * 0.5, -r * 2.0, -r * 0.2); c.lineTo(-r * 1.0, r * 0.15); c.fill();
      c.beginPath(); c.ellipse(-r * 0.15, 0, r * 1.05, r * 0.62, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(r * 0.85, 0, r * 0.52, r * 0.42, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(r * 0.7, -r * 0.3); c.lineTo(r * 0.55, -r * 0.75); c.lineTo(r * 0.95, -r * 0.35); c.moveTo(r * 0.7, r * 0.3); c.lineTo(r * 0.55, r * 0.75); c.lineTo(r * 0.95, r * 0.35); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#e8f6ff';
      c.beginPath(); c.arc(r * 1.05, -r * 0.16, r * 0.09, 0, TAU); c.arc(r * 1.05, r * 0.16, r * 0.09, 0, TAU); c.fill();
    } else if (type === 'fatuo') {
      const fl = 1 + Math.sin(t * 13) * 0.08;
      c.shadowColor = col; c.shadowBlur = r * 3;
      c.fillStyle = col + '66'; c.beginPath(); c.moveTo(-r * 0.8, 0); c.quadraticCurveTo(0, -r * 2.2 * fl, r * 0.8, 0); c.arc(0, 0, r * 0.8, 0, Math.PI); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.8 * fl, 0, TAU); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#f2fffb'; c.beginPath(); c.arc(0, r * 0.1, r * 0.38, 0, TAU); c.fill();
    } else if (type === 'golem') {
      c.rotate(face || 0);
      c.fillStyle = '#7a4f22'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = col; c.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
      c.fillStyle = '#7a4f22'; c.fillRect(-r * 0.62, -r * 0.05, r * 1.24, r * 0.1);
      c.fillStyle = '#e8b673'; for (const [x, y] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) { c.beginPath(); c.arc(x * r, y * r, r * 0.08, 0, TAU); c.fill(); }
      c.fillStyle = '#7fe0c8'; c.shadowColor = '#7fe0c8'; c.shadowBlur = r * 0.6;
      c.beginPath(); c.arc(r * 0.72, -r * 0.25, r * 0.1, 0, TAU); c.arc(r * 0.72, r * 0.25, r * 0.1, 0, TAU); c.fill();
    } else {
      const flap = Math.abs(Math.sin(t * 18));
      c.fillStyle = 'rgba(255,240,250,0.55)';
      for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * r * 0.9, -r * 0.4, r * 0.9, r * (0.35 + flap * 0.35), sg * 0.5, 0, TAU); c.fill(); }
      c.shadowColor = col; c.shadowBlur = r * 3; c.fillStyle = col;
      c.beginPath(); c.arc(0, 0, r * 0.75, 0, TAU); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#fff6fb'; c.beginPath(); c.arc(0, 0, r * 0.38, 0, TAU); c.fill();
    }
    c.restore();
  };
  const BOON_COLOR = { fuerza: '#a63f2c', celeridad: '#3f8576', robustez: '#5a7a3a', pies: '#3b5f8a', ojo: '#6b4a8a', sanguijuela: '#7a2f3a', filo: '#8a5a2a', puntas: '#4e6b6b', piel: '#5e5a4a', regen: '#3f7a52', mortal: '#8a2f2f', fenix: '#c9622a' };
  G.drawMerchant = function (c, r, t) {
    c.fillStyle = '#3a2440'; c.beginPath(); c.arc(0, r * 0.15, r, 0, TAU); c.fill();
    c.fillStyle = '#4e3258'; c.beginPath(); c.arc(0, -r * 0.2, r * 0.66, 0, TAU); c.fill();
    c.fillStyle = '#1a1220'; c.beginPath(); c.ellipse(0, -r * 0.1, r * 0.42, r * 0.36, 0, 0, TAU); c.fill();
    c.fillStyle = '#f4b860'; c.beginPath(); c.arc(-r * 0.15, -r * 0.12, r * 0.07, 0, TAU); c.arc(r * 0.15, -r * 0.12, r * 0.07, 0, TAU); c.fill();
    c.fillStyle = '#d9c7a8'; c.beginPath(); c.arc(r * 0.78, r * 0.25, r * 0.17, 0, TAU); c.fill();
  };
  /* Paquete sorpresa: caja envuelta con lazo y una interrogación. */
  G.drawPack = function (c, r) {
    c.fillStyle = '#5a3a6e'; c.fillRect(-r * 0.8, -r * 0.45, r * 1.6, r * 1.15);
    c.fillStyle = '#6e4a86'; c.fillRect(-r * 0.9, -r * 0.7, r * 1.8, r * 0.36);
    c.fillStyle = '#f0c35a'; c.fillRect(-r * 0.12, -r * 0.7, r * 0.24, r * 1.4);
    c.fillRect(-r * 0.8, -r * 0.08, r * 1.6, r * 0.18);
    c.strokeStyle = '#f0c35a'; c.lineWidth = Math.max(1.5, r * 0.13);
    c.beginPath(); c.ellipse(-r * 0.32, -r * 0.88, r * 0.3, r * 0.17, -0.5, 0, TAU); c.ellipse(r * 0.32, -r * 0.88, r * 0.3, r * 0.17, 0.5, 0, TAU); c.stroke();
    c.fillStyle = '#ffe39a'; c.font = `800 ${Math.round(r * 0.75)}px 'Alegreya Sans', system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', r * 0.45, r * 0.32);
  };

  /* Icono de cualquier artículo del mercado, centrado en el origen. */
  G.drawShopItem = function (c, it, r, t) {
    switch (it.cat) {
      case 'weapon': c.save(); c.translate(-r, -r); G.drawWeaponIcon(c, it.w.icon, r * 2, G.RARITIES[it.w.rarity].color); c.restore(); break;
      case 'relic': G.drawRelic(c, it.relic, r * 0.8); break;
      case 'tome': G.drawTome(c, r * 0.75, BOON_COLOR[it.boon]); break;
      case 'companion': G.drawCompanion(c, it.comp, r * (it.comp === 'hada' || it.comp === 'fatuo' ? 0.42 : it.comp === 'golem' ? 0.6 : 0.4), t || 0, 0); break;
      case 'potion': G.drawPotion(c, r * 0.75); break;
      case 'heal': G.drawHeal(c, r * 0.75); break;
      case 'pack': G.drawPack(c, r * 0.8); break;
    }
  };

  /* ---------- Enemigos ---------- */
  function circle(c, x, y, r, fill) { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  const SHAPES = {
    rat(c, e, r, t, w) {
      c.strokeStyle = w || '#b08f86'; c.lineWidth = r * 0.16; c.beginPath(); c.moveTo(-r * 0.9, 0); c.quadraticCurveTo(-r * 1.5, Math.sin(t * 10) * r * 0.6, -r * 2.0, Math.sin(t * 10 + 1) * r * 0.3); c.stroke();
      c.fillStyle = w || '#76675a'; c.beginPath(); c.ellipse(0, 0, r * 1.1, r * 0.75, 0, 0, TAU); c.fill();
      c.fillStyle = w || '#8a7a6a'; c.beginPath(); c.ellipse(r * 0.75, 0, r * 0.55, r * 0.45, 0, 0, TAU); c.fill();
      circle(c, r * 0.5, -r * 0.45, r * 0.22, w || '#c98f8f'); circle(c, r * 0.5, r * 0.45, r * 0.22, w || '#c98f8f');
      circle(c, r * 1.02, -r * 0.18, r * 0.09, '#ff5a44'); circle(c, r * 1.02, r * 0.18, r * 0.09, '#ff5a44');
    },
    skel(c, e, r, t, w) {
      circle(c, 0, 0, r, w || '#d9cfb7');
      c.strokeStyle = 'rgba(60,50,40,0.45)'; c.lineWidth = r * 0.12; c.beginPath(); c.arc(0, 0, r * 0.94, 0, TAU); c.stroke();
      c.fillStyle = '#1a1320'; c.beginPath(); c.ellipse(r * 0.42, -r * 0.3, r * 0.2, r * 0.16, 0, 0, TAU); c.ellipse(r * 0.42, r * 0.3, r * 0.2, r * 0.16, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(26,19,32,0.7)'; c.fillRect(r * 0.66, -r * 0.22, r * 0.12, r * 0.44);
    },
    archer(c, e, r, t, w) {
      SHAPES.skel(c, e, r, t, w);
      c.strokeStyle = w || '#4e7d5b'; c.lineWidth = r * 0.35; c.beginPath(); c.arc(0, 0, r * 0.9, Math.PI * 0.55, Math.PI * 1.45); c.stroke();
      c.strokeStyle = '#7a5235'; c.lineWidth = r * 0.14; c.beginPath(); c.arc(r * 0.6, 0, r * 0.9, -1.1, 1.1); c.stroke();
    },
    slime(c, e, r, t, w) {
      const k = Math.sin(t * 5 + e.phase) * 0.1;
      c.fillStyle = w || 'rgba(104,186,110,0.88)'; c.beginPath(); c.ellipse(0, 0, r * (1 + k), r * (1 - k), 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(-r * 0.3, -r * 0.35, r * 0.3, r * 0.18, -0.5, 0, TAU); c.fill();
      circle(c, r * 0.45, -r * 0.22, r * 0.12, '#14301a'); circle(c, r * 0.45, r * 0.22, r * 0.12, '#14301a');
    },
    bat(c, e, r, t, w) {
      const f = 0.4 + Math.abs(Math.sin(t * 16 + e.phase)) * 0.9;
      c.fillStyle = w || '#4f4068';
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(-r * 0.1, 0); c.lineTo(-r * 0.6, sg * r * 1.6 * f); c.lineTo(r * 0.1, sg * r * 1.1 * f); c.lineTo(r * 0.3, sg * r * 0.3); c.closePath(); c.fill(); }
      circle(c, 0, 0, r * 0.6, w || '#3a2f4d'); circle(c, r * 0.35, -r * 0.18, r * 0.1, '#ff6a4a'); circle(c, r * 0.35, r * 0.18, r * 0.1, '#ff6a4a');
    },
    brute(c, e, r, t, w) {
      circle(c, 0, 0, r, w || '#934535'); circle(c, -r * 0.15, 0, r * 0.72, w || '#a5513f');
      c.fillStyle = C.bone; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.7, sg * r * 0.35); c.lineTo(r * 1.15, sg * r * 0.5); c.lineTo(r * 0.78, sg * r * 0.12); c.fill(); }
      circle(c, r * 0.52, -r * 0.24, r * 0.09, '#f4d36a'); circle(c, r * 0.52, r * 0.24, r * 0.09, '#f4d36a');
    },
    mage(c, e, r, t, w) {
      circle(c, 0, 0, r, w || '#4d3478');
      c.fillStyle = w || '#3a2560'; c.beginPath(); c.moveTo(-r * 0.9, -r * 0.6); c.lineTo(r * 0.75, 0); c.lineTo(-r * 0.9, r * 0.6); c.closePath(); c.fill();
      circle(c, r * 0.45, -r * 0.18, r * 0.1, C.ember); circle(c, r * 0.45, r * 0.18, r * 0.1, C.ember);
      c.fillStyle = '#c9a8ff'; c.shadowColor = '#c9a8ff'; c.shadowBlur = r * 1.2; c.beginPath(); c.arc(r * 0.6, r * 0.75, r * 0.2, 0, TAU); c.fill(); c.shadowBlur = 0;
    },
    knight(c, e, r, t, w) {
      circle(c, 0, 0, r, w || '#878d9c');
      c.strokeStyle = w || '#b4442f'; c.lineWidth = r * 0.3; c.beginPath(); c.arc(-r * 0.15, 0, r * 0.62, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
      c.fillStyle = '#16121c'; c.fillRect(r * 0.35, -r * 0.5, r * 0.16, r * 1.0);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.82, -1.2, -0.3); c.stroke();
    },
  };
  function drawBoss(c, e, r, t, w) {
    const B = e.boss;
    c.save(); c.rotate(-e.face);
    c.strokeStyle = B.color; c.globalAlpha = 0.35; c.lineWidth = r * 0.12; c.setLineDash([r * 0.3, r * 0.25]);
    c.beginPath(); c.arc(0, 0, r * 1.25, t * 0.8, t * 0.8 + TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.restore();
    circle(c, 0, 0, r, w || B.color);
    if (B.id === 'carcelero') {
      circle(c, -r * 0.1, 0, r * 0.7, w || '#7e3324');
      c.fillStyle = C.bone; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.2, sg * r * 0.55); c.quadraticCurveTo(r * 0.7, sg * r * 1.1, r * 1.1, sg * r * 0.8); c.lineTo(r * 0.45, sg * r * 0.35); c.fill(); }
      c.strokeStyle = '#8b90a0'; c.lineWidth = r * 0.1; c.setLineDash([r * 0.12, r * 0.08]); c.beginPath(); c.arc(0, 0, r * 0.85, 0.8, 5.5); c.stroke(); c.setLineDash([]);
    } else if (B.id === 'liche') {
      circle(c, 0, 0, r * 0.62, w || '#d9cfb7');
      c.fillStyle = C.gold; c.beginPath(); for (let i = 0; i < 5; i++) { const a = Math.PI + (i - 2) * 0.42; c.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); c.lineTo(Math.cos(a + 0.21) * r * 0.95, Math.sin(a + 0.21) * r * 0.95); } c.closePath(); c.fill();
      circle(c, r * 0.3, -r * 0.2, r * 0.1, '#c9a8ff'); circle(c, r * 0.3, r * 0.2, r * 0.1, '#c9a8ff');
    } else {
      c.strokeStyle = 'rgba(40,30,30,0.5)'; c.lineWidth = r * 0.07;
      c.beginPath(); c.moveTo(-r * 0.6, -r * 0.3); c.lineTo(-r * 0.1, -r * 0.1); c.lineTo(r * 0.1, -r * 0.6); c.moveTo(-r * 0.4, r * 0.5); c.lineTo(0, r * 0.15); c.lineTo(r * 0.5, r * 0.3); c.stroke();
      c.fillStyle = C.ember; c.shadowColor = C.ember; c.shadowBlur = r * 0.8; c.beginPath(); c.arc(r * 0.1, 0, r * 0.22, 0, TAU); c.fill(); c.shadowBlur = 0;
      circle(c, r * 0.62, -r * 0.25, r * 0.09, '#ff7a4a'); circle(c, r * 0.62, r * 0.25, r * 0.09, '#ff7a4a');
    }
  }

  /* ---------- Renderizador ---------- */
  G.createRenderer = function (canvas) {
    const ctx = canvas.getContext('2d');
    const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
    const R = { W: 0, H: 0, dpr: 1, S: 40, cam: { x: 0, y: 0 }, lastRun: null, lastFloor: -1, zoom: 1,
      reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches };

    R.resize = function () {
      R.dpr = Math.min(2, window.devicePixelRatio || 1);
      R.W = canvas.clientWidth || window.innerWidth; R.H = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(R.W * R.dpr); canvas.height = Math.round(R.H * R.dpr);
      dark.width = Math.ceil(R.W / 2); dark.height = Math.ceil(R.H / 2);
      R.S = G.clamp(Math.min(R.W, R.H) / 12.5, 30, 62) * R.zoom;
    };

    /* Coordenadas de pantalla → mundo (para apuntar con el ratón). */
    R.screenToWorld = (sx, sy) => ({ x: R.cam.x + (sx - R.W / 2) / R.S, y: R.cam.y + (sy - R.H / 2) / R.S });

    function light(c, x, y, r, a) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.3, `rgba(0,0,0,${a * 0.96})`); g.addColorStop(0.65, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }

    R.draw = function (s, dt) {
      const W = R.W, H = R.H, S = R.S, m = s.map, p = s.player;
      // En el mercado la cámara se inclina hacia el centro de la sala para que se vea entera
      const tx = m.isShop ? (p.x + m.w / 2) / 2 : p.x, ty = m.isShop ? (p.y + m.h / 2) / 2 : p.y;
      if (R.lastRun !== s || R.lastMap !== m) { R.cam.x = tx; R.cam.y = ty; R.lastRun = s; R.lastMap = m; }
      const k = Math.min(1, dt * 7);
      R.cam.x += (tx - R.cam.x) * k; R.cam.y += (ty - R.cam.y) * k;
      let shx = 0, shy = 0;
      if (s.shake > 0 && !R.reduced) { shx = (Math.random() - 0.5) * s.shake * 16; shy = (Math.random() - 0.5) * s.shake * 16; }
      const ox = Math.round(W / 2 - R.cam.x * S + shx), oy = Math.round(H / 2 - R.cam.y * S + shy);
      const X = x => ox + x * S, Y = y => oy + y * S;
      const t = s.t;

      ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      ctx.fillStyle = C.abyss; ctx.fillRect(0, 0, W, H);

      // ----- Casillas -----
      const tx0 = Math.max(0, Math.floor(-ox / S) - 1), tx1 = Math.min(m.w - 1, Math.ceil((W - ox) / S) + 1);
      const ty0 = Math.max(0, Math.floor(-oy / S) - 1), ty1 = Math.min(m.h - 1, Math.ceil((H - oy) / S) + 1);
      const grout = Math.max(1, Math.round(S * 0.045));
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const i = ty * m.w + tx;
          if (!m.seen[i]) continue;
          const v = m.vis[i], sh = m.shade[i] >> 5, x = ox + tx * S, y = oy + ty * S;
          if (m.tiles[i] === G.FLOOR) {
            ctx.fillStyle = v ? C.floor[sh] : C.floorMem[sh];
            ctx.fillRect(x, y, S + 1, S + 1);
            ctx.fillStyle = 'rgba(8,5,12,0.28)';
            ctx.fillRect(x, y, S, grout); ctx.fillRect(x, y, grout, S);
            if (ty > 0 && m.tiles[i - m.w] !== G.FLOOR) { ctx.fillStyle = 'rgba(8,5,12,0.35)'; ctx.fillRect(x, y, S + 1, S * 0.22); }
            const sv = m.shade[i];
            if (sv > 244) { ctx.fillStyle = v ? 'rgba(233,223,200,0.10)' : 'rgba(233,223,200,0.04)'; ctx.beginPath(); ctx.arc(x + S * 0.3, y + S * 0.65, S * 0.07, 0, TAU); ctx.arc(x + S * 0.42, y + S * 0.7, S * 0.045, 0, TAU); ctx.fill(); }
            else if (sv < 9) { ctx.strokeStyle = 'rgba(8,5,12,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + S * 0.2, y + S * 0.3); ctx.lineTo(x + S * 0.45, y + S * 0.5); ctx.lineTo(x + S * 0.4, y + S * 0.78); ctx.stroke(); }
          } else {
            const below = ty + 1 < m.h && m.tiles[i + m.w] === G.FLOOR;
            ctx.fillStyle = v ? C.wallTop[sh] : C.wallMem;
            ctx.fillRect(x, y, S + 1, S + 1);
            if (below) {
              ctx.fillStyle = v ? C.wallFace : C.wallFaceMem;
              ctx.fillRect(x, y + S * 0.56, S + 1, S * 0.44 + 1);
              ctx.fillStyle = C.brick;
              ctx.fillRect(x, y + S * 0.56, S + 1, grout);
              ctx.fillRect(x, y + S * 0.78, S + 1, grout);
              const off = (tx % 2) * S * 0.5;
              ctx.fillRect(x + S * 0.25 + off * 0.5, y + S * 0.56, grout, S * 0.22);
              ctx.fillRect(x + S * 0.6 - off * 0.3, y + S * 0.78, grout, S * 0.22);
            }
          }
        }
      }

      // ----- Alfombra del mercado -----
      if (m.isShop) {
        const g = m.rug, x0 = X(g.x0), y0 = Y(g.y0), w = (g.x1 - g.x0) * S, h = (g.y1 - g.y0) * S;
        ctx.fillStyle = '#3a1b24'; ctx.fillRect(x0, y0, w, h);
        ctx.strokeStyle = '#7a5a2e'; ctx.lineWidth = Math.max(2, S * 0.06);
        ctx.strokeRect(x0 + S * 0.15, y0 + S * 0.15, w - S * 0.3, h - S * 0.3);
        ctx.strokeStyle = 'rgba(122,90,46,0.35)'; ctx.lineWidth = 1;
        for (let k2 = 1; k2 < 6; k2++) { const yy = y0 + h * k2 / 6; ctx.beginPath(); ctx.moveTo(x0 + S * 0.3, yy); ctx.lineTo(x0 + w - S * 0.3, yy); ctx.stroke(); }
        // Mostrador del mercader
        const mx0 = X(m.merchant.x - 2.2), my0 = Y(m.merchant.y + 0.45);
        ctx.fillStyle = '#5e3b25'; ctx.fillRect(mx0, my0, 4.4 * S, 0.42 * S);
        ctx.fillStyle = '#8a5a3a'; ctx.fillRect(mx0, my0, 4.4 * S, 0.12 * S);
      }

      // ----- Escaleras -----
      const si = m.stairs.y * m.w + m.stairs.x;
      if (m.seen[si]) {
        const x = X(m.stairs.x), y = Y(m.stairs.y), vis = m.vis[si];
        for (let k2 = 0; k2 < 4; k2++) {
          const inset = S * (0.06 + k2 * 0.1);
          ctx.fillStyle = ['#3d3548', '#2a2433', '#1a1520', '#0b0910'][k2];
          ctx.fillRect(x + inset, y + inset + k2 * S * 0.02, S - inset * 2, S - inset * 2);
        }
        if (s.stairsLocked) {
          ctx.strokeStyle = vis ? '#8b90a0' : '#4a4652'; ctx.lineWidth = Math.max(2, S * 0.06);
          ctx.beginPath(); ctx.moveTo(x + S * 0.15, y + S * 0.15); ctx.lineTo(x + S * 0.85, y + S * 0.85); ctx.moveTo(x + S * 0.85, y + S * 0.15); ctx.lineTo(x + S * 0.15, y + S * 0.85); ctx.stroke();
        } else if (vis) {
          ctx.strokeStyle = `rgba(244,184,96,${0.35 + Math.sin(t * 3) * 0.15})`; ctx.lineWidth = 2;
          ctx.strokeRect(x + S * 0.08, y + S * 0.08, S * 0.84, S * 0.84);
        }
      }

      // ----- Objetos del suelo -----
      for (const it of s.items) {
        const ti = Math.floor(it.y) * m.w + Math.floor(it.x);
        if (!m.seen[ti]) continue;
        const vis = m.vis[ti], x = X(it.x), y = Y(it.y) + Math.sin(it.t * 2.4) * S * 0.05;
        ctx.globalAlpha = vis ? 1 : 0.35;
        if (it.kind === 'weapon') {
          const col = G.RARITIES[it.w.rarity].color, pulse = 0.5 + Math.sin(it.t * 3) * 0.2;
          const g = ctx.createRadialGradient(x, y, 0, x, y, S * 0.55);
          g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, S * 0.55, 0, TAU); ctx.fill();
          ctx.strokeStyle = col; ctx.globalAlpha *= pulse; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, Y(it.y) + S * 0.28, S * 0.32, S * 0.1, 0, 0, TAU); ctx.stroke();
          ctx.globalAlpha = vis ? 1 : 0.35;
          ctx.save(); ctx.translate(x - S * 0.4, y - S * 0.4); G.drawWeaponIcon(ctx, it.w.icon, S * 0.8, col); ctx.restore();
        } else if (it.kind === 'potion') {
          ctx.save(); ctx.translate(x, y); G.drawPotion(ctx, S * 0.25); ctx.restore();
        } else if (it.kind === 'gold') {
          const gy = Y(it.y), r = S * (it.v >= 10 * G.econ(s.floor) ? 0.14 : 0.11);
          if (r > S * 0.12) G.drawCoin(ctx, X(it.x) - r * 0.5, gy + r * 0.3, r);
          G.drawCoin(ctx, X(it.x), gy, r);
        } else if (it.kind === 'chest') {
          drawChest(ctx, X(it.x), Y(it.y), S, it.open, it.t);
        } else if (it.kind === 'shop') {
          drawPedestal(ctx, s, it, X(it.x), Y(it.y), S, it.t);
        } else if (it.kind === 'merchant') {
          ctx.save(); ctx.translate(X(it.x), Y(it.y) + Math.sin(it.t * 1.6) * S * 0.02); G.drawMerchant(ctx, S * 0.42, it.t); ctx.restore();
          // Farol
          const lx = X(it.x + 0.62), ly = Y(it.y - 0.05);
          ctx.strokeStyle = '#5e3b25'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly + S * 0.35); ctx.lineTo(lx, ly - S * 0.1); ctx.stroke();
          ctx.fillStyle = '#f4b860'; ctx.shadowColor = '#f4b860'; ctx.shadowBlur = S * 0.6;
          ctx.fillRect(lx - S * 0.08, ly - S * 0.22, S * 0.16, S * 0.2); ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      }

      // ----- Compañeros -----
      for (const c of s.companions) {
        if (!m.vis[Math.floor(c.y) * m.w + Math.floor(c.x)]) continue;
        const x = X(c.x), y = Y(c.y), r = c.r * S, ground = c.d.kind === 'melee' || c.d.kind === 'slam';
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + (ground ? r * 0.7 : r * 2.2), r * 0.9, r * 0.35, 0, 0, TAU); ctx.fill();
        const bob = c.moving ? Math.sin(c.anim * 16) * r * 0.08 : 0;
        const lunge = c.atk > 0 && ground ? Math.sin(c.atk / 0.25 * Math.PI) * r * 0.5 : 0;
        ctx.save(); ctx.translate(x + Math.cos(c.face) * lunge, y + bob + Math.sin(c.face) * lunge);
        G.drawCompanion(ctx, c.type, r, c.anim, c.face);
        ctx.restore();
        if (c.d.kind === 'heal' && c.atk > 0) {
          ctx.globalAlpha = c.atk / 0.6; ctx.strokeStyle = c.d.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(p.x), Y(p.y)); ctx.stroke(); ctx.globalAlpha = 1;
        }
      }

      // ----- Telegrafiado de ataques enemigos -----
      for (const e of s.enemies) {
        if (!m.vis[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
        if (e.boss && e.act) {
          const a = e.act, prog = Math.min(1, a.t / a.wind);
          if (a.type === 'slam' && !a.done) {
            ctx.fillStyle = `rgba(196,85,59,${0.12 + prog * 0.18})`; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), a.r * S, 0, TAU); ctx.fill();
            ctx.strokeStyle = 'rgba(196,85,59,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), a.r * S * prog, 0, TAU); ctx.stroke();
          } else if (a.type === 'charge' && a.t < a.wind) {
            ctx.save(); ctx.translate(X(e.x), Y(e.y)); ctx.rotate(a.ang);
            ctx.fillStyle = `rgba(196,85,59,${0.12 + prog * 0.2})`; ctx.fillRect(0, -e.r * S, 5.5 * S, e.r * 2 * S); ctx.restore();
          } else if ((a.type === 'ring' || a.type === 'volley' || a.type === 'summon') && a.t < a.wind) {
            ctx.strokeStyle = `rgba(166,139,224,${0.3 + prog * 0.5})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), (e.r + 0.3 + prog * 0.4) * S, 0, TAU); ctx.stroke();
          }
        } else if (e.wind > 0) {
          const total = e.boss ? e.boss.wind : e.d.wind, prog = 1 - e.wind / total;
          if (e.d.ranged) {
            ctx.strokeStyle = `rgba(196,85,59,${0.2 + prog * 0.5})`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.y)); ctx.lineTo(X(e.x + Math.cos(e.face) * 6), Y(e.y + Math.sin(e.face) * 6)); ctx.stroke(); ctx.setLineDash([]);
          } else {
            const reach = (e.boss ? e.boss.range : e.d.range) + e.r + 0.3;
            ctx.fillStyle = `rgba(196,85,59,${0.15 + prog * 0.3})`;
            ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.y)); ctx.arc(X(e.x), Y(e.y), reach * S, e.face - 0.8, e.face + 0.8); ctx.closePath(); ctx.fill();
          }
        }
      }

      // ----- Enemigos -----
      for (const e of s.enemies) {
        if (!m.vis[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
        const x = X(e.x), y = Y(e.y), r = e.r * S;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.75, r * 0.95, r * 0.4, 0, 0, TAU); ctx.fill();
        const lunge = e.lunge > 0 ? Math.sin(e.lunge / 0.15 * Math.PI) * r * 0.35 : 0;
        ctx.save(); ctx.translate(x + Math.cos(e.face) * lunge, y + Math.sin(e.face) * lunge);
        const white = e.flash > 0 ? '#fff6e6' : null;
        if (e.elite) { ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.25; ctx.beginPath(); ctx.arc(0, 0, r * 1.22, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
        if (e.slowT > 0) { ctx.fillStyle = 'rgba(111,179,217,0.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill(); }
        ctx.rotate(e.face);
        if (e.boss) drawBoss(ctx, e, r, t, white);
        else (SHAPES[e.d.shape] || SHAPES.skel)(ctx, e, r, t + e.anim, white);
        ctx.restore();
        if (e.burnT > 0 && Math.random() < 0.4) s.parts.push({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y, vx: 0, vy: -1.5, color: '#f08a3c', life: 0.4, max: 0.4, size: 0.06 });
        if (e.stun > 0) { ctx.fillStyle = C.gold; for (let i2 = 0; i2 < 3; i2++) { const a = t * 5 + i2 * TAU / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.8, y - r * 1.1 + Math.sin(a) * r * 0.25, Math.max(1.5, S * 0.04), 0, TAU); ctx.fill(); } }
      }

      // ----- Jugador -----
      drawPlayer(ctx, s, X(p.x), Y(p.y), S, t);

      // ----- Barridos cuerpo a cuerpo -----
      for (const f of s.fx) {
        const prog = f.t / f.dur;
        if (f.type === 'swing') {
          const x = X(p.x), y = Y(p.y), reach = f.reach * S;
          ctx.globalAlpha = (1 - prog) * 0.55;
          if (f.thrust) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(f.dir);
            const g = ctx.createLinearGradient(0, 0, reach, 0); g.addColorStop(0, 'rgba(233,223,200,0)'); g.addColorStop(1, f.color);
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(S * 0.3, -S * 0.08); ctx.lineTo(reach, 0); ctx.lineTo(S * 0.3, S * 0.08); ctx.fill(); ctx.restore();
          } else {
            const a0 = f.whirl ? 0 : f.dir - f.half, a1 = f.whirl ? TAU : f.dir - f.half + f.half * 2 * Math.min(1, prog * 1.6);
            ctx.fillStyle = f.color;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, reach, a0, a1); ctx.closePath(); ctx.globalAlpha = (1 - prog) * 0.18; ctx.fill();
            ctx.globalAlpha = (1 - prog) * 0.8; ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(2, S * 0.06);
            ctx.beginPath(); ctx.arc(x, y, reach * 0.92, Math.max(a0, a1 - 0.9), a1); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (f.type === 'boom') {
          ctx.globalAlpha = 1 - prog; ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(2, S * 0.08);
          ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), f.r * S * (0.4 + prog * 0.6), 0, TAU); ctx.stroke();
          ctx.fillStyle = f.color; ctx.globalAlpha = (1 - prog) * 0.2; ctx.fill(); ctx.globalAlpha = 1;
        }
      }

      // ----- Proyectiles -----
      for (const pr of s.proj) drawProjectile(ctx, pr, X(pr.x), Y(pr.y), S, false);
      for (const b of s.eproj) drawProjectile(ctx, b, X(b.x), Y(b.y), S, true);

      // ----- Partículas -----
      for (const q of s.parts) {
        ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color;
        const sz = q.size * S; ctx.fillRect(X(q.x) - sz / 2, Y(q.y) - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;

      // ----- Oscuridad y antorcha -----
      const dw = dark.width, sc = dw / W;
      dctx.globalCompositeOperation = 'source-over';
      dctx.clearRect(0, 0, dw, dark.height);
      dctx.fillStyle = m.isShop ? 'rgba(8,5,14,0.5)' : 'rgba(8,5,14,0.86)'; dctx.fillRect(0, 0, dw, dark.height);
      dctx.globalCompositeOperation = 'destination-out';
      const flick = R.reduced ? 1 : 1 + Math.sin(t * 9.3) * 0.015 + Math.sin(t * 23.7) * 0.01;
      light(dctx, X(p.x) * sc, Y(p.y) * sc, (m.isShop ? 9 : s.stats.visR) * 1.05 * S * sc * flick, 1);
      if (m.isShop) {
        light(dctx, X(m.merchant.x + 0.6) * sc, Y(m.merchant.y) * sc, S * 4.5 * sc * flick, 0.9);
        for (const it of s.items) if (it.kind === 'shop') light(dctx, X(it.x) * sc, Y(it.y) * sc, S * 2.2 * sc, 0.7);
      }
      for (const c of s.companions) if (c.type === 'fatuo' || c.type === 'hada') light(dctx, X(c.x) * sc, Y(c.y) * sc, S * 1.6 * sc, 0.5);
      for (const pr of s.proj) if (pr.homing || pr.aoe) light(dctx, X(pr.x) * sc, Y(pr.y) * sc, S * 1.4 * sc, 0.5);
      for (const b of s.eproj) if (b.kind === 'orb') light(dctx, X(b.x) * sc, Y(b.y) * sc, S * 1.2 * sc, 0.45);
      if (m.seen[si] && !s.stairsLocked) light(dctx, X(m.stairs.x + 0.5) * sc, Y(m.stairs.y + 0.5) * sc, S * 2 * sc, 0.5);
      ctx.drawImage(dark, 0, 0, W, H);
      const warm = ctx.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), S * 6);
      warm.addColorStop(0, 'rgba(244,184,96,0.13)'); warm.addColorStop(1, 'rgba(244,184,96,0)');
      ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);

      // ----- Barras de vida enemigas -----
      for (const e of s.enemies) {
        if (e.hp >= e.maxHp || e.boss || !m.vis[Math.floor(e.y) * m.w + Math.floor(e.x)]) continue;
        const w = Math.max(S * 0.6, e.r * S * 2.2), x = X(e.x) - w / 2, y = Y(e.y) - e.r * S - S * 0.28;
        ctx.fillStyle = 'rgba(10,6,14,0.8)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
        ctx.fillStyle = e.elite ? C.gold : '#d0644a'; ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 3);
      }

      // ----- Textos flotantes -----
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (const tx of s.texts) {
        const a = 1 - Math.max(0, (tx.t - tx.life * 0.6) / (tx.life * 0.4));
        const size = { crit: 0.52, big: 0.6, hurt: 0.42, heal: 0.42, info: 0.34, burn: 0.3, gold: 0.4 }[tx.kind] || 0.36;
        const pop = tx.kind === 'crit' ? 1 + Math.max(0, 0.15 - tx.t) * 3 : 1;
        ctx.font = `800 ${Math.round(S * size * pop)}px 'Alegreya Sans', system-ui, sans-serif`;
        ctx.globalAlpha = a;
        ctx.strokeStyle = 'rgba(12,8,18,0.9)'; ctx.lineWidth = 3;
        ctx.strokeText(tx.str, X(tx.x), Y(tx.y));
        ctx.fillStyle = { crit: C.ember, hurt: '#ff7a5c', heal: C.moss, info: '#9fd3c6', burn: '#f08a3c', big: C.gold, gold: '#ffd77a' }[tx.kind] || C.bone;
        ctx.fillText(tx.str, X(tx.x), Y(tx.y));
      }
      ctx.globalAlpha = 1;
      if (p.hurtT > 0 && !R.reduced) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, 'rgba(196,60,40,0)'); g.addColorStop(1, `rgba(196,60,40,${p.hurtT * 0.6})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    };

    function drawChest(c, x, y, S, open, t) {
      const w = S * 0.66, h = S * 0.42;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + h * 0.6, w * 0.6, h * 0.25, 0, 0, TAU); c.fill();
      c.fillStyle = '#6e4630'; c.fillRect(x - w / 2, y - h * 0.15, w, h * 0.7);
      c.fillStyle = '#c9a24a'; c.fillRect(x - w / 2, y + h * 0.05, w, h * 0.1); c.fillRect(x - w * 0.36, y - h * 0.15, w * 0.1, h * 0.7); c.fillRect(x + w * 0.26, y - h * 0.15, w * 0.1, h * 0.7);
      if (open) {
        c.fillStyle = '#1a1220'; c.fillRect(x - w * 0.44, y - h * 0.22, w * 0.88, h * 0.18);
        c.fillStyle = '#5e3b25'; c.fillRect(x - w / 2, y - h * 0.85, w, h * 0.55);
        c.fillStyle = '#c9a24a'; c.fillRect(x - w / 2, y - h * 0.4, w, h * 0.08);
      } else {
        c.fillStyle = '#8a5a3a'; c.beginPath(); c.moveTo(x - w / 2, y - h * 0.15); c.lineTo(x - w / 2, y - h * 0.45); c.quadraticCurveTo(x, y - h * 0.85, x + w / 2, y - h * 0.45); c.lineTo(x + w / 2, y - h * 0.15); c.closePath(); c.fill();
        c.fillStyle = '#f0c35a'; c.fillRect(x - w * 0.07, y - h * 0.25, w * 0.14, h * 0.2);
        const g = 0.25 + Math.sin(t * 3) * 0.15;
        c.strokeStyle = `rgba(240,195,90,${g})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y + h * 0.2, w * 0.7, h * 0.85, 0, 0, TAU); c.stroke();
      }
    }
    function drawPedestal(c, s, it, x, y, S, t) {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + S * 0.32, S * 0.42, S * 0.12, 0, 0, TAU); c.fill();
      c.fillStyle = '#4a4152'; c.fillRect(x - S * 0.34, y + S * 0.02, S * 0.68, S * 0.3);
      c.fillStyle = '#5e5468'; c.fillRect(x - S * 0.4, y - S * 0.04, S * 0.8, S * 0.1);
      if (it.sold) return;
      const fy = y - S * 0.32 + Math.sin(t * 2.2) * S * 0.04;
      const glow = it.cat === 'weapon' ? G.RARITIES[it.w.rarity].color : it.cat === 'relic' ? G.RELIC_MAP[it.relic].color : it.cat === 'companion' ? G.COMPANIONS[it.comp].color : it.cat === 'pack' ? '#b98be8' : '#f4b860';
      const g = c.createRadialGradient(x, fy, 0, x, fy, S * 0.55);
      g.addColorStop(0, glow + '55'); g.addColorStop(1, glow + '00');
      c.fillStyle = g; c.beginPath(); c.arc(x, fy, S * 0.55, 0, TAU); c.fill();
      c.save(); c.translate(x, fy); G.drawShopItem(c, it, S * 0.36, t); c.restore();
      // Precio
      const price = G.shopPrice(s, it), why = G.shopCheck(s, it), poor = s.gold < price;
      const txt = G.fmt(price);
      c.font = `800 ${Math.round(S * 0.28)}px 'Alegreya Sans', system-ui, sans-serif`;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      const tw = c.measureText(txt).width, cw = S * 0.22, total = cw + S * 0.06 + tw, px = x - total / 2, py = y + S * 0.56;
      c.fillStyle = 'rgba(14,10,20,0.78)'; c.fillRect(px - S * 0.1, py - S * 0.18, total + S * 0.2, S * 0.36);
      G.drawCoin(c, px + cw / 2, py, S * 0.1);
      c.fillStyle = poor ? '#e58a74' : why ? '#8d8374' : '#ffd77a';
      c.fillText(txt, px + cw + S * 0.06, py + 1);
      if (it.stock > 1) { c.font = `700 ${Math.round(S * 0.22)}px 'Alegreya Sans', system-ui, sans-serif`; c.fillStyle = '#bdb29c'; c.textAlign = 'center'; c.fillText('×' + it.stock, x + S * 0.42, fy - S * 0.28); }
    }

    function drawProjectile(c, pr, x, y, S, enemy) {
      const a = Math.atan2(pr.vy, pr.vx);
      c.save(); c.translate(x, y); c.rotate(a);
      const kind = enemy ? pr.kind : pr.icon;
      if (kind === 'orb' || kind === 'wand' || kind === 'staff' || kind === 'wisp') {
        const col = enemy ? (pr.color || '#b07cff') : (kind === 'staff' ? '#c9a8ff' : pr.color);
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = S * 0.5;
        c.beginPath(); c.arc(0, 0, pr.r * S * 1.1, 0, TAU); c.fill(); c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(0, 0, pr.r * S * 0.45, 0, TAU); c.fill();
      } else if (kind === 'sling') {
        c.fillStyle = '#a7a2a8'; c.beginPath(); c.arc(0, 0, S * 0.08, 0, TAU); c.fill();
      } else if (kind === 'knives') {
        c.rotate(pr.spin); bar(c, -S * 0.12, 0, S * 0.05, C.woodD); blade(c, 0, S * 0.18, S * 0.06, C.metal);
      } else {
        const len = kind === 'xbow' || kind === 'handxbow' ? 0.32 : 0.45;
        c.strokeStyle = enemy ? '#cfc2a4' : '#c9b48e'; c.lineWidth = Math.max(1.5, S * 0.035);
        c.beginPath(); c.moveTo(-len * S, 0); c.lineTo(0, 0); c.stroke();
        c.fillStyle = enemy ? '#e9dfc8' : C.metal; c.beginPath(); c.moveTo(S * 0.08, 0); c.lineTo(-S * 0.04, -S * 0.05); c.lineTo(-S * 0.04, S * 0.05); c.fill();
        c.fillStyle = enemy ? '#a8432f' : (pr.color || C.bone); c.fillRect(-len * S, -S * 0.04, S * 0.08, S * 0.08);
      }
      c.restore();
    }

    function drawPlayer(c, s, x, y, S, t) {
      const p = s.player, r = p.r * S, f = p.facing;
      const blink = p.iframes > 0 && p.dashT <= 0 && p.hurtT > 0 && Math.floor(t * 24) % 2 === 0;
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(x, y + r * 0.8, r * 1.0, r * 0.42, 0, 0, TAU); c.fill();
      if (blink) c.globalAlpha = 0.45;
      const bob = p.moving ? Math.sin(p.walkT * 14) * r * 0.06 : 0;
      const hands = p.hands, two = hands.L && hands.L === hands.R;

      const drawHand = (k, side) => {
        const w = k === 'B' ? hands.L : hands[k];
        const icon = w ? w.icon : 'fists';
        const L = S * (G.ICON_LEN[icon] || 0.6) * (k === 'B' ? 1.05 : 0.95);
        const anim = Math.max(0, p.anim[k]), prog = anim > 0 ? 1 - anim / 0.2 : 1;
        let ang = anim > 0 ? p.aim[k] : f + side * 0.55;
        let push = 0;
        if (w && w.kind === 'melee' && anim > 0) {
          if (w.arc <= 40) push = Math.sin(prog * Math.PI) * S * 0.35;
          else { const half = Math.min(1.3, w.arc * Math.PI / 360); ang = p.aim[k] - half + half * 2 * (1 - Math.pow(1 - prog, 3)); }
        } else if (w && w.kind === 'ranged' && anim > 0) push = -Math.sin(prog * Math.PI) * S * 0.08;
        else if (!w && anim > 0) push = Math.sin(prog * Math.PI) * S * 0.3;   // puñetazo
        const guarding = p.guard && w && w.kind === 'shield';
        const ha = guarding ? f + side * 0.3 : f + side * 1.05;
        const hx = x + Math.cos(ha) * r * 0.85 + Math.cos(ang) * push, hy = y + bob + Math.sin(ha) * r * 0.85 + Math.sin(ang) * push;
        c.save(); c.translate(hx, hy);
        if (w && w.kind === 'shield') { c.rotate(f); c.translate(r * (guarding ? 0.55 : 0.15), 0); G.drawWeapon(c, 'shield', L * (guarding ? 1.25 : 1), G.RARITIES[w.rarity].color); }
        else if (w && (icon === 'bow' || icon === 'recurve' || icon === 'xbow' || icon === 'handxbow' || icon === 'staff' || icon === 'wand' || icon === 'sling' || icon === 'knives')) { c.rotate(anim > 0 ? p.aim[k] : f); G.drawWeapon(c, icon, L, G.RARITIES[w.rarity].color); }
        else { c.rotate(ang); G.drawWeapon(c, icon, L, w ? G.RARITIES[w.rarity].color : C.bone); }
        c.restore();
        c.fillStyle = '#d9c7a8'; c.beginPath(); c.arc(hx, hy, Math.max(2, r * 0.22), 0, TAU); c.fill();
      };

      // Arma detrás del cuerpo según hacia dónde mire
      const backSide = Math.sin(f) < 0 ? 1 : -1;
      if (!two) { const kb = backSide === 1 ? 'R' : 'L'; if (hands[kb] || kb === 'R' || p.anim[kb] > 0) drawHand(kb, backSide); }
      // Cuerpo: capa verdín con capucha
      c.fillStyle = p.hurtT > 0 ? '#e8826b' : '#3f8576';
      c.beginPath(); c.arc(x, y + bob, r, 0, TAU); c.fill();
      c.fillStyle = p.hurtT > 0 ? '#f0a08a' : '#5fae9c';
      c.beginPath(); c.arc(x - Math.cos(f) * r * 0.12, y + bob - Math.sin(f) * r * 0.12, r * 0.78, 0, TAU); c.fill();
      c.fillStyle = '#e2cfae'; c.beginPath(); c.arc(x + Math.cos(f) * r * 0.42, y + bob + Math.sin(f) * r * 0.42, r * 0.34, 0, TAU); c.fill();
      c.fillStyle = '#2a4f47'; c.beginPath(); c.arc(x + Math.cos(f) * r * 0.42 + Math.cos(f + 1.57) * r * 0.13, y + bob + Math.sin(f) * r * 0.42 + Math.sin(f + 1.57) * r * 0.13, r * 0.06, 0, TAU); c.arc(x + Math.cos(f) * r * 0.42 - Math.cos(f + 1.57) * r * 0.13, y + bob + Math.sin(f) * r * 0.42 - Math.sin(f + 1.57) * r * 0.13, r * 0.06, 0, TAU); c.fill();
      if (two) drawHand('B', 0.4);
      else { const kf = backSide === 1 ? 'L' : 'R'; if (hands[kf] || kf === 'R' || p.anim[kf] > 0) drawHand(kf, -backSide); }
      c.globalAlpha = 1;
    }

    /* ---------- Minimapa ---------- */
    const mini = document.createElement('canvas'), mctx = mini.getContext('2d');
    R.drawMinimap = function (cv, s) {
      const c = cv.getContext('2d'), m = s.map, W = cv.width, H = cv.height;
      if (mini.width !== m.w || mini.height !== m.h) { mini.width = m.w; mini.height = m.h; }
      const img = mctx.createImageData(m.w, m.h), d = img.data;
      for (let i = 0; i < m.w * m.h; i++) {
        if (!m.seen[i]) continue;
        const o = i * 4;
        if (m.tiles[i] === G.FLOOR) { const v = m.vis[i]; d[o] = v ? 150 : 92; d[o + 1] = v ? 138 : 82; d[o + 2] = v ? 156 : 100; d[o + 3] = 255; }
        else { d[o] = 52; d[o + 1] = 45; d[o + 2] = 60; d[o + 3] = 255; }
      }
      mctx.putImageData(img, 0, 0);
      c.clearRect(0, 0, W, H);
      const k = Math.min(W / m.w, H / m.h), ox = (W - m.w * k) / 2, oy = (H - m.h * k) / 2;
      c.imageSmoothingEnabled = false;
      c.drawImage(mini, ox, oy, m.w * k, m.h * k);
      const dot = (x, y, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(ox + x * k, oy + y * k, r, 0, TAU); c.fill(); };
      for (const it of s.items) {
        if (!m.seen[Math.floor(it.y) * m.w + Math.floor(it.x)]) continue;
        if (it.kind === 'weapon') dot(it.x, it.y, G.RARITIES[it.w.rarity].color, Math.max(1.5, k * 0.6));
        else if (it.kind === 'chest' && !it.open) dot(it.x, it.y, '#c9a24a', Math.max(2, k * 0.8));
        else if (it.kind === 'shop' && !it.sold) dot(it.x, it.y, '#f0c35a', Math.max(1.5, k * 0.5));
        else if (it.kind === 'merchant') dot(it.x, it.y, '#b98be8', Math.max(2.5, k * 0.9));
      }
      if (m.seen[m.stairs.y * m.w + m.stairs.x]) { c.fillStyle = s.stairsLocked ? '#8b90a0' : C.ember; c.fillRect(ox + m.stairs.x * k - k, oy + m.stairs.y * k - k, k * 3, k * 3); }
      if (s.boss && m.seen[Math.floor(s.boss.y) * m.w + Math.floor(s.boss.x)]) dot(s.boss.x, s.boss.y, C.blood, Math.max(2.5, k * 1.2));
      dot(s.player.x, s.player.y, '#7fe0c8', Math.max(2.5, k * 1.1));
    };

    R.resize();
    return R;
  };
})(window.G);
