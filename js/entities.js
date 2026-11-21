'use strict';
// ===================== POSTACIE: wiewiórki, psy, sroki, przedmioty =====================

class Squirrel {
  constructor(x, y, o = {}) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.w = 30; this.h = 26;
    this.facing = 1;
    this.state = 'air'; this.plat = null; this.tree = null;
    this.charging = false; this.chargeT = 0; this.charge = 0;
    this.cheeks = []; this.cones = 0;
    this.hearts = 3; this.maxHearts = 5;
    this.invuln = 0; this.stun = 0; this.dropIgnore = null; this.dropT = 0; this.grabCd = 0;
    this.powers = { golden: 0, speed: 0, glide: 0, dizzy: 0 };
    this.score = 0;
    this.isPlayer = !!o.isPlayer; this.id = o.id || 0; this.name = o.name || 'Wiewiórka';
    this.fur = o.fur || '#c8571b'; this.furDark = o.furDark || '#8a3510'; this.belly = o.belly || '#f6e0c0';
    this.scarf = o.scarf || null;
    this.bury = 0; this.anim = Math.random() * 10; this.down = 0; this.gliding = false;
    this.airMax = 240; this.bubble = null; this.fullCd = 0; this.eatT = 0;
    this.stats = { deposits: 0, falls: 0, stolen: 0, stomps: 0, perfect: 0, buried: 0, caught: 0 };
  }

  get slots() { return this.cheeks.reduce((s, k) => s + ITEM_TYPES[k].slots, 0); }
  get active() { return this.down <= 0; }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }

  canFit(type) { return this.slots + ITEM_TYPES[type].slots <= CHEEK_SLOTS; }

  startClimb(t) {
    this.state = 'climb'; this.tree = t; this.plat = null;
    this.x = t.x + t.w / 2; this.vx = 0; this.vy = 0;
  }

  update(c, dt, game) {
    const world = game.world;
    for (const k in this.powers) if (this.powers[k] > 0) this.powers[k] = Math.max(0, this.powers[k] - dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.fullCd > 0) this.fullCd -= dt;
    if (this.grabCd > 0) this.grabCd -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    this.anim += dt;

    let ix = c.x, iy = c.y, jumpHeld = c.jump, jumpPressed = c.jumpPressed;
    if (this.powers.dizzy > 0) ix = -ix;
    if (this.stun > 0) { this.stun -= dt; ix = 0; iy = 0; jumpHeld = false; jumpPressed = false; this.charging = false; }
    if (this.bury > 0) {
      ix = 0; iy = 0; jumpHeld = false; jumpPressed = false;
      this.bury -= dt;
      if (Math.random() < 0.3) game.dust(this.x + this.facing * 12, this.y, 1, '#7a5a3a');
      if (this.bury <= 0) game.finishBury(this);
    }

    const slots = this.slots;
    const spd = (1 - 0.055 * slots) * (this.powers.speed > 0 ? 1.4 : 1);
    const jmp = (1 - 0.035 * slots) * (this.powers.speed > 0 ? 1.12 : 1);
    const RUN = 240 * spd;

    // --- ładowanie skoku (wskaźnik siły pulsuje 0→1→0; trafienie w zielone pole = idealne wybicie)
    const canJump = this.state === 'ground' || this.state === 'climb';
    if (jumpPressed && canJump && !this.charging) { this.charging = true; this.chargeT = 0; this.charge = 0; }
    if (this.charging) {
      if (!canJump) this.charging = false;
      else {
        this.chargeT += dt;
        const p = (this.chargeT / 0.7) % 2;
        this.charge = p < 1 ? p : 2 - p;
        if (!jumpHeld) this.doJump(ix, jmp, game);
      }
    }

    if (this.state === 'ground') {
      const ice = this.plat && this.plat.ice;
      const target = this.charging ? 0 : ix * RUN;
      const a = (ix !== 0 && !this.charging) ? (ice ? 3 : 16) : (ice ? 1.6 : 14);
      this.vx += (target - this.vx) * Math.min(1, a * dt);
      if (ix) this.facing = ix;
      this.x += this.vx * dt;
      if (this.plat && (this.x < this.plat.x - 4 || this.x > this.plat.x + this.plat.w + 4)) {
        this.state = 'air'; this.plat = null; this.airMax = Math.max(RUN, Math.abs(this.vx));
      }
      if (this.state === 'ground' && !this.charging && this.bury <= 0) {
        if (iy === -1) {
          const t = trunkAt(world, this.x, this.y - 5);
          if (t && this.y > t.top + 30) this.startClimb(t);
        } else if (iy === 1 && this.plat && !this.plat.stump) {
          const t = trunkAt(world, this.x, this.y + 6);
          if (t) { this.startClimb(t); this.y += 4; }
          else { this.state = 'air'; this.dropIgnore = this.plat; this.dropT = 0.3; this.plat = null; this.y += 2; this.airMax = RUN; }
        }
      }
    } else if (this.state === 'climb') {
      const t = this.tree;
      this.vx = 0;
      this.vy = this.charging ? 0 : iy * 190 * spd;
      this.y += this.vy * dt;
      if (ix) this.facing = ix;
      if (this.y < t.top + 16) {
        this.y = t.top + 16;
        if (iy === -1) {
          const crown = world.platforms.find((p) => p.tree === t && p.crown);
          if (crown) { this.state = 'ground'; this.plat = crown; this.y = crown.y; this.tree = null; }
        }
      }
      if (this.state === 'climb' && this.y >= GROUND_Y) {
        this.y = GROUND_Y;
        if (iy > 0 || ix !== 0) { this.state = 'ground'; this.plat = null; this.tree = null; this.vx = ix * 100; }
      }
      if (this.state === 'climb' && ix !== 0 && !this.charging) {
        for (const p of world.platforms) {
          if (p.tree !== t || Math.abs(p.y - this.y) > 16) continue;
          if (p.side === ix || p.side === 0) {
            this.state = 'ground'; this.plat = p; this.y = p.y; this.x += ix * 8; this.tree = null; this.vx = ix * 120;
            break;
          }
        }
      }
    } else { // powietrze
      this.vy += GRAVITY * dt;
      this.gliding = this.powers.glide > 0 && jumpHeld && this.vy > 80;
      if (this.gliding) this.vy = 80;
      this.vx += game.wind * dt * (this.gliding ? 2.5 : 1);
      if (ix) {
        this.vx += ix * 800 * dt;
        this.facing = ix;
      }
      this.vx = clamp(this.vx, -this.airMax, this.airMax);
      if (this.vy > 1300) this.vy = 1300;
      const prevY = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (iy === -1 && this.grabCd <= 0) {
        const t = trunkAt(world, this.x, this.y - 10);
        if (t && this.y > t.top + 20) { this.startClimb(t); if (this.isPlayer) game.sfx('land'); }
      }
      if (this.state === 'air' && this.vy > 0) {
        let best = null;
        for (const p of world.platforms) {
          if (p === this.dropIgnore && this.dropT > 0) continue;
          if (prevY <= p.y + 0.5 && this.y >= p.y && this.x >= p.x - 3 && this.x <= p.x + p.w + 3) {
            if (!best || p.y < best.y) best = p;
          }
        }
        if (best) this.land(best, game);
        else if (this.y >= GROUND_Y) this.land(null, game);
      }
    }

    // granice świata
    if (this.x < 15) { this.x = 15; this.vx = Math.max(0, this.vx); }
    if (this.x > world.width - 15) { this.x = world.width - 15; this.vx = Math.min(0, this.vx); }
    if (this.y < -400) { this.y = -400; this.vy = Math.max(0, this.vy); }
  }

  doJump(ix, jmp, game) {
    const c = Math.max(0.28, this.charge);
    const perfect = this.charge >= 0.88;
    const boost = perfect ? 1.13 : 1;
    const dir = ix !== 0 ? ix : (this.state === 'climb' ? this.facing : 0);
    this.vy = -(360 + 480 * c) * jmp * boost;
    this.vx = dir * (150 + 290 * c) * jmp * boost;
    if (this.state === 'climb') {
      this.vy *= 0.85;
      this.x += dir * (this.tree.w / 2 + 6);
      this.grabCd = 0.3;
    } else if (this.plat && this.plat.tree && !this.plat.stump) {
      this.grabCd = 0.15;
    }
    this.airMax = Math.max(240, Math.abs(this.vx));
    this.state = 'air'; this.plat = null; this.tree = null; this.charging = false;
    if (this.isPlayer) {
      if (perfect) {
        game.sfx('perfect'); game.sparkle(this.x, this.y - 10, '#7dff7a');
        this.stats.perfect++;
        if (Math.random() < 0.35) game.say(this, pick(LINES.perfect), '#2f8f2a');
      } else game.sfx('jump');
    }
  }

  land(p, game) {
    const impact = this.vy;
    this.state = 'ground'; this.plat = p; this.y = p ? p.y : GROUND_Y; this.vy = 0;
    if (impact > 1080 && this.powers.golden <= 0) {
      this.stun = 1.1; this.vx = 0;
      game.dust(this.x, this.y, 14, '#c9b38a');
      if (this.isPlayer) {
        this.stats.falls++;
        game.sfx('thud'); game.shake(8);
        game.say(this, pick(LINES.fall), '#b33');
        game.dropFromCheeks(this, 2);
        if (impact > 1250) game.hurt(this, null, true);
      }
    } else if (impact > 350) {
      game.dust(this.x, this.y, 4, p ? '#a58a60' : '#bfae80');
      if (this.isPlayer) game.sfx('land');
    }
  }
}

