// Input: keyboard + mouse state for Duskhold, classic script, no dependencies.
// Tracks held keys, edge-triggered presses, and mouse position in canvas pixels
// (the canvas is 1280x720 internally and CSS-scaled to the window).
var Input = (function () {
  var keys = {};
  var pressed = {};
  var mouse = { x: 640, y: 360, down: false, clicked: false, clickX: 0, clickY: 0 };
  var canvas = null;

  function toCanvas(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (1280 / r.width),
      y: (e.clientY - r.top) * (720 / r.height)
    };
  }

  function init(c) {
    canvas = c;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      keys[e.code] = true;
      pressed[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    canvas.addEventListener('mousemove', function (e) {
      var p = toCanvas(e);
      mouse.x = p.x; mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', function (e) {
      var p = toCanvas(e);
      mouse.x = p.x; mouse.y = p.y;
      mouse.down = true;
      mouse.clicked = true;
      mouse.clickX = p.x; mouse.clickY = p.y;
      if (window.AudioSys) AudioSys.unlock();
    });
    window.addEventListener('mouseup', function () { mouse.down = false; });
    window.addEventListener('blur', function () {
      for (var k in keys) keys[k] = false;
      mouse.down = false;
    });
  }

  function isDown(code) { return !!keys[code]; }

  // Edge-triggered: true once, then cleared at end of frame by Game.
  function wasPressed(code) { return !!pressed[code]; }

  function axis() {
    var x = 0, y = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) y += 1;
    if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
    return { x: x, y: y };
  }

  function endFrame() {
    pressed = {};
    mouse.clicked = false;
  }

  return {
    init: init,
    keys: keys,
    mouse: mouse,
    isDown: isDown,
    wasPressed: wasPressed,
    axis: axis,
    endFrame: endFrame
  };
})();
