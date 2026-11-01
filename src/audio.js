import { config } from './config.js';
import { getMute, saveMute } from './storage.js';

function noiseBuffer(ctx, seconds = 0.5) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.engineSub = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.muted = getMute();
    this.noise = null;
    this.started = false;

    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenActive = false;
    this.sirenLfo = null;

    this.brakeGain = null;
    this.brakeSource = null;
    this.lastBlinkerTime = 0;
  }

  async resume() {
    if (!this.ctx) this._init();
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Autoplay policy
      }
    }
    this.started = this.ctx.state === 'running';
  }

  setMasterVolume(vol) {
    config.audio.master = Math.max(0, Math.min(1, vol));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(config.audio.master, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    saveMute(muted);
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : config.audio.master, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  updateEngine(speed, nitro, braking) {
    if (!this.engine || !this.started) return;
    const t = this.ctx.currentTime;

    // RPM calculations
    let effectiveSpeed = speed;
    if (braking) effectiveSpeed *= 0.65;
    if (nitro) effectiveSpeed *= 1.35;

    const pitch = 50 + effectiveSpeed * 2.6;
    const subPitch = pitch * 0.5;
    const cutoff = 200 + effectiveSpeed * 22 + (nitro ? 650 : 0);
    const vol = braking ? 0.025 : (0.045 + effectiveSpeed * 0.0014 + (nitro ? 0.025 : 0));

    this.engine.frequency.setTargetAtTime(pitch, t, 0.06);
    this.engineSub.frequency.setTargetAtTime(subPitch, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(cutoff, t, 0.06);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : vol, t, 0.05);

    // Update brake tire squeal sound
    this._updateBrakeSound(braking, effectiveSpeed);
  }

  _updateBrakeSound(braking, speed) {
    if (!this.ctx || !this.started || !this.brakeGain) return;
    const t = this.ctx.currentTime;
    const targetVol = (braking && speed > 18) ? (this.muted ? 0 : 0.08) : 0;
    this.brakeGain.gain.setTargetAtTime(targetVol, t, 0.04);
  }

  stopEngine() {
    if (!this.engineGain || !this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    if (this.brakeGain) this.brakeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    this.stopPoliceSiren();
  }

  click() {
    this._tone(880, 0.04, 'square', 0.05, 1800);
  }

  scorePing() {
    this._tone(740, 0.08, 'sine', 0.08, 1400);
    this._tone(1110, 0.06, 'sine', 0.05, 1900, 0.03);
  }

  nearMiss(comboCount = 1) {
    // Dynamic pitch ascending with combo streak
    const baseFreq = 880 + Math.min(6, comboCount) * 90;
    this._tone(baseFreq, 0.07, 'triangle', 0.12, 2800);
    this._tone(baseFreq * 1.25, 0.09, 'sine', 0.08, 3200, 0.04);
  }

  carHorn() {
    if (!this.ctx || !this.started) return;
    // Dual-frequency car horn (440Hz + 554Hz major third)
    this._tone(440, 0.22, 'sawtooth', 0.045, 1600);
    this._tone(554, 0.22, 'sawtooth', 0.045, 1600);
  }

  speedBreakerThud(harshness = 1.0) {
    if (!this.ctx || !this.started || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const masterGain = this.master;

      const playAxleThud = (delay, pitch, volume) => {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(260, now + delay);
          filter.frequency.exponentialRampToValueAtTime(45, now + delay + 0.16);

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(pitch, now + delay);
          osc.frequency.exponentialRampToValueAtTime(28, now + delay + 0.16);

          gain.gain.setValueAtTime(0.001, now + delay);
          gain.gain.linearRampToValueAtTime(Math.min(0.35, 0.2 * volume * harshness), now + delay + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);

          if (this.noise) {
            const noiseSrc = this.ctx.createBufferSource();
            noiseSrc.buffer = this.noise;
            const nFilter = this.ctx.createBiquadFilter();
            nFilter.type = 'bandpass';
            nFilter.frequency.setValueAtTime(320, now + delay);
            nFilter.Q.setValueAtTime(2.0, now + delay);

            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.12 * harshness, now + delay);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

            noiseSrc.connect(nFilter);
            nFilter.connect(nGain);
            nGain.connect(masterGain);
            noiseSrc.start(now + delay);
            noiseSrc.stop(now + delay + 0.09);
          }

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);

          osc.start(now + delay);
          osc.stop(now + delay + 0.2);
        } catch {
          // Audio safety
        }
      };

      // Front axle thump
      playAxleThud(0, 95, 1.0);
      // Rear axle thump
      playAxleThud(0.12, 80, 0.85);
    } catch {
      // Audio safety
    }
  }

  blinkerTick() {
    const now = performance.now();
    if (now - this.lastBlinkerTime < 180) return;
    this.lastBlinkerTime = now;
    this._tone(1400, 0.02, 'triangle', 0.035, 2200);
  }

  startPoliceSiren() {
    if (this.sirenActive || !this.ctx || !this.started) return;
    this.sirenActive = true;
    const t = this.ctx.currentTime;

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(650, t);

    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.setValueAtTime(1.8, t); // 1.8 Hz wail

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(260, t); // +/- 260 Hz swing
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, t);

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.setValueAtTime(this.muted ? 0 : 0.05, t);

    this.sirenOsc.connect(filter);
    filter.connect(this.sirenGain);
    this.sirenGain.connect(this.master);

    this.sirenOsc.start(t);
    this.sirenLfo.start(t);
  }

  stopPoliceSiren() {
    if (!this.sirenActive) return;
    this.sirenActive = false;
    if (this.sirenGain) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
    setTimeout(() => {
      try {
        if (this.sirenOsc) this.sirenOsc.stop();
        if (this.sirenLfo) this.sirenLfo.stop();
      } catch {}
    }, 200);
  }

  nitroWhoosh() {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.32);
    filter.Q.value = 1.0;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.48);
  }

  crash() {
    if (!this.ctx || !this.started) return;
    this.stopPoliceSiren();
    const t = this.ctx.currentTime;

    // Heavy crash impact burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'lowpass';
    hp.frequency.setValueAtTime(1200, t);
    hp.frequency.exponentialRampToValueAtTime(80, t + 0.45);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.48, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.6);

    // Deep sub-bass boom
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 0.45);

    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.48);
  }

  _init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : config.audio.master;
    this.master.connect(this.ctx.destination);
    this.noise = noiseBuffer(this.ctx, 1.0);

    // Dual-oscillator engine synthesis (sawtooth + triangle)
    this.engine = this.ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 60;

    this.engineSub = this.ctx.createOscillator();
    this.engineSub.type = 'triangle';
    this.engineSub.frequency.value = 30;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engine.connect(this.engineFilter);
    this.engineSub.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.engine.start();
    this.engineSub.start();

    // Continuous looping brake squeal synthesizer
    this._initBrakeSynthesizer();
  }

  _initBrakeSynthesizer() {
    const brakeFilter = this.ctx.createBiquadFilter();
    brakeFilter.type = 'bandpass';
    brakeFilter.frequency.value = 3200;
    brakeFilter.Q.value = 4.5;

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0;

    const brakeNoise = this.ctx.createBufferSource();
    brakeNoise.buffer = this.noise;
    brakeNoise.loop = true;

    brakeNoise.connect(brakeFilter);
    brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.master);
    brakeNoise.start();
  }

  _tone(freq, dur, type, vol, filterFreq, delay = 0) {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
