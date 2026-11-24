# Rustbucket Summer — a Finnish summer garage sim

An original first-person browser game for CrazyGames: summer 1997 by a lake in the Finnish countryside. You inherit your uncle's house, a tired van, a moped and a **Ruska 1300** coupé in about a hundred pieces in the garage. Build the car, get it through inspection, win the Saturday gravel rally, and survive everyday life along the way: hunger, thirst, sleep, sauna, beer, jobs, police and moose.

The game opens straight into gameplay. The only menus are the pause menu (Esc), shops, and the death screen.

Every asset is generated: textures come from a build-time generator (`tools/gen-textures.mjs`); models, audio and radio music are generated at runtime. There are no third-party art, sound or music files.

## Features

**Car building**
- About 90 part slots on the Ruska: engine internals, ignition, fuel, cooling, electrics, brakes, steering, suspension, wheels, exhaust, interior, body panels and lights.
- Every part has its own bolts. Tighten or loosen them with the wrench (mouse wheel). Loose parts wobble and can fall off while you drive, including wheels.
- Bring a part close to where it fits and a green ghost shows the spot. Press E to attach it.
- Engine stand and engine hoist, jack stands, battery charger.
- Fluids: oil, coolant, brake fluid and fuel, poured from cans. Driving without oil seizes the engine.
- Tuning: set the carburettor mixture (AFR) and ignition timing with the screwdriver.
- Performance parts: twin or racing carbs, fast-road and race cams, high-compression pistons, racing header, turbo kit, close-ratio 5-speed gearbox, rally LSD axle, sport and rally suspension, sport brakes, rally or sport tyres, spoiler, rally lights, roll cage and more. Spray paint in eight colours.
- Damage: crashes dent the body, damage parts and can rip panels, bumpers and lights off. Parts also wear over time.
- Build checklist (Tab) shows completion, fluid levels, and why the engine won't start.

**Vehicles**
- Raycast vehicle physics with an engine, clutch and gearbox model, surface grip (asphalt, gravel, grass), wet roads and water drowning.
- Ruska 1300 (your project), Kuormuri van, Vuoksi 35 tractor with a bale spear, and the Pappa 50 moped.
- First-person view with a working dashboard, or a chase camera. Ignition and starter, choke, lights, seatbelt, horn and radio.

**Life**
- Needs: hunger, thirst, fatigue, stress, bladder, dirtiness, drunkenness and health.
- Cook sausages and pizza on the stove or the sauna stones. Beer, lonkero, coffee and salmiakki.
- Lakeside sauna: feed the stove with firewood, throw löyly, then jump in the lake.
- Chop firewood, fish from the dock, return bottles, play the pub slot machine, pee in nature, throw up, pass out.
- Sleeping in your bed saves the game. Mail arrives with letters, bills and gifts. The home phone calls a tow, a taxi, a pizza or a parts order.

**World and people**
- About 5.8 km² of countryside: a lake with islands, forests (spruce, pine, birch) with roughly 59,000 trees, fields, lupines, an asphalt highway loop and gravel roads.
- Locations: the village of Kurkimäki (shop, gas station, pub, bus stop), the town of Rautala (auto parts, inspection and workshop, police station with jail, kiosk, church), Haapala farm, Romu-Raimo's junkyard and the Kurki-Sprint rally stage.
- Original characters: Tarja, Kaija, Jussi, Inspector Mattila, Seppo, Constable Nieminen, Aune, Romu-Raimo, Jari, Leena, and Pertti, the neighbour who always wants a beer and a ride.
- AI traffic, plus a police patrol with speed traps, pursuits, fines and arrests. Drink-driving and unregistered cars are illegal. A moose wanders near the roads.

**Jobs and goals**
- Hay bales with the tractor, a newspaper round, van deliveries, selling firewood and fish, a taxi service for Pertti, and scrap trading.
- Vehicle inspection gives you number plates. The rally runs on Saturdays from 12:00 to 18:00 with prize money and a trophy, and practice runs are free at any time.
- 35+ achievements and a statistics page.

**Graphics and audio**
- PBR materials, a dynamic sky and Finnish white nights (sun position at 62°N), volumetric-looking clouds, weather (rain and thunderstorms), image-based lighting, shadows, bloom, and drunk and underwater effects.
- Terrain splat shader, tree LODs with impostors, GPU grass, and a lake shader that reflects the sky and the forest line.
- Fully procedural audio: engine sound, starter, ambience (birds, wind, crickets, mosquitoes, rain), foley, and procedurally composed radio music.
- Four quality presets (Low to Ultra). The game also lowers quality automatically when the frame rate drops.

## Controls

| On foot | | Driving | |
|---|---|---|---|
| WASD | move | W / S | throttle / brake |
| Shift / Space / C | run / jump / crouch | A / D | steer |
| LMB | pick up / drop | Space | handbrake |
| RMB | throw | Shift or X / Q or Z | gear up / down |
| E | use, talk, attach a held part, eat or drink | C | clutch (assisted clutch is on by default) |
| F or 1/2/3 | hands / wrench / screwdriver | I | ignition (hold to crank) |
| Mouse wheel | tighten or loosen bolts, tune | K / L / B / H | choke / lights / seatbelt / horn |
| R (holding) | rotate the item | R / N | radio / next station |
| P / T | pee / check watch | V / E | camera / exit |
| Tab / M / H / Esc | checklist / map / hints / pause | Tractor R / F / G | raise / lower / drop the bale |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
node tools/gen-textures.mjs   # regenerate the procedural textures in public/textures
```

Add `?lowres` to the URL to force Low quality, for example on slow machines or in headless tests.

## CrazyGames

`index.html` loads the CrazyGames HTML5 SDK v3 from their CDN. The wrapper is in `src/core/sdk.js`:

- `init()`, plus `loadingStart` and `loadingStop` during boot.
- `gameplayStart` and `gameplayStop` on play, pause, menus and ads.
- A midgame ad at a natural break, after sleeping (rate-limited to once every 3 minutes).
- A rewarded ad on the death screen that revives you in hospital.
- `happytime()` on big moments: the first engine start, passing inspection, winning the rally.
- Saves and settings go through `SDK.data`, which falls back to `localStorage` outside CrazyGames.
- Audio pauses during ads and follows the platform's `muteAudio` setting.

Without the SDK (local dev), the game runs standalone: ads are skipped and rewarded ads are granted.

To upload: run `npm run build`, then zip the contents of `dist/` (with `index.html` at the zip root) and upload it as an HTML5 game. The build is about 3 MB of JS (1 MB gzipped) plus about 12 MB of textures.

## Project layout

```
src/core/      renderer and post-processing, input, procedural audio, physics wrapper, SDK, noise, assets
src/world/     map layout, terrain, roads, vegetation, water, sky and weather, building kit, props, locations
src/vehicles/  vehicle physics, parametric car body, parts and slots, buildable car, van/tractor/moped/traffic models
src/game/      game loop and saves, player, items, interaction, actions, NPCs, traffic and police, jobs and rally, radio, UI
tools/         procedural texture generator
```
