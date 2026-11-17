// Waves: spawn composition per wave, the spawn queue, and the wave-clear flow.
// Wave 5 brings the Gloom Herald, wave 10 the Night Sovereign. Clearing wave
// 10 wins the game. Light radius shrinks every wave (see LightSys).
var Waves = (function () {
  var queue = [];
  var spawnT = 0;
  var spawnInterval = 1;
  var betweenT = 0;
  var active = false;

  function composition(n) {
    var out = [];
    var total = 5 + 3 * n;
    for (var i = 0; i < total; i++) {
      var roll = Math.random();
      if (n >= 3 && roll < 0.10) out.push('spitter');
      else if (n >= 2 && roll < 0.24) out.push('brute');
      else if (roll < 0.55) out.push('shambler');
      else out.push('skitter');
    }
    if (n === 5) out.push('herald');
    if (n === 10) out.push('sovereign');
    // Shuffle so the boss does not always arrive last.
    for (var j = out.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = out[j]; out[j] = out[k]; out[k] = tmp;
    }
    return out;
  }

  function startWave(n) {
    queue = composition(n);
    spawnInterval = Math.max(0.35, 1.15 - 0.07 * n);
    spawnT = 0.4;
    betweenT = 0;
    active = true;
  }

  function isActive() { return active; }

  function remaining() { return queue.length + Enemies.count(); }

  function update(dt, S) {
    if (!active) return;
    if (queue.length > 0) {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = spawnInterval;
        var type = queue.shift();
        Enemies.spawnAtEdge(type);
        if (type === 'herald' || type === 'sovereign') {
          Game.addFloat(640, 200, type === 'herald' ? 'THE GLOOM HERALD' : 'THE NIGHT SOVEREIGN', '#ff3df0');
          AudioSys.play('boss');
          if (type === 'sovereign') LightSys.setDrain(25);
        }
      }
    } else if (Enemies.count() === 0) {
      // Wave cleared.
      active = false;
      S.wavesCleared = S.wave;
      var bonus = 10 + 2 * S.wave;
      S.gold += bonus;
      Player.heal(20);
      Game.addFloat(640, 300, 'WAVE ' + S.wave + ' CLEARED  +' + bonus + 'g', '#ffd682');
      AudioSys.play('waveClear');
      if (S.wave >= 10) {
        Game.onWin();
      } else {
        betweenT = 1.6;
        Game.setBanner('WAVE ' + S.wave + ' CLEARED', 1.6);
      }
    }
  }

  // Called by Game after the clear banner: open the upgrade choice.
  function afterBanner(S) {
    if (betweenT > 0) return false;
    return true;
  }

  function tickBetween(dt) {
    if (betweenT > 0) {
      betweenT -= dt;
      if (betweenT <= 0) return true;
    }
    return false;
  }

  function reset() {
    queue = [];
    active = false;
    betweenT = 0;
  }

  return {
    startWave: startWave,
    isActive: isActive,
    remaining: remaining,
    update: update,
    afterBanner: afterBanner,
    tickBetween: tickBetween,
    reset: reset
  };
})();
