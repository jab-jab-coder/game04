'use strict';
// ===================== GRAFIKA: wszystko rysowane proceduralnie =====================

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (color) { ctx.fillStyle = color; ctx.fill(); }
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------- Tło ----------------
function drawBackground(ctx, g, W, H) {
  const L = g.level;
  const cam = g.cam;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, L.sky[0]); sky.addColorStop(1, L.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  const groundSY = (GROUND_Y - cam.y) * cam.zoom + H / 2;
  // słońce
  ctx.fillStyle = L.particles === 'snow' ? 'rgba(255,255,255,0.7)' : 'rgba(255,240,170,0.9)';
  ellipse(ctx, W * 0.8 - cam.x * cam.zoom * 0.02, groundSY - 520 * cam.zoom, 50 * cam.zoom, 50 * cam.zoom);
  ctx.fill();

  // chmury
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 6; i++) {
    const span = W + 400;
    const cx = ((i * 397 + g.time * (8 + i * 3) - cam.x * cam.zoom * 0.1) % span + span) % span - 200;
    const cy = groundSY - (560 + (i % 3) * 90) * cam.zoom;
    const s = cam.zoom * (0.8 + (i % 2) * 0.4);
    ellipse(ctx, cx, cy, 60 * s, 20 * s); ctx.fill();
    ellipse(ctx, cx + 35 * s, cy - 12 * s, 38 * s, 22 * s); ctx.fill();
    ellipse(ctx, cx - 30 * s, cy - 6 * s, 30 * s, 16 * s); ctx.fill();
  }

  // wzgórza (paralaksa)
  const layers = [
    { f: 0.2, h: 260, amp: 70, c: L.hills[0], fr: 0.0025 },
    { f: 0.45, h: 150, amp: 50, c: L.hills[1], fr: 0.004 },
  ];
  for (const ly of layers) {
    ctx.fillStyle = ly.c;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 20; sx += 20) {
      const u = sx / cam.zoom + cam.x * ly.f;
      const y = groundSY - (ly.h + Math.sin(u * ly.fr) * ly.amp + Math.sin(u * ly.fr * 2.7 + 1) * ly.amp * 0.4) * cam.zoom;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath(); ctx.fill();
  }
  // odległy las (sylwetki choinek)
  ctx.fillStyle = 'rgba(40,70,40,0.25)';
  for (let i = -2; i < W / (40 * cam.zoom) + 2; i++) {
    const off = (cam.x * cam.zoom * 0.6) % (40 * cam.zoom);
    const sx = i * 40 * cam.zoom - off;
    const hh = (60 + ((i * 7919 + Math.floor(cam.x * 0.6 / 40)) % 5 + 5) % 5 * 12) * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(sx, groundSY - 30 * cam.zoom);
    ctx.lineTo(sx + 16 * cam.zoom, groundSY - 30 * cam.zoom - hh);
    ctx.lineTo(sx + 32 * cam.zoom, groundSY - 30 * cam.zoom);
    ctx.fill();
  }
}

