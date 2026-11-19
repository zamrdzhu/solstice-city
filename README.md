# Costa Alba — an open-world crime game (gta6-01)

A complete 3D open-world crime game in a sun-soaked modern coastal city of
our own invention. All names, characters, vehicles, story and art are
original — nothing borrowed from any commercial game.

## The city

Costa Alba: a road-grid city with a downtown tower cluster, shop-lined
streets, a beach, a pier, a marina and a lighthouse on the point. Traffic
flows through the intersections and pedestrians stroll the sidewalks.

## What you can do

- **Explore on foot and by car** — steal any car (E), drive it, get out again.
- **Wanted system** — crimes raise your stars. Patrol cars chase and ram,
  roadblocks appear at 3 stars, and a police helicopter with a searchlight
  circles overhead at 4 stars. Stay clean and the heat cools off.
- **Eight story chapters** — Dante Cruz, a former getaway driver turned
  courier, is pulled back into the underworld: fares, a stolen Cometa GT,
  a timed harbor run, a pier fight, a bank job, a convoy interception, a
  90-second helicopter hunt, and a finale at the lighthouse.
- **Combat** — punch up close (F), shoot with the pistol (click).
- **Dynamic weather, like the real thing** — clear → cloudy → rain →
  thunderstorm → fog, with smooth transitions. Rain streaks and splashes,
  wet shiny roads and puddles, lightning with delayed thunder, fog that
  cuts visibility, and wet roads that make the car slide a little. The
  HUD shows the weather next to the city clock. Press G to cycle the
  weather yourself, or force one with `?weather=storm`.
- **Three radio stations** (T) — Alba FM 88.4, Costa Rock 101 and Marina
  Nights 96.2, all synthesized live with WebAudio.
- **A dense HUD** — wanted stars, health, money, mission panel, city
  clock, weather, radio, and a circular minimap with mission, police and
  traffic blips.
- **Save system** — progress, money and the clock are kept in localStorage;
  continue from the start screen.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move / drive |
| Shift | Run |
| Space | Handbrake |
| E | Enter / leave a car |
| Mouse click | Shoot |
| F | Punch |
| T | Next radio station |
| G | Cycle the weather |
| Esc | Pause |

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Screenshots are staged deterministically: `?shot=cover|drive|mission|foot`
with `&seed=1` (see `shots.json`). All assets are local files; the game
makes no network request.

## Files

- `game/index.html` — page shell and HUD styling
- `game/src/main.js` — bootstrap, game loop, input
- `game/src/config.js` — tuning, palette, the eight-chapter story
- `game/src/city.js` — the city, beach, pier, lighthouse, marina
- `game/src/weather.js` — the dynamic weather cycle
- `game/src/vehicles.js` — cars, driving physics, traffic
- `game/src/pedestrians.js` — the people of Costa Alba
- `game/src/player.js` — Dante on foot, camera, combat
- `game/src/police.js` — wanted level, patrols, roadblocks, helicopter
- `game/src/missions.js` — the eight story chapters
- `game/src/hud.js` — HUD, circular minimap, overlays
- `game/src/audio.js` — synthesized sound and three radio stations
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — deterministic screenshot staging
- `game/src/rng.js` — seeded random generator

## License

MIT — see `LICENSE`.
