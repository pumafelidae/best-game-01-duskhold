// LightSys: the beacon and the light/darkness rules of Duskhold.
// The beacon is a lamp at the arena centre. Its circle of light is the only
// place monsters are visible and can be hurt. Outside it is dark; only the
// monsters' glowing eyes show. The radius shrinks every wave.
var LightSys = (function () {
  var W = 1280, H = 720;
  var darkCanvas = null;
  var darkCtx = null;

  var beacon = { x: 640, y: 352, hp: 150, maxHp: 150, r: 20, flicker: 0 };
  var lamp2 = { x: 300, y: 150, r: 110, active: false };
  var wandering = false;
  var radiusBonus = 0;
  var drain = 0; // temporary shrink while the Night Sovereign lives
  var pulse = 0; // beacon heartbeat animation phase

  function init() {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = W; darkCanvas.height = H;
    darkCtx = darkCanvas.getContext('2d');
  }

  function baseRadius(wave) {
    return Math.max(120, 260 - 12 * (wave - 1));
  }

  function radius(wave) {
    return Math.max(90, baseRadius(wave) + radiusBonus - drain);
  }

  function reset() {
    beacon.x = 640; beacon.y = 352;
    beacon.hp = 150; beacon.maxHp = 150;
    lamp2.active = false;
    wandering = false;
    radiusBonus = 0;
    drain = 0;
    pulse = 0;
  }

  function update(dt, playerX, playerY) {
    pulse += dt;
    beacon.flicker = Math.sin(pulse * 7.3) * 0.5 + Math.sin(pulse * 13.1) * 0.5;
    if (wandering) {
      // The beacon drifts toward the keeper instead of staying centred.
      beacon.x += (playerX - beacon.x) * Math.min(1, dt * 2.2);
      beacon.y += (playerY - beacon.y) * Math.min(1, dt * 2.2);
    }
  }

  function isLit(x, y, wave) {
    var r = radius(wave);
    var dx = x - beacon.x, dy = y - beacon.y;
    if (dx * dx + dy * dy <= r * r) return true;
    if (lamp2.active) {
      var lx = x - lamp2.x, ly = y - lamp2.y;
      if (lx * lx + ly * ly <= lamp2.r * lamp2.r) return true;
    }
    return false;
  }

  // Paint the darkness mask: near-black everywhere except the light circles.
  function drawDarkness(ctx, wave) {
    var r = radius(wave);
    var d = darkCtx;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(5, 4, 16, 0.96)';
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    var g = d.createRadialGradient(beacon.x, beacon.y, r * 0.25, beacon.x, beacon.y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.92)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.beginPath(); d.arc(beacon.x, beacon.y, r, 0, Math.PI * 2); d.fill();
    if (lamp2.active) {
      var g2 = d.createRadialGradient(lamp2.x, lamp2.y, 10, lamp2.x, lamp2.y, lamp2.r);
      g2.addColorStop(0, 'rgba(0,0,0,1)');
      g2.addColorStop(0.8, 'rgba(0,0,0,0.9)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g2;
      d.beginPath(); d.arc(lamp2.x, lamp2.y, lamp2.r, 0, Math.PI * 2); d.fill();
    }
    ctx.drawImage(darkCanvas, 0, 0);
  }

  function drawBeaconGlow(ctx, wave) {
    var r = radius(wave);
    var fl = 1 + beacon.flicker * 0.02;
    var g = ctx.createRadialGradient(beacon.x, beacon.y, 8, beacon.x, beacon.y, r * fl);
    g.addColorStop(0, 'rgba(255, 214, 130, 0.55)');
    g.addColorStop(0.45, 'rgba(255, 166, 66, 0.22)');
    g.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(beacon.x, beacon.y, r * fl, 0, Math.PI * 2); ctx.fill();
    if (lamp2.active) {
      var g2 = ctx.createRadialGradient(lamp2.x, lamp2.y, 6, lamp2.x, lamp2.y, lamp2.r);
      g2.addColorStop(0, 'rgba(255, 214, 130, 0.5)');
      g2.addColorStop(0.5, 'rgba(255, 166, 66, 0.18)');
      g2.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(lamp2.x, lamp2.y, lamp2.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBeacon(ctx) {
    // Stone lamp post with a warm flame, drawn over the glow.
    ctx.save();
    ctx.translate(beacon.x, beacon.y);
    ctx.fillStyle = '#3a3348';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57506e';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    var fl = 1 + beacon.flicker * 0.12;
    ctx.fillStyle = '#ffd682';
    ctx.beginPath(); ctx.arc(0, 0, 9 * fl, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(0, 0, 5 * fl, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (lamp2.active) {
      ctx.save();
      ctx.translate(lamp2.x, lamp2.y);
      ctx.fillStyle = '#3a3348';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd682';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Beacon HP ring, readable at a glance.
    var ratio = Math.max(0, beacon.hp / beacon.maxHp);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ratio > 0.4 ? '#ffd682' : '#ff5a4e';
    ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke();
    ctx.restore();
  }

  return {
    beacon: beacon,
    lamp2: lamp2,
    init: init,
    reset: reset,
    update: update,
    radius: radius,
    baseRadius: baseRadius,
    isLit: isLit,
    drawDarkness: drawDarkness,
    drawBeaconGlow: drawBeaconGlow,
    drawBeacon: drawBeacon,
    setWandering: function (v) { wandering = v; },
    isWandering: function () { return wandering; },
    addRadiusBonus: function (n) { radiusBonus += n; },
    setDrain: function (n) { drain = n; }
  };
})();
