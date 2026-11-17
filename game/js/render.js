// Render: the whole draw pipeline for Duskhold. Order matters:
// ground -> beacon glow -> lit bodies -> bullets/pickups -> darkness mask ->
// glowing eyes in the dark -> particles -> damage numbers -> HUD / screens.
// The camera is fixed; screen shake only offsets the world layer.
var Render = (function () {
  var W = 1280, H = 720;
  var speckles = [];
  var tiles = [];

  // Deterministic decoration, seeded so every run looks the same.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function init() {
    var rnd = mulberry32(1337);
    for (var i = 0; i < 260; i++) {
      speckles.push({ x: 30 + rnd() * 1220, y: 30 + rnd() * 660, r: 1 + rnd() * 2.2, a: 0.05 + rnd() * 0.12 });
    }
    for (var tx = 0; tx < 16; tx++) {
      for (var ty = 0; ty < 9; ty++) {
        tiles.push({ x: 28 + tx * 77, y: 28 + ty * 74, tone: rnd() });
      }
    }
  }

  function drawGround(ctx, S) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#17122b');
    g.addColorStop(0.55, '#241a33');
    g.addColorStop(1, '#2e1f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Cobble tiles.
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      ctx.fillStyle = t.tone > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(t.x + 1, t.y + 1, 75, 72);
    }
    for (var j = 0; j < speckles.length; j++) {
      var s = speckles[j];
      ctx.fillStyle = 'rgba(255, 220, 160, ' + s.a + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    // Arena border: old stone wall.
    ctx.strokeStyle = '#4a3f5e';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, 1224, 664);
    ctx.strokeStyle = 'rgba(255, 214, 130, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, 1212, 652);
  }

  function drawBullets(ctx, S) {
    for (var i = 0; i < S.bullets.length; i++) {
      var b = S.bullets[i];
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      g.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      g.addColorStop(0.4, 'rgba(255, 214, 130, 0.7)');
      g.addColorStop(1, 'rgba(255, 166, 66, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawGlobs(ctx, S) {
    for (var i = 0; i < S.globs.length; i++) {
      var b = S.globs[i];
      ctx.fillStyle = '#b06ae0';
      ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d08aff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPickups(ctx, S) {
    for (var i = 0; i < S.pickups.length; i++) {
      var pk = S.pickups[i];
      var bob = Math.sin(S.time * 5 + pk.phase) * 2;
      if (pk.kind === 'shard') {
        ctx.fillStyle = '#8a7bff';
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        ctx.rotate(S.time * 2 + pk.phase);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffd682';
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawParticles(ctx, S) {
    for (var i = 0; i < S.particles.length; i++) {
      var pt = S.particles[i];
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats(ctx, S) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Arial, sans-serif';
    for (var i = 0; i < S.floats.length; i++) {
      var f = S.floats[i];
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw(ctx, S) {
    ctx.clearRect(0, 0, W, H);
    UI.clearButtons();
    // Shake offset, visual only.
    var sh = S.trauma * S.trauma;
    var ox = 0, oy = 0;
    if (sh > 0.001) {
      var t = S.realTime * 31;
      ox = 11 * sh * Math.sin(t * 1.7);
      oy = 8 * sh * Math.sin(t * 2.3);
    }
    ctx.save();
    ctx.translate(ox, oy);
    drawGround(ctx, S);
    LightSys.drawBeaconGlow(ctx, S.wave);
    LightSys.drawBeacon(ctx);
    drawPickups(ctx, S);
    Player.draw(ctx);
    Enemies.draw(ctx, S);
    LightSys.drawDarkness(ctx, S.wave);
    // Light itself shines in the dark: bolts, globs and eyes go above the mask.
    drawBullets(ctx, S);
    drawGlobs(ctx, S);
    Enemies.drawEyes(ctx, S);
    drawParticles(ctx, S);
    drawFloats(ctx, S);
    ctx.restore();
    // Vignette for the dusk mood.
    var v = ctx.createRadialGradient(640, 360, 320, 640, 360, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(5,4,16,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // Screens and HUD sit above the world, unshaken.
    if (UI.is('title')) UI.drawTitle(ctx, S);
    else if (UI.is('upgrade')) UI.drawUpgrade(ctx, S);
    else if (UI.is('paused')) { UI.drawHUD(ctx, S); UI.drawPause(ctx, S); }
    else if (UI.is('win')) UI.drawEnd(ctx, S, true);
    else if (UI.is('lose')) UI.drawEnd(ctx, S, false);
    else {
      UI.drawHUD(ctx, S);
      UI.drawBanner(ctx, S);
    }
    drawButtons(ctx);
  }

  function drawButtons(ctx) {
    // Buttons registered this frame are drawn with hover state.
    var list = UI._buttons ? UI._buttons() : null;
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.card) continue; // upgrade cards draw themselves
      var hover = Input.mouse.x >= b.x && Input.mouse.x <= b.x + b.w &&
        Input.mouse.y >= b.y && Input.mouse.y <= b.y + b.h;
      UI.button(ctx, b, hover);
    }
  }

  return { init: init, draw: draw };
})();
