// All sound is synthesized live with WebAudio: engine hum, sirens, gunshots,
// thunder and three invented radio stations. No audio files, no network.

import { RADIO_STATIONS } from './config.js';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Chord progressions (MIDI note numbers) and bass lines, one per station.
const STATION_MUSIC = {
  pop: {
    bpm: 112,
    wave: 'triangle',
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    bass: [36, 33, 29, 31],
    lead: [72, 76, 79, 76, 72, 67, 69, 72, 74, 76, 79, 81, 79, 76, 74, 72],
  },
  rock: {
    bpm: 132,
    wave: 'sawtooth',
    chords: [[52, 55, 59], [50, 53, 57], [48, 52, 55], [55, 59, 62]],
    bass: [28, 26, 24, 31],
    lead: [64, 64, 67, 64, 69, 67, 64, 62, 64, 67, 69, 67, 64, 62, 60, 62],
  },
  synth: {
    bpm: 96,
    wave: 'sine',
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 58, 62]],
    bass: [33, 29, 24, 31],
    lead: [69, 72, 76, 72, 69, 67, 65, 67, 69, 72, 74, 76, 77, 76, 74, 72],
  },
};

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radio = null;
    this.radioTimer = null;
    this.radioStep = 0;
    this.radioNextTime = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  /** Create the audio context on the first user gesture. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, seconds, type, volume, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  noiseBurst(seconds, volume, filterFreq, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  gunshot() {
    this.noiseBurst(0.12, 0.5, 1800);
    this.tone(180, 0.08, 'square', 0.25);
  }

  punch() {
    this.noiseBurst(0.1, 0.35, 500);
  }

  crash() {
    this.noiseBurst(0.35, 0.5, 700);
  }

  pickup() {
    this.tone(660, 0.12, 'sine', 0.3);
    this.tone(990, 0.18, 'sine', 0.3, 0.09);
  }

  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.3, i * 0.11));
  }

  wasted() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.22, i * 0.22));
  }

  thunder(delaySeconds) {
    this.noiseBurst(2.2, 0.55, 220, delaySeconds);
    this.noiseBurst(1.4, 0.3, 120, delaySeconds + 0.4);
  }

  /** A continuous engine hum whose pitch follows the car's speed. */
  setEngine(running, speedNorm) {
    if (!this.ctx) return;
    if (running && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (!running && this.engineOsc) {
      this.engineOsc.stop();
      this.engineOsc = null;
      this.engineGain = null;
      return;
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speedNorm * 140;
      this.engineGain.gain.value = 0.04 + speedNorm * 0.05;
    }
  }

  /** Police siren loop, on while any patrol car is chasing. */
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 880;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    }
    if (!on && this.sirenOsc) {
      this.sirenOsc.stop();
      this.sirenLfo.stop();
      this.sirenOsc = null;
      this.sirenLfo = null;
      this.sirenGain = null;
    }
  }

  // ---- Radio: a 16-step sequencer per station, scheduled ahead of time. ----
  startRadio(index) {
    if (!this.ensure()) return;
    this.stopRadio();
    const station = RADIO_STATIONS[index % RADIO_STATIONS.length];
    const music = STATION_MUSIC[station.key];
    this.radio = { station, music, index: index % RADIO_STATIONS.length };
    this.radioStep = 0;
    this.radioNextTime = this.ctx.currentTime + 0.1;
    this.radioTimer = setInterval(() => this.scheduleRadio(), 40);
  }

  stopRadio() {
    if (this.radioTimer) clearInterval(this.radioTimer);
    this.radioTimer = null;
    this.radio = null;
  }

  scheduleRadio() {
    if (!this.radio || !this.ctx) return;
    const { music } = this.radio;
    const stepSeconds = 60 / music.bpm / 4;
    while (this.radioNextTime < this.ctx.currentTime + 0.15) {
      const step = this.radioStep % 16;
      const bar = Math.floor(this.radioStep / 16) % 4;
      const when = this.radioNextTime - this.ctx.currentTime;
      // Bass on every quarter note.
      if (step % 4 === 0) {
        this.tone(midiToFreq(music.bass[bar]), stepSeconds * 3.5, music.wave, 0.16, when);
      }
      // Chord pad on the first step of each bar.
      if (step === 0) {
        music.chords[bar].forEach((n) => this.tone(midiToFreq(n), stepSeconds * 15, 'sine', 0.05, when));
      }
      // Lead melody on even steps.
      if (step % 2 === 0) {
        const note = music.lead[(bar * 4 + step / 2) % music.lead.length];
        this.tone(midiToFreq(note), stepSeconds * 1.8, music.wave, 0.07, when);
      }
      this.radioStep += 1;
      this.radioNextTime += stepSeconds;
    }
  }

  radioName() {
    return this.radio ? this.radio.station.name : 'RADIO OFF';
  }

  radioIndex() {
    return this.radio ? this.radio.index : -1;
  }
}