// ---------------- Mózg konkurencyjnej wiewiórki szarej ----------------
class RivalBrain {
  constructor(sq) { this.sq = sq; this.target = null; this.think = 0; this.stuck = 0; this.lastX = sq.x; this.lastY = sq.y; this.wanderX = sq.x; }

  ctrl(dt, game) {
    const s = this.sq;
    const c = blankCtrl();
    if (s.eatT > 0 || s.stun > 0) return c;
    this.think -= dt;
    if (this.target && (!game.items.includes(this.target) || this.target.taken)) this.target = null;
    if (this.think <= 0 || !this.target) {
      this.think = 2.5;
      let best = null, bd = 1e9;
      for (const it of game.items) {
        if (ITEM_TYPES[it.type].kind !== 'food' || !it.resting) continue;
        const d = Math.abs(it.x - s.x) + Math.abs(it.y - s.y) * 0.6 + Math.random() * 200;
        if (d < bd) { bd = d; best = it; }
      }
      this.target = best;
      if (!best) this.wanderX = 100 + Math.random() * (game.world.width - 200);
    }
    // wykrywanie zablokowania
    const moved = Math.abs(s.x - this.lastX) + Math.abs(s.y - this.lastY);
    this.lastX = s.x; this.lastY = s.y;
    if (moved < 0.5) { this.stuck += dt; if (this.stuck > 3) { this.target = null; this.think = 0; this.stuck = 0; c.jumpPressed = true; c.jump = true; } }
    else this.stuck = 0;

    const tgt = this.target || { x: this.wanderX, y: GROUND_Y, tree: null };
    const ttree = tgt.tree || null;
    const goTo = (x) => { if (Math.abs(x - s.x) > 6) c.x = Math.sign(x - s.x); };

    if (s.state === 'climb') {
      const t = s.tree;
      if (t === ttree) {
        if (tgt.y < s.y - 8) c.y = -1;
        else if (tgt.y > s.y + 8) c.y = 1;
        else c.x = Math.sign(tgt.x - s.x) || 1;
      } else c.y = 1;
    } else if (s.state === 'ground') {
      if (!s.plat) { // trawa
        if (ttree) { const cx = ttree.x + ttree.w / 2; goTo(cx); if (Math.abs(cx - s.x) < 10) c.y = -1; }
        else goTo(tgt.x);
      } else if (s.plat.stump || !s.plat.tree) {
        goTo(tgt.x); if (Math.abs(tgt.x - s.x) < 8) c.x = 1;
      } else {
        const t = s.plat.tree;
        if (t === ttree && Math.abs(s.plat.y - tgt.y) < 6) goTo(tgt.x);
        else {
          const cx = t.x + t.w / 2; goTo(cx);
          if (Math.abs(cx - s.x) < 10) c.y = (t === ttree && tgt.y < s.y) ? -1 : 1;
        }
      }
    } else {
      goTo(tgt.x);
    }
    return c;
  }
}

