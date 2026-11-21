'use strict';
// ===================== ŚWIAT: generowanie lasu, platformy, pnie =====================

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateWorld(level, seed) {
  const rng = mulberry32(seed);
  const R = (a, b) => a + rng() * (b - a);
  const trees = [];
  const platforms = [];
  const decor = [];
  const homeIndex = Math.floor(level.trees / 2);
  let x = 260;

  for (let i = 0; i < level.trees; i++) {
    const isHome = i === homeIndex;
    const kind = isHome ? 'oak' : (rng() < 0.3 ? 'pine' : (rng() < 0.5 ? 'oak' : 'birch'));
    const h = isHome ? 820 : R(560, 880);
    const w = isHome ? 64 : (kind === 'birch' ? R(30, 38) : R(38, 54));
    const tree = { x, w, top: GROUND_Y - h, kind, home: isHome, branches: [], leaves: [], hollow: null };

    let y = GROUND_Y - R(140, 190);
    let side = rng() < 0.5 ? -1 : 1;
    while (y > tree.top + 70) {
      const len = R(105, 240);
      addBranch(tree, platforms, y, side, len, level.ice);
      if (rng() < 0.3) addBranch(tree, platforms, y + R(-10, 10), -side, R(80, 170), level.ice);
      y -= R(110, 160);
      side = -side;
    }
    // korona: szeroka gałąź na szczycie
    const crownY = tree.top + 20;
    const crownLen = R(70, 130);
    tree.crownPlat = { x: x - crownLen, y: crownY, w: w + crownLen * 2, h: 14, tree, side: 0, ice: level.ice, crown: true };
    platforms.push(tree.crownPlat);

    // liście (pozycje stałe, by nie migotały)
    const leafCount = kind === 'pine' ? 0 : 26;
    for (let k = 0; k < leafCount; k++) {
      tree.leaves.push({
        x: x + w / 2 + R(-crownLen - 60, crownLen + 60),
        y: crownY + R(-90, 40),
        r: R(26, 48),
        c: Math.floor(rng() * level.leaves.length),
      });
    }

    if (isHome) {
      tree.hollow = { x: x + w / 2, y: GROUND_Y - 360, rx: 20, ry: 26 };
      // gwarantowana gałąź przy dziupli
      addBranch(tree, platforms, GROUND_Y - 330, 1, 170, false);
      addBranch(tree, platforms, GROUND_Y - 330, -1, 170, false);
    }

    trees.push(tree);
    x += w + R(250, 560);
  }

  const width = x + 200;

  // pnie / kłody na ziemi jako mini-platformy
  for (let i = 0; i < trees.length - 1; i++) {
    if (rng() < 0.55) {
      const a = trees[i], b = trees[i + 1];
      const gap = b.x - (a.x + a.w);
      if (gap > 240) {
        const stumpW = R(50, 90);
        const sx = a.x + a.w + gap / 2 - stumpW / 2 + R(-40, 40);
        const sh = R(40, 75);
        platforms.push({ x: sx, y: GROUND_Y - sh, w: stumpW, h: sh, tree: null, side: 0, stump: true, ice: false });
      }
    }
  }

  // dekoracje trawy
  for (let dx = 0; dx < width; dx += R(40, 110)) {
    const r = rng();
    decor.push({ x: dx, type: r < 0.5 ? 'tuft' : r < 0.75 ? 'flower' : r < 0.9 ? 'shroom' : 'rock', c: Math.floor(rng() * 4), s: R(0.7, 1.3) });
  }

  const home = trees[homeIndex];
  const hollowZone = { x: home.hollow.x - 42, y: home.hollow.y - 40, w: 84, h: 80 };

  return { trees, platforms, decor, width, home, hollowZone, saplings: [], rng };
}

function addBranch(tree, platforms, y, side, len, ice) {
  const p = {
    x: side < 0 ? tree.x - len : tree.x,
    y, w: len + tree.w, h: 12, tree, side, ice, len,
  };
  platforms.push(p);
  tree.branches.push(p);
}

// Pień, który obejmuje punkt (x, y)
function trunkAt(world, x, y) {
  for (const t of world.trees) {
    if (x > t.x - 6 && x < t.x + t.w + 6 && y > t.top && y <= GROUND_Y + 1) return t;
  }
  return null;
}

function randomSpawnPoint(world, preferGround) {
  const rng = Math.random;
  if (preferGround || rng() < 0.22) {
    const x = 80 + rng() * (world.width - 160);
    return { x, y: GROUND_Y, ground: true };
  }
  const plats = world.platforms.filter((p) => !p.stump);
  for (let tries = 0; tries < 10; tries++) {
    const p = plats[Math.floor(rng() * plats.length)];
    // unikamy punktu przy samym pniu – orzechy rosną na końcach gałęzi
    let x = p.x + 14 + rng() * (p.w - 28);
    if (p.tree && x > p.tree.x - 10 && x < p.tree.x + p.tree.w + 10 && !p.crown) continue;
    return { x, y: p.y, ground: false };
  }
  const p = plats[Math.floor(rng() * plats.length)];
  return { x: p.x + p.w / 2, y: p.y, ground: false };
}

function weightedType(ground) {
  const entries = Object.entries(ITEM_TYPES);
  const total = entries.reduce((s, [, t]) => s + (ground ? t.groundWeight : t.weight), 0);
  let r = Math.random() * total;
  for (const [k, t] of entries) {
    r -= ground ? t.groundWeight : t.weight;
    if (r <= 0) return k;
  }
  return 'acorn';
}

function boxOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