// ---------------- Drzewa ----------------
function drawTreeBack(ctx, t, L, time) {
  // pień
  const h = GROUND_Y - t.top;
  if (t.kind === 'birch') {
    ctx.fillStyle = '#ece8df'; ctx.fillRect(t.x, t.top, t.w, h + 4);
    ctx.fillStyle = '#2a2a2a';
    for (let y = t.top + 20; y < GROUND_Y; y += 37) {
      ctx.fillRect(t.x + ((y * 13) % (t.w - 10)), y, 8 + (y % 7), 3);
    }
  } else {
    ctx.fillStyle = t.kind === 'pine' ? '#5b3a22' : '#6b4527';
    ctx.fillRect(t.x, t.top, t.w, h + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(t.x + t.w * 0.65, t.top, t.w * 0.35, h + 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
    for (let y = t.top + 30; y < GROUND_Y - 10; y += 46) {
      ctx.beginPath();
      ctx.moveTo(t.x + 8, y); ctx.quadraticCurveTo(t.x + t.w / 2, y + 12, t.x + 6, y + 28);
      ctx.stroke();
    }
  }
  // korzenie
  ctx.fillStyle = t.kind === 'birch' ? '#d8d2c4' : '#5a3a20';
  ctx.beginPath();
  ctx.moveTo(t.x - 18, GROUND_Y + 2); ctx.quadraticCurveTo(t.x, GROUND_Y - 6, t.x + 4, GROUND_Y - 30);
  ctx.lineTo(t.x + t.w - 4, GROUND_Y - 30); ctx.quadraticCurveTo(t.x + t.w, GROUND_Y - 6, t.x + t.w + 18, GROUND_Y + 2);
  ctx.closePath(); ctx.fill();

  // dziupla
  if (t.hollow) {
    const ho = t.hollow;
    ellipse(ctx, ho.x, ho.y, ho.rx + 6, ho.ry + 6, '#4a2c15');
    ellipse(ctx, ho.x, ho.y, ho.rx, ho.ry, '#1d1008');
    ctx.fillStyle = 'rgba(255,200,80,0.6)';
    for (let i = 0; i < 3; i++) ellipse(ctx, ho.x - 8 + i * 7, ho.y + ho.ry - 6, 4, 3), ctx.fill();
  }
}

function drawBranch(ctx, p, L) {
  if (p.crown || p.stump) return;
  const t = p.tree;
  const base = p.side < 0 ? t.x : t.x + t.w;
  const tip = p.side < 0 ? p.x : p.x + p.w;
  ctx.fillStyle = t.kind === 'birch' ? '#cfc8b8' : '#6b4527';
  ctx.beginPath();
  ctx.moveTo(base, p.y - 1);
  ctx.lineTo(tip, p.y);
  ctx.lineTo(tip, p.y + 5);
  ctx.lineTo(base, p.y + 16);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.moveTo(base, p.y + 10); ctx.lineTo(tip, p.y + 4); ctx.lineTo(tip, p.y + 5); ctx.lineTo(base, p.y + 16); ctx.fill();
  // gałązka
  ctx.strokeStyle = ctx.fillStyle = t.kind === 'birch' ? '#a9a191' : '#5a3a20';
  ctx.lineWidth = 3;
  const mid = lerp(base, tip, 0.65);
  ctx.beginPath(); ctx.moveTo(mid, p.y + 2); ctx.lineTo(mid + (tip - base) * 0.2, p.y - 22); ctx.stroke();
  // listki
  if (t.kind !== 'pine') {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = L.leaves[(i + Math.floor(p.y)) % L.leaves.length];
      ellipse(ctx, tip + (i - 1.5) * 8 * Math.sign(tip - base) * -1, p.y - 6 + (i % 2) * 8, 10, 7); ctx.fill();
    }
    ctx.fillStyle = L.leaves[Math.floor(p.y) % L.leaves.length];
    ellipse(ctx, mid + (tip - base) * 0.2, p.y - 26, 11, 8); ctx.fill();
  } else {
    ctx.fillStyle = '#2f5a2a';
    for (let i = 0; i < 5; i++) {
      const xx = lerp(base, tip, 0.2 + i * 0.18);
      ctx.beginPath(); ctx.moveTo(xx - 10, p.y + 8); ctx.lineTo(xx, p.y - 12); ctx.lineTo(xx + 10, p.y + 8); ctx.fill();
    }
  }
  if (p.ice) {
    ctx.fillStyle = 'rgba(210,240,255,0.9)';
    ctx.fillRect(Math.min(base, tip), p.y - 2, Math.abs(tip - base), 3);
    ctx.fillStyle = 'rgba(210,240,255,0.8)';
    for (let x = Math.min(base, tip) + 10; x < Math.max(base, tip); x += 23) {
      ctx.beginPath(); ctx.moveTo(x, p.y + 6); ctx.lineTo(x + 3, p.y + 16); ctx.lineTo(x + 6, p.y + 6); ctx.fill();
    }
  }
}

function drawCanopy(ctx, t, L, time) {
  const cx = t.x + t.w / 2;
  if (t.kind === 'pine') {
    for (let i = 0; i < 4; i++) {
      const w = 70 + i * 28, y = t.top - 70 + i * 55;
      ctx.fillStyle = i % 2 ? '#2f5a2a' : '#3a6b33';
      ctx.beginPath(); ctx.moveTo(cx - w, y + 70); ctx.lineTo(cx, y - 10); ctx.lineTo(cx + w, y + 70); ctx.fill();
      if (L.particles === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.moveTo(cx - w * 0.4, y + 22); ctx.lineTo(cx, y - 10); ctx.lineTo(cx + w * 0.4, y + 22); ctx.fill();
      }
    }
  } else {
    // gruba gałąź korony
    ctx.fillStyle = t.kind === 'birch' ? '#cfc8b8' : '#6b4527';
    const crown = t.crownPlat;
    if (crown) { roundRect(ctx, crown.x, crown.y - 1, crown.w, 13, 6); ctx.fill(); }
    for (const lf of t.leaves) {
      const sway = Math.sin(time * 1.3 + lf.x * 0.01) * 2;
      ctx.fillStyle = L.leaves[lf.c];
      ellipse(ctx, lf.x + sway, lf.y - 30, lf.r, lf.r * 0.8); ctx.fill();
    }
  }
}

function drawStump(ctx, p) {
  ctx.fillStyle = '#7a5030';
  roundRect(ctx, p.x, p.y, p.w, p.h + 4, 6); ctx.fill();
  ellipse(ctx, p.x + p.w / 2, p.y + 3, p.w / 2, 7, '#c89a62');
  ctx.strokeStyle = '#9a7040'; ctx.lineWidth = 1.5;
  ellipse(ctx, p.x + p.w / 2, p.y + 3, p.w / 4, 3); ctx.stroke();
}

function drawHollowSign(ctx, g) {
  const ho = g.world.home.hollow;
  const x = ho.x - 25, y = ho.y + 92;
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + 4, y - 22, 3, 8); ctx.fillRect(x + 43, y - 22, 3, 8);
  ctx.fillStyle = '#c8955a'; roundRect(ctx, x - 10, y - 16, 70, 22, 4); ctx.fill();
  ctx.strokeStyle = '#6b4527'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#3a2010'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SPIŻARNIA', x + 25, y - 1);
  // zaproszenie, gdy ktoś niesie orzechy
  if (g.players.some((p) => p.cheeks.length > 0)) {
    const a = 0.4 + Math.sin(g.time * 5) * 0.3;
    ctx.strokeStyle = `rgba(255,220,90,${a})`; ctx.lineWidth = 4;
    ellipse(ctx, ho.x, ho.y, ho.rx + 12, ho.ry + 12); ctx.stroke();
  }
}