// ---------------- Pies ----------------
class Dog {
  constructor(type, x) {
    const d = DOG_TYPES[type];
    this.type = type; Object.assign(this, d);
    this.x = x; this.y = GROUND_Y; this.vx = 0; this.vy = 0;
    this.homeX = x; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.state = 'patrol'; this.target = null; this.highT = 0;
    this.dazed = 0; this.sleep = 0; this.scared = 0; this.barkCd = 1 + Math.random() * 2; this.jumpCd = 0;
    this.t = Math.random() * 10; this.bubble = null; this.sayCd = 0; this.facing = this.dir;
  }

  box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }

  update(dt, game) {
    this.t += dt;
    if (this.barkCd > 0) this.barkCd -= dt;
    if (this.jumpCd > 0) this.jumpCd -= dt;
    if (this.sayCd > 0) this.sayCd -= dt;
    // grawitacja (skoki owczarka)
    if (this.y < GROUND_Y || this.vy < 0) {
      this.vy += GRAVITY * dt; this.y += this.vy * dt;
      if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.vy = 0; }
    }

    if (this.dazed > 0) {
      this.dazed -= dt; this.vx *= 0.9; this.x += this.vx * dt;
      return;
    }
    if (this.sleep > 0) {
      this.sleep -= dt;
      if (this.sayCd <= 0) { game.say(this, pick(LINES.mopsSleep), '#555'); this.sayCd = 3; }
      for (const s of game.allSquirrels()) {
        if (s.active && Math.abs(s.x - this.x) < 90 && s.y > GROUND_Y - 40) this.sleep = 0;
      }
      return;
    }

    // szukanie celu
    let best = null, bd = this.senses;
    for (const s of game.allSquirrels()) {
      if (!s.active) continue;
      const low = s.y > GROUND_Y - 70;
      const d = Math.abs(s.x - this.x);
      if (low && d < bd) { bd = d; best = s; }
    }
    if (best && this.state !== 'chase') {
      this.state = 'chase'; this.target = best; this.highT = 0;
      if (this.sayCd <= 0) { game.say(this, pick(LINES.dogChase), '#7a2a00'); this.sayCd = 2.5; }
      game.sfx('bark');
    }
    if (best && this.target && best !== this.target && Math.abs(best.x - this.x) < Math.abs(this.target.x - this.x) - 100) this.target = best;

    if (this.state === 'chase' && this.target) {
      const s = this.target;
      if (s.powers.golden > 0) this.scared = 2;
      const dx = s.x - this.x;
      if (this.scared > 0) {
        this.scared -= dt;
        this.vx = -Math.sign(dx || 1) * this.chase;
        if (this.sayCd <= 0) { game.say(this, pick(LINES.dogScared), '#7a2a00'); this.sayCd = 3; game.sfx('yelp'); }
      } else {
        const high = s.y < GROUND_Y - 70;
        if (!high) {
          this.highT = 0;
          this.vx = lerp(this.vx, Math.sign(dx) * this.chase, Math.min(1, dt * 5));
        } else {
          this.highT += dt;
          this.vx = Math.abs(dx) > 20 ? lerp(this.vx, Math.sign(dx) * this.chase * 0.7, Math.min(1, dt * 4)) : this.vx * 0.8;
          if (this.barkCd <= 0) {
            game.sfx('bark'); this.barkCd = 0.7 + Math.random();
            if (this.sayCd <= 0) { game.say(this, pick(LINES.dogBark), '#7a2a00'); this.sayCd = 2.8; }
          }
          if (this.jump > 0 && this.jumpCd <= 0 && Math.abs(dx) < 70 && s.y > GROUND_Y - 190 && this.y >= GROUND_Y) {
            this.vy = -this.jump; this.jumpCd = 1.8;
          }
        }
        if (this.highT > 4.5 || Math.abs(dx) > this.senses * 1.5 || !s.active) {
          this.state = 'patrol'; this.target = null;
          if (this.type === 'mops' && Math.random() < 0.6) this.sleep = 5 + Math.random() * 5;
        }
      }
    } else {
      this.state = 'patrol';
      if (this.x > this.homeX + 320) this.dir = -1;
      if (this.x < this.homeX - 320) this.dir = 1;
      if (Math.random() < dt * 0.15) this.dir = -this.dir;
      this.vx = lerp(this.vx, this.dir * this.patrol, Math.min(1, dt * 3));
      if (this.type === 'mops' && Math.random() < dt * 0.05) this.sleep = 6 + Math.random() * 6;
    }
    if (Math.abs(this.vx) > 5) this.facing = Math.sign(this.vx);
    this.x += this.vx * dt;
    this.x = clamp(this.x, 30, game.world.width - 30);
  }
}

