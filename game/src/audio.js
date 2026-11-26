// All sound is synthesised with WebAudio — an engine whose pitch follows throttle, wind
// that follows airspeed, and short voices for the radio, the bell of a passed ring and
// the thud of a touchdown. No audio files exist; the game makes its own noise, started
// on the first user gesture as browsers require.

export function makeAudio() {
  let ctx = null, engineOsc = null, engineGain = null, windGain = null, started = false;
  function start() {
    if (started) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      const wind = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      wind.buffer = buf; wind.loop = true;
      const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 700;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      wind.connect(windFilter).connect(windGain).connect(ctx.destination);
      wind.start();
      started = true;
    } catch { /* silent skies */ }
  }
  function blip(freq, dur = 0.12, type = 'sine', vol = 0.12, when = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  return {
    start,
    update(state) {
      if (!ctx) return;
      const rpm = 50 + state.throttle * 65 + state.speed * 0.35;
      engineOsc.frequency.value = rpm;
      engineGain.gain.value = state.fuel > 0 ? 0.028 + state.throttle * 0.05 : 0.012;
      windGain.gain.value = Math.min(0.11, state.speed * 0.0016) * (state.onGround ? 0.4 : 1);
    },
    ring() { blip(880, 0.16, 'sine', 0.14); blip(1318, 0.22, 'sine', 0.12, 0.07); },
    radio() { blip(1240, 0.05, 'square', 0.05); blip(1240, 0.05, 'square', 0.05, 0.09); },
    touchdown(hard) { blip(hard ? 90 : 130, 0.18, 'triangle', hard ? 0.3 : 0.16); },
    cash() { blip(990, 0.1, 'sine', 0.12); blip(1320, 0.14, 'sine', 0.12, 0.08); },
    alarm() { blip(620, 0.14, 'square', 0.08); blip(620, 0.14, 'square', 0.08, 0.2); },
    shot() { blip(170, 0.045, 'square', 0.045); },
    hit() { blip(340, 0.05, 'square', 0.07); },
    splash() { blip(520, 0.3, 'sawtooth', 0.1); blip(196, 0.5, 'sawtooth', 0.12, 0.16); blip(90, 0.4, 'triangle', 0.14, 0.34); },
    crash() { blip(60, 0.7, 'sawtooth', 0.3); blip(45, 0.9, 'square', 0.22, 0.05); },
  };
}