function drawGround(ctx, g) {
  const L = g.level, w = g.world.width;
  const grad = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H + 300);
  grad.addColorStop(0, L.grass[0]); grad.addColorStop(0.15, L.grass[1]); grad.addColorStop(1, '#3e2e1e');
  ctx.fillStyle = grad;
  ctx.fillRect(-500, GROUND_Y, w + 1000, WORLD_H + 800);
  ctx.fillStyle = L.grass[0];
  for (let x = -100; x < w + 100; x += 14) {
    const hh = 6 + ((x * 31) % 7);
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 2); ctx.lineTo(x + 4, GROUND_Y - hh); ctx.lineTo(x + 8, GROUND_Y + 2); ctx.fill();
  }
  for (const d of g.world.decor) {
    const x = d.x, s = d.s;
    if (d.type === 'tuft') {
      ctx.fillStyle = L.grass[1];
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 4 - 2, GROUND_Y + 2); ctx.lineTo(x + i * 6, GROUND_Y - 16 * s + Math.abs(i) * 3); ctx.lineTo(x + i * 4 + 2, GROUND_Y + 2); ctx.fill(); }
    } else if (d.type === 'flower' && L.particles !== 'snow') {
      ctx.strokeStyle = '#3f7a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - 16 * s); ctx.stroke();
      ctx.fillStyle = ['#f5e663', '#ffffff', '#c97be0', '#ff8a8a'][d.c];
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ellipse(ctx, x + Math.cos(a) * 4 * s, GROUND_Y - 16 * s + Math.sin(a) * 4 * s, 3 * s, 3 * s); ctx.fill(); }
      ellipse(ctx, x, GROUND_Y - 16 * s, 2 * s, 2 * s, '#e89a20');
    } else if (d.type === 'shroom') {
      ctx.fillStyle = '#f3ead8'; ctx.fillRect(x - 2 * s, GROUND_Y - 10 * s, 4 * s, 10 * s);
      ctx.fillStyle = d.c % 2 ? '#d43b2b' : '#8a5a2b';
      ctx.beginPath(); ctx.ellipse(x, GROUND_Y - 10 * s, 9 * s, 6 * s, 0, Math.PI, 0); ctx.fill();
      if (d.c % 2) { ctx.fillStyle = '#fff'; ellipse(ctx, x - 3 * s, GROUND_Y - 13 * s, 1.5 * s, 1.5 * s); ctx.fill(); ellipse(ctx, x + 3 * s, GROUND_Y - 12 * s, 1.2 * s, 1.2 * s); ctx.fill(); }
    } else if (d.type === 'rock') {
      ellipse(ctx, x, GROUND_Y - 2, 12 * s, 7 * s, '#8d8a84');
      ellipse(ctx, x - 3, GROUND_Y - 5, 5 * s, 3 * s, '#a6a39c');
    }
  }
  // sadzonki z zakopanych orzechów
  for (const sp of g.world.saplings) {
    const s = 0.3 + sp.g * 0.9;
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 2 + s;
    ctx.beginPath(); ctx.moveTo(sp.x, GROUND_Y); ctx.lineTo(sp.x, GROUND_Y - 30 * s); ctx.stroke();
    ctx.fillStyle = '#5fa040';
    ellipse(ctx, sp.x - 7 * s, GROUND_Y - 28 * s, 7 * s, 4 * s); ctx.fill();
    ellipse(ctx, sp.x + 7 * s, GROUND_Y - 32 * s, 7 * s, 4 * s); ctx.fill();
    ellipse(ctx, sp.x, GROUND_Y - 38 * s, 5 * s, 6 * s); ctx.fill();
    ctx.fillStyle = '#6b4a2a'; ellipse(ctx, sp.x, GROUND_Y + 1, 10, 3); ctx.fill();
  }
}