// ---------------- Sroka ----------------
class Magpie {
  constructor(x, y) {
    this.x = x; this.y = y; this.baseY = y; this.vx = 0; this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1; this.state = 'cruise';
    this.t = Math.random() * 10; this.timer = 0; this.carry = null; this.carryT = 0;
    this.target = null; this.scanCd = 2; this.poopCd = 4; this.bubble = null; this.w = 40; this.h = 22;
  }

  box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

  update(dt, game) {
    this.t += dt;
    if (this.poopCd > 0) this.poopCd -= dt;
    if (this.carry) {
      this.carryT += dt;
      if (this.carryT > 18) { this.carry = null; game.say(this, 'Mniam, kra!', '#222'); }
    }
    switch (this.state) {
      case 'cruise': {
        this.vx = lerp(this.vx, this.dir * 120, Math.min(1, dt * 2));
        const ty = this.baseY + Math.sin(this.t * 1.8) * 30;
        this.vy = (ty - this.y) * 2;
        if (this.x < 60) this.dir = 1;
        if (this.x > game.world.width - 60) this.dir = -1;
        this.scanCd -= dt;
        if (this.scanCd <= 0 && !this.carry) {
          this.scanCd = 0.8;
          let best = null, bd = 400;
          for (const s of game.allSquirrels()) {
            if (!s.active || s.cheeks.length === 0 || s.invuln > 0) continue;
            const d = Math.hypot(s.x - this.x, s.y - this.y);
            if (d < bd) { bd = d; best = s; }
          }
          if (best && Math.random() < 0.55) {
            this.state = 'swoop'; this.target = best; this.timer = 3.5;
            game.sfx('magpie'); game.say(this, 'Kra?', '#222');
          }
        }
        // „prezent” z nieba
        if (this.poopCd <= 0) {
          for (const s of game.players) {
            if (s.active && Math.abs(s.x - this.x) < 30 && s.y > this.y && Math.random() < dt * 0.8) {
              game.poops.push({ x: this.x, y: this.y + 8, vy: 0 });
              this.poopCd = 8;
              break;
            }
          }
        }
        break;
      }
      case 'swoop': {
        const s = this.target;
        this.timer -= dt;
        if (!s || !s.active || this.timer <= 0 || s.cheeks.length === 0) { this.flee(); break; }
        const dx = s.x - this.x, dy = (s.y - 16) - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.vx = lerp(this.vx, dx / d * 330, Math.min(1, dt * 3));
        this.vy = lerp(this.vy, dy / d * 330, Math.min(1, dt * 3));
        break;
      }
      case 'flee':
        this.timer -= dt;
        this.vx = lerp(this.vx, this.dir * 220, Math.min(1, dt * 2));
        this.vy = lerp(this.vy, this.y > 200 ? -180 : 0, Math.min(1, dt * 2));
        if (this.timer <= 0) { this.state = 'cruise'; this.baseY = 120 + Math.random() * 260; }
        break;
      case 'dazed':
        this.timer -= dt;
        this.vy += 500 * dt; this.vx *= 0.97;
        if (this.timer <= 0) this.flee();
        break;
    }
    if (Math.abs(this.vx) > 10) this.dir = Math.sign(this.vx);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, 20, game.world.width - 20);
    if (this.y > GROUND_Y - 30) { this.y = GROUND_Y - 30; this.vy = Math.min(0, this.vy); }
    if (this.y < -150) this.y = -150;
  }

  flee() {
    this.state = 'flee'; this.timer = 2.5; this.target = null;
    this.dir = Math.random() < 0.5 ? -1 : 1;
  }
}

