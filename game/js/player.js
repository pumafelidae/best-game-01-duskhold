// Player: the Lightkeeper. WASD movement, mouse aim, hold-to-fire light bolts.
// XP shards level the keeper up (+damage, small heal). Gold and kills are score.
var Player = (function () {
  var ARENA = { x: 28, y: 28, w: 1224, h: 664 };

  var p = null;

  function reset() {
    p = {
      x: 640, y: 480, r: 14,
      speed: 250, hp: 100, maxHp: 100,
      aim: -Math.PI / 2, fireCd: 0, fireRate: 6,
      dmg: 12, pierce: 0, projectiles: 1,
      level: 1, xp: 0, xpNeed: 6,
      burn: false, burnDmg: 0,
      pulseCd: 0, pulseMax: 8, hasPulse: false,
      sunflare: false, magnetLight: false,
      invuln: 0, walkPhase: 0, alive: true
    };
    return p;
  }

  function get() { return p; }

  function update(dt, fire) {
    if (!p || !p.alive) return;
    var a = Input.axis();
    p.x += a.x * p.speed * dt;
    p.y += a.y * p.speed * dt;
    if (p.x < ARENA.x + p.r) p.x = ARENA.x + p.r;
    if (p.x > ARENA.x + ARENA.w - p.r) p.x = ARENA.x + ARENA.w - p.r;
    if (p.y < ARENA.y + p.r) p.y = ARENA.y + p.r;
    if (p.y > ARENA.y + ARENA.h - p.r) p.y = ARENA.y + ARENA.h - p.r;
    if (a.x !== 0 || a.y !== 0) p.walkPhase += dt * 10;
    p.aim = Math.atan2(Input.mouse.y - p.y, Input.mouse.x - p.x);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.pulseCd > 0) p.pulseCd -= dt;
    if (fire && p.fireCd <= 0) {
      p.fireCd = 1 / p.fireRate;
      Game.fireBullets(p);
      AudioSys.play('shoot');
    }
  }

  function takeDamage(n) {
    if (!p || !p.alive || p.invuln > 0) return false;
    p.hp -= n;
    p.invuln = 0.45;
    Game.addTrauma(0.35);
    Game.addFloat(p.x, p.y - 22, '-' + n, '#ff6b5e');
    AudioSys.play('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      Game.onPlayerDeath();
    }
    return true;
  }

  function heal(n) {
    if (!p) return;
    p.hp = Math.min(p.maxHp, p.hp + n);
  }

  function addXp(n) {
    if (!p) return;
    p.xp += n;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed;
      p.level += 1;
      p.xpNeed = 6 + 3 * p.level;
      p.dmg *= 1.10;
      heal(12);
      Game.addFloat(p.x, p.y - 30, 'LEVEL UP!', '#ffd682');
      AudioSys.play('upgrade');
    }
  }

  function firePulse() {
    if (!p || !p.hasPulse || p.pulseCd > 0) return false;
    p.pulseCd = p.pulseMax;
    return true;
  }

  function draw(ctx) {
    if (!p || !p.alive) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Cloak: warm amber circle with a hood, bobbing as the keeper walks.
    var bob = Math.sin(p.walkPhase) * 1.5;
    ctx.fillStyle = '#b3541e';
    ctx.beginPath(); ctx.arc(0, bob * 0.4, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e07830';
    ctx.beginPath(); ctx.arc(0, bob * 0.4, p.r - 4, 0, Math.PI * 2); ctx.fill();
    // Lantern held toward the aim direction.
    var lx = Math.cos(p.aim) * 18, ly = Math.sin(p.aim) * 18;
    ctx.fillStyle = '#ffd682';
    ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
    // Brief white flash while invulnerable.
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, p.r + 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  return {
    reset: reset,
    get: get,
    update: update,
    takeDamage: takeDamage,
    heal: heal,
    addXp: addXp,
    firePulse: firePulse,
    draw: draw
  };
})();