// ---------------- Przedmioty ----------------
function drawItem(ctx, type, x, y, t, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  switch (type) {
    case 'acorn':
    case 'golden': {
      const gold = type === 'golden';
      if (gold) { ctx.fillStyle = `rgba(255,230,80,${0.35 + Math.sin(t * 6) * 0.15})`; ellipse(ctx, 0, 0, 20, 20); ctx.fill(); }
      ellipse(ctx, 0, 3, 7, 9, gold ? '#ffd23a' : '#b5762f');
      ctx.fillStyle = gold ? '#fff2a0' : '#d39a52'; ellipse(ctx, -2, 3, 2.5, 5); ctx.fill();
      ctx.fillStyle = gold ? '#c99a10' : '#6e4a24';
      ctx.beginPath(); ctx.ellipse(0, -4, 8.5, 5, 0, Math.PI, 0); ctx.lineTo(8.5, -3); ctx.lineTo(-8.5, -3); ctx.fill();
      ctx.strokeStyle = gold ? '#a07a00' : '#4a3018'; ctx.lineWidth = 0.8;
      for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(i, -8); ctx.lineTo(i + 2, -3); ctx.stroke(); }
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(1, -12); ctx.stroke();
      if (gold && Math.sin(t * 9) > 0.6) { ctx.fillStyle = '#fff'; ellipse(ctx, 5, -8, 2, 2); ctx.fill(); }
      break;
    }
    case 'hazel':
      ellipse(ctx, 0, 1, 8, 8, '#a8692c');
      ctx.fillStyle = '#c4843f'; ellipse(ctx, -2, 2, 3, 4); ctx.fill();
      ctx.fillStyle = '#e8d2a8'; ctx.beginPath(); ctx.ellipse(0, -5, 6, 3, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6a9a3a'; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-10, -14, -1, -12); ctx.fill();
      break;
    case 'walnut':
      ellipse(ctx, 0, 0, 11, 9, '#cfae78');
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke();
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(i * 3, -6); ctx.quadraticCurveTo(i * 8, -2, i * 4, 2); ctx.quadraticCurveTo(i * 9, 5, i * 4, 7); ctx.stroke();
      }
      break;
    case 'cone':
      ctx.fillStyle = '#7a4a22';
      ellipse(ctx, 0, 0, 7, 11); ctx.fill();
      ctx.fillStyle = '#a0662f';
      for (let r = -8; r <= 8; r += 4) for (let c = -1; c <= 1; c++) {
        if (Math.abs(c) === 1 && Math.abs(r) > 6) continue;
        ctx.beginPath(); ctx.moveTo(c * 4 - 3, r); ctx.lineTo(c * 4, r + 3); ctx.lineTo(c * 4 + 3, r); ctx.fill();
      }
      break;
    case 'mushroom':
      ctx.fillStyle = '#efe4cc'; roundRect(ctx, -4, -3, 8, 13, 3); ctx.fill();
      ctx.fillStyle = '#7a4a1f'; ctx.beginPath(); ctx.ellipse(0, -3, 11, 8, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a06a35'; ellipse(ctx, -3, -7, 4, 2); ctx.fill();
      ctx.fillStyle = '#ff5a6a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('+', 0, -14 + Math.sin(t * 4) * 2);
      break;
    case 'raspberry':
      ctx.fillStyle = '#d0234a';
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; ellipse(ctx, Math.cos(a) * 4, 1 + Math.sin(a) * 5, 3.3, 3.3); ctx.fill(); }
      ellipse(ctx, 0, 1, 3.5, 3.5); ctx.fill();
      ctx.fillStyle = '#ff7a96'; ellipse(ctx, -2, -1, 1.2, 1.2); ctx.fill();
      ctx.fillStyle = '#3f8a2a'; ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0, -9); ctx.lineTo(5, -5); ctx.lineTo(0, -6); ctx.fill();
      break;
    case 'feather':
      ctx.rotate(-0.6 + Math.sin(t * 3) * 0.15);
      ctx.fillStyle = '#9fc0e0';
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.quadraticCurveTo(-9, 0, 0, -13); ctx.quadraticCurveTo(9, 0, 0, 12); ctx.fill();
      ctx.strokeStyle = '#5a7aa0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -12); ctx.stroke();
      break;
    case 'rotten':
      ellipse(ctx, 0, 1, 8, 8, '#5d6a2a');
      ctx.fillStyle = '#3e4a1a'; ellipse(ctx, 2, 3, 3, 2); ctx.fill();
      ctx.fillStyle = '#8a9a3a'; ctx.beginPath(); ctx.ellipse(0, -5, 6, 3, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#222';
      for (let i = 0; i < 2; i++) { const a = t * (4 + i) + i * 3; ellipse(ctx, Math.cos(a) * 13, -8 + Math.sin(a * 1.3) * 6, 1.6, 1.6); ctx.fill(); }
      break;
  }
  ctx.restore();
}

