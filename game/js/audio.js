// AudioSys: procedural WebAudio sounds for Duskhold. No audio files, no network.
// Every sound is synthesized from oscillators and filtered noise, with small
// pitch/volume jitter so repeats never sound identical. A quiet dusk pad drones
// under play. Context is created on the first user gesture.
var AudioSys = (function () {
  var ctx = null;
  var master = null;
  var padNodes = null;
  var muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.32;
  }

  function isMuted() { return muted; }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, delay) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  function jitter(v, amt) { return v * (1 + (Math.random() * 2 - 1) * amt); }

  var SFX = {
    shoot: function () { tone(jitter(880, 0.08), 0.07, 'square', 0.10, 320); },
    hit: function () { noise(0.06, 0.14, 2600); },
    die: function () { tone(jitter(220, 0.15), 0.22, 'sawtooth', 0.16, 55); noise(0.14, 0.12, 900); },
    pickup: function () { tone(jitter(1320, 0.06), 0.09, 'sine', 0.14, 1980); },
    coin: function () { tone(1568, 0.07, 'sine', 0.10); tone(2093, 0.10, 'sine', 0.10, null, 0.06); },
    waveClear: function () { tone(523, 0.16, 'triangle', 0.16); tone(659, 0.16, 'triangle', 0.16, null, 0.10); tone(784, 0.28, 'triangle', 0.18, null, 0.20); },
    boss: function () { tone(82, 0.7, 'sawtooth', 0.22, 41); tone(110, 0.7, 'sawtooth', 0.14, 55, 0.05); noise(0.5, 0.10, 300); },
    hurt: function () { tone(140, 0.18, 'sawtooth', 0.20, 70); noise(0.10, 0.12, 500); },
    click: function () { tone(990, 0.05, 'sine', 0.12); },
    upgrade: function () { tone(660, 0.12, 'triangle', 0.16); tone(880, 0.12, 'triangle', 0.16, null, 0.08); tone(1320, 0.22, 'triangle', 0.16, null, 0.16); },
    pulse: function () { tone(392, 0.3, 'sine', 0.18, 784); noise(0.25, 0.08, 2400); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.16, null, i * 0.14); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.34, 'triangle', 0.15, null, i * 0.16); }); },
    spit: function () { tone(jitter(300, 0.1), 0.12, 'sawtooth', 0.08, 140); }
  };

  function startPad() {
    if (!ensure() || padNodes || muted) return;
    try {
      var g = ctx.createGain();
      g.gain.value = 0.045;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 320;
      var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 164.8;
      var o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 55;
      o1.connect(f); o2.connect(f); o3.connect(f); f.connect(g); g.connect(master);
      o1.start(); o2.start(); o3.start();
      padNodes = { gain: g, oscs: [o1, o2, o3] };
    } catch (e) { padNodes = null; }
  }

  function stopPad() {
    if (!padNodes) return;
    try {
      padNodes.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
      var oscs = padNodes.oscs;
      setTimeout(function () { oscs.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 800);
    } catch (e) {}
    padNodes = null;
  }

  return {
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    startPad: startPad,
    stopPad: stopPad,
    play: function (name) { if (SFX[name]) SFX[name](); }
  };
})();
