'use strict';
/* =========================================================================
   DUNGEONMESS · Datos del juego
   Todo lo que define el contenido (armas, enemigos, jefes, mejoras, árbol)
   vive aquí para poder ajustarlo sin tocar el motor.
   ========================================================================= */
window.G = window.G || {};
(function (G) {
  G.VERSION = '0.3.0';
  G.SAVE_KEY = 'dungeonmess.save.v1';
  G.OLD_SAVE_KEYS = ['descenso.save.v1'];   // nombre anterior del juego: se migra al cargar

  /* ---------- Equilibrio general ---------- */
  G.BAL = {
    enemyHp: 1.25,        // multiplicador de vida enemiga por piso
    enemyDmg: 1.12,       // multiplicador de daño enemigo por piso
    weaponGrowth: 1.10,   // multiplicador de daño de armas por nivel de objeto (= piso)
    eliteBase: 0.05, eliteFloor: 0.01, eliteMax: 0.25,
    weaponDrop: 0.05,     // probabilidad base de que un enemigo suelte un arma
    potionDrop: 0.06,
    soulPerXp: 0.20,      // almas por punto de experiencia base del enemigo
    soulFloorGrowth: 0.08, // almas extra por piso
    xpFloorGrowth: 0.25,  // experiencia extra por piso
    visRadius: 8,         // radio de la antorcha (en casillas)
    // Economía: el oro y los precios crecen con el mismo factor por piso
    econGrowth: 1.10,     // multiplicador de oro y precios por piso
    goldDrop: 0.45,       // probabilidad de que un enemigo suelte monedas
    chestChance: 0.55,    // probabilidad de un cofre por piso (y 15% de un segundo)
    potionHeal: 0.35,     // curación de las pociones del cinturón
    shortcutGold: 30,     // oro por piso saltado al empezar más abajo con Atajo
  };
  G.econ = f => Math.pow(G.BAL.econGrowth, f - 1);
  /* Tras estos pisos hay un mercado antes de seguir bajando: después de cada jefe y a mitad de ciclo. */
  G.isShopAfter = f => f % 5 === 0 || f % 5 === 2;

  /* ---------- Utilidades ---------- */
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.angDiff = function (a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  G.dec = (n, d) => n.toFixed(d === undefined ? 1 : d).replace('.', ',');
  G.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    const a = Math.abs(n);
    if (a < 1000) return String(Math.round(n) || (n > 0 ? 1 : 0));
    const units = ['K', 'M', 'G', 'T', 'P', 'E', 'Z'];
    let i = -1, v = a;
    while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
    const s = v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace('.', ',').replace(/,0$/, '');
    return (n < 0 ? '-' : '') + s + units[i];
  };
  G.makeRng = function (seed) {
    let a = (seed >>> 0) || 1;
    const r = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (min, max) => min + Math.floor(r() * (max - min + 1));
    r.range = (min, max) => min + r() * (max - min);
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    return r;
  };

  /* ---------- Rarezas (nombres en femenino: concuerdan con «arma») ---------- */
  G.RARITIES = [
    { id: 'comun',      name: 'Común',      color: '#cfc6b2', mult: 1.00, affixes: 0, weight: 60 },
    { id: 'rara',       name: 'Rara',       color: '#6fb3d9', mult: 1.25, affixes: 0, weight: 27 },
    { id: 'epica',      name: 'Épica',      color: '#b98be8', mult: 1.55, affixes: 1, weight: 10 },
    { id: 'legendaria', name: 'Legendaria', color: '#f3b84e', mult: 2.00, affixes: 2, weight: 3 },
  ];

  G.KIND_LABEL = { melee: 'cuerpo a cuerpo', ranged: 'a distancia', shield: 'escudo' };

  /* ---------- Armas base ----------
     g: género gramatical del nombre (m, f, mp) para concordar los adjetivos.
     dmg: daño por golpe/proyectil · cd: segundos entre ataques · range: casillas
     arc: grados del barrido (cuerpo a cuerpo) · kb: empuje · stun: prob. de aturdir
     pspeed: velocidad del proyectil · pierce: enemigos que atraviesa · shots: proyectiles
     homing: giro teledirigido (rad/s) · aoe: radio de explosión */
  G.WEAPONS = {
    daga:      { name: 'Daga',                  g: 'f',  kind: 'melee',  hands: 1, dmg: 6,  cd: 0.34, range: 1.15, arc: 70,  crit: 0.10, kb: 0.5, icon: 'dagger' },
    espada:    { name: 'Espada corta',          g: 'f',  kind: 'melee',  hands: 1, dmg: 10, cd: 0.55, range: 1.4,  arc: 100, kb: 0.9, icon: 'sword' },
    hacha:     { name: 'Hacha de mano',         g: 'f',  kind: 'melee',  hands: 1, dmg: 14, cd: 0.78, range: 1.3,  arc: 90,  kb: 1.4, icon: 'axe' },
    maza:      { name: 'Maza',                  g: 'f',  kind: 'melee',  hands: 1, dmg: 13, cd: 0.72, range: 1.3,  arc: 80,  kb: 1.3, stun: 0.15, icon: 'mace' },
    mandoble:  { name: 'Mandoble',              g: 'm',  kind: 'melee',  hands: 2, dmg: 24, cd: 0.95, range: 1.9,  arc: 150, kb: 1.8, icon: 'greatsword' },
    hachagu:   { name: 'Hacha de guerra',       g: 'f',  kind: 'melee',  hands: 2, dmg: 33, cd: 1.25, range: 1.7,  arc: 120, kb: 2.6, icon: 'greataxe' },
    lanza:     { name: 'Lanza',                 g: 'f',  kind: 'melee',  hands: 2, dmg: 19, cd: 0.70, range: 2.5,  arc: 30,  kb: 1.2, icon: 'spear' },
    martillo:  { name: 'Martillo de guerra',    g: 'm',  kind: 'melee',  hands: 2, dmg: 38, cd: 1.45, range: 1.6,  arc: 140, kb: 3.0, stun: 0.35, icon: 'hammer' },
    honda:     { name: 'Honda',                 g: 'f',  kind: 'ranged', hands: 1, dmg: 8,  cd: 0.62, range: 6,    pspeed: 10, kb: 0.4, icon: 'sling' },
    cuchillos: { name: 'Cuchillos arrojadizos', g: 'mp', kind: 'ranged', hands: 1, dmg: 6,  cd: 0.38, range: 5.5,  pspeed: 13, icon: 'knives' },
    varita:    { name: 'Varita',                g: 'f',  kind: 'ranged', hands: 1, dmg: 9,  cd: 0.70, range: 7,    pspeed: 8,  homing: 2.5, icon: 'wand' },
    ballestam: { name: 'Ballesta de mano',      g: 'f',  kind: 'ranged', hands: 1, dmg: 12, cd: 0.90, range: 7,    pspeed: 15, pierce: 1, icon: 'handxbow' },
    arco:      { name: 'Arco largo',            g: 'm',  kind: 'ranged', hands: 2, dmg: 18, cd: 0.82, range: 9,    pspeed: 14, pierce: 1, icon: 'bow' },
    arcorec:   { name: 'Arco recurvo',          g: 'm',  kind: 'ranged', hands: 2, dmg: 9,  cd: 0.85, range: 7.5,  pspeed: 13, shots: 3, spread: 14, icon: 'recurve' },
    ballesta:  { name: 'Ballesta pesada',       g: 'f',  kind: 'ranged', hands: 2, dmg: 32, cd: 1.45, range: 9,    pspeed: 18, pierce: 2, kb: 1.5, icon: 'xbow' },
    baston:    { name: 'Bastón arcano',         g: 'm',  kind: 'ranged', hands: 2, dmg: 16, cd: 1.10, range: 7,    pspeed: 9,  aoe: 1.3, icon: 'staff' },
    escudo:    { name: 'Escudo',                g: 'm',  kind: 'shield', hands: 1, block: 0.25, armor: 10, weight: 0.6, icon: 'shield' },
  };
  G.FISTS = { name: 'Puños', base: 'fists', g: 'mp', kind: 'melee', hands: 1, dmg: 3, cd: 0.5, range: 0.95, arc: 80, kb: 0.5, icon: 'fists', rarity: 0, affixes: [], ilvl: 1 };

  /* ---------- Afijos (solo épicas y legendarias) ---------- */
  G.AFFIXES = [
    { id: 'vamp',     forms: { m: 'vampírico', f: 'vampírica', mp: 'vampíricos' }, desc: 'Roba un 4% del daño como vida', kinds: ['melee', 'ranged'], apply(w) { w.lifesteal = (w.lifesteal || 0) + 0.04; } },
    { id: 'veloz',    forms: { m: 'veloz', f: 'veloz', mp: 'veloces' }, desc: 'Ataca un 20% más rápido', kinds: ['melee', 'ranged'], apply(w) { w.cd /= 1.2; } },
    { id: 'afilado',  forms: { m: 'afilado', f: 'afilada', mp: 'afilados' }, desc: '+12% de probabilidad de crítico', kinds: ['melee', 'ranged'], apply(w) { w.crit = (w.crit || 0) + 0.12; } },
    { id: 'gelido',   forms: { m: 'gélido', f: 'gélida', mp: 'gélidos' }, desc: 'Ralentiza un 40% durante 1,5 s', kinds: ['melee', 'ranged'], apply(w) { w.slow = 0.4; } },
    { id: 'igneo',    forms: { m: 'ígneo', f: 'ígnea', mp: 'ígneos' }, desc: 'Quema: un 40% extra del golpe en 2 s', kinds: ['melee', 'ranged'], apply(w) { w.burn = 0.4; } },
    { id: 'pesado',   forms: { m: 'pesado', f: 'pesada', mp: 'pesados' }, desc: '+60% de empuje y un 10% de aturdir', kinds: ['melee'], apply(w) { w.kb = (w.kb || 0.8) * 1.6; w.stun = (w.stun || 0) + 0.10; } },
    { id: 'certero',  forms: { m: 'certero', f: 'certera', mp: 'certeros' }, desc: 'Atraviesa un enemigo más', kinds: ['ranged'], apply(w) { w.pierce = (w.pierce || 0) + 1; } },
    { id: 'robusto',  forms: { m: 'robusto', f: 'robusta', mp: 'robustos' }, desc: '+12 de armadura', kinds: ['shield'], apply(w) { w.armor += 12; } },
    { id: 'espinoso', forms: { m: 'espinoso', f: 'espinosa', mp: 'espinosos' }, desc: 'Al bloquear, devuelve un golpe con tu arma', kinds: ['shield'], apply(w) { w.thorns = 1; } },
  ];
  G.AFFIX_MAP = {};
  for (const a of G.AFFIXES) G.AFFIX_MAP[a.id] = a;

  /* ---------- Enemigos ----------
     min: primer piso en el que aparecen · w: peso de aparición
     ranged: dispara · keep: distancia que intenta mantener · wind: preparación del ataque (telegrafiado) */
  G.ENEMIES = {
    rata:    { name: 'Rata',              hp: 14,  dmg: 5,  spd: 3.3, r: 0.24, range: 0.55, cd: 0.9, wind: 0.25, xp: 2,  min: 1, w: 10, shape: 'rat' },
    esq:     { name: 'Esqueleto',         hp: 28,  dmg: 9,  spd: 2.3, r: 0.32, range: 0.7,  cd: 1.1, wind: 0.35, xp: 4,  min: 1, w: 10, shape: 'skel' },
    arquero: { name: 'Esqueleto arquero', hp: 20,  dmg: 8,  spd: 2.0, r: 0.30, ranged: true, range: 6, keep: 4, cd: 1.9, wind: 0.5, pspeed: 7, xp: 5, min: 2, w: 6, shape: 'archer', proj: 'arrow' },
    limo:    { name: 'Limo',              hp: 40,  dmg: 8,  spd: 1.5, r: 0.38, range: 0.65, cd: 1.0, wind: 0.3,  xp: 4,  min: 3, w: 6, split: 2, shape: 'slime' },
    limito:  { name: 'Limo pequeño',      hp: 13,  dmg: 5,  spd: 2.2, r: 0.22, range: 0.5,  cd: 0.9, wind: 0.25, xp: 1,  min: 99, w: 0, shape: 'slime' },
    murci:   { name: 'Murciélago',        hp: 11,  dmg: 6,  spd: 4.3, r: 0.22, range: 0.5,  cd: 0.8, wind: 0.15, xp: 3,  min: 4, w: 7, erratic: true, shape: 'bat' },
    bruto:   { name: 'Bruto',             hp: 105, dmg: 19, spd: 1.8, r: 0.48, range: 0.9,  cd: 1.6, wind: 0.55, xp: 12, min: 5, w: 4, kbres: 0.7, shape: 'brute' },
    brujo:   { name: 'Brujo',             hp: 36,  dmg: 11, spd: 1.9, r: 0.32, ranged: true, range: 6.5, keep: 4.5, cd: 2.6, wind: 0.6, pspeed: 5.5, shots: 3, spread: 22, homing: 1.1, xp: 9, min: 6, w: 4, shape: 'mage', proj: 'orb' },
    caball:  { name: 'Caballero hueco',   hp: 85,  dmg: 15, spd: 2.2, r: 0.40, range: 0.85, cd: 1.2, wind: 0.4,  xp: 11, min: 8, w: 4, rangedRes: 0.4, kbres: 0.4, shape: 'knight' },
  };

  /* ---------- Jefes (cada 5 pisos, en rotación) ---------- */
  G.BOSSES = [
    { id: 'carcelero', name: 'El Carcelero',    color: '#a8432f', hp: 520, dmg: 16, spd: 2.0, r: 0.80, range: 1.0, cd: 1.4, wind: 0.5, every: 3.6, moves: ['slam', 'charge', 'summon', 'charge'], adds: ['esq', 'rata'] },
    { id: 'liche',     name: 'La Reina Liche',  color: '#8a6bd6', hp: 440, dmg: 14, spd: 1.7, r: 0.70, range: 0.9, cd: 1.6, wind: 0.5, every: 3.0, keep: 3.5, moves: ['ring', 'volley', 'summon', 'volley'], adds: ['esq', 'murci'] },
    { id: 'golem',     name: 'Gólem de huesos', color: '#d8ccb2', hp: 700, dmg: 20, spd: 1.5, r: 0.95, range: 1.1, cd: 1.8, wind: 0.6, every: 3.4, moves: ['slam', 'ring', 'charge'], adds: ['bruto'] },
  ];

  /* ---------- Mejoras al subir de nivel (durante la partida) ---------- */
  G.BOONS = [
    { id: 'fuerza',      name: 'Fuerza',          desc: '+10% de daño', max: 99 },
    { id: 'celeridad',   name: 'Celeridad',       desc: '+8% de velocidad de ataque', max: 99 },
    { id: 'robustez',    name: 'Robustez',        desc: '+15% de vida máxima y te cura un 30%', max: 99 },
    { id: 'pies',        name: 'Pies ligeros',    desc: '+7% de velocidad de movimiento', max: 6 },
    { id: 'ojo',         name: 'Ojo certero',     desc: '+6% de probabilidad de crítico', max: 8 },
    { id: 'sanguijuela', name: 'Sanguijuela',     desc: '+2% de robo de vida', max: 8 },
    { id: 'filo',        name: 'Filo largo',      desc: '+12% de alcance cuerpo a cuerpo', max: 5 },
    { id: 'puntas',      name: 'Puntas de acero', desc: 'Tus proyectiles atraviesan un enemigo más', max: 3 },
    { id: 'piel',        name: 'Piel de piedra',  desc: '+8 de armadura', max: 99 },
    { id: 'regen',       name: 'Savia',           desc: 'Regeneras un 0,5% de vida por segundo', max: 6 },
    { id: 'mortal',      name: 'Golpe mortal',    desc: '+25% de daño crítico', max: 6 },
    { id: 'fenix',       name: 'Pluma de fénix',  desc: 'Revives una vez con un 40% de vida', max: 1, rare: true },
  ];
  G.BOON_MAP = {};
  for (const b of G.BOONS) G.BOON_MAP[b.id] = b;

  /* ---------- Reliquias: habilidades pasivas que se compran en el mercado ----------
     Duran toda la partida. Cada una solo se puede tener una vez. price: precio base (×econ) */
  G.RELICS = [
    { id: 'bolsa',    name: 'Bolsa sin fondo',        desc: '+30% de oro de todas las fuentes', price: 65, color: '#f0c35a' },
    { id: 'brasas',   name: 'Corona de brasas',       desc: 'Los enemigos que matas explotan y hieren a los que tienen cerca', price: 100, color: '#f08a3c' },
    { id: 'caliz',    name: 'Cáliz de sangre',        desc: 'Cada enemigo que matas te cura un 2% de la vida máxima', price: 90, color: '#c4553b' },
    { id: 'espinas',  name: 'Cota de espinas',        desc: 'Quien te golpea cuerpo a cuerpo recibe un golpe de tu arma', price: 85, color: '#a7abb8' },
    { id: 'alas',     name: 'Botas aladas',           desc: '+12% de velocidad y la voltereta recarga un 40% antes', price: 70, color: '#9fd3c6' },
    { id: 'cuervo',   name: 'Ojo del cuervo',         desc: 'La antorcha alumbra 3 casillas más y las escaleras salen en el mapa', price: 60, color: '#b98be8' },
    { id: 'gemelos',  name: 'Guanteletes gemelos',    desc: 'Con dos armas, +25% de daño', price: 90, color: '#b98be8' },
    { id: 'gigante',  name: 'Cinturón del gigante',   desc: 'Armas a dos manos: +30% de daño y +15% de alcance', price: 90, color: '#d0644a' },
    { id: 'trebol',   name: 'Trébol de cuatro hojas', desc: '+8% de crítico y botín de más rareza', price: 80, color: '#8bb174' },
    { id: 'reloj',    name: 'Reloj de arena',         desc: '+15% de velocidad de ataque', price: 95, color: '#e9dfc8' },
    { id: 'escarcha', name: 'Corazón de escarcha',    desc: 'Todos tus golpes ralentizan un 25%', price: 75, color: '#6fb3d9' },
    { id: 'colmillo', name: 'Colmillo de vampiro',    desc: '+3% de robo de vida', price: 85, color: '#d9654a' },
  ];
  G.RELIC_MAP = {};
  for (const r of G.RELICS) G.RELIC_MAP[r.id] = r;

  /* ---------- Compañeros: espíritus que te acompañan toda la partida ----------
     No pueden morir. Comprar otra vez el mismo sube su nivel (máximo 5).
     dmg crece con el piso igual que las armas y un 50% por nivel. */
  G.COMPANIONS = {
    lobo:  { name: 'Lobo espectral',  desc: 'Corre hacia los enemigos y los muerde', kind: 'melee',  dmg: 9,  cd: 0.75, range: 0.5, spd: 5.4, r: 0.26, price: 90,  color: '#9fb4c8' },
    fatuo: { name: 'Fuego fatuo',     desc: 'Flota a tu lado y lanza llamas que persiguen al enemigo', kind: 'ranged', dmg: 8, cd: 1.0, range: 6.5, pspeed: 8, r: 0.16, price: 100, color: '#7fe0c8' },
    golem: { name: 'Gólem de bronce', desc: 'Lento, pero aplasta en área y aturde', kind: 'slam', dmg: 18, cd: 1.7, range: 0.6, aoe: 1.3, spd: 2.9, r: 0.36, price: 115, color: '#c98a3a' },
    hada:  { name: 'Hada sanadora',   desc: 'Te cura cada 5 segundos si estás herido', kind: 'heal', heal: 0.04, cd: 5, r: 0.13, price: 105, color: '#f3b8e0' },
  };
  G.COMPANION_IDS = Object.keys(G.COMPANIONS);
  G.COMPANION_MAX_LVL = 5;

  /* ---------- Mercado ---------- */
  G.SHOP = {
    potion: 22, heal: 35, tome: 55, reroll: 15,   // precios base (×econ)
    pack: 95, packGrowth: 0.35, packStock: 2,      // paquete sorpresa: precio base, subida por cada uno comprado y existencias
    potionStock: 3,
    rarityPrice: [1, 1.8, 3.2, 5.5],              // multiplicador del precio de un arma por rareza
    meltRarity: [0.25, 0.4, 0.65, 1],             // fracción del precio base que da fundir, por rareza
    weaponBase: 22,
  };

  /* ---------- Árbol de habilidades (permanente, se compra con almas) ----------
     depth: anillo desde el centro · slot: desplazamiento lateral dentro de la rama
     cost: [base, crecimiento] → coste del nivel n = base · crecimiento^n
     req: [id, nivel mínimo] */
  G.BRANCHES = {
    root:     { name: 'Origen',     color: '#e9dfc8', angle: 0 },
    doble:    { name: 'Doble filo', color: '#b98be8', angle: -90 },
    punteria: { name: 'Puntería',   color: '#5fae9c', angle: -30 },
    fortuna:  { name: 'Fortuna',    color: '#f0c35a', angle: 30 },
    vigor:    { name: 'Vigor',      color: '#8bb174', angle: 150 },
    acero:    { name: 'Acero',      color: '#d0644a', angle: 210 },
    comercio: { name: 'Comercio',   color: '#6fb3d9', angle: 90 },
  };
  const pct = n => Math.round(n) + '%';
  G.SKILLS = [
    { id: 'root', branch: 'root', depth: 0, slot: 0, name: 'Despertar', max: 0, cost: [0, 1], req: null,
      fx: () => 'Aquí empieza todo. Cada vez que caes conservas las almas que hayas reunido.' },

    // Doble filo: llevar dos armas a la vez
    { id: 'd1', branch: 'doble', depth: 1, slot: 0, name: 'Ambidiestro', max: 6, cost: [15, 1.55], req: ['root', 0],
      fx: l => `Con dos armas, cada una hace un ${85 + 5 * l}% de su daño (base 85%)` },
    { id: 'd2', branch: 'doble', depth: 2, slot: -1, name: 'Ritmo', max: 10, cost: [20, 1.45], req: ['d1', 1],
      fx: l => `+${pct(4 * l)} de velocidad de ataque` },
    { id: 'd3', branch: 'doble', depth: 2, slot: 1, name: 'Golpe cruzado', max: 5, cost: [25, 1.55], req: ['d1', 2],
      fx: l => `+${pct(3 * l)} de crítico al llevar dos armas` },
    { id: 'd4', branch: 'doble', depth: 3, slot: 0, name: 'Tempestad', max: 5, cost: [70, 1.65], req: ['d2', 3],
      fx: l => `Con dos armas, cada golpe adelanta ${G.dec(0.04 * l, 2)} s el siguiente de la otra` },

    // Acero: cuerpo a cuerpo
    { id: 'a1', branch: 'acero', depth: 1, slot: 0, name: 'Brazo firme', max: 15, cost: [10, 1.42], req: ['root', 0],
      fx: l => `+${pct(6 * l)} de daño cuerpo a cuerpo` },
    { id: 'a2', branch: 'acero', depth: 2, slot: -1, name: 'Alcance', max: 5, cost: [20, 1.55], req: ['a1', 1],
      fx: l => `+${pct(6 * l)} de alcance cuerpo a cuerpo` },
    { id: 'a3', branch: 'acero', depth: 2, slot: 1, name: 'Sed de sangre', max: 5, cost: [30, 1.6], req: ['a1', 3],
      fx: l => `Los golpes cuerpo a cuerpo roban un ${l}% de vida` },
    { id: 'a4', branch: 'acero', depth: 3, slot: -1, name: 'Maestría a dos manos', max: 8, cost: [45, 1.5], req: ['a2', 2],
      fx: l => `+${pct(8 * l)} de daño con armas a dos manos` },
    { id: 'a5', branch: 'acero', depth: 3, slot: 1, name: 'Torbellino', max: 5, cost: [60, 1.6], req: ['a3', 2],
      fx: l => `${pct(4 * l)} de probabilidad de que un golpe barra en círculo` },
    { id: 'a6', branch: 'acero', depth: 4, slot: 0, name: 'Rompehuesos', max: 5, cost: [90, 1.65], req: ['a4', 3],
      fx: l => `${pct(5 * l)} de probabilidad de aturdir cuerpo a cuerpo` },

    // Puntería: a distancia
    { id: 'p1', branch: 'punteria', depth: 1, slot: 0, name: 'Pulso firme', max: 15, cost: [10, 1.42], req: ['root', 0],
      fx: l => `+${pct(6 * l)} de daño a distancia` },
    { id: 'p2', branch: 'punteria', depth: 2, slot: -1, name: 'Flechas veloces', max: 5, cost: [20, 1.55], req: ['p1', 1],
      fx: l => `+${pct(10 * l)} de velocidad de proyectil y +${pct(5 * l)} de alcance` },
    { id: 'p3', branch: 'punteria', depth: 2, slot: 1, name: 'Ojo de halcón', max: 5, cost: [25, 1.55], req: ['p1', 3],
      fx: l => `+${pct(3 * l)} de probabilidad de crítico` },
    { id: 'p4', branch: 'punteria', depth: 3, slot: -1, name: 'Perforación', max: 2, cost: [80, 2.8], req: ['p2', 3],
      fx: l => `Los proyectiles atraviesan ${l} ${l === 1 ? 'enemigo' : 'enemigos'} más` },
    { id: 'p5', branch: 'punteria', depth: 3, slot: 1, name: 'Ráfaga', max: 5, cost: [60, 1.6], req: ['p3', 2],
      fx: l => `${pct(6 * l)} de probabilidad de disparar un proyectil extra` },
    { id: 'p6', branch: 'punteria', depth: 4, slot: 0, name: 'Golpe letal', max: 5, cost: [90, 1.65], req: ['p5', 2],
      fx: l => `+${pct(10 * l)} de daño crítico` },

    // Vigor: supervivencia
    { id: 'v1', branch: 'vigor', depth: 1, slot: 0, name: 'Constitución', max: 15, cost: [10, 1.42], req: ['root', 0],
      fx: l => `+${pct(8 * l)} de vida máxima` },
    { id: 'v2', branch: 'vigor', depth: 2, slot: -1, name: 'Piel curtida', max: 10, cost: [15, 1.45], req: ['v1', 1],
      fx: l => `+${3 * l} de armadura` },
    { id: 'v3', branch: 'vigor', depth: 2, slot: 1, name: 'Zancada', max: 5, cost: [20, 1.55], req: ['v1', 1],
      fx: l => `+${pct(3 * l)} de velocidad de movimiento` },
    { id: 'v4', branch: 'vigor', depth: 3, slot: -1, name: 'Regeneración', max: 5, cost: [50, 1.6], req: ['v2', 3],
      fx: l => `Regeneras un ${G.dec(0.2 * l)}% de vida por segundo` },
    { id: 'v5', branch: 'vigor', depth: 3, slot: 1, name: 'Reflejos', max: 6, cost: [45, 1.55], req: ['v3', 2],
      fx: l => `+${pct(2 * l)} de esquiva y rodar recarga un ${pct(8 * l)} antes` },
    { id: 'v6', branch: 'vigor', depth: 4, slot: 0, name: 'Segundo aliento', max: 2, cost: [180, 2.6], req: ['v4', 2],
      fx: l => `Una vez por partida, revives con un ${l === 1 ? 30 : 50}% de vida` },

    // Fortuna: progresión incremental
    { id: 'f1', branch: 'fortuna', depth: 1, slot: 0, name: 'Codicia', max: 15, cost: [12, 1.45], req: ['root', 0],
      fx: l => `+${pct(10 * l)} de almas` },
    { id: 'f2', branch: 'fortuna', depth: 2, slot: -1, name: 'Buen ojo', max: 5, cost: [25, 1.55], req: ['f1', 1],
      fx: l => `Más armas de rareza alta: +${pct(30 * l)} de épicas y +${pct(45 * l)} de legendarias` },
    { id: 'f3', branch: 'fortuna', depth: 2, slot: 1, name: 'Erudito', max: 5, cost: [25, 1.55], req: ['f1', 1],
      fx: l => `+${pct(10 * l)} de experiencia` },
    { id: 'f4', branch: 'fortuna', depth: 3, slot: -1, name: 'Hallazgos', max: 5, cost: [45, 1.55], req: ['f2', 2],
      fx: l => `Los enemigos sueltan un ${pct(15 * l)} más de armas y pociones` },
    { id: 'f5', branch: 'fortuna', depth: 3, slot: 1, name: 'Atajo', max: 10, cost: [40, 1.6], req: ['f3', 2],
      fx: l => `Puedes empezar hasta en el piso ${1 + 3 * l} (sin pasar de tu récord). Empiezas en un mercado con oro para equiparte` },
    { id: 'f6', branch: 'fortuna', depth: 4, slot: -1, name: 'Arsenal', max: 3, cost: [80, 2.1], req: ['f4', 2],
      fx: l => `Empiezas con un arma ${['rara', 'épica', 'legendaria'][l - 1]} adicional` },
    { id: 'f7', branch: 'fortuna', depth: 4, slot: 1, name: 'Piloto automático', max: 1, cost: [120, 1], req: ['f5', 1],
      fx: () => 'El héroe explora, lucha, recoge armas, compra en el mercado y baja solo. Se activa con la tecla T o el botón Auto.' },
    // Comercio: oro, mercados y compañeros
    { id: 'c1', branch: 'comercio', depth: 1, slot: 0, name: 'Bolsa heredada', max: 5, cost: [15, 1.5], req: ['root', 0],
      fx: l => `Empiezas cada partida con ${40 * l} de oro (más si empiezas en un piso profundo)` },
    { id: 'c2', branch: 'comercio', depth: 2, slot: -1, name: 'Regateo', max: 6, cost: [25, 1.55], req: ['c1', 1],
      fx: l => `El mercader te cobra un ${5 * l}% menos` },
    { id: 'c3', branch: 'comercio', depth: 2, slot: 1, name: 'Saqueador', max: 10, cost: [20, 1.45], req: ['c1', 1],
      fx: l => `+${10 * l}% de oro` },
    { id: 'c4', branch: 'comercio', depth: 3, slot: -1, name: 'Cinturón', max: 3, cost: [60, 1.9], req: ['c2', 2],
      fx: l => `Llevas hasta ${2 + l} pociones y empiezas con ${1 + l}` },
    { id: 'c5', branch: 'comercio', depth: 3, slot: 1, name: 'Lazos', max: 8, cost: [35, 1.5], req: ['c3', 2],
      fx: l => `Tus compañeros hacen y curan un ${15 * l}% más` },
    { id: 'c6', branch: 'comercio', depth: 4, slot: 1, name: 'Manada', max: 2, cost: [150, 2.5], req: ['c5', 2],
      fx: l => `Puedes llevar ${1 + l} compañeros a la vez (sin esta mejora, uno)` },
  ];
  G.SKILL_MAP = {};
  for (const s of G.SKILLS) G.SKILL_MAP[s.id] = s;
})(window.G);
