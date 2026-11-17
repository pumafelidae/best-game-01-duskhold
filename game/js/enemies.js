// Enemies: shadow monsters with a small FSM (spawn -> approach -> attack ->
// stunned -> dead). Perception runs on a timer and writes a target to each
// enemy; steering follows it with separation. Hysteresis on attack ranges and
// a stuck guard keep agents from flickering or freezing on walls.
// Monsters are only hurt inside the light; outside it only their eyes show.
var Enemies = (function () {
  var TYPES = {
    shambler: { hp: 30, speed: 55, r: 16, dmg: 7, gold: 1, xp: 1, color: '#7d8a6a', eye: '#c8ff5e' },
    skitter: { hp: 14, speed: 132, r: 10, dmg: 4, gold: 1, xp: 1, color: '#c47b2d', eye: '#ffd23e' },
    brute: { hp: 95, speed: 38, r: 23, dmg: 14, gold: 3, xp: 2, color: '#8a2f3c', eye: '#ff5a4e' },
    spitter: { hp: 24, speed: 48, r: 13, dmg: 6, gold: 2, xp: 2, color: '#6a4a8a', eye: '#d08aff' },
    herald: { hp: 650, speed: 52, r: 34, dmg: 20, gold: 25, xp: 10, color: '#4a2d6a', eye: '#ff3df0', boss: true },
    sovereign: { hp: 1150, speed: 66, r: 40, dmg: 26, gold: 50, xp: 20, color: '#1f2a5a', eye: '#5ec8ff', boss: true }
  };

  var list = [];
  var nextId = 1;

  function clear() { list = []; }

  function count() { return list.length; }

  function all() { return list; }

  function spawn(type, x, y) {
    var t = TYPES[type];
    var e = {
      id: nextId++, type: type, x: x, y: y, r: t.r,
      hp: t.hp, maxHp: t.hp, speed: t.speed, dmg: t.dmg,
      state: 'spawn', stateT: 0, target: 'player',
      perceiveT: Math.random() * 0.4,
      attackCd: 0, shootCd: 2 + Math.random() * 2,
      burstCd: 6, summonCd: 9, chargeCd: 7,
      charging: 0, chargeDx: 0, chargeDy: 0, telegraph: 0,
      flash: 0, burnT: 0, burnDps: 0,
      lastX: x, lastY: y, stuckT: 0,
      vx: 0, vy: 0, wobble: Math.random() * Math.PI * 2
    };
    list.push(e);
    return e;
  }

  function spawnAtEdge(type) {
    var side = Math.floor(Math.random() * 4);
    var x, y;
    if (side === 0) { x = 40 + Math.random() * 1200; y = 40; }
    else if (side === 1) { x = 40 + Math.random() * 1200; y = 680; }
    else if (side === 2) { x = 40; y = 40 + Math.random() * 640; }
    else { x = 1240; y = 40 + Math.random() * 640; }
    return spawn(type, x, y);
  }

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  function perceive(e, player, beacon) {
    // Cheap first: squared distance to player vs beacon, then choose.
    var dp = dist2(e.x, e.y, player.x, player.y);
    var db = dist2(e.x, e.y, beacon.x, beacon.y);
    if (e.type === 'skitter') e.target = 'player';
    else if (e.type === 'spitter') e.target = (dp < db * 0.6) ? 'player' : 'beacon';
    else e.target = (dp < db) ? 'player' : 'beacon';
  }

  function targetPos(e, player, beacon) {
    return e.target === 'player' ? player : beacon;
  }

  function update(dt, S) {
    var player = S.player;
    var beacon = LightSys.beacon;
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      e.stateT += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < dt * 8) Game.addParticle(e.x, e.y, '#ff9a3c', 1);
        if (e.hp <= 0) { kill(e, S, true); continue; }
      }
      if (e.state === 'dead') continue;

      if (e.state === 'spawn') {
        if (e.stateT >= 0.5) { e.state = 'approach'; e.stateT = 0; }
        continue;
      }
      if (e.state === 'stunned') {
        if (e.stateT >= 1.5) { e.state = 'approach'; e.stateT = 0; }
        continue;
      }

      e.perceiveT -= dt;
      if (e.perceiveT <= 0) {
        e.perceiveT = 0.5;
        perceive(e, player, beacon);
      }

      if (e.state === 'approach') {
        var tp = targetPos(e, player, beacon);
        var dx = tp.x - e.x, dy = tp.y - e.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        var reach = tp.r + e.r + 2;
        // Hysteresis: enter attack inside reach, leave only past reach + 14.
        if (e.type === 'spitter') {
          // A spitter must fight inside the light: it holds a firing band
          // within the beacon's radius and only shoots while lit, so the
          // keeper can always answer it.
          var want = Math.max(90, Math.min(170, LightSys.radius(S.wave) - 40));
          if (d < want + 90) {
            var dir = (d > want + 30) ? 1 : (d < want - 30 ? -1 : 0);
            e.vx = (dx / d) * e.speed * dir;
            e.vy = (dy / d) * e.speed * dir;
            e.shootCd -= dt;
            if (e.shootCd <= 0 && LightSys.isLit(e.x, e.y, S.wave)) {
              e.shootCd = 2.4;
              Game.enemyShoot(e, tp);
              AudioSys.play('spit');
            }
          } else {
            e.vx = (dx / d) * e.speed;
            e.vy = (dy / d) * e.speed;
          }
        } else if (e.type === 'sovereign' && e.telegraph > 0) {
          e.telegraph -= dt;
          e.vx = 0; e.vy = 0;
          if (e.telegraph <= 0) {
            e.charging = 0.5;
            e.chargeDx = dx / d; e.chargeDy = dy / d;
          }
        } else if (e.charging > 0) {
          e.charging -= dt;
          e.vx = e.chargeDx * 430; e.vy = e.chargeDy * 430;
        } else if (d <= reach) {
          e.state = 'attack'; e.stateT = 0;
          e.vx = 0; e.vy = 0;
        } else {
          // Wobble so packs do not march in a single file.
          e.wobble += dt * 2;
          var wx = Math.cos(e.wobble) * 0.3, wy = Math.sin(e.wobble) * 0.3;
          e.vx = (dx / d + wx) * e.speed;
          e.vy = (dy / d + wy) * e.speed;
        }
        // Separation from neighbours (small n, O(n^2) is fine).
        for (var j = 0; j < list.length; j++) {
          var o = list[j];
          if (o === e || o.state === 'dead') continue;
          var sx = e.x - o.x, sy = e.y - o.y;
          var sd = Math.sqrt(sx * sx + sy * sy);
          var min = e.r + o.r + 2;
          if (sd > 0.01 && sd < min) {
            var push = (min - sd) / min * 60;
            e.vx += (sx / sd) * push;
            e.vy += (sy / sd) * push;
          }
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 30) e.x = 30; if (e.x > 1250) e.x = 1250;
        if (e.y < 30) e.y = 30; if (e.y > 690) e.y = 690;
        // Stuck guard: no progress in 2 s while approaching -> sidestep.
        var moved = Math.sqrt((e.x - e.lastX) * (e.x - e.lastX) + (e.y - e.lastY) * (e.y - e.lastY));
        if (moved < 3) {
          e.stuckT += dt;
          if (e.stuckT > 2) {
            e.stuckT = 0;
            e.wobble += Math.PI / 2;
            e.x += (Math.random() - 0.5) * 30;
            e.y += (Math.random() - 0.5) * 30;
          }
        } else e.stuckT = 0;
        e.lastX = e.x; e.lastY = e.y;
        // Boss patterns.
        if (e.type === 'herald') {
          e.burstCd -= dt;
          if (e.burstCd <= 0) { e.burstCd = 6; Game.bossBurst(e); }
          e.summonCd -= dt;
          if (e.summonCd <= 0) {
            e.summonCd = 9;
            for (var s = 0; s < 3; s++) spawn('skitter', e.x + (Math.random() - 0.5) * 60, e.y + (Math.random() - 0.5) * 60);
            Game.addFloat(e.x, e.y - 40, 'THE HERALD CALLS', '#ff3df0');
          }
        }
        if (e.type === 'sovereign') {
          e.chargeCd -= dt;
          if (e.chargeCd <= 0 && e.charging <= 0 && e.telegraph <= 0) {
            e.chargeCd = 7;
            e.telegraph = 0.8;
            Game.addFloat(e.x, e.y - 46, '!', '#5ec8ff');
          }
          e.summonCd -= dt;
          if (e.summonCd <= 0) {
            e.summonCd = 12;
            spawn('spitter', e.x + 60, e.y);
          }
        }
      } else if (e.state === 'attack') {
        // Windup 0.4 s, then one strike, then back to approach.
        if (e.stateT >= 0.4) {
          var tp2 = targetPos(e, player, beacon);
          var d2 = Math.sqrt(dist2(e.x, e.y, tp2.x, tp2.y));
          if (d2 <= tp2.r + e.r + 26) {
            if (e.target === 'player') Player.takeDamage(e.dmg);
            else Game.damageBeacon(e.dmg);
          }
          e.state = 'approach'; e.stateT = 0;
          e.attackCd = 0.9;
        }
      }
    }
    // Remove the dead.
    for (var k = list.length - 1; k >= 0; k--) {
      if (list[k].state === 'dead') list.splice(k, 1);
    }
  }

  function takeDamage(e, dmg, S, fromX, fromY) {
    if (e.state === 'dead' || e.state === 'spawn') return false;
    e.hp -= dmg;
    e.flash = 0.12;
    // Knockback away from the shot.
    var dx = e.x - fromX, dy = e.y - fromY;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var kb = e.type === 'brute' || TYPES[e.type].boss ? 4 : 14;
    e.x += (dx / d) * kb;
    e.y += (dy / d) * kb;
    Game.addFloat(e.x, e.y - e.r - 6, '' + Math.round(dmg), '#ffe9a8');
    Game.addParticle(e.x, e.y, '#ffd682', 4);
    AudioSys.play('hit');
    if (e.hp <= 0) { kill(e, S, false); return true; }
    return false;
  }

  function applyBurn(e, dps, dur) {
    e.burnT = Math.max(e.burnT, dur);
    e.burnDps = Math.max(e.burnDps, dps);
  }

  function stunAllLit(S) {
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.state === 'dead') continue;
      if (LightSys.isLit(e.x, e.y, S.wave)) {
        e.state = 'stunned'; e.stateT = 0;
        e.charging = 0; e.telegraph = 0;
        n++;
      }
    }
    return n;
  }

  function kill(e, S, byBurn) {
    if (e.state === 'dead') return;
    e.state = 'dead';
    var t = TYPES[e.type];
    Game.addBurst(e.x, e.y, t.color, e.r);
    Game.addFloat(e.x, e.y - e.r - 10, '+' + t.gold + 'g', '#ffd682');
    Game.dropPickup(e.x, e.y, t);
    Game.onKill(e, S);
    AudioSys.play('die');
    if (t.boss) {
      Game.addTrauma(1);
      Game.hitStop(0.12);
      Game.addFloat(e.x, e.y - 50, 'BOSS DOWN', '#ffd682');
      if (e.type === 'sovereign') LightSys.setDrain(0);
    }
  }

  function draw(ctx, S) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.state === 'dead') continue;
      var lit = LightSys.isLit(e.x, e.y, S.wave);
      var t = TYPES[e.type];
      if (!lit) continue; // Unlit monsters show only eyes; drawn after darkness.
      // Spawn rise-in.
      var scale = e.state === 'spawn' ? Math.max(0.2, e.stateT / 0.5) : 1;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(scale, scale);
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
      // Type silhouettes.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (e.type === 'brute') {
        ctx.beginPath(); ctx.moveTo(-e.r, -e.r * 0.4); ctx.lineTo(-e.r - 8, -e.r - 6); ctx.lineTo(-e.r * 0.4, -e.r * 0.7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.r, -e.r * 0.4); ctx.lineTo(e.r + 8, -e.r - 6); ctx.lineTo(e.r * 0.4, -e.r * 0.7); ctx.fill();
      } else if (e.type === 'spitter') {
        ctx.beginPath(); ctx.arc(0, e.r * 0.4, e.r * 0.45, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'skitter') {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        for (var l = 0; l < 3; l++) {
          var a = l * 2.1;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * e.r * 0.6, Math.sin(a) * e.r * 0.6);
          ctx.lineTo(Math.cos(a) * (e.r + 6), Math.sin(a) * (e.r + 6)); ctx.stroke();
        }
      }
      if (t.boss) {
        ctx.fillStyle = '#ffd682';
        ctx.beginPath();
        ctx.moveTo(-14, -e.r + 2); ctx.lineTo(-10, -e.r - 12); ctx.lineTo(-4, -e.r + 2);
        ctx.lineTo(0, -e.r - 14); ctx.lineTo(4, -e.r + 2); ctx.lineTo(10, -e.r - 12); ctx.lineTo(14, -e.r + 2);
        ctx.closePath(); ctx.fill();
      }
      // Eyes (facing the target).
      var tp = e.target === 'player' ? S.player : LightSys.beacon;
      var ang = Math.atan2(tp.y - e.y, tp.x - e.x);
      var exx = Math.cos(ang) * 4, eyy = Math.sin(ang) * 4;
      ctx.fillStyle = t.eye;
      ctx.beginPath(); ctx.arc(-5 + exx, -3 + eyy, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5 + exx, -3 + eyy, 2.8, 0, Math.PI * 2); ctx.fill();
      // Flash white on hit, telegraph ring while charging.
      if (e.flash > 0) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.telegraph > 0) {
        ctx.strokeStyle = 'rgba(94,200,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, e.r + 8 + Math.sin(S.time * 20) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      // Boss HP bar above the boss.
      if (t.boss) {
        var w = 90;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 22, w, 7);
        ctx.fillStyle = '#ff5a4e';
        ctx.fillRect(e.x - w / 2, e.y - e.r - 22, w * Math.max(0, e.hp / e.maxHp), 7);
      }
    }
  }

  // Glowing eyes for monsters hiding in the dark. Called AFTER the
  // darkness mask, so the eyes shine through it.
  function drawEyes(ctx, S) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.state === 'dead') continue;
      if (LightSys.isLit(e.x, e.y, S.wave)) continue;
      var t = TYPES[e.type];
      var ex = Math.cos(S.time * 2 + e.id) * 0.4;
      var eyeY = e.y - 3;
      ctx.fillStyle = t.eye;
      ctx.beginPath(); ctx.arc(e.x - 5 + ex, eyeY, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + 5 + ex, eyeY, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  return {
    TYPES: TYPES,
    clear: clear,
    count: count,
    all: all,
    spawn: spawn,
    spawnAtEdge: spawnAtEdge,
    update: update,
    takeDamage: takeDamage,
    applyBurn: applyBurn,
    stunAllLit: stunAllLit,
    draw: draw,
    drawEyes: drawEyes
  };
})();
