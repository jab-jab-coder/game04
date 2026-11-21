'use strict';
// ===================== GŁÓWNA PĘTLA GRY =====================

const PLAYER_STYLES = [
  { name: 'Ruda', fur: '#c8571b', furDark: '#8a3510', belly: '#f6e0c0', scarf: '#3fae4a' },
  { name: 'Kasztanka', fur: '#5a3324', furDark: '#2e1810', belly: '#e8cfb0', scarf: '#3f8be0' },
];
const RIVAL_STYLE = { name: 'Szaruś', fur: '#8f8f8f', furDark: '#5e5e5e', belly: '#f0f0f0' };

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';
    this.menuIndex = 0;
    this.numPlayers = 1;
    this.levelIndex = 0;
    this.time = 0;
    this.cam = { x: 800, y: 700, zoom: 1, shake: 0 };
    this.seenFacts = new Set();
    this.totalScores = [0, 0];
    this.players = [];
    this.weather = [];
    this.helpPage = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupLevel(0, true);
    this.state = 'title';
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.weather = [];
    for (let i = 0; i < 70; i++) this.weather.push({ x: Math.random() * this.W, y: Math.random() * this.H, s: 0.5 + Math.random(), r: Math.random() * 6, c: Math.floor(Math.random() * 4) });
  }

  // ---------------- przygotowanie poziomu ----------------
  setupLevel(i, demo = false) {
    this.levelIndex = i;
    this.level = LEVELS[i];
    this.world = generateWorld(this.level, (Date.now() & 0xffff) + i * 7777);
    this.items = []; this.dogs = []; this.magpies = []; this.rivals = [];
    this.projectiles = []; this.poops = []; this.particles = []; this.texts = [];
    this.bank = 0; this.timeLeft = this.level.time; this.wind = 0; this.windT = 6;
    this.spawnT = 0; this.toast = null; this.tipQueue = []; this.tipT = 3;
    this.demo = demo;

    const home = this.world.home;
    const hx = home.x + home.w / 2;
    this.players = [];
    const n = demo ? 0 : this.numPlayers;
    for (let p = 0; p < n; p++) {
      const s = new Squirrel(hx + (p === 0 ? 70 : -70), GROUND_Y - 345, { isPlayer: true, id: p, ...PLAYER_STYLES[p] });
      s.facing = p === 0 ? 1 : -1;
      s.invuln = 1.5;
      this.players.push(s);
    }
    const W = this.world.width;
    this.level.dogs.forEach((type, k) => {
      let x = (k + 0.5) / this.level.dogs.length * W;
      if (Math.abs(x - hx) < 350) x += 450;
      this.dogs.push(new Dog(type, clamp(x, 100, W - 100)));
    });
    for (let k = 0; k < this.level.magpies; k++) this.magpies.push(new Magpie(Math.random() * W, 140 + Math.random() * 220));
    for (let k = 0; k < this.level.rivals; k++) {
      const t = this.world.trees[(k * 3 + 1) % this.world.trees.length];
      const s = new Squirrel(t.x + t.w + 30, GROUND_Y, RIVAL_STYLE);
      s.brain = new RivalBrain(s);
      this.rivals.push(s);
    }
    for (let k = 0; k < this.level.maxItems * 0.85; k++) this.spawnItem(true);

    if (i === 0 && !demo) {
      this.tipQueue = [
        'Przytrzymaj SKOK i puść, gdy wskaźnik jest w ZIELONYM polu – idealne wybicie daje +13% siły!',
        'Zanieś zdobycz do DZIUPLI (Spiżarnia). Więcej orzechów naraz = większe combo!',
        'Na trawie grasują psy. Wspinaj się (GÓRA) przy pniu, a w locie przytrzymaj GÓRĘ, by złapać się drzewa.',
        'Szyszki to amunicja (AKCJA). Na ziemi: DÓŁ + AKCJA = zakop orzech (bezpieczne, ale mniej punktów).',
      ];
    } else if (!demo) this.tipQueue = [pick(FACTS)];
    this.updateCamera(1, true);
  }

  spawnItem(initial = false) {
    const sp = randomSpawnPoint(this.world, false);
    const type = weightedType(sp.ground);
    let plat = null;
    if (!sp.ground) plat = this.world.platforms.find((p) => Math.abs(p.y - sp.y) < 0.1 && sp.x >= p.x && sp.x <= p.x + p.w) || null;
    if (initial && type === 'golden') return; // złoty żołądź nie od razu
    for (const p of this.players) if (Math.abs(p.x - sp.x) < 60 && Math.abs(p.y - sp.y) < 60) return;
    const it = new Item(type, sp.x, sp.y, { resting: true, plat });
    if (!initial && !sp.ground && Math.random() < 0.5) { // czasem spada z drzewa
      it.resting = false; it.y = sp.y - 60; it.plat = null;
    }
    this.items.push(it);
  }

  allSquirrels() { return this.players.concat(this.rivals); }

  // ---------------- efekty ----------------
  sfx(n) { Audio2.sfx(n); }
  shake(v) { this.cam.shake = Math.max(this.cam.shake, v); }
  say(ent, text, color) { ent.bubble = { text, color, t: 2.2 }; }
  addText(x, y, text, color = '#fff', size = 18) { this.texts.push({ x, y, text, color, size, t: 0, life: 1.4 }); }
  showToast(text, dur = 6) { this.toast = { text, t: dur }; }
  dust(x, y, n, color) {
    for (let i = 0; i < n; i++) this.particles.push({ x, y: y - 2, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 2 + Math.random() * 3, g: 300 });
  }
  sparkle(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 140;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, t: 0, color, size: 2 + Math.random() * 2, g: 0, star: true });
    }
  }

  // ---------------- zdarzenia rozgrywki ----------------
  dropFromCheeks(s, n) {
    for (let i = 0; i < n && s.cheeks.length; i++) {
      const type = s.cheeks.pop();
      this.items.push(new Item(type, s.x, s.y - 20, { vx: (Math.random() - 0.5) * 320, vy: -300 - Math.random() * 200, dropped: true, pickCd: 0.8 }));
    }
  }

  hurt(s, src, fromFall = false) {
    if (s.invuln > 0 || s.powers.golden > 0 || s.down > 0) return;
    s.hearts--; s.invuln = 2; s.stats.caught += fromFall ? 0 : 1;
    this.dropFromCheeks(s, s.cheeks.length);
    if (!fromFall) {
      s.state = 'air'; s.plat = null; s.tree = null; s.charging = false;
      s.vy = -480; s.vx = src ? Math.sign(s.x - src.x || 1) * 320 : 0; s.airMax = 320;
    }
    this.sfx('hurt'); this.shake(10);
    this.say(s, pick(LINES.hurt), '#b33');
    if (s.hearts <= 0) {
      s.down = 3.5; s.cones = 0;
      this.addText(s.x, s.y - 40, `${s.name} zemdlała!`, '#ff6a6a', 22);
      this.dust(s.x, s.y, 20, '#ddd');
    }
  }

  respawn(s) {
    const ho = this.world.home.hollow;
    s.hearts = 3; s.x = ho.x + (s.id === 0 ? 50 : -50); s.y = GROUND_Y - 345;
    s.vx = 0; s.vy = 0; s.state = 'air'; s.plat = null; s.tree = null; s.cheeks = [];
    s.invuln = 2.5; s.stun = 0; s.bury = 0; s.charging = false;
    for (const k in s.powers) s.powers[k] = 0;
    this.addText(s.x, s.y - 40, 'Wracam do gry!', '#fff', 18);
  }

  tryPickup(s, it) {
    const T = ITEM_TYPES[it.type];
    if (!s.isPlayer) {
      if (T.kind !== 'food' || !s.canFit(it.type) || s.cheeks.length >= 3) return false;
      s.cheeks.push(it.type);
      if (Math.random() < 0.3) this.say(s, pick(LINES.rival), '#444');
      return true;
    }
    switch (T.kind) {
      case 'food':
        if (!s.canFit(it.type)) {
          if (s.fullCd <= 0) { this.say(s, pick(LINES.full), '#a60'); this.sfx('full'); s.fullCd = 2.5; }
          return false;
        }
        s.cheeks.push(it.type); this.sfx('pickup');
        this.addText(it.x, it.y - 20, `+${T.name}`, '#fff7c0', 14);
        if (s.slots >= CHEEK_SLOTS) this.say(s, pick(LINES.full), '#a60');
        break;
      case 'ammo':
        if (s.cones >= MAX_CONES) return false;
        s.cones++; this.sfx('pickup');
        this.addText(it.x, it.y - 20, '+Szyszka', '#ffe0b0', 14);
        break;
      case 'heal':
        if (s.hearts >= s.maxHearts) { this.addText(it.x, it.y - 20, 'Mniam! (+5)', '#fff', 14); this.bankPoints(s, 5); }
        else { s.hearts++; this.addText(it.x, it.y - 20, '+1 ♥', '#ff8a9a', 18); }
        this.sfx('heal');
        break;
      case 'power':
        s.powers[T.power] = T.dur; s.powers.dizzy = 0;
        this.sfx('power'); this.sparkle(it.x, it.y - 10, '#ffe46a');
        this.addText(it.x, it.y - 24, T.name + '!', '#ffe46a', 20);
        break;
      case 'bad':
        s.powers.dizzy = 4; this.sfx('bad');
        this.bankPoints(s, -10);
        this.say(s, pick(LINES.rotten), '#5a7a20');
        this.addText(it.x, it.y - 20, '-10', '#9acd32', 18);
        break;
    }
    if (!this.seenFacts.has(it.type)) { this.seenFacts.add(it.type); this.showToast(ITEM_FACTS[it.type]); }
    return true;
  }

  bankPoints(s, pts) {
    this.bank = Math.max(0, this.bank + pts);
    if (s) s.score = Math.max(0, s.score + pts);
  }

  deposit(p) {
    const n = p.cheeks.length;
    const base = p.cheeks.reduce((sum, k) => sum + ITEM_TYPES[k].points, 0);
    let mult = 1 + 0.15 * (n - 1);
    const full = p.slots >= CHEEK_SLOTS;
    if (full) mult += 0.25;
    if (p.powers.golden > 0) mult *= 2;
    const total = Math.round(base * mult);
    this.bankPoints(p, total);
    p.cheeks = []; p.stats.deposits++;
    const ho = this.world.home.hollow;
    this.addText(ho.x, ho.y - 40, `+${total}`, '#ffe46a', 30);
    if (n >= 2) this.addText(ho.x, ho.y - 70, `Combo x${mult.toFixed(2)}`, '#fff', 16);
    if (full) this.addText(ho.x, ho.y - 92, 'Pełne policzki! +25%', '#7dff7a', 16);
    this.sfx('deposit'); this.sparkle(ho.x, ho.y, '#ffd23a');
  }

  startBury(p) {
    p.bury = 0.8; p.vx = 0; this.sfx('dig');
  }

  finishBury(p) {
    const idx = p.cheeks.length - 1;
    if (idx < 0) return;
    const type = p.cheeks.pop();
    const pts = Math.round(ITEM_TYPES[type].points * 0.6);
    this.bankPoints(p, pts);
    p.stats.buried++;
    this.world.saplings.push({ x: p.x + p.facing * 12, g: 0 });
    this.addText(p.x, p.y - 40, `+${pts} zakopane`, '#d8f5a0', 16);
    this.say(p, pick(LINES.bury), '#3a6a20');
    this.sfx('dig');
    if (!this.seenFacts.has('bury')) { this.seenFacts.add('bury'); this.showToast('Zapomniane, zakopane orzechy kiełkują – wiewiórki to najlepsi ogrodnicy lasu! Patrz, rośnie sadzonka.'); }
  }

  throwCone(p) {
    p.cones--;
    this.projectiles.push({ x: p.x + p.facing * 14, y: p.y - 20, vx: p.facing * 580 + p.vx * 0.3, vy: -230, owner: p, rot: 0, life: 2.5 });
    this.sfx('throw');
  }

  stompMagpie(s, m) {
    m.state = 'dazed'; m.timer = 1.2; m.vy = 100;
    if (m.carry) {
      this.items.push(new Item(m.carry, m.x, m.y, { vx: (Math.random() - 0.5) * 120, vy: -150, dropped: true, pickCd: 0.3 }));
      m.carry = null;
    }
    this.say(m, pick(LINES.magpieHit), '#222');
    this.bankPoints(s, 25); s.stats.stomps++;
    this.addText(m.x, m.y - 20, '+25', '#fff', 18);
    this.sfx('stomp');
  }

  hitRival(s, r) {
    r.stun = 1.3; r.eatT = 0; r.vx = 0;
    this.dropFromCheeks(r, r.cheeks.length);
    this.say(r, pick(LINES.rivalHit), '#444');
    if (s) { this.bankPoints(s, 15); s.stats.stomps++; this.addText(r.x, r.y - 40, '+15', '#fff', 16); }
    this.sfx('stomp');
  }

  // ---------------- pętla ----------------
  loop(ts) {
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.1) dt = 0.1;
    if (Input.consumeMute()) { const m = Audio2.toggleMute(); this.showToast(m ? 'Dźwięk wyłączony (M)' : 'Dźwięk włączony (M)', 2); }
    this.frame(dt);
    requestAnimationFrame((t) => this.loop(t));
  }

  frame(dt) {
    this.time += dt;
    const menu = Input.menu();
    const ctrls = Input.poll(this.numPlayers);
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

    switch (this.state) {
      case 'title': this.updateTitle(menu, dt); break;
      case 'help': if (menu.ok || menu.back) { this.helpPage++; this.sfx('select'); if (menu.back || this.helpPage > 1) { this.state = 'title'; this.helpPage = 0; } } this.demoTick(dt); break;
      case 'intro': if (menu.ok) { this.state = 'play'; this.sfx('confirm'); Input.poll(this.numPlayers); } break;
      case 'play': {
        if (menu.pause || ctrls.some((c) => c.pausePressed)) { this.state = 'paused'; this.menuIndex = 0; this.sfx('select'); break; }
        // stała, drobna klatka fizyki
        const steps = Math.ceil(dt / (1 / 120));
        const sdt = dt / steps;
        for (let i = 0; i < steps; i++) { this.update(sdt, ctrls); if (i === 0) ctrls.forEach(clearEdges); }
        break;
      }
      case 'paused': this.updatePause(menu); break;
      case 'levelEnd': if (menu.ok) this.afterLevel(); break;
      case 'victory': if (menu.ok) { this.state = 'title'; this.totalScores = [0, 0]; this.setupLevel(0, true); this.sfx('confirm'); } break;
    }
    this.render();
  }

  demoTick(dt) {
    // tło menu: kamera płynie przez las, a psy i sroki żyją swoim życiem
    for (const d of this.dogs) d.update(dt, this);
    for (const m of this.magpies) m.update(dt, this);
    for (const r of this.rivals) { r.update(r.brain.ctrl(dt, this), dt, this); }
    for (const r of this.rivals) for (const it of this.items) if (!it.taken && boxOverlap(r.box(), it.box()) && this.tryPickup(r, it)) it.taken = true;
    this.items = this.items.filter((i) => !i.taken);
    for (const r of this.rivals) if (r.cheeks.length >= 3) r.cheeks = [];
    if (this.items.length < this.level.maxItems) this.spawnItem();
    for (const b of [...this.dogs, ...this.magpies, ...this.rivals]) if (b.bubble) { b.bubble.t -= dt; if (b.bubble.t <= 0) b.bubble = null; }
    const span = this.world.width - this.W / this.cam.zoom;
    this.cam.zoom = this.H / 760;
    this.cam.x = this.W / 2 / this.cam.zoom + (Math.sin(this.time * 0.05) * 0.5 + 0.5) * Math.max(0, span);
    this.cam.y = WORLD_H - this.H / 2 / this.cam.zoom;
  }

  updateTitle(menu, dt) {
    this.demoTick(dt);
    const opts = this.titleOptions();
    if (menu.up) { this.menuIndex = (this.menuIndex + opts.length - 1) % opts.length; this.sfx('select'); }
    if (menu.down) { this.menuIndex = (this.menuIndex + 1) % opts.length; this.sfx('select'); }
    if (menu.ok) {
      this.sfx('confirm');
      const o = opts[this.menuIndex].id;
      if (o === '1p' || o === '2p') {
        this.numPlayers = o === '1p' ? 1 : 2;
        this.totalScores = [0, 0];
        this.setupLevel(0);
        this.state = 'intro';
      } else if (o === 'help') { this.state = 'help'; this.helpPage = 0; }
      else if (o === 'sound') Audio2.toggleMute();
      else if (o === 'fs') toggleFullscreen();
    }
  }

  titleOptions() {
    return [
      { id: '1p', label: '1 gracz' },
      { id: '2p', label: '2 graczy (kooperacja)' },
      { id: 'help', label: 'Jak grać?' },
      { id: 'sound', label: 'Dźwięk: ' + (Audio2.muted ? 'wyłączony' : 'włączony') },
      { id: 'fs', label: 'Pełny ekran' },
    ];
  }

  updatePause(menu) {
    const opts = ['Wznów', 'Zacznij poziom od nowa', 'Menu główne'];
    if (menu.up) { this.menuIndex = (this.menuIndex + 2) % 3; this.sfx('select'); }
    if (menu.down) { this.menuIndex = (this.menuIndex + 1) % 3; this.sfx('select'); }
    if (menu.pause || menu.back) { this.state = 'play'; return; }
    if (menu.ok) {
      this.sfx('confirm');
      if (this.menuIndex === 0) this.state = 'play';
      else if (this.menuIndex === 1) { this.setupLevel(this.levelIndex); this.state = 'intro'; }
      else { this.setupLevel(0, true); this.state = 'title'; this.menuIndex = 0; }
      Input.poll(this.numPlayers);
    }
    this.pauseOpts = opts;
  }

  endLevel() {
    const L = this.level;
    const success = this.bank >= L.target;
    const stars = this.bank >= L.target * 1.8 ? 3 : this.bank >= L.target * 1.4 ? 2 : success ? 1 : 0;
    this.endInfo = { success, stars, bank: this.bank, fact: pick(FACTS) };
    if (success) this.players.forEach((p, i) => { this.totalScores[i] += p.score; });
    this.state = 'levelEnd';
    this.sfx(success ? 'win' : 'lose');
  }

  afterLevel() {
    this.sfx('confirm');
    if (!this.endInfo.success) { this.setupLevel(this.levelIndex); this.state = 'intro'; return; }
    this.lastStats = this.players.map((p) => ({ name: p.name, stats: { ...p.stats }, score: p.score }));
    this.allStats = this.allStats || [];
    this.allStats[this.levelIndex] = this.lastStats;
    if (this.levelIndex + 1 < LEVELS.length) { this.setupLevel(this.levelIndex + 1); this.state = 'intro'; }
    else { this.state = 'victory'; }
  }

  update(dt, ctrls) {
    const L = this.level;
    this.timeLeft -= dt;
    if (this.timeLeft <= 10 && Math.floor(this.timeLeft) !== Math.floor(this.timeLeft + dt) && this.timeLeft > 0) this.sfx('tick');
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.endLevel(); return; }

    // podpowiedzi
    this.tipT -= dt;
    if (this.tipT <= 0 && this.tipQueue.length) { this.showToast(this.tipQueue.shift(), 7); this.tipT = 9; }

    // wiatr
    if (L.wind) {
      this.windT -= dt;
      if (this.windT <= 0) {
        if (this.wind === 0) { this.wind = (Math.random() < 0.5 ? -1 : 1) * L.wind * (0.7 + Math.random() * 0.6); this.windT = 4 + Math.random() * 3; }
        else { this.wind = 0; this.windT = 5 + Math.random() * 5; }
      }
    }

    // gracze
    this.players.forEach((p, i) => {
      if (p.down > 0) { p.down -= dt; if (p.down <= 0) this.respawn(p); return; }
      const c = ctrls[i];
      p.update(c, dt, this);
      if (c.actionPressed && p.stun <= 0 && p.bury <= 0) {
        if (p.state === 'ground' && !p.plat && c.y === 1 && p.cheeks.some((k) => ITEM_TYPES[k].kind === 'food')) this.startBury(p);
        else if (p.cones > 0) this.throwCone(p);
        else if (p.fullCd <= 0) { this.addText(p.x, p.y - 50, 'Brak szyszek!', '#ffd0a0', 13); p.fullCd = 1; }
      }
      // dziupla
      if (p.cheeks.length && boxOverlap(p.box(), this.world.hollowZone)) this.deposit(p);
    });

    // rywale
    for (const r of this.rivals) {
      const c = r.brain.ctrl(dt, this);
      r.update(c, dt, this);
      if (r.eatT > 0) {
        r.eatT -= dt;
        if (r.eatT <= 0) { r.cheeks = []; this.addText(r.x, r.y - 40, 'Zjedzone…', '#ccc', 14); }
      } else if (r.cheeks.length >= 3 && r.state === 'ground') {
        r.eatT = 4; this.say(r, pick(LINES.rivalEat), '#444');
      }
    }

    // przedmioty
    for (const it of this.items) it.update(dt, this.world);
    for (const s of this.allSquirrels()) {
      if (!s.active || s.stun > 0 || s.eatT > 0) continue;
      const b = s.box();
      for (const it of this.items) {
        if (it.taken || it.pickCd > 0) continue;
        if (boxOverlap(b, it.box()) && this.tryPickup(s, it)) it.taken = true;
      }
    }
    this.items = this.items.filter((i) => !i.taken);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.1; if (this.items.length < L.maxItems) this.spawnItem(); }

    // psy
    for (const d of this.dogs) {
      d.update(dt, this);
      if (d.dazed > 0 || d.sleep > 0) continue;
      const db = d.box();
      for (const s of this.allSquirrels()) {
        if (!s.active || s.invuln > 0) continue;
        if (!boxOverlap(db, s.box())) continue;
        if (s.powers.golden > 0) { d.scared = 2.5; continue; }
        if (s.isPlayer) this.hurt(s, d);
        else {
          s.stun = 1.5; s.invuln = 2; s.eatT = 0;
          this.dropFromCheeks(s, s.cheeks.length);
          s.state = 'air'; s.plat = null; s.tree = null; s.vy = -420; s.vx = Math.sign(s.x - d.x || 1) * 260; s.airMax = 260;
          this.say(s, 'Ratunkuuu!', '#444');
        }
        this.sfx('bark');
      }
    }

    // sroki
    for (const m of this.magpies) {
      m.update(dt, this);
      if (m.state === 'dazed') continue;
      for (const s of this.allSquirrels()) {
        if (!s.active) continue;
        const dx = Math.abs(s.x - m.x);
        if (s.state === 'air' && s.vy > 120 && dx < 28 && s.y > m.y - 16 && s.y < m.y + 8) {
          if (s.isPlayer) { this.stompMagpie(s, m); s.vy = -560; }
          continue;
        }
        if (m.state === 'swoop' && boxOverlap(m.box(), s.box()) && s.invuln <= 0) {
          if (s.powers.golden > 0) { m.state = 'dazed'; m.timer = 1; this.say(m, 'Au! Świeci!', '#222'); continue; }
          if (s.cheeks.length) {
            m.carry = s.cheeks.pop(); m.carryT = 0;
            if (s.isPlayer) s.stats.stolen++;
            this.say(m, pick(LINES.magpieSteal), '#222');
            this.addText(s.x, s.y - 40, 'Sroka ukradła orzech!', '#ffb0b0', 15);
            this.sfx('steal');
            s.invuln = Math.max(s.invuln, 0.8);
          }
          m.flee();
        }
      }
    }

    // gracz skacze na rywala
    for (const p of this.players) {
      if (!p.active || p.state !== 'air' || p.vy < 150) continue;
      for (const r of this.rivals) {
        if (r.stun > 0) continue;
        if (Math.abs(p.x - r.x) < 24 && p.y > r.y - 30 && p.y < r.y - 8) { this.hitRival(p, r); p.vy = -520; }
      }
    }

    // szyszki
    for (const pr of this.projectiles) {
      pr.vy += GRAVITY * 0.7 * dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.rot += dt * 14; pr.life -= dt;
      if (pr.y >= GROUND_Y - 4) { pr.life = 0; this.dust(pr.x, GROUND_Y, 4, '#8a5a2a'); }
      const pb = { x: pr.x - 7, y: pr.y - 7, w: 14, h: 14 };
      for (const d of this.dogs) {
        if (pr.life > 0 && boxOverlap(pb, d.box())) {
          pr.life = 0; d.dazed = 3; d.sleep = 0; d.state = 'patrol'; d.target = null;
          this.say(d, pick(LINES.dogDazed), '#7a2a00'); this.sfx('yelp');
          this.bankPoints(pr.owner, 10); this.addText(d.x, d.y - 50, '+10', '#fff', 16);
        }
      }
      for (const m of this.magpies) {
        if (pr.life > 0 && m.state !== 'dazed' && boxOverlap(pb, m.box())) { pr.life = 0; this.stompMagpie(pr.owner, m); this.sfx('hit'); }
      }
      for (const r of this.rivals) {
        if (pr.life > 0 && r.stun <= 0 && boxOverlap(pb, r.box())) { pr.life = 0; this.hitRival(pr.owner, r); this.sfx('hit'); }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    // „prezenty” od srok (na szczęście!)
    for (const po of this.poops) {
      po.vy += 900 * dt; po.y += po.vy * dt;
      for (const p of this.players) {
        if (p.active && !po.done && Math.abs(p.x - po.x) < 16 && po.y > p.y - 30 && po.y < p.y) {
          po.done = true;
          this.bankPoints(p, 15);
          this.say(p, pick(LINES.gift), '#556');
          this.addText(p.x, p.y - 50, '+15 na szczęście', '#ffffff', 15);
          this.sfx('splat');
          if (!this.seenFacts.has('poop')) { this.seenFacts.add('poop'); this.showToast('Według polskiego przesądu, gdy ptak cię „obdaruje” – to na szczęście! Gra się z tym zgadza: +15 pkt.'); }
        }
      }
      if (po.y >= GROUND_Y) { po.done = true; this.dust(po.x, GROUND_Y, 3, '#fff'); }
    }
    this.poops = this.poops.filter((p) => !p.done);

    // sadzonki rosną
    for (const sp of this.world.saplings) sp.g = Math.min(1, sp.g + dt / 25);

    this.updateFx(dt);
    this.updateCamera(dt);
  }

  updateFx(dt) {
    for (const p of this.particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const e of [...this.players, ...this.rivals, ...this.dogs, ...this.magpies]) {
      if (e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
    }
    if (this.cam.shake > 0) this.cam.shake = Math.max(0, this.cam.shake - dt * 30);
  }

  updateCamera(dt, snap = false) {
    const act = this.players.filter((p) => p.active);
    const list = act.length ? act : this.players;
    if (!list.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of list) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y - 30); maxY = Math.max(maxY, p.y - 30); }
    const W = this.W, H = this.H;
    let z = H / 700;
    if (list.length > 1) z = Math.min(z, W / (maxX - minX + 520), H / (maxY - minY + 420));
    const minZoom = Math.max(H / (WORLD_H + 300), W / this.world.width);
    z = Math.max(z, minZoom);
    const cam = this.cam;
    cam.zoom = snap ? z : lerp(cam.zoom, z, Math.min(1, dt * 3));
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (list.length === 1) cx += list[0].facing * 60;
    const halfW = W / 2 / cam.zoom, halfH = H / 2 / cam.zoom;
    cx = clamp(cx, halfW, Math.max(halfW, this.world.width - halfW));
    const top = -300 + halfH, bottom = WORLD_H - halfH;
    cy = top > bottom ? (top + bottom) / 2 : clamp(cy, top, bottom);
    cam.x = snap ? cx : lerp(cam.x, cx, Math.min(1, dt * 5));
    cam.y = snap ? cy : lerp(cam.y, cy, Math.min(1, dt * 5));
    // w trybie 2 graczy nikt nie ucieknie poza ekran
    if (this.players.length > 1) {
      for (const p of this.players) p.x = clamp(p.x, cam.x - halfW + 20, cam.x + halfW - 20);
    }
  }

  // ---------------- rysowanie ----------------
  render() {
    const ctx = this.ctx, W = this.W, H = this.H, cam = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackground(ctx, this, W, H);

    const sx = (Math.random() - 0.5) * cam.shake, sy = (Math.random() - 0.5) * cam.shake;
    ctx.setTransform(cam.zoom * this.dpr, 0, 0, cam.zoom * this.dpr,
      (W / 2 - cam.x * cam.zoom + sx) * this.dpr, (H / 2 - cam.y * cam.zoom + sy) * this.dpr);
    const viewL = cam.x - W / 2 / cam.zoom - 300, viewR = cam.x + W / 2 / cam.zoom + 300;
    const vis = (x) => x > viewL && x < viewR;
    const L = this.level, t = this.time;

    for (const tr of this.world.trees) if (vis(tr.x)) drawTreeBack(ctx, tr, L, t);
    for (const p of this.world.platforms) if (vis(p.x) || vis(p.x + p.w)) { if (p.stump) drawStump(ctx, p); else drawBranch(ctx, p, L); }
    for (const tr of this.world.trees) if (vis(tr.x)) drawCanopy(ctx, tr, L, t);
    drawGround(ctx, this);
    if (!this.demo) drawHollowSign(ctx, this);

    for (const it of this.items) {
      if (!vis(it.x)) continue;
      const bob = it.resting ? Math.sin(it.t * 3) * 2 : 0;
      const sc = it.spawnAnim > 0 ? 1 - it.spawnAnim * 1.6 : 1;
      drawItem(ctx, it.type, it.x, it.y - 12 + bob, it.t, Math.max(0.2, sc));
    }
    for (const r of this.rivals) if (vis(r.x)) drawSquirrel(ctx, r, t);
    for (const d of this.dogs) if (vis(d.x)) drawDog(ctx, d, t);
    for (const p of this.players) drawSquirrel(ctx, p, t);
    for (const m of this.magpies) if (vis(m.x)) drawMagpie(ctx, m, t);
    for (const pr of this.projectiles) {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.rot); drawItem(ctx, 'cone', 0, 0, t, 0.8); ctx.restore();
    }
    ctx.fillStyle = '#f4f4f0';
    for (const po of this.poops) { ellipse(ctx, po.x, po.y, 4, 5); ctx.fill(); }

    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      if (p.star) drawStar(ctx, p.x, p.y, p.size * 1.5); else ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const e of [...this.players, ...this.rivals, ...this.dogs, ...this.magpies]) {
      if (e.bubble && vis(e.x)) {
        const yy = e instanceof Magpie ? e.y - 18 : e.y - (e.h || 30) - 34;
        drawBubble(ctx, e.x, yy, e.bubble.text, e.bubble.color);
      }
    }
    for (const tx of this.texts) {
      const a = 1 - tx.t / tx.life;
      ctx.globalAlpha = a;
      ctx.font = `bold ${tx.size}px sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(tx.text, tx.x, tx.y - tx.t * 40);
      ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y - tx.t * 40);
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawWeather(ctx);
    if (this.state === 'play' || this.state === 'paused' || this.state === 'intro' || this.state === 'levelEnd') this.drawHUD(ctx);
    if (this.toast && this.state === 'play') this.drawToast(ctx);
    switch (this.state) {
      case 'title': this.drawTitle(ctx); break;
      case 'help': this.drawHelp(ctx); break;
      case 'intro': this.drawIntro(ctx); break;
      case 'paused': this.drawPause(ctx); break;
      case 'levelEnd': this.drawLevelEnd(ctx); break;
      case 'victory': this.drawVictory(ctx); break;
    }
  }

  drawWeather(ctx) {
    const L = this.level, W = this.W, H = this.H;
    const snow = L.particles === 'snow';
    const snowing = snow || (this.state === 'play' && this.timeLeft < 15);
    for (const w of this.weather) {
      w.y += (snowing ? 40 : 30) * w.s * 0.016;
      w.x += (Math.sin(this.time + w.r) * 0.5 + this.wind * 0.01) * w.s;
      w.r += 0.02;
      if (w.y > H + 10) { w.y = -10; w.x = Math.random() * W; }
      if (w.x < -10) w.x = W + 10; if (w.x > W + 10) w.x = -10;
      if (snowing) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ellipse(ctx, w.x, w.y, 2 * w.s, 2 * w.s); ctx.fill();
      } else if (w.c < 2) {
        ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.r);
        ctx.fillStyle = L.leaves[w.c + 1] || L.leaves[0];
        ellipse(ctx, 0, 0, 5 * w.s, 2.5 * w.s); ctx.fill();
        ctx.restore();
      }
    }
  }

  drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(30,20,10,0.6)';
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
  }

  drawPlayerHUD(ctx, p, x, y, alignRight) {
    const w = 230, h = 78;
    const px = alignRight ? x - w : x;
    this.drawPanel(ctx, px, y, w, h);
    ctx.fillStyle = p.scarf; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`P${p.id + 1} ${p.name}`, px + 10, y + 18);
    ctx.fillStyle = '#ffe46a'; ctx.textAlign = 'right';
    ctx.fillText(`${p.score} pkt`, px + w - 10, y + 18);
    for (let i = 0; i < p.maxHearts; i++) drawHeart(ctx, px + 18 + i * 20, y + 25, 15, i < p.hearts);
    // policzki
    ctx.textAlign = 'left';
    let cx = px + 12;
    for (let i = 0; i < CHEEK_SLOTS; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ellipse(ctx, cx + i * 19 + 8, y + 60, 8, 8); ctx.fill();
    }
    let slot = 0;
    for (const k of p.cheeks) {
      const sl = ITEM_TYPES[k].slots;
      drawItem(ctx, k, cx + slot * 19 + 8 + (sl - 1) * 9.5, y + 61, this.time, sl > 1 ? 0.85 : 0.75);
      slot += sl;
    }
    // szyszki
    drawItem(ctx, 'cone', px + 135, y + 44, this.time, 0.7);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`×${p.cones}`, px + 144, y + 49);
    // moce
    let off = 0;
    for (const [k, icon] of [['golden', 'golden'], ['speed', 'raspberry'], ['glide', 'feather'], ['dizzy', 'rotten']]) {
      if (p.powers[k] > 0) {
        drawItem(ctx, icon, px + 135 + off, y + 64, this.time, 0.6);
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
        ctx.fillText(Math.ceil(p.powers[k]) + 's', px + 144 + off, y + 70);
        off += 34;
      }
    }
    if (p.down > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, px, y, w, h, 10); ctx.fill();
      ctx.fillStyle = '#ff8a8a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`Zemdlała… ${Math.ceil(p.down)}`, px + w / 2, y + h / 2 + 5);
    }
  }

  drawHUD(ctx) {
    const W = this.W, L = this.level;
    if (this.players[0]) this.drawPlayerHUD(ctx, this.players[0], 12, 12, false);
    if (this.players[1]) this.drawPlayerHUD(ctx, this.players[1], W - 12, 12, true);
    // środek: czas + cel
    const cw = Math.min(320, W - 520 > 200 ? 320 : 220), cx = W / 2 - cw / 2;
    const cy = W < 760 ? 100 : 12;
    this.drawPanel(ctx, cx, cy, cw, 64);
    const tl = Math.ceil(this.timeLeft);
    ctx.textAlign = 'center';
    ctx.fillStyle = tl <= 15 ? (Math.floor(this.time * 4) % 2 ? '#ff6a6a' : '#fff') : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Do zimy: ${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, W / 2, cy + 23);
    const bx = cx + 14, bw = cw - 28, by = cy + 34, bh = 14;
    const maxV = L.target * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(ctx, bx, by, bw, bh, 7); ctx.fill();
    const fr = Math.min(1, this.bank / maxV);
    ctx.fillStyle = this.bank >= L.target ? '#7dd34a' : '#e8b030';
    if (fr > 0) { roundRect(ctx, bx, by, Math.max(14, bw * fr), bh, 7); ctx.fill(); }
    for (const [m, n] of [[1, 1], [1.4, 2], [1.8, 3]]) {
      const xx = bx + bw * (m / 1.8);
      ctx.fillStyle = this.bank >= L.target * m ? '#ffe46a' : 'rgba(255,255,255,0.5)';
      for (let k = 0; k < n; k++) drawStar(ctx, xx - 6 - k * 9, by + bh + 7, 4);
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`Spiżarnia: ${this.bank} / ${L.target}`, W / 2, by + 11);
    // wiatr
    if (this.wind) {
      const wx = W / 2, wy = cy + 86;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Wiatr ' + (this.wind > 0 ? '→→' : '←←'), wx, wy);
    }
    // strzałka do dziupli
    const ho = this.world.home.hollow, cam = this.cam;
    const hsx = (ho.x - cam.x) * cam.zoom + W / 2, hsy = (ho.y - cam.y) * cam.zoom + this.H / 2;
    if (this.players.some((p) => p.cheeks.length) && (hsx < 0 || hsx > W || hsy < 0 || hsy > this.H)) {
      const ax = clamp(hsx, 40, W - 40), ay = clamp(hsy, 120, this.H - 40);
      const ang = Math.atan2(hsy - ay, hsx - ax);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('dziupla', ax, ay + 24);
    }
  }

  drawToast(ctx) {
    const W = this.W, H = this.H;
    ctx.font = '15px sans-serif';
    const lines = wrapText(ctx, this.toast.text, Math.min(620, W - 60));
    const h = lines.length * 20 + 18, w = Math.min(660, W - 30);
    const a = Math.min(1, this.toast.t * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,250,230,0.94)';
    roundRect(ctx, W / 2 - w / 2, H - h - 18, w, h, 10); ctx.fill();
    ctx.fillStyle = '#4a3010'; ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H - h - 18 + 24 + i * 20));
    ctx.globalAlpha = 1;
  }

  drawCard(ctx, w, h) {
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    w = Math.min(w, W - 24); h = Math.min(h, H - 24);
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    ctx.fillStyle = '#fff6e0'; roundRect(ctx, x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 4; roundRect(ctx, x, y, w, h, 18); ctx.stroke();
    return { x, y, w, h };
  }

  drawMenuList(ctx, opts, cx, y0, sel) {
    opts.forEach((label, i) => {
      const y = y0 + i * 44;
      const on = i === sel;
      ctx.fillStyle = on ? '#c8571b' : 'rgba(90,60,30,0.15)';
      roundRect(ctx, cx - 160, y - 26, 320, 36, 10); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#5a3a1a';
      ctx.font = `bold ${on ? 19 : 17}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(label, cx, y - 2);
    });
  }

  drawTitle(ctx) {
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    const ty = Math.max(90, H * 0.2);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.min(72, W / 11)}px Georgia, serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#4a2a10';
    ctx.strokeText('Orzechowa Gorączka', cx, ty);
    ctx.fillStyle = '#ffcf6a'; ctx.fillText('Orzechowa Gorączka', cx, ty);
    ctx.font = 'italic 18px Georgia, serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Wiewiórcza przygoda w koronach drzew', cx, ty + 34);
    // maskotka
    const mascot = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, state: 'ground', charging: false, charge: 0, anim: this.time, fur: PLAYER_STYLES[0].fur, furDark: PLAYER_STYLES[0].furDark, belly: PLAYER_STYLES[0].belly, scarf: PLAYER_STYLES[0].scarf, slots: 3 + Math.round(Math.sin(this.time * 2) * 2), powers: {}, stun: 0, down: 0, invuln: 0, eatT: 0, isPlayer: false };
    ctx.save(); ctx.translate(cx, ty + 120); ctx.scale(2.4, 2.4);
    drawSquirrel(ctx, mascot, this.time);
    ctx.restore();

    const opts = this.titleOptions().map((o) => o.label);
    const box = { w: 380, h: opts.length * 44 + 30 };
    const by = ty + 150;
    ctx.fillStyle = 'rgba(255,246,224,0.92)';
    roundRect(ctx, cx - box.w / 2, by, box.w, box.h, 16); ctx.fill();
    this.drawMenuList(ctx, opts, cx, by + 46, this.menuIndex);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    const pads = Input.pads().length;
    ctx.fillText(`Strzałki/W S + Enter/Spacja albo pad. Podłączone pady: ${pads}`, cx, Math.min(H - 16, by + box.h + 26));
  }

  drawHelp(ctx) {
    const c = this.drawCard(ctx, 760, 560);
    const L = (txt, y, size = 15, color = '#4a3010', bold = false) => {
      ctx.fillStyle = color; ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(txt, c.x + 30, c.y + y);
    };
    if (this.helpPage === 0) {
      L('Jak grać – sterowanie', 40, 24, '#8a3510', true);
      L('Gracz 1: A/D – ruch,  W/S – wspinaczka,  SPACJA – skok,  E – akcja', 80);
      L('Gracz 2: ←/→ – ruch,  ↑/↓ – wspinaczka,  prawy SHIFT – skok,  prawy CTRL / Enter – akcja', 106);
      L('Pad: lewa gałka/krzyżak – ruch,  A – skok,  B/X – akcja,  START – pauza', 132);
      L('W trybie 1 gracza działają oba zestawy klawiszy. P/Esc – pauza, M – dźwięk.', 158);
      L('Skakanie', 200, 18, '#8a3510', true);
      L('• Przytrzymaj SKOK – wskaźnik siły pulsuje. Puść, aby skoczyć w stronę, którą trzymasz.', 228);
      L('• Puść w ZIELONYM polu = idealne wybicie (+13% siły). Bez kierunku = skok w górę.', 252);
      L('• Za słaby skok = lot na trawę. Upadek z dużej wysokości ogłusza i gubisz orzechy!', 276);
      L('• W locie przytrzymaj GÓRĘ przy pniu, aby się go złapać. DÓŁ na gałęzi = zeskok.', 300);
      L('Zbieranie', 342, 18, '#8a3510', true);
      L('• Policzki mieszczą 6 miejsc (orzech włoski zajmuje 2). Pełne policzki = wolniejsza wiewiórka.', 370);
      L('• Zanieś zdobycz do DZIUPLI. Więcej naraz = combo (+15% za każdy), pełne policzki +25%.', 394);
      L('• Na trawie: DÓŁ + AKCJA = zakop orzech (60% punktów od razu, wyrośnie sadzonka).', 418);
      L('• Zbierz tyle punktów, ile wymaga poziom, zanim przyjdzie zima!', 442);
      L('Dalej ▶ (Enter / A)', c.h - 24, 15, '#c8571b', true);
    } else {
      L('Przyjaciele, wrogowie i przysmaki', 40, 24, '#8a3510', true);
      const rows = [
        ['acorn', 'Żołądź 10 pkt, orzech laskowy 20 pkt, orzech włoski 45 pkt (2 miejsca)'],
        ['cone', 'Szyszka – amunicja (AKCJA): ogłusza psy, strąca sroki, przegania rywali'],
        ['mushroom', 'Borowik – +1 serce (max 5)'],
        ['golden', 'Złoty żołądź – nietykalność, psy uciekają, punkty ×2'],
        ['raspberry', 'Malina – szybszy bieg i mocniejsze skoki'],
        ['feather', 'Piórko polatuchy – przytrzymaj skok w locie, aby szybować'],
        ['rotten', 'Zgniły orzech – odwrócone sterowanie i −10 pkt. Fuj!'],
      ];
      rows.forEach(([k, txt], i) => {
        drawItem(ctx, k, c.x + 44, c.y + 82 + i * 34, this.time, 1);
        ctx.fillStyle = '#4a3010'; ctx.font = '15px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(txt, c.x + 70, c.y + 88 + i * 34);
      });
      const y0 = 82 + rows.length * 34 + 14;
      L('• Psy (jamnik, owczarek, mops) gonią po trawie. Złapanie = −1 serce i rozsypane orzechy.', y0);
      L('  Owczarek podskakuje, jamnik jest szybki, a mops… często zasypia.', y0 + 24);
      L('• Sroki pikują i kradną orzechy z policzków. Skocz na nią lub rzuć szyszką, by odzyskać!', y0 + 48);
      L('• Szaruś (wiewiórka szara) podbiera jedzenie. Skocz mu na głowę, a wszystko upuści.', y0 + 72);
      L('• Ptasi „prezent” z nieba to… szczęście! +15 pkt.', y0 + 96);
      L('◀ Powrót (Enter / A)', c.h - 24, 15, '#c8571b', true);
    }
  }

  drawIntro(ctx) {
    const c = this.drawCard(ctx, 620, 380);
    const L = this.level;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a5a2a'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Poziom ${this.levelIndex + 1} z ${LEVELS.length}`, this.W / 2, c.y + 40);
    ctx.fillStyle = '#8a3510'; ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(L.name, this.W / 2, c.y + 84);
    ctx.fillStyle = '#4a3010'; ctx.font = 'italic 16px sans-serif';
    wrapText(ctx, L.subtitle, c.w - 60).forEach((l, i) => ctx.fillText(l, this.W / 2, c.y + 118 + i * 20));
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Cel: ${L.target} pkt w spiżarni   •   Czas: ${Math.floor(L.time / 60)}:${String(L.time % 60).padStart(2, '0')}`, this.W / 2, c.y + 178);
    ctx.font = '15px sans-serif';
    const dogs = [...new Set(L.dogs)].map((d) => DOG_TYPES[d].name).join(', ');
    ctx.fillText(`Psy: ${dogs}  •  Sroki: ${L.magpies}  •  Rywale: ${L.rivals}${L.wind ? '  •  Wiatr!' : ''}${L.ice ? '  •  Lód!' : ''}`, this.W / 2, c.y + 206);
    ctx.fillStyle = '#6a5030'; ctx.font = 'italic 14px sans-serif';
    wrapText(ctx, 'Ciekawostka: ' + this.tipFact(), c.w - 70).forEach((l, i) => ctx.fillText(l, this.W / 2, c.y + 250 + i * 19));
    ctx.fillStyle = Math.floor(this.time * 2) % 2 ? '#c8571b' : '#8a3510';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Naciśnij SPACJĘ / ENTER / A, aby zacząć', this.W / 2, c.y + c.h - 26);
  }

  tipFact() {
    if (!this.introFact || this.introFactLevel !== this.levelIndex + '_' + this.level.time + this.world.width) {
      this.introFact = pick(FACTS); this.introFactLevel = this.levelIndex + '_' + this.level.time + this.world.width;
    }
    return this.introFact;
  }

  drawPause(ctx) {
    const c = this.drawCard(ctx, 420, 260);
    ctx.fillStyle = '#8a3510'; ctx.font = 'bold 30px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('Pauza', this.W / 2, c.y + 50);
    this.drawMenuList(ctx, this.pauseOpts || ['Wznów', 'Zacznij poziom od nowa', 'Menu główne'], this.W / 2, c.y + 110, this.menuIndex);
  }

  drawLevelEnd(ctx) {
    const e = this.endInfo;
    const c = this.drawCard(ctx, 640, 320 + this.players.length * 26);
    const cx = this.W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = e.success ? '#3a8a20' : '#a03020';
    ctx.font = 'bold 32px Georgia, serif';
    ctx.fillText(e.success ? 'Spiżarnia pełna!' : 'Zima przyszła za wcześnie…', cx, c.y + 54);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < e.stars ? '#ffc820' : 'rgba(0,0,0,0.15)';
      drawStar(ctx, cx - 60 + i * 60, c.y + 100, 24);
    }
    ctx.fillStyle = '#4a3010'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Zebrano: ${e.bank} / ${this.level.target} pkt`, cx, c.y + 156);
    ctx.font = '15px sans-serif';
    this.players.forEach((p, i) => {
      ctx.fillStyle = p.scarf;
      ctx.fillText(`${p.name}: ${p.score} pkt • idealne skoki: ${p.stats.perfect} • upadki: ${p.stats.falls} • złapania: ${p.stats.caught} • zakopane: ${p.stats.buried}`, cx, c.y + 190 + i * 26);
    });
    const fy = c.y + 200 + this.players.length * 26;
    ctx.fillStyle = '#6a5030'; ctx.font = 'italic 14px sans-serif';
    wrapText(ctx, (e.success ? 'Wiesz, że… ' : 'Pocieszenie: ') + e.fact, c.w - 70).forEach((l, i) => ctx.fillText(l, cx, fy + 20 + i * 19));
    ctx.fillStyle = '#c8571b'; ctx.font = 'bold 18px sans-serif';
    const next = e.success ? (this.levelIndex + 1 < LEVELS.length ? 'Dalej – następna pora roku!' : 'Zobacz wielki finał!') : 'Spróbuj jeszcze raz';
    ctx.fillText(next + ' (Enter / A)', cx, c.y + c.h - 26);
  }

  drawVictory(ctx) {
    const c = this.drawCard(ctx, 680, 470);
    const cx = this.W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a3510'; ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('Zima? Niestraszna!', cx, c.y + 54);
    ctx.fillStyle = '#4a3010'; ctx.font = '16px sans-serif';
    wrapText(ctx, 'Spiżarnia pęka w szwach, a ty możesz spokojnie przespać mroźne dni zwinięta w kłębek pod puszystym ogonem.', c.w - 80).forEach((l, i) => ctx.fillText(l, cx, c.y + 90 + i * 21));
    ctx.font = 'bold 20px sans-serif';
    this.players.forEach((p, i) => {
      ctx.fillStyle = p.scarf;
      ctx.fillText(`${p.name}: ${this.totalScores[i]} pkt łącznie`, cx, c.y + 160 + i * 30);
    });
    // humorystyczne nagrody
    const all = (key) => this.players.map((p, i) => ({ i, v: (this.allStats || []).reduce((s, lv) => s + ((lv && lv[i]) ? lv[i].stats[key] : 0), 0) }));
    const award = (key, title) => {
      const a = all(key).sort((x, y) => y.v - x.v)[0];
      return a && a.v > 0 ? `${title}: ${this.players[a.i].name} (${a.v})` : null;
    };
    const awards = [
      award('perfect', '🏅 Polatucha honoris causa – idealne skoki'),
      award('falls', '🤕 Kaskader roku – upadki'),
      award('caught', '🐕 Ulubienica jamników – złapania'),
      award('buried', '🌱 Ogrodniczka lasu – zakopane orzechy'),
      award('stomps', '🦶 Postrach srok – skoki na głowę'),
    ].filter(Boolean);
    ctx.fillStyle = '#4a3010'; ctx.font = '15px sans-serif';
    awards.forEach((a, i) => ctx.fillText(a, cx, c.y + 240 + i * 26));
    ctx.fillStyle = '#c8571b'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Powrót do menu (Enter / A)', cx, c.y + c.h - 26);
  }
}

function clearEdges(c) {
  c.jumpPressed = false; c.jumpReleased = false; c.actionPressed = false; c.pausePressed = false;
  c.upPressed = false; c.downPressed = false; c.leftPressed = false; c.rightPressed = false;
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); }
  else if (document.exitFullscreen) document.exitFullscreen();
}

window.addEventListener('load', () => {
  Input.init();
  window.game = new Game(document.getElementById('game'));
  window.addEventListener('gamepadconnected', (e) => window.game.showToast(`Pad podłączony: ${e.gamepad.id.slice(0, 40)}`, 3));
});
