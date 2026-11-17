// Game: the main loop and shared state for Duskhold.
// Owns the fixed-step update, collisions, pickups, streaks, screen flow and
// the juice state (trauma shake, hit-stop). Screens: title -> playing ->
// upgrade / paused -> win / lose, all with working restart.
var Game = (function () {
  var canvas = null;
  var ctx = null;
  var last = 0;
  var timeScale = 1;
  var hitStopT = 0;
  var hitStopId = 0;
  var booted = false;

  var S = {
    screen: 'title',
    wave: 1,
    wavesCleared: 0,
    time: 0,
    realTime: 0,
    gold: 0,
    kills: 0,
    streak: 0,
    streakT: 0,
    player: null,
    bullets: [],
    globs: [],
    particles: [],
    floats: [],
    pickups: [],
    trauma: 0,
    banner: '',
    bannerT: 0,
    betweenT: 0,
    started: false
  };

  function boot() {
    if (booted) return;
    booted = true;
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    Input.init(canvas);
    LightSys.init();
    Render.init();
    S.player = Player.reset();
    LightSys.reset();
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function fitCanvas() {
    var scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    canvas.style.width = Math.floor(1280 * scale) + 'px';
    canvas.style.height = Math.floor(720 * scale) + 'px';
  }

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.realTime += dt;
    // Hit-stop: real-time restore, newest call wins.
    var sdt = dt;
    if (hitStopT > 0) {
      hitStopT -= dt;
      sdt = dt * 0.08;
      if (hitStopT <= 0) timeScale = 1;
    }
    if (S.trauma > 0) S.trauma = Math.max(0, S.trauma - 1.4 * dt);
    update(sdt, dt);
    Render.draw(ctx, S);
    Input.endFrame();
  }

  function update(dt, realDt) {
    // Global keys, available on every screen.
    if (Input.wasPressed('KeyM')) AudioSys.setMuted(!AudioSys.isMuted());
    if (Input.mouse.clicked) {
      if (UI.handleClick(Input.mouse.clickX, Input.mouse.clickY)) return;
    }
    var screen = UI.top();
    if (screen === 'title') {
      LightSys.update(dt, S.player.x, S.player.y);
      ambient(dt);
      if (Input.wasPressed('Enter')) startGame();
      return;
    }
    if (screen === 'win' || screen === 'lose') {
      if (Input.wasPressed('KeyR')) startGame();
      if (Input.wasPressed('Enter')) startGame();
      return;
    }
    if (screen === 'paused') {
      if (Input.wasPressed('Escape') || Input.wasPressed('KeyP')) resumeGame();
      return;
    }
    if (screen === 'upgrade') {
      var cards = UI.getOffer() || [];
      if (Input.wasPressed('Digit1') && cards[0]) pickUpgrade(cards[0]);
      else if (Input.wasPressed('Digit2') && cards[1]) pickUpgrade(cards[1]);
      else if (Input.wasPressed('Digit3') && cards[2]) pickUpgrade(cards[2]);
      return;
    }
    // Playing.
    S.time += dt;
    if (Input.wasPressed('Escape') || Input.wasPressed('KeyP')) {
      UI.push('paused');
      return;
    }
    if (Input.wasPressed('Space')) {
      if (Player.firePulse()) {
        var n = Enemies.stunAllLit(S);
        if (n > 0) {
          addTrauma(0.5);
          addFloat(S.player.x, S.player.y - 34, 'DAWN PULSE! ' + n + ' stunned', '#fff3c4');
          AudioSys.play('pulse');
        }
      }
    }
    LightSys.update(dt, S.player.x, S.player.y);
    Player.update(dt, Input.mouse.down);
    Enemies.update(dt, S);
    Waves.update(dt, S);
    updateBullets(dt);
    updateGlobs(dt);
    updateParticles(dt);
    updateFloats(dt);
    updatePickups(dt);
    if (S.bannerT > 0) {
      S.bannerT -= realDt;
      if (S.bannerT <= 0) S.banner = '';
    }
    if (S.streakT > 0) {
      S.streakT -= dt;
      if (S.streakT <= 0) S.streak = 0;
    }
    // Between-wave pause: when the banner ends, open the upgrade choice.
    if (!Waves.isActive() && S.wave < 10 && S.started && !S._offerOpen) {
      if (Waves.tickBetween(realDt)) {
        S._offerOpen = true;
        UI.setOffer(Upgrades.offer());
        UI.push('upgrade');
      }
    }
  }

  function ambient(dt) {
    // Title backdrop: a few glowing eyes drift in the dark.
    if (Math.random() < dt * 2 && S.particles.length < 40) {
      addParticle(60 + Math.random() * 1160, 60 + Math.random() * 600, '#ffd23e', 0);
    }
  }

  function startGame() {
    S.wave = 1;
    S.wavesCleared = 0;
    S.time = 0;
    S.gold = 0;
    S.kills = 0;
    S.streak = 0;
    S.streakT = 0;
    S.bullets = [];
    S.globs = [];
    S.particles = [];
    S.floats = [];
    S.pickups = [];
    S.trauma = 0;
    S.banner = '';
    S.bannerT = 0;
    S._offerOpen = false;
    S.started = true;
    S.player = Player.reset();
    LightSys.reset();
    Enemies.clear();
    Waves.reset();
    Upgrades.reset();
    UI.set('playing');
    AudioSys.unlock();
    AudioSys.startPad();
    setBanner('WAVE 1', 2);
    Waves.startWave(1);
  }

  function resumeGame() {
    if (UI.top() === 'paused') UI.pop();
  }

  function toTitle() {
    UI.set('title');
    S.started = false;
    Enemies.clear();
    Waves.reset();
    AudioSys.stopPad();
  }

  function pickUpgrade(card) {
    Upgrades.apply(card, S);
    UI.setOffer(null);
    UI.pop();
    S._offerOpen = false;
    S.wave += 1;
    setBanner('WAVE ' + S.wave, 2);
    Waves.startWave(S.wave);
  }

  function onWin() {
    S.wavesCleared = 10;
    UI.set('win');
    LightSys.setDrain(0);
    AudioSys.play('win');
    AudioSys.stopPad();
  }

  function onPlayerDeath() {
    UI.set('lose');
    addBurst(S.player.x, S.player.y, '#e07830', 26);
    AudioSys.play('lose');
    AudioSys.stopPad();
  }

  function onBeaconDeath() {
    UI.set('lose');
    addBurst(LightSys.beacon.x, LightSys.beacon.y, '#ffd682', 30);
    AudioSys.play('lose');
    AudioSys.stopPad();
  }

  function damageBeacon(n) {
    var b = LightSys.beacon;
    b.hp -= n;
    addTrauma(0.3);
    addFloat(b.x, b.y - 34, '-' + n, '#ff9a9a');
    if (b.hp <= 0) {
      b.hp = 0;
      onBeaconDeath();
    }
  }

  function fireBullets(p) {
    var n = p.projectiles;
    for (var i = 0; i < n; i++) {
      var spread = (i - (n - 1) / 2) * 0.12;
      var a = p.aim + spread;
      S.bullets.push({
        x: p.x + Math.cos(p.aim) * 20,
        y: p.y + Math.sin(p.aim) * 20,
        vx: Math.cos(a) * 640,
        vy: Math.sin(a) * 640,
        dmg: p.dmg,
        pierce: p.pierce,
        hitIds: []
      });
    }
    addParticle(p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22, '#ffd682', 2);
  }

  function updateBullets(dt) {
    for (var i = S.bullets.length - 1; i >= 0; i--) {
      var b = S.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      var dead = false;
      if (b.x < 24 || b.x > 1256 || b.y < 24 || b.y > 696) dead = true;
      if (!dead) {
        var list = Enemies.all();
        for (var j = 0; j < list.length; j++) {
          var e = list[j];
          if (e.state === 'dead' || e.state === 'spawn') continue;
          if (b.hitIds.indexOf(e.id) >= 0) continue;
          var dx = e.x - b.x, dy = e.y - b.y;
          var rr = e.r + 5;
          if (dx * dx + dy * dy <= rr * rr) {
            // Only the lit can be hurt: a bolt into the dark finds nothing.
            if (!LightSys.isLit(e.x, e.y, S.wave)) continue;
            b.hitIds.push(e.id);
            var died = Enemies.takeDamage(e, b.dmg, S, b.x - b.vx * 0.02, b.y - b.vy * 0.02);
            if (S.player.burn) Enemies.applyBurn(e, S.player.burnDmg, 3);
            if (b.pierce > 0) { b.pierce -= 1; }
            else { dead = true; }
            if (died) break;
            if (dead) break;
          }
        }
      }
      if (dead) S.bullets.splice(i, 1);
    }
  }

  function enemyShoot(e, target) {
    var a = Math.atan2(target.y - e.y, target.x - e.x);
    S.globs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, dmg: e.dmg, life: 4 });
  }

  function bossBurst(e) {
    for (var i = 0; i < 10; i++) {
      var a = (i / 10) * Math.PI * 2;
      S.globs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, dmg: 10, life: 4 });
    }
    addTrauma(0.4);
    AudioSys.play('boss');
  }

  function updateGlobs(dt) {
    for (var i = S.globs.length - 1; i >= 0; i--) {
      var g = S.globs[i];
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.life -= dt;
      var dead = g.life <= 0 || g.x < 24 || g.x > 1256 || g.y < 24 || g.y > 696;
      if (!dead) {
        var p = S.player;
        if (p.alive) {
          var dx = p.x - g.x, dy = p.y - g.y;
          if (dx * dx + dy * dy <= (p.r + 6) * (p.r + 6)) {
            Player.takeDamage(g.dmg);
            dead = true;
          }
        }
        if (!dead) {
          var b = LightSys.beacon;
          var bx = b.x - g.x, by = b.y - g.y;
          if (bx * bx + by * by <= (b.r + 6) * (b.r + 6)) {
            damageBeacon(g.dmg);
            dead = true;
          }
        }
      }
      if (dead) S.globs.splice(i, 1);
    }
  }

  function onKill(e, s) {
    S.kills += 1;
    S.gold += Enemies.TYPES[e.type].gold;
    if (S.streakT > 0) S.streak += 1; else S.streak = 1;
    S.streakT = 3;
    if (S.streak >= 3) {
      S.gold += 1;
      addFloat(e.x, e.y - e.r - 26, 'STREAK x' + S.streak, '#ff9a3c');
    }
    addTrauma(e.type === 'brute' ? 0.3 : 0.15);
    // Sunflare: a kill in the light can scorch its neighbours.
    if (S.player.sunflare && Math.random() < 0.25) {
      var list = Enemies.all();
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (o === e || o.state === 'dead') continue;
        var dx = o.x - e.x, dy = o.y - e.y;
        if (dx * dx + dy * dy <= 130 * 130 && LightSys.isLit(o.x, o.y, S.wave)) {
          Enemies.takeDamage(o, 20, S, e.x, e.y);
        }
      }
      addBurst(e.x, e.y, '#ffe9a8', 30);
    }
  }

  function dropPickup(x, y, t) {
    for (var i = 0; i < t.xp; i++) {
      S.pickups.push({ kind: 'shard', x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 24, phase: Math.random() * 6 });
    }
    if (Math.random() < 0.55) {
      S.pickups.push({ kind: 'coin', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, phase: Math.random() * 6 });
    }
  }

  function updatePickups(dt) {
    var p = S.player;
    for (var i = S.pickups.length - 1; i >= 0; i--) {
      var pk = S.pickups[i];
      var dx = p.x - pk.x, dy = p.y - pk.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var magnetR = p.magnetLight && LightSys.isLit(pk.x, pk.y, S.wave) ? 9999 : 120;
      if (d < magnetR) {
        pk.x += (dx / d) * 320 * dt;
        pk.y += (dy / d) * 320 * dt;
      }
      if (d < p.r + 10) {
        if (pk.kind === 'shard') { Player.addXp(1); AudioSys.play('pickup'); }
        else { S.gold += 2; AudioSys.play('coin'); }
        S.pickups.splice(i, 1);
      }
    }
  }

  function addParticle(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      if (S.particles.length > 320) return;
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 160;
      S.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.3, maxLife: 0.65,
        size: 1.5 + Math.random() * 2.5, color: color
      });
    }
  }

  function addBurst(x, y, color, r) {
    for (var i = 0; i < 22; i++) {
      if (S.particles.length > 320) return;
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 220;
      S.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.35, maxLife: 0.75,
        size: 2 + Math.random() * 3, color: color
      });
    }
    void r;
  }

  function updateParticles(dt) {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var pt = S.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      pt.life -= dt;
      if (pt.life <= 0) S.particles.splice(i, 1);
    }
  }

  function addFloat(x, y, text, color) {
    if (S.floats.length > 24) S.floats.shift();
    S.floats.push({ x: x, y: y, text: text, color: color, life: 1.1, maxLife: 1.1 });
  }

  function updateFloats(dt) {
    for (var i = S.floats.length - 1; i >= 0; i--) {
      var f = S.floats[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) S.floats.splice(i, 1);
    }
  }

  function addTrauma(n) {
    S.trauma = Math.min(1, S.trauma + n);
  }

  function hitStop(dur) {
    hitStopId += 1;
    hitStopT = dur;
    void hitStopId;
  }

  function setBanner(text, dur) {
    S.banner = text;
    S.bannerT = dur;
  }

  // Read-only state for the automated playtest (no gameplay effect).
  function debugState() {
    return {
      screen: UI.top(),
      wave: S.wave,
      time: Math.round(S.time * 10) / 10,
      hp: S.player ? Math.round(S.player.hp) : 0,
      beaconHp: Math.round(LightSys.beacon.hp),
      enemies: Enemies.count(),
      kills: S.kills,
      gold: S.gold,
      offer: (UI.getOffer() || []).map(function (c) { return c.id; }),
      player: S.player ? { x: Math.round(S.player.x), y: Math.round(S.player.y), level: S.player.level } : null
    };
  }

  return {
    S: S,
    boot: boot,
    startGame: startGame,
    resumeGame: resumeGame,
    toTitle: toTitle,
    pickUpgrade: pickUpgrade,
    onWin: onWin,
    onPlayerDeath: onPlayerDeath,
    damageBeacon: damageBeacon,
    fireBullets: fireBullets,
    enemyShoot: enemyShoot,
    bossBurst: bossBurst,
    onKill: onKill,
    dropPickup: dropPickup,
    addParticle: addParticle,
    addBurst: addBurst,
    addFloat: addFloat,
    addTrauma: addTrauma,
    hitStop: hitStop,
    setBanner: setBanner,
    debugState: debugState
  };
})();

window.__duskhold = Game;
document.addEventListener('DOMContentLoaded', function () { Game.boot(); });
if (document.readyState !== 'loading') Game.boot();
