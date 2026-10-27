'use strict';
/* =========================================================================
   DUNGEONMESS · Generación de mazmorras, visión y búsqueda de caminos
   ========================================================================= */
(function (G) {
  const WALL = 0, FLOOR = 1;
  G.WALL = WALL; G.FLOOR = FLOOR;

  function makeMap(w, h) {
    const n = w * h;
    return {
      w, h, rooms: [],
      tiles: new Uint8Array(n), seen: new Uint8Array(n), vis: new Uint8Array(n), shade: new Uint8Array(n),
      _q: new Int32Array(n), _prev: new Int32Array(n),
    };
  }

  G.walk = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.tiles[y * m.w + x] === FLOOR;
  G.solidAt = (m, x, y) => !G.walk(m, Math.floor(x), Math.floor(y));

  /* Genera un piso: salas rectangulares unidas por pasillos de dos casillas
     (árbol de expansión mínima + algunos bucles). Las escaleras se colocan
     en la sala más alejada del inicio. En los pisos de jefe esa sala se agranda. */
  G.genFloor = function (floor, seed) {
    const rng = G.makeRng(seed);
    const boss = floor % 5 === 0;
    const W = Math.min(44 + floor, 72), H = Math.min(32 + Math.floor(floor / 2), 50);
    const m = makeMap(W, H);
    const set = (x, y) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) m.tiles[y * W + x] = FLOOR; };

    const target = Math.min(7 + Math.floor(floor / 3), 13);
    for (let tries = 0; m.rooms.length < target && tries < 600; tries++) {
      const rw = rng.int(5, 11), rh = rng.int(4, 9);
      const rx = rng.int(2, W - rw - 3), ry = rng.int(2, H - rh - 3);
      if (m.rooms.some(o => rx < o.x + o.w + 2 && rx + rw + 2 > o.x && ry < o.y + o.h + 2 && ry + rh + 2 > o.y)) continue;
      m.rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
    }
    for (const r of m.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y);

    // Árbol de expansión mínima (Prim) sobre los centros de las salas
    const n = m.rooms.length, inTree = new Array(n).fill(false), edges = [];
    inTree[0] = true;
    for (let k = 1; k < n; k++) {
      let best = null, bd = Infinity;
      for (let i = 0; i < n; i++) if (inTree[i]) for (let j = 0; j < n; j++) if (!inTree[j]) {
        const a = m.rooms[i], b = m.rooms[j];
        const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
        if (d < bd) { bd = d; best = [i, j]; }
      }
      inTree[best[1]] = true; edges.push(best);
    }
    const loops = 2 + Math.floor(n / 5);
    for (let k = 0; k < loops; k++) { const i = rng.int(0, n - 1), j = rng.int(0, n - 1); if (i !== j) edges.push([i, j]); }

    const carve2 = (x, y) => { set(x, y); set(x + 1, y); set(x, y + 1); set(x + 1, y + 1); };
    for (const [i, j] of edges) {
      const a = m.rooms[i], b = m.rooms[j];
      let x = a.cx, y = a.cy;
      const horizontalFirst = rng() < 0.5;
      const goX = () => { while (x !== b.cx) { carve2(x, y); x += Math.sign(b.cx - x); } carve2(x, y); };
      const goY = () => { while (y !== b.cy) { carve2(x, y); y += Math.sign(b.cy - y); } carve2(x, y); };
      if (horizontalFirst) { goX(); goY(); } else { goY(); goX(); }
    }

    const start = m.rooms[0];
    const dist = G.bfsField(m, start.cx, start.cy);
    let far = m.rooms[m.rooms.length - 1], fd = -1;
    for (const r of m.rooms) { const d = dist[r.cy * W + r.cx]; if (r !== start && d > fd) { fd = d; far = r; } }

    if (boss) {
      const nw = Math.max(far.w, 13), nh = Math.max(far.h, 10);
      const nx = G.clamp(far.cx - Math.floor(nw / 2), 1, W - nw - 1), ny = G.clamp(far.cy - Math.floor(nh / 2), 1, H - nh - 1);
      for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) set(x, y);
      Object.assign(far, { x: nx, y: ny, w: nw, h: nh, cx: Math.floor(nx + nw / 2), cy: Math.floor(ny + nh / 2) });
    }

    m.startRoom = start; m.start = { x: start.cx, y: start.cy };
    m.stairsRoom = far; m.stairs = { x: far.cx, y: far.cy };
    for (let i = 0; i < m.shade.length; i++) m.shade[i] = Math.floor(rng() * 256);
    return m;
  };

  /* Mercado: una sala amplia con el mercader arriba, nueve mesas en rejilla
     (armas, reliquias y pergamino, compañero y pociones) y las escaleras a la derecha. */
  G.genShop = function () {
    const W = 23, H = 15, m = makeMap(W, H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) m.tiles[y * W + x] = FLOOR;
    for (const [x, y] of [[3, 2], [19, 2], [3, 12], [19, 12]]) m.tiles[y * W + x] = WALL;  // columnas
    const room = { x: 1, y: 1, w: W - 2, h: H - 2, cx: 11, cy: 7 };
    m.rooms.push(room);
    m.startRoom = m.stairsRoom = room;
    m.start = { x: 2, y: 7 }; m.stairs = { x: 20, y: 7 };
    m.merchant = { x: 11.5, y: 2.1 };
    m.rug = { x0: 5.4, y0: 3.3, x1: 17.6, y1: 11.9 };
    const cols = [7.5, 11.5, 15.5];
    m.slots = [
      ['weapon', cols[0], 4.6], ['weapon', cols[1], 4.6], ['weapon', cols[2], 4.6],
      ['relic', cols[0], 7.6], ['relic', cols[1], 7.6], ['tome', cols[2], 7.6],
      ['companion', cols[0], 10.6], ['potion', cols[1], 10.6], ['heal', cols[2], 10.6],
    ];
    m.isShop = true;
    m.seen.fill(1); m.vis.fill(1);
    for (let i = 0; i < m.shade.length; i++) m.shade[i] = (i * 2654435761 >>> 24) & 255;
    return m;
  };

  /* Campo de distancias BFS (4 vecinos). Devuelve -1 en casillas inalcanzables. */
  G.bfsField = function (m, sx, sy, _unused, out) {
    const W = m.w, N = W * m.h;
    out = out || new Int16Array(N);
    out.fill(-1);
    if (!G.walk(m, sx, sy)) return out;
    const q = m._q; let h = 0, t = 0;
    const s0 = sy * W + sx; out[s0] = 0; q[t++] = s0;
    while (h < t) {
      const c = q[h++], cx = c % W, cy = (c / W) | 0, d = out[c] + 1;
      if (cx > 0 && m.tiles[c - 1] === FLOOR && out[c - 1] < 0) { out[c - 1] = d; q[t++] = c - 1; }
      if (cx < W - 1 && m.tiles[c + 1] === FLOOR && out[c + 1] < 0) { out[c + 1] = d; q[t++] = c + 1; }
      if (cy > 0 && m.tiles[c - W] === FLOOR && out[c - W] < 0) { out[c - W] = d; q[t++] = c - W; }
      if (cy < m.h - 1 && m.tiles[c + W] === FLOOR && out[c + W] < 0) { out[c + W] = d; q[t++] = c + W; }
    }
    return out;
  };

  /* Camino más corto hasta la primera casilla que cumpla goal(x, y, idx).
     Devuelve una lista de casillas {x, y} sin incluir el origen, o null. */
  G.bfsPath = function (m, sx, sy, goal, maxNodes) {
    const W = m.w, prev = m._prev, q = m._q;
    prev.fill(-1);
    if (sx < 0 || sy < 0 || sx >= W || sy >= m.h) return null;
    const s0 = sy * W + sx; prev[s0] = s0;
    let h = 0, t = 0; q[t++] = s0;
    const limit = maxNodes || Infinity;
    while (h < t && h < limit) {
      const c = q[h++], cx = c % W, cy = (c / W) | 0;
      if (c !== s0 && goal(cx, cy, c)) {
        const path = [];
        for (let k = c; k !== s0; k = prev[k]) path.push({ x: k % W, y: (k / W) | 0 });
        return path.reverse();
      }
      const nb = [c - 1, c + 1, c - W, c + W];
      const ok = [cx > 0, cx < W - 1, cy > 0, cy < m.h - 1];
      for (let i = 0; i < 4; i++) {
        const ni = nb[i];
        if (!ok[i] || prev[ni] !== -1 || m.tiles[ni] !== FLOOR) continue;
        prev[ni] = c; q[t++] = ni;
      }
    }
    return null;
  };

  /* Línea de visión entre dos puntos (muestreo cada 0,25 casillas). */
  G.los = function (m, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    const n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) if (G.solidAt(m, x0 + dx * i / n, y0 + dy * i / n)) return false;
    return true;
  };

  function rayReaches(m, x0, y0, x1, y1, tx, ty) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(d / 0.3));
    for (let i = 1; i < n; i++) {
      const x = Math.floor(x0 + dx * i / n), y = Math.floor(y0 + dy * i / n);
      if (x === tx && y === ty) return true;
      if (m.tiles[y * m.w + x] === WALL) return false;
    }
    return true;
  }

  /* Calcula las casillas visibles desde la antorcha y las marca como exploradas. */
  G.computeVis = function (m, px, py, R) {
    m.vis.fill(0);
    const W = m.w, ptx = Math.floor(px), pty = Math.floor(py), r = Math.ceil(R), R2 = R * R;
    for (let ty = pty - r; ty <= pty + r; ty++) {
      if (ty < 0 || ty >= m.h) continue;
      for (let tx = ptx - r; tx <= ptx + r; tx++) {
        if (tx < 0 || tx >= W) continue;
        const cx = tx + 0.5, cy = ty + 0.5;
        if ((cx - px) * (cx - px) + (cy - py) * (cy - py) > R2) continue;
        const idx = ty * W + tx;
        let gx = cx, gy = cy;
        if (m.tiles[idx] === WALL) { gx = G.clamp(px, tx + 0.02, tx + 0.98); gy = G.clamp(py, ty + 0.02, ty + 0.98); }
        if (rayReaches(m, px, py, gx, gy, tx, ty)) { m.vis[idx] = 1; m.seen[idx] = 1; }
      }
    }
  };
})(window.G);
