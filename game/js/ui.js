// UI: screen stack (title / playing / upgrade / paused / win / lose), the
// event-driven HUD, and clickable buttons. Only the top screen takes input.
// Layout uses fixed anchor positions at the 1280x720 reference resolution;
// HUD values are cached and redrawn only when they change.
var UI = (function () {
  var stack = ['title'];
  var buttons = [];
  var hudCache = {};
  var offer = null;

  function top() { return stack[stack.length - 1]; }
  function push(s) { stack.push(s); }
  function pop() { if (stack.length > 1) stack.pop(); }
  function set(s) { stack = [s]; }
  function is(s) { return top() === s; }

  function setOffer(cards) { offer = cards; }
  function getOffer() { return offer; }

  function clearButtons() { buttons = []; }

  function addButton(x, y, w, h, label, onClick, sub) {
    buttons.push({ x: x, y: y, w: w, h: h, label: label, onClick: onClick, sub: sub || '' });
  }

  function handleClick(mx, my) {
    for (var i = buttons.length - 1; i >= 0; i--) {
      var b = buttons[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        AudioSys.play('click');
        b.onClick();
        return true;
      }
    }
    return false;
  }

  function button(ctx, b, hover) {
    ctx.save();
    ctx.fillStyle = hover ? '#ff9a3c' : '#2a2438';
    ctx.strokeStyle = hover ? '#ffd682' : '#57506e';
    ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = hover ? '#1a1025' : '#ffe9a8';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.sub ? -8 : 0));
    if (b.sub) {
      ctx.font = '13px Arial, sans-serif';
      ctx.fillStyle = hover ? '#1a1025' : '#b8aee0';
      ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 14);
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bar(ctx, x, y, w, h, ratio, fill, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
    roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = fill;
      roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, ratio)), h - 4, (h - 4) / 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
  }

  function drawHUD(ctx, S) {
    var p = S.player;
    var key = [p.hp, p.maxHp, p.level, p.xp, p.xpNeed, S.wave, S.kills, S.gold, S.time | 0, S.streak, LightSys.beacon.hp, LightSys.beacon.maxHp].join('|');
    if (hudCache.key === key && hudCache.drawn) { /* values unchanged; still redraw cheap text below */ }
    hudCache.key = key;
    ctx.save();
    ctx.textBaseline = 'middle';
    // Top-left: HP + XP + beacon HP.
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('KEEPER', 20, 24);
    bar(ctx, 20, 34, 220, 16, p.hp / p.maxHp, p.hp / p.maxHp > 0.35 ? '#7ddc6a' : '#ff5a4e');
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, 250, 42);
    ctx.fillStyle = '#b8aee0';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText('LV ' + p.level, 20, 66);
    bar(ctx, 64, 58, 176, 10, p.xp / p.xpNeed, '#8a7bff');
    ctx.fillStyle = '#ffd682';
    ctx.fillText('BEACON', 20, 88);
    bar(ctx, 92, 80, 148, 10, LightSys.beacon.hp / LightSys.beacon.maxHp, '#ffd682');
    // Top-centre: wave + timer.
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('WAVE ' + S.wave + ' / 10', 640, 30);
    ctx.font = '15px Arial, sans-serif';
    ctx.fillStyle = '#cfc4f2';
    var t = Math.floor(S.time);
    ctx.fillText(Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), 640, 54);
    if (Waves.isActive()) {
      ctx.font = '13px Arial, sans-serif';
      ctx.fillStyle = '#ff9a9a';
      ctx.fillText(Enemies.count() + ' shadows remain', 640, 76);
    }
    // Top-right: gold + kills.
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillStyle = '#ffd682';
    ctx.fillText('◈ ' + S.gold + ' gold', 1260, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('☠ ' + S.kills + ' kills', 1260, 52);
    if (S.streak >= 3) {
      ctx.fillStyle = '#ff9a3c';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText('STREAK x' + S.streak, 1260, 82);
    }
    // Dawn Pulse cooldown, bottom-left.
    if (p.hasPulse) {
      ctx.textAlign = 'left';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillStyle = p.pulseCd <= 0 ? '#fff3c4' : '#8a80b0';
      ctx.fillText(p.pulseCd <= 0 ? 'SPACE: Dawn Pulse ready' : 'Dawn Pulse ' + Math.ceil(p.pulseCd) + 's', 20, 700);
    }
    ctx.restore();
  }

  function drawTitle(ctx, S) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,4,16,0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd682';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.fillText('DUSKHOLD', 640, 210);
    ctx.fillStyle = '#ff9a3c';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('— LIGHTKEEPER —', 640, 258);
    ctx.fillStyle = '#e8dff5';
    ctx.font = '19px Arial, sans-serif';
    ctx.fillText('The last beacon burns at dusk. The dark is full of eyes.', 640, 310);
    ctx.fillText('Monsters are only seen — and only hurt — inside the light.', 640, 338);
    ctx.fillText('Hold the light for 10 waves. Do not let it go out.', 640, 366);
    ctx.fillStyle = '#cfc4f2';
    ctx.font = '17px Arial, sans-serif';
    ctx.fillText('WASD move    ·    Mouse aim    ·    Hold click to fire', 640, 420);
    ctx.fillText('SPACE Dawn Pulse (once earned)    ·    P pause    ·    M mute', 640, 446);
    ctx.restore();
    clearButtons();
    addButton(540, 490, 200, 56, 'LIGHT THE BEACON', function () { Game.startGame(); }, 'or press Enter');
  }

  function drawUpgrade(ctx, S) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,4,16,0.72)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd682';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('WAVE ' + S.wave + ' CLEARED', 640, 110);
    ctx.fillStyle = '#e8dff5';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText('Choose one blessing of the light.', 640, 148);
    ctx.restore();
    clearButtons();
    var cards = offer || [];
    var cw = 300, ch = 300, gap = 40;
    var total = cards.length * cw + (cards.length - 1) * gap;
    var x0 = 640 - total / 2;
    for (var i = 0; i < cards.length; i++) {
      (function (card, x) {
        addButton(x, 220, cw, ch, '', function () { Game.pickUpgrade(card); }, '');
        buttons[buttons.length - 1].card = card;
        buttons[buttons.length - 1].index = i;
      })(cards[i], x0 + i * (cw + gap));
    }
    // Draw the cards themselves (buttons above are invisible hit areas).
    for (var j = 0; j < cards.length; j++) {
      var c = cards[j];
      var x = x0 + j * (cw + gap), y = 220;
      var hover = Input.mouse.x >= x && Input.mouse.x <= x + cw && Input.mouse.y >= y && Input.mouse.y <= y + ch;
      ctx.save();
      ctx.fillStyle = hover ? '#3d2c17' : '#241d33';
      ctx.strokeStyle = hover ? '#ffd682' : c.color;
      ctx.lineWidth = hover ? 3 : 2;
      roundRect(ctx, x, y, cw, ch, 14); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = c.color;
      ctx.font = '54px Arial, sans-serif';
      ctx.fillText(c.glyph, x + cw / 2, y + 78);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText(c.name, x + cw / 2, y + 128);
      ctx.fillStyle = '#d8cfee';
      ctx.font = '15px Arial, sans-serif';
      wrapText(ctx, c.desc, x + cw / 2, y + 158, cw - 36, 22);
      var owned = Upgrades.count(c.id);
      ctx.fillStyle = '#8a80b0';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText('owned: ' + owned + ' / ' + c.max + '      ·      press ' + (j + 1), x + cw / 2, y + ch - 22);
      ctx.restore();
    }
  }

  function wrapText(ctx, text, cx, y, maxW, lineH) {
    var words = text.split(' ');
    var line = '';
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], cx, y + j * lineH);
  }

  function drawPause(ctx, S) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,4,16,0.6)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd682';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('PAUSED', 640, 240);
    ctx.fillStyle = '#cfc4f2';
    ctx.font = '17px Arial, sans-serif';
    ctx.fillText('Wave ' + S.wave + '  ·  ' + S.kills + ' kills  ·  ' + S.gold + ' gold', 640, 286);
    ctx.restore();
    clearButtons();
    addButton(540, 330, 200, 52, 'RESUME', function () { Game.resumeGame(); }, 'Esc / P');
    addButton(540, 398, 200, 52, 'RESTART', function () { Game.startGame(); }, 'start over');
    addButton(540, 466, 200, 52, 'TITLE', function () { Game.toTitle(); }, 'back to menu');
  }

  function drawEnd(ctx, S, won) {
    ctx.save();
    ctx.fillStyle = won ? 'rgba(20,16,4,0.72)' : 'rgba(16,4,8,0.78)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffd682' : '#ff5a4e';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText(won ? 'DAWN BREAKS' : 'THE LIGHT DIES', 640, 220);
    ctx.fillStyle = '#e8dff5';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(won
      ? 'Ten waves held. The beacon still burns — and so do you.'
      : 'The dark swallowed the beacon. The keeper falls, the dusk remains.', 640, 268);
    ctx.fillStyle = '#cfc4f2';
    ctx.font = '18px Arial, sans-serif';
    var t = Math.floor(S.time);
    ctx.fillText('Waves cleared: ' + S.wavesCleared + ' / 10', 640, 330);
    ctx.fillText('Kills: ' + S.kills + '    ·    Gold: ' + S.gold + '    ·    Level: ' + S.player.level, 640, 360);
    ctx.fillText('Time: ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), 640, 390);
    ctx.restore();
    clearButtons();
    addButton(540, 440, 200, 56, won ? 'PLAY AGAIN' : 'TRY AGAIN', function () { Game.startGame(); }, 'or press R');
    addButton(540, 512, 200, 56, 'TITLE', function () { Game.toTitle(); }, '');
  }

  function drawBanner(ctx, S) {
    if (!S.banner || S.bannerT <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, S.bannerT * 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd682';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText(S.banner, 640, 180);
    ctx.restore();
  }

  return {
    top: top,
    push: push,
    pop: pop,
    set: set,
    is: is,
    setOffer: setOffer,
    getOffer: getOffer,
    clearButtons: clearButtons,
    addButton: addButton,
    handleClick: handleClick,
    button: button,
    drawHUD: drawHUD,
    drawTitle: drawTitle,
    drawUpgrade: drawUpgrade,
    drawPause: drawPause,
    drawEnd: drawEnd,
    drawBanner: drawBanner,
    roundRect: roundRect,
    _buttons: function () { return buttons; },
    stack: function () { return stack; }
  };
})();