// ---------------- Wiewiórka ----------------
function drawSquirrel(ctx, s, time) {
  if (s.down > 0) return;
  if (s.invuln > 0 && Math.floor(time * 12) % 2 === 0) return;
  ctx.save();
  ctx.translate(s.x, s.y);
  const moving = Math.abs(s.vx) > 20 && s.state === 'ground';
  const run = moving ? Math.sin(s.anim * 22) : 0;

  if (s.powers.golden > 0) {
    ctx.fillStyle = `rgba(255,220,60,${0.3 + Math.sin(time * 10) * 0.15})`;
    ellipse(ctx, 0, -16, 30, 26); ctx.fill();
  }
  if (s.state === 'climb') {
    ctx.translate(0, -14);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(1, s.facing);
    ctx.translate(0, 12);
  } else {
    ctx.scale(s.facing, 1);
    if (s.charging) ctx.scale(1 + s.charge * 0.18, 1 - s.charge * 0.28);
    else if (s.state === 'air') { const st = clamp(-s.vy / 2500, -0.12, 0.2); ctx.scale(1 - st * 0.5, 1 + st); }
  }
  if (s.eatT > 0) ctx.translate(0, Math.sin(time * 30) * 1);

  const fur = s.fur, dark = s.furDark;
  // ogon
  const wag = Math.sin(s.anim * 4) * 3 + (s.state === 'air' ? -4 : 0);
  ctx.fillStyle = fur; ctx.strokeStyle = dark; ctx.lineWidth = 2;
  ctx.beginPath();
  if (s.gliding) {
    ctx.moveTo(-10, -8); ctx.bezierCurveTo(-30, -10, -44, -16, -40, -24); ctx.bezierCurveTo(-30, -26, -18, -18, -8, -14);
  } else {
    ctx.moveTo(-10, -6);
    ctx.bezierCurveTo(-30, -4, -36 + wag, -30, -24 + wag, -42);
    ctx.bezierCurveTo(-14 + wag, -50, -2 + wag, -44, -8 + wag, -34);
    ctx.bezierCurveTo(-14, -26, -16, -16, -6, -13);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ellipse(ctx, -22 + wag * 0.6, -32, 4, 8); ctx.fill();

  // tylna łapa
  ellipse(ctx, -5 + run * 3, -4, 7, 5, dark);
  // tułów
  ellipse(ctx, 0, -12, 13, 10, fur);
  ellipse(ctx, 5, -9, 7, 6, s.belly);
  // przednia łapa
  ctx.fillStyle = dark;
  roundRect(ctx, 7 - run * 3, -6, 4, 7, 2); ctx.fill();
  if (s.eatT > 0) { drawItem(ctx, 'hazel', 17, -14, time, 0.6); }

  // szalik gracza
  if (s.scarf) {
    ctx.fillStyle = s.scarf;
    roundRect(ctx, 4, -19, 12, 5, 2); ctx.fill();
    const fl = Math.sin(time * 8) * 2;
    ctx.beginPath(); ctx.moveTo(5, -17); ctx.lineTo(-4, -14 + fl); ctx.lineTo(-3, -10 + fl); ctx.lineTo(6, -15); ctx.fill();
  }
  // głowa
  ellipse(ctx, 13, -22, 8.5, 7.5, fur);
  // ucho z pędzelkiem
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.moveTo(9, -27); ctx.lineTo(11, -37); ctx.lineTo(15, -27); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(11, -36); ctx.lineTo(10, -41); ctx.moveTo(11, -36); ctx.lineTo(13, -40); ctx.stroke();
  // policzki – puchną z każdym orzechem!
  const cheek = 2 + s.slots * 1.0;
  ellipse(ctx, 16, -18, cheek, cheek * 0.85, s.belly);
  // oko
  if (s.stun > 0 || s.down > 0) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(14, -25); ctx.lineTo(18, -21); ctx.moveTo(18, -25); ctx.lineTo(14, -21); ctx.stroke();
  } else {
    ellipse(ctx, 16, -23, 2.2, 2.4, '#111');
    ctx.fillStyle = '#fff'; ellipse(ctx, 16.8, -24, 0.8, 0.8); ctx.fill();
  }
  ellipse(ctx, 21.5, -21, 1.6, 1.4, '#3a1a10');
  ctx.restore();

  // gwiazdki ogłuszenia / zawroty
  if (s.stun > 0 || s.powers.dizzy > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + i * 2.1;
      ctx.fillStyle = s.powers.dizzy > 0 ? '#7ac040' : '#ffd23a';
      drawStar(ctx, s.x + Math.cos(a) * 16, s.y - 44 + Math.sin(a) * 4, 4);
    }
  }
  // piórko – szybowanie
  if (s.powers.glide > 0 && s.state === 'air' && !s.gliding && Math.floor(time * 3) % 2 === 0) {
    ctx.fillStyle = 'rgba(80,110,160,0.8)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('przytrzymaj skok!', s.x, s.y - 52);
  }

  // wskaźnik siły skoku
  if (s.charging && s.isPlayer) {
    const bx = s.x - 22, by = s.y - 56;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, bx - 2, by - 2, 48, 10, 4); ctx.fill();
    ctx.fillStyle = 'rgba(80,255,90,0.55)'; ctx.fillRect(bx + 44 * 0.88, by, 44 * 0.12, 6);
    ctx.fillStyle = s.charge >= 0.88 ? '#6dff6a' : s.charge > 0.6 ? '#ffd23a' : '#ff8a3a';
    ctx.fillRect(bx, by, 44 * s.charge, 6);
  }
  // znacznik gracza
  if (s.isPlayer && s.state !== 'climb') {
    ctx.fillStyle = s.scarf;
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('P' + (s.id + 1), s.x, s.y - (s.charging ? 64 : 48));
  } else if (s.isPlayer) {
    ctx.fillStyle = s.scarf; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('P' + (s.id + 1), s.x + 28 * (s.facing > 0 ? 1 : -1), s.y - 20);
  }
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

