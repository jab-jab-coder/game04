'use strict';
// ===================== STEROWANIE: klawiatura + gamepad =====================

const KEYMAP = {
  p1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    jump: ['Space'], action: ['KeyE', 'KeyQ'],
  },
  p2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    jump: ['ShiftRight', 'Numpad0', 'Slash'], action: ['ControlRight', 'NumpadDecimal', 'Period', 'Enter'],
  },
};

const Input = {
  keys: new Set(),
  prev: [blankCtrl(), blankCtrl()],
  menuPrev: { up: false, down: false, ok: false, back: false, pause: false },
  pauseKey: false,
  muteKey: false,

  init() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'Escape' || e.code === 'KeyP') this.pauseKey = true;
        if (e.code === 'KeyM') this.muteKey = true;
      }
      this.keys.add(e.code);
      Audio2.unlock();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointerdown', () => Audio2.unlock());
  },

  anyKey(codes) { return codes.some((c) => this.keys.has(c)); },

  pads() {
    const list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    return list.filter((p) => p && p.connected);
  },

  readPad(pad, c) {
    const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const dz = 0.35;
    if (ax < -dz || b(14)) c.x = -1;
    if (ax > dz || b(15)) c.x = 1;
    if (ay < -dz || b(12)) c.y = -1;
    if (ay > dz || b(13)) c.y = 1;
    // skok: A, a także lewy bumper/spust – wygodne, gdy kciuk prawej ręki jest zajęty
    if (b(0) || b(4) || b(6)) c.jump = true;
    if (b(1) || b(2) || b(3) || b(5) || b(7)) c.action = true;
    if (b(9)) c.pause = true;
  },

  readKeys(map, c) {
    if (this.anyKey(map.left)) c.x = -1;
    if (this.anyKey(map.right)) c.x = c.x === -1 ? 0 : 1;
    if (this.anyKey(map.up)) c.y = -1;
    if (this.anyKey(map.down)) c.y = c.y === -1 ? 0 : 1;
    if (this.anyKey(map.jump)) c.jump = true;
    if (this.anyKey(map.action)) c.action = true;
  },

  // Zwraca stan sterowania dla każdego gracza (z flagami "pressed"/"released")
  poll(numPlayers) {
    const pads = this.pads();
    const out = [];
    for (let i = 0; i < 2; i++) {
      const c = blankCtrl();
      if (numPlayers === 1) {
        if (i === 0) {
          this.readKeys(KEYMAP.p1, c);
          this.readKeys(KEYMAP.p2, c);
          pads.forEach((p) => this.readPad(p, c));
        }
      } else {
        this.readKeys(i === 0 ? KEYMAP.p1 : KEYMAP.p2, c);
        if (pads[i]) this.readPad(pads[i], c);
      }
      const p = this.prev[i];
      c.jumpPressed = c.jump && !p.jump;
      c.jumpReleased = !c.jump && p.jump;
      c.actionPressed = c.action && !p.action;
      c.pausePressed = c.pause && !p.pause;
      c.upPressed = c.y === -1 && p.y !== -1;
      c.downPressed = c.y === 1 && p.y !== 1;
      c.leftPressed = c.x === -1 && p.x !== -1;
      c.rightPressed = c.x === 1 && p.x !== 1;
      this.prev[i] = c;
      out.push(c);
    }
    return out;
  },

  // Nawigacja w menu – dowolne urządzenie
  menu() {
    const pads = this.pads();
    const s = { up: false, down: false, ok: false, back: false, pause: false };
    if (this.anyKey(['ArrowUp', 'KeyW'])) s.up = true;
    if (this.anyKey(['ArrowDown', 'KeyS'])) s.down = true;
    if (this.anyKey(['Enter', 'Space', 'NumpadEnter'])) s.ok = true;
    if (this.anyKey(['Escape', 'Backspace'])) s.back = true;
    for (const pad of pads) {
      const b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const ay = pad.axes[1] || 0;
      if (ay < -0.5 || b(12)) s.up = true;
      if (ay > 0.5 || b(13)) s.down = true;
      if (b(0) || b(9)) s.ok = true;
      if (b(1)) s.back = true;
      if (b(9)) s.pause = true;
    }
    const p = this.menuPrev;
    const r = {
      up: s.up && !p.up, down: s.down && !p.down, ok: s.ok && !p.ok,
      back: s.back && !p.back, pause: (s.pause && !p.pause) || this.pauseKey,
    };
    this.menuPrev = s;
    this.pauseKey = false;
    return r;
  },

  consumeMute() { const m = this.muteKey; this.muteKey = false; return m; },
};

function blankCtrl() {
  return {
    x: 0, y: 0, jump: false, action: false, pause: false,
    jumpPressed: false, jumpReleased: false, actionPressed: false, pausePressed: false,
    upPressed: false, downPressed: false, leftPressed: false, rightPressed: false,
  };
}
