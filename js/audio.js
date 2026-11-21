'use strict';
// ===================== DŹWIĘK: syntezowany w WebAudio (zero plików) =====================

const Audio2 = {
  ctx: null, master: null, musicGain: null, muted: false, musicOn: true,
  musicTimer: null, step: 0,

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.startMusic();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },

  tone(freq, dur, { type = 'square', vol = 0.12, slide = null, delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this.tone(300, 0.15, { type: 'triangle', slide: 700, vol: 0.12 }); break;
      case 'perfect':
        this.tone(500, 0.12, { type: 'triangle', slide: 1000, vol: 0.12 });
        this.tone(1000, 0.18, { type: 'sine', slide: 1600, vol: 0.08, delay: 0.06 }); break;
      case 'land': this.noise(0.06, { vol: 0.08, freq: 400 }); break;
      case 'thud': this.noise(0.25, { vol: 0.35, freq: 180, type: 'lowpass' }); this.tone(120, 0.25, { type: 'sine', slide: 50, vol: 0.2 }); break;
      case 'pickup': this.tone(880, 0.07, { type: 'square', vol: 0.06 }); this.tone(1320, 0.09, { type: 'square', vol: 0.05, delay: 0.05 }); break;
      case 'power': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, { type: 'triangle', vol: 0.1, delay: i * 0.06 })); break;
      case 'heal': [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, { type: 'sine', vol: 0.12, delay: i * 0.08 })); break;
      case 'bad': this.tone(300, 0.4, { type: 'sawtooth', slide: 90, vol: 0.08 }); break;
      case 'deposit': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.06, delay: i * 0.05 })); break;
      case 'bark':
        this.noise(0.09, { vol: 0.25, freq: 700, q: 3 });
        this.tone(220, 0.09, { type: 'sawtooth', slide: 140, vol: 0.1 }); break;
      case 'yelp': this.tone(900, 0.3, { type: 'sawtooth', slide: 400, vol: 0.07 }); break;
      case 'magpie': this.tone(1400, 0.08, { type: 'sawtooth', slide: 900, vol: 0.05 }); this.tone(1300, 0.08, { type: 'sawtooth', slide: 800, vol: 0.05, delay: 0.1 }); break;
      case 'steal': this.tone(700, 0.25, { type: 'square', slide: 200, vol: 0.08 }); break;
      case 'hurt': this.tone(400, 0.3, { type: 'square', slide: 100, vol: 0.12 }); this.noise(0.15, { vol: 0.2, freq: 900 }); break;
      case 'throw': this.noise(0.12, { vol: 0.12, freq: 2500, q: 0.7 }); break;
      case 'hit': this.noise(0.1, { vol: 0.25, freq: 600, q: 2 }); this.tone(200, 0.1, { type: 'square', vol: 0.08 }); break;
      case 'stomp': this.tone(200, 0.12, { type: 'square', slide: 600, vol: 0.12 }); break;
      case 'dig': this.noise(0.1, { vol: 0.12, freq: 300 }); break;
      case 'full': this.tone(220, 0.12, { type: 'square', vol: 0.06 }); break;
      case 'select': this.tone(660, 0.06, { type: 'square', vol: 0.06 }); break;
      case 'confirm': this.tone(660, 0.08, { type: 'square', vol: 0.07 }); this.tone(990, 0.12, { type: 'square', vol: 0.07, delay: 0.07 }); break;
      case 'win': [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.12, delay: i * 0.13 })); break;
      case 'lose': [440, 392, 349, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.2 })); break;
      case 'tick': this.tone(1200, 0.04, { type: 'square', vol: 0.04 }); break;
      case 'splat': this.noise(0.15, { vol: 0.2, freq: 500, type: 'lowpass' }); break;
    }
  },

  // Prosta, pogodna pętla muzyczna (pentatonika)
  startMusic() {
    if (this.musicTimer) return;
    const melody = [0, 2, 4, 7, 4, 2, 9, 7, 0, 4, 7, 9, 12, 9, 7, 4];
    const bass = [0, 0, 5, 5, 7, 7, 5, 5];
    const base = 392; // G4
    const st = (n) => base * Math.pow(2, n / 12);
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn || this.ctx.state !== 'running') { this.step++; return; }
      const s = this.step % 16;
      if (s % 2 === 0 || Math.random() < 0.4) {
        this.tone(st(melody[s]), 0.22, { type: 'triangle', vol: 0.35, dest: this.musicGain });
      }
      if (s % 2 === 0) this.tone(st(bass[(s / 2) | 0] - 24), 0.35, { type: 'sine', vol: 0.5, dest: this.musicGain });
      this.step++;
    }, 220);
  },
};