// ---------------- Przedmiot ----------------
class Item {
  constructor(type, x, y, o = {}) {
    this.type = type; this.x = x; this.y = y;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.resting = !!o.resting; this.plat = o.plat || null;
    this.tree = this.plat ? this.plat.tree : null;
    this.t = Math.random() * 10; this.age = 0;
    this.spawnAnim = o.dropped ? 0 : 0.5;
    this.pickCd = o.pickCd || 0;
  }
  box() { return { x: this.x - 12, y: this.y - 24, w: 24, h: 24 }; }

  update(dt, world) {
    this.t += dt; this.age += dt;
    if (this.spawnAnim > 0) this.spawnAnim -= dt;
    if (this.pickCd > 0) this.pickCd -= dt;
    if (this.resting) return;
    const prevY = this.y;
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.99;
    this.x = clamp(this.x, 15, world.width - 15);
    if (this.vy > 0) {
      for (const p of world.platforms) {
        if (prevY <= p.y && this.y >= p.y && this.x >= p.x && this.x <= p.x + p.w) {
          this.y = p.y; this.rest(p); return;
        }
      }
      if (this.y >= GROUND_Y) { this.y = GROUND_Y; this.rest(null); }
    }
  }
  rest(p) { this.resting = true; this.vx = 0; this.vy = 0; this.plat = p; this.tree = p ? p.tree : null; }
}