// ---------------- Pies ----------------
function drawDog(ctx, d, time) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(d.facing, 1);
  const w = d.w, h = d.h;
  const moving = Math.abs(d.vx) > 15 && d.y >= GROUND_Y - 1;
  const step = moving ? Math.sin(d.t * (d.type === 'jamnik' ? 26 : 18)) : 0;
  const sleeping = d.sleep > 0;
  if (sleeping) ctx.translate(0, 6);

  const body = d.type === 'owczarek' ? '#c48a4a' : d.color;
  const saddle = d.type === 'owczarek' ? '#2a1f18' : null;
  // nogi
  ctx.fillStyle = d.type === 'mops' ? d.color : (d.type === 'owczarek' ? '#c48a4a' : d.dark);
  const legH = d.type === 'jamnik' ? 8 : 12;
  if (!sleeping) {
    for (const [lx, ph] of [[-w * 0.32, 1], [-w * 0.2, -1], [w * 0.22, -1], [w * 0.34, 1]]) {
      ctx.fillRect(lx + step * 3 * ph - 2, -legH - 1, 5, legH + 1);
    }
  }
  // ogon
  ctx.strokeStyle = body; ctx.lineWidth = d.type === 'mops' ? 4 : 5; ctx.lineCap = 'round';
  const wag = Math.sin(d.t * (d.state === 'chase' ? 25 : 8)) * 0.5;
  ctx.beginPath();
  if (d.type === 'mops') { ctx.arc(-w * 0.42, -h * 0.75, 5, 0, Math.PI * 1.6); }
  else { ctx.moveTo(-w * 0.42, -h * 0.65); ctx.quadraticCurveTo(-w * 0.6, -h * (0.9 + wag * 0.3), -w * 0.62, -h * (1.2 + wag * 0.4)); }
  ctx.stroke(); ctx.lineCap = 'butt';
  // tułów
  ellipse(ctx, 0, -legH - h * 0.28, w * 0.45, h * 0.32, body);
  if (saddle) { ellipse(ctx, -w * 0.05, -legH - h * 0.38, w * 0.36, h * 0.22, saddle); }
  // głowa
  const hx = w * 0.44, hy = -legH - h * 0.55;
  const hr = d.type === 'mops' ? h * 0.38 : h * 0.3;
  ellipse(ctx, hx, hy, hr, hr * 0.9, d.type === 'owczarek' ? '#c48a4a' : body);
  // pysk
  if (d.type === 'mops') {
    ellipse(ctx, hx + hr * 0.5, hy + hr * 0.25, hr * 0.55, hr * 0.5, d.dark);
  } else {
    ctx.fillStyle = d.type === 'owczarek' ? '#2a1f18' : body;
    roundRect(ctx, hx, hy - hr * 0.2, hr * 1.4, hr * 0.8, 4); ctx.fill();
    ellipse(ctx, hx + hr * 1.4, hy - hr * 0.05, 3, 2.5, '#111');
  }
  // ucho
  ctx.fillStyle = d.type === 'mops' ? d.dark : (d.type === 'owczarek' ? '#2a1f18' : d.dark);
  ctx.beginPath();
  if (d.type === 'owczarek') { ctx.moveTo(hx - 6, hy - hr * 0.6); ctx.lineTo(hx - 2, hy - hr * 1.7); ctx.lineTo(hx + 4, hy - hr * 0.6); }
  else { const fl = moving ? Math.sin(d.t * 20) * 3 : 0; ctx.ellipse(hx - 4, hy + 2 + fl, 4, hr * 0.8, 0.3, 0, Math.PI * 2); }
  ctx.fill();
  // oko
  if (d.dazed > 0 || sleeping) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hx + 1, hy - 4); ctx.lineTo(hx + 7, hy - 4); ctx.stroke();
  } else {
    ellipse(ctx, hx + 4, hy - 4, 2.5, 2.5, '#111');
    ctx.fillStyle = '#fff'; ellipse(ctx, hx + 4.6, hy - 4.8, 0.8, 0.8); ctx.fill();
  }
  // język przy pościgu
  if (d.state === 'chase' && !d.dazed && d.type !== 'mops') {
    ctx.fillStyle = '#e85a7a'; roundRect(ctx, hx + hr * 0.8, hy + hr * 0.5, 5, 7 + Math.sin(d.t * 20) * 2, 2); ctx.fill();
  }
  ctx.restore();
  if (d.dazed > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + i * 2.1;
      ctx.fillStyle = '#ffd23a';
      drawStar(ctx, d.x + Math.cos(a) * 16, d.y - d.h - 18 + Math.sin(a) * 4, 4);
    }
  }
}

