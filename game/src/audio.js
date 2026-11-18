/* SOLMAR BAY — audio: synthesized sound effects and procedural radio.
   No audio files: every sound is built with WebAudio oscillators and noise. */
(function () {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioOn = true;
    this.station = 0;
    this.radioTimer = null;
    this.radioStep = 0;
    this.noiseBuf = null;
  }

  AudioEngine.prototype.init = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Shared noise buffer for gunshots, crashes and explosions.
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startEngineHum();
    this.startRadio();
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  };

  AudioEngine.prototype.now = function () { return this.ctx ? this.ctx.currentTime : 0; };

  // Sound only plays once the context is running (after a user gesture);
  // before that, stay silent instead of spamming autoplay warnings.
  AudioEngine.prototype.live = function () {
    return !!(this.ctx && this.ctx.state === 'running' && !this.muted);
  };

  AudioEngine.prototype.blip = function (freq, dur, type, vol) {
    if (!this.live()) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, this.now());
    g.gain.exponentialRampToValueAtTime(0.001, this.now() + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.now() + dur + 0.02);
  };

  AudioEngine.prototype.noise = function (dur, vol, freq) {
    if (!this.live()) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.now());
    g.gain.exponentialRampToValueAtTime(0.001, this.now() + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(); s.stop(this.now() + dur + 0.02);
  };

  AudioEngine.prototype.shoot = function () { this.noise(0.14, 0.5, 2600); this.blip(160, 0.08, 'square', 0.12); };
  AudioEngine.prototype.crash = function () { this.noise(0.25, 0.5, 500); };
  AudioEngine.prototype.explosion = function () { this.noise(0.9, 0.7, 300); this.blip(55, 0.7, 'sine', 0.4); };
  AudioEngine.prototype.pickup = function () { this.blip(660, 0.1, 'sine', 0.22); setTimeout(() => this.blip(990, 0.16, 'sine', 0.22), 90); };
  AudioEngine.prototype.missionOk = function () {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.25), i * 110));
  };
  AudioEngine.prototype.click = function () { this.blip(880, 0.05, 'square', 0.1); };
  AudioEngine.prototype.busted = function () { this.blip(220, 0.5, 'sawtooth', 0.25); setTimeout(() => this.blip(165, 0.7, 'sawtooth', 0.25), 350); };

  // Engine hum: one sawtooth whose pitch follows speed, through a lowpass.
  AudioEngine.prototype.startEngineHum = function () {
    if (!this.ctx || this.engineOsc) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 50;
    f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.value = 0.0;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start();
    this.engineOsc = o; this.engineGain = g;
  };
  AudioEngine.prototype.setEngine = function (speed01, on) {
    if (!this.engineOsc) return;
    const t = this.now();
    this.engineOsc.frequency.setTargetAtTime(46 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
  };

  // Police siren: two-tone wail while any police are active.
  AudioEngine.prototype.setSiren = function (on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 750;
      lfo.type = 'square'; lfo.frequency.value = 0.55;
      lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.value = 0.035;
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null; this.sirenGain = null;
    }
  };

  // Radio: a tiny step sequencer, one looping 16-step pattern per station.
  AudioEngine.prototype.startRadio = function () {
    if (!this.ctx || this.radioTimer) return;
    const self = this;
    this.radioTimer = setInterval(function () { self.radioStepFn(); }, 60000 / 112 / 2);
  };
  AudioEngine.prototype.radioStepFn = function () {
    if (!this.live() || !this.radioOn) return;
    const st = SB.RADIO_STATIONS[this.station];
    const step = this.radioStep++ % 16;
    const bassNotes = [0, 0, 7, 0, 5, 0, 3, 2];
    const arpNotes = [12, 15, 19, 24, 19, 15, 12, 10];
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    // Bass on beats.
    if (step % 4 === 0) this.blip(midi(st.root + bassNotes[(step / 4) | 0]), 0.28, st.wave, 0.14);
    // Arpeggio sparkle on off-beats for chill/drive stations.
    if (st.mood !== 'funk' && step % 2 === 1) this.blip(midi(st.root + arpNotes[step % 8]), 0.12, 'triangle', 0.05);
    // Hat tick.
    if (step % 2 === 0) this.noise(0.03, 0.03, 6000);
    // Funk station: syncopated bass pops.
    if (st.mood === 'funk' && (step === 3 || step === 11)) this.blip(midi(st.root + 10), 0.1, 'square', 0.09);
  };
  AudioEngine.prototype.nextStation = function () {
    this.station = (this.station + 1) % SB.RADIO_STATIONS.length;
    this.radioStep = 0;
    return SB.RADIO_STATIONS[this.station].name;
  };
  AudioEngine.prototype.stationName = function () { return SB.RADIO_STATIONS[this.station].name; };

  SB.AudioEngine = AudioEngine;
})();
