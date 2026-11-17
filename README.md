[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/zamrdzhu/solstice-city/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/zamrdzhu/solstice-city/reward.svg)](https://make.fun/c/gta6-01)

# SOLSTICE CITY

A sun-soaked open-world crime game, built for the [make.fun](https://make.fun) **Make GTA 6** competition (gta6-01).

Mara Voss came back to Solstice City broke and owing the wrong people. Steal cars, outrun the Suncoast Police, and run three jobs for fixer Dario Kestrel to buy her way out — or just cruise the coast and see what the city offers.

## The city

- A 3D low-poly coastal city in Three.js: 81 blocks, a beach, the sea, the old pier, Solstice Plaza and the Marina — all original, all offline.
- Drive and steal cars (any parked or traffic car is yours if you can reach it), on-foot movement, traffic that loops the street grid, and pedestrians who stroll the sidewalks — and run when trouble starts.
- A wanted system with five stars: the Suncoast PD sends pursuit cars that chase, ram, and bust you on foot. Lay low for 25 seconds and the heat cools off.
- Three story missions: **First Fare** (drive Lena Marlowe to the Marina), **Hot Wheels** (steal the gold Comet GT for Kestrel's garage), **Pier Pressure** (clear the Gull Gang off the old pier and escape to the safehouse). Finish all three and the city is yours.
- Combat on foot (mouse-aimed pistol), HUD with a live minimap, cash and health, start screen, pause, and localStorage saves.

## Screenshots

The cover is a three-star police chase down the western avenue; the others show Mara on foot at Solstice Plaza, the pier fight, and a golden-hour cruise along the beach. All four are real renders of the game, staged with `?shot=chase|street|mission|coast&seed=1`.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look (click to shoot on foot) |
| E | Enter / exit car |
| Space | Brake / handbrake |
| Shift | Sprint |
| P | Pause |
| R | Restart mission |
| M | Mute |

## Play it

Serve `game/` with any static server and open `index.html`, for example:

```sh
node serve.ts
# open http://localhost:8080
```

Everything the game loads lives under `game/` (Three.js is vendored as `game/vendor/three.min.js`) — no network requests, no build step.

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` via `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built with the [make.fun](https://make.fun) kit. All names, characters, vehicles, story, art and sounds are original — nothing from any commercial game.