// ---------------- Sroka ----------------
function drawMagpie(ctx, m, time) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(m.dir, 1);
  if (m.state === 'dazed') ctx.rotate(Math.sin(time * 20) * 0.4);
  // ogon
  ctx.fillStyle = '#163a3a';
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-34, -6); ctx.lineTo(-34, 2); ctx.lineTo(-8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(60,160,150,0.6)';
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-32, -3); ctx.lineTo(-32, 0); ctx.fill();
  // tułów
  ellipse(ctx, 0, 0, 13, 8, '#111');
  ellipse(ctx, 3, 3, 8, 5, '#f4f4f4');
  // skrzydło
  const flap = Math.sin(time * (m.state === 'swoop' ? 22 : 12) + m.t);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(4, -3); ctx.lineTo(-4, -3 - flap * 16); ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(2, -3); ctx.lineTo(-3, -3 - flap * 9); ctx.fill();
  // głowa
  ellipse(ctx, 12, -5, 6, 5.5, '#111');
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(17, -6); ctx.lineTo(24, -4); ctx.lineTo(17, -2); ctx.fill();
  ctx.fillStyle = '#fff'; ellipse(ctx, 14, -6.5, 1.5, 1.5); ctx.fill();
  ctx.fillStyle = '#111'; ellipse(ctx, 14.4, -6.5, 0.8, 0.8); ctx.fill();
  if (m.carry) drawItem(ctx, m.carry, 24, 2, time, 0.7);
  ctx.restore();
}

// ---------------- Napisy i dymki ----------------
function drawBubble(ctx, x, y, text, color) {
  ctx.font = 'bold 13px sans-serif';
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, x - w / 2, y - 24, w, 22, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x, y + 5); ctx.lineTo(x + 5, y - 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  roundRect(ctx, x - w / 2, y - 24, w, 22, 8); ctx.stroke();
  ctx.fillStyle = color || '#222'; ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 8);
}

function drawHeart(ctx, x, y, s, full) {
  ctx.fillStyle = full ? '#e8304a' : 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
  ctx.fill();
}
