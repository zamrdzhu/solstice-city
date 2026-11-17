// All sound is synthesized with WebAudio — no audio files, nothing to download.
// Engine hum, police sirens, gunshots, pickups and a lazy synthwave pad loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let padNodes = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = now();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowFreq) {
    if (!ctx || muted) return;
    const t = now();
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  return {
    // Call from the first user gesture (title screen button).
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: one oscillator flipped between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Pad: two detuned triangles playing a slow four-chord loop.
      const padGain = ctx.createGain();
      padGain.gain.value = 0.05;
      padGain.connect(master);
      const o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.value = 220;
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = 277.18;
      o1.connect(padGain);
      o2.connect(padGain);
      o1.start();
      o2.start();
      padNodes = { o1, o2, padGain };
    },
    setEngine(speedRatio, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.045 + speedRatio * 0.075 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, now(), 0.08);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, now(), 0.08);
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.035 : 0, now(), 0.1);
    },
    update(dt) {
      if (!ctx || !sirenOsc) return;
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 960 : 720, now(), 0.05);
      }
    },
    shoot() {
      noiseBurst(0.14, 0.5, 2400);
      blip(190, 0.09, 'square', 0.22, 70);
    },
    enemyShoot() {
      noiseBurst(0.12, 0.25, 1800);
    },
    hit() {
      blip(140, 0.12, 'sawtooth', 0.3, 60);
    },
    pickup() {
      blip(660, 0.1, 'sine', 0.3);
      setTimeout(() => blip(990, 0.16, 'sine', 0.3), 90);
    },
    missionComplete() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.32), i * 110));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.22), i * 160));
    },
    click() {
      blip(880, 0.06, 'sine', 0.2);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
