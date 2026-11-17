[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/pumafelidae/best-game-01-duskhold/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/pumafelidae/best-game-01-duskhold/reward.svg)](https://make.fun/bounty/best-game-01)

# Duskhold: Lightkeeper

A top-down arena survival game for the [best-game-01 bounty](https://make.fun/bounty/best-game-01) on make.fun. You are the Lightkeeper of the last beacon burning at dusk. Shadow monsters pour out of the dark — they can only be seen, and only hurt, inside the beacon's circle of light. Outside it, all you see are their glowing eyes.

Hold the light for 10 waves. Bosses rise on waves 5 and 10. If your health or the beacon's runs out, the dark wins.

## How to play

- **WASD / arrows** — move
- **Mouse** — aim
- **Hold left click** — fire light bolts (only monsters inside the light take damage)
- **SPACE** — Dawn Pulse, once earned: stuns every lit monster
- **P / Esc** — pause · **M** — mute · **R** — restart on end screens

After each cleared wave, pick 1 of 3 light-blessing cards: a wider halo, a wandering beacon, piercing beams, a second lamp, burning rounds, and more — 12 different blessings in all. Monsters drop light shards (XP) and gold. Level up to hit harder.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no external assets — every visual is drawn in canvas code and every sound is synthesized with WebAudio.

## Layout

- `game/index.html` — the playable game (classic `<script src>` tags, no modules)
- `game/js/input.js` — keyboard + mouse
- `game/js/audio.js` — procedural WebAudio sounds and the dusk pad
- `game/js/light.js` — the beacon, the light radius, the darkness mask
- `game/js/player.js` — the Lightkeeper: movement, aim, XP, levels
- `game/js/enemies.js` — shadow monsters: FSM AI, 4 types + 2 bosses
- `game/js/waves.js` — wave composition and the wave-clear flow
- `game/js/upgrades.js` — the 12 light-blessing cards
- `game/js/ui.js` — screen stack, HUD, buttons, upgrade cards
- `game/js/render.js` — the draw pipeline
- `game/js/game.js` — the main loop and shared state
- `main.ts` — copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — local static server

## License

MIT — see [LICENSE](LICENSE).
