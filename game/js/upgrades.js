// Upgrades: 12 light-themed cards. After each cleared wave the keeper picks
// 1 of 3. Every card changes gameplay for real; several stack to a cap.
var Upgrades = (function () {
  var owned = {};

  var POOL = [
    {
      id: 'wide-halo', name: 'Wide Halo', max: 3, color: '#ffd682', glyph: '◯',
      desc: '+45 light radius. See further, hurt more of the dark.'
    },
    {
      id: 'wandering-flame', name: 'Wandering Flame', max: 1, color: '#ff9a3c', glyph: '✦',
      desc: 'The beacon drifts to follow you. The light goes where you go.'
    },
    {
      id: 'piercing-beam', name: 'Piercing Beam', max: 2, color: '#7ee0ff', glyph: '➶',
      desc: 'Your bolts pierce +1 monster. One shot, a whole line of dark.'
    },
    {
      id: 'dawn-pulse', name: 'Dawn Pulse', max: 1, color: '#fff3c4', glyph: '☀',
      desc: 'Press SPACE: a pulse of dawn stuns every lit monster for 1.5s.'
    },
    {
      id: 'second-lamp', name: 'Second Lamp', max: 1, color: '#ffb35e', glyph: '❋',
      desc: 'A second lamp burns in the north-west corner. Two pools of light.'
    },
    {
      id: 'ember-rounds', name: 'Ember Rounds', max: 2, color: '#ff6b3d', glyph: '♨',
      desc: 'Your bolts set monsters burning: 8 damage a second for 3s.'
    },
    {
      id: 'rapid-light', name: 'Rapid Light', max: 3, color: '#c8ff5e', glyph: '≫',
      desc: '+25% fire rate. The lantern talks faster.'
    },
    {
      id: 'beacon-mend', name: 'Beacon Mend', max: 2, color: '#8affc1', glyph: '✚',
      desc: '+30 beacon max HP and repair 30 HP now.'
    },
    {
      id: 'gold-magnet', name: 'Gold Magnet', max: 1, color: '#ffd23e', glyph: '◎',
      desc: 'Shards and coins anywhere in the light fly straight to you.'
    },
    {
      id: 'heavy-lantern', name: 'Heavy Lantern', max: 2, color: '#ff8a7a', glyph: '♥',
      desc: '+25 max HP and heal 25 HP now.'
    },
    {
      id: 'twin-shot', name: 'Twin Shot', max: 2, color: '#d08aff', glyph: '⋔',
      desc: '+1 bolt per shot, fanned out.'
    },
    {
      id: 'sunflare', name: 'Sunflare', max: 1, color: '#ffe9a8', glyph: '✺',
      desc: 'Kills in the light burst: 25% chance to scorch nearby monsters.'
    }
  ];

  function reset() { owned = {}; }

  function count(id) { return owned[id] || 0; }

  function available() {
    return POOL.filter(function (c) { return (owned[c.id] || 0) < c.max; });
  }

  function offer() {
    var avail = available();
    var picks = [];
    while (picks.length < 3 && avail.length > 0) {
      var i = Math.floor(Math.random() * avail.length);
      picks.push(avail.splice(i, 1)[0]);
    }
    return picks;
  }

  function apply(card, S) {
    owned[card.id] = (owned[card.id] || 0) + 1;
    var p = S.player;
    switch (card.id) {
      case 'wide-halo': LightSys.addRadiusBonus(45); break;
      case 'wandering-flame': LightSys.setWandering(true); break;
      case 'piercing-beam': p.pierce += 1; break;
      case 'dawn-pulse': p.hasPulse = true; break;
      case 'second-lamp': LightSys.lamp2.active = true; break;
      case 'ember-rounds': p.burn = true; p.burnDmg = 8; break;
      case 'rapid-light': p.fireRate *= 1.25; break;
      case 'beacon-mend':
        LightSys.beacon.maxHp += 30;
        LightSys.beacon.hp = Math.min(LightSys.beacon.maxHp, LightSys.beacon.hp + 30);
        break;
      case 'gold-magnet': p.magnetLight = true; break;
      case 'heavy-lantern': p.maxHp += 25; Player.heal(25); break;
      case 'twin-shot': p.projectiles += 1; break;
      case 'sunflare': p.sunflare = true; break;
    }
    AudioSys.play('upgrade');
  }

  return {
    POOL: POOL,
    reset: reset,
    count: count,
    offer: offer,
    apply: apply
  };
})();
