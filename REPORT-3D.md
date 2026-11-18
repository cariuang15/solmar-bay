# SOLMAR BAY — 3D open-world crime game for make.fun gta6-01

A new 3D entry for the "Make GTA 6" bounty (competition `gta6-01`, $1,666, 100 paid places,
deadline 24 Nov 2026 22:00 WIB). Built to beat the rank-1 3D game "HALCYON KEYS 3D"
(99.33% win rate) and our own 2D entry Solara Bay (rank #3,301, 12-0-0, 98.23%).

## What it is

**SOLMAR BAY** — an original sun-soaked coastal city. You are **Kai Reyes**, a newcomer
who owes a debt to **Mama Lu**, the fixer who runs a garage on the west side. Seven story
jobs build your reputation from stealing your first car to a casino heist. No Rockstar /
GTA names, characters, maps or assets anywhere — everything (city, characters, vehicles,
names, story, art, sound, music) is original.

## Systems (all wired together)

- **3D city** — procedural grid streets (7×7 blocks), buildings with lit windows,
  sidewalks, beach + ocean, palms, streetlights, clouds, landmarks (garage, diner, marina,
  docks, casino, warehouse, safehouse, hideout, plaza, hospital). Day sun + shadows.
- **On foot** — third-person character, WASD + mouse-drag orbit camera, walk/run,
  pistol (mouse aim, hitscan), car enter/exit with **E**.
- **Driving** — chase camera, acceleration / brake / steer, collisions with buildings,
  props and traffic, skid marks, engine sound that follows speed.
- **Traffic** — 16 AI cars driving the street grid (lane discipline, turns at
  intersections, avoiding each other) + 22 pedestrians walking the sidewalks who flee
  from danger.
- **Car stealing** — any NPC car can be taken (E near a car); stealing raises wanted.
- **Wanted + police** — 0–5 stars, rising for car theft, hitting pedestrians, shooting.
  Police cars chase and ram; a **police helicopter joins at 3+ stars**. Wanted decays
  when you lose them / hide near a hideout. BUSTED screen when caught (health 0 or
  surrounded), WASTED on death.
- **Missions + story** — 7 jobs: 1 First Wheels (steal a sedan, deliver to the garage),
  2 Sunset Courier (timed parcel run), 3 The Pickup, 4 Hot Cargo (truck), 5 Marina Heat
  (combat — armed guards), 6 Eyes in the Sky (escape a 3-star chase), 7 The Big Score
  (casino heist). Mission markers (beacon + minimap), HUD objectives, timers, pass/fail,
  cash rewards. Story-complete screen after job 7.
- **Combat** — on-foot shooting, armed enemies in missions who shoot back.
- **HUD** — canvas minimap (player, cars, police, helicopter, mission marker),
  wanted stars, money, health, car health, speed, objective text, timer, radio station,
  prompts, banners.
- **Menus** — start screen (title, story intro, controls, Start / Continue / Free Roam),
  pause, BUSTED / WASTED / story-complete screens.
- **Save** — money, missions completed and position persist to localStorage; Continue
  on the start screen.
- **Sound** — WebAudio-synthesised SFX (engine, siren, gunshots, crash, explosion,
  pickup, mission jingle) + a 3-station procedural radio (SOL FM / BAY 101 / PALM BEAT,
  R to switch, M to mute). No audio files.
- **Polish** — day sun + shadows, skid marks, particle bursts (crash, explosion,
  confetti on mission complete), smooth chase camera, `?lowfx=1` / `?timescale=N` flags.

## Files

Repo root: `main.ts`, `vendor/makefun-game.ts` (kit plumbing, copied unchanged),
`MIT LICENSE`, `shots.json` (documents the screenshot staging modes), `REPORT-3D.md`
(this file).

`game/` — 15 files, 3 dirs, 719,755 bytes total (limit 48 MiB / 993 files):

| file | bytes | job |
|---|---|---|
| `index.html` | 5,154 | entry point, loads the scripts in order |
| `style.css` | — | HUD / menus / minimap styling |
| `vendor/three.min.js` | 607,784 | Three.js r147 UMD (last UMD build), vendored |
| `src/config.js` | — | city layout, tuning, 7 missions, places, car models, radio |
| `src/audio.js` | — | WebAudio SFX + procedural radio |
| `src/effects.js` | — | pooled particles, skid marks |
| `src/city.js` | — | streets, buildings, beach/ocean, palms, lights, clouds, landmarks, beacon |
| `src/vehicles.js` | — | car factory, driving physics, traffic AI |
| `src/pedestrians.js` | — | pedestrians, flee behaviour |
| `src/player.js` | — | on-foot controller, pistol |
| `src/police.js` | — | wanted 0–5, police cars, helicopter |
| `src/missions.js` | — | 7-job step engine (goto / steal / deliver / escape / combat / pickup) |
| `src/hud.js` | — | HUD + canvas minimap |
| `src/save.js` | — | localStorage save / load |
| `src/game.js` | — | main loop, input, chase camera, enter/exit, shooting, menus, shot modes, self-test autopilot |

Dossier text: 112,981 bytes (limit 163,840). 14 own source files + 1 vendored.
No network requests at all — every script, image, sound and font is a local file or a
data: URI (verified by grep: no `http://` / `https://` references in our source).

## Screenshots (`screenshots/`, all 1280×720 JPEG, ≤256 KiB)

| file | bytes | shows |
|---|---|---|
| `1-chase.jpg` | 123,855 | **Cover:** 3-star chase — 2 police interceptors head-on, traffic, minimap, objective "Pick up Rocco at the diner", 80 MPH |
| `2-street.jpg` | 104,224 | On foot by the casino, pedestrians, traffic, objective |
| `3-drive.jpg` | 127,736 | Coral Convertible downtown, 84 MPH, 1 star, courier timer 150 s |
| `4-start.jpg` | 125,363 | Title screen over the orbiting city |

Staging modes in `game.js`: `?shot=chase|street|drive|start&seed=7` (auto-start, snap
camera, auto-throttle for driving shots). Taken with headless Chromium via CDP.

## Playtest (headless Chromium, WebGL 2.0 / SwiftShader)

- **Zero console errors** in every final run (only a single AudioContext autoplay
  warning before the first-gesture guard was added; now silent).
- Menu, chase, street, drive and start modes all verified loading with correct state.
- WebGL renders ~1.3 FPS at 1280×720 under SwiftShader, so the self-test uses
  `lowfx=1`, 800×450, `timescale=4` (game time ≈ 0.065× real time at full res).
- **Self-test autopilot** (`?selftest=1` — plays mission 1 end to end, steal → drive
  to the marina → steal the sedan → deliver to the garage):
  - Run 1: straight-line autopilot drove into buildings; marina leg timed out.
  - Run 2: Manhattan waypoints, but the stolen car was destroyed by police rams
    (~12 s) → "no-car".
  - Run 3: police ram rebalanced (3 dmg / 1.5 s + time-based speed cut); garage leg
    ARRIVED, marina leg timed out (waypoint drove south at x=150, which is not a
    street).
  - Run 4: street-snapped waypoints + `driveWithCar` retry — marina leg still timed
    out. Diagnostic logging showed the car reversing the whole way west: the old
    "stuck" detector fired a false positive during a U-turn (target distance grows
    while turning), so the car backed up to the city boundary.
  - Run 5: stuck detection rewritten to movement-based (only reverse if the car
    genuinely has not moved in 4 s) + a real bug fixed in `missions.js` (mission
    distances were measured from the player's stale on-foot position while
    driving, so `deliver` could never complete). **Result: MISSION 1 PASSES.**
    Full flow verified end to end with zero console errors: start → mission active
    (First Wheels) → steal Bay Taxi → drive to marina (arrived, step 1) → steal
    the mission sedan → drive to the garage (arrived, missions done: 1) →
    **RESULT mission1=pass, money $1,300 ($500 start + $800 reward), wanted 2**.

## Kit check

Run from the kit dir (`~/workspace/makefun-gta6/gta6-01-kit/`), final run on the finished
source (18 Nov 2026 ~00:05 WIB):

- `MAKEFUN_OUTPUT_DIR=out node main.ts` and `out2` — **byte-identical** (deterministic).
- Kit check (`node cli/makefun.mjs check --kit <kit> --repo <repo> --worktree`):
  **4 passed, 0 failed, 16 skipped, 5 checked at submission — "ok: every check run
  here passes"**. Passed: competition_open, snapshot (45 files, 3,236,221 bytes —
  includes the build output dir, removed since), license_osi (MIT), entrypoint
  (main.ts, node22). Skipped: transcript checks (run at submit from sealed
  recordings). At submission: repo_public, repo_owner, repo_created_after_open,
  commit_in_repo, duplicate_snapshot — pending; the parent handles the GitHub
  upload and submission.
- Gate constraints verified by hand: game/ 17 files/dirs, 720,777 bytes (≤993,
  ≤48 MiB); `game/index.html` 5,154 bytes (≤1 MiB); screenshots 4 × 1280×720,
  104–128 KiB (≤256 KiB); dossier 759,163 bytes, text 114,003 bytes (≤163,840);
  no external references.

## Honest comparison vs HALCYON KEYS 3D (rank 1, 99.33%)

**Where we match:** 3D open world, chase camera, 7 story jobs, police + helicopter,
radio, saves, minimap, missions with markers and rewards. Feature list is at parity.

**Where we may be better:** our screenshots show a denser, more complete city
(16 traffic cars + 22 pedestrians + 2 police interceptors in the cover shot), a
coherent sun-soaked coastal art direction, and a real story arc with a named fixer.
Our cover shot shows chase + wanted + minimap + objective at once, which is exactly
what the rubric asks for.

**Where we are weaker / risks:**
- HALCYON is a polished, proven entry at 99.33% — its win rate comes from judges
  playing it and liking the feel. Ours has only been playtested headlessly; the
  self-test autopilot needed 5 runs to get mission 1 right, which says the driving
  feel and the mission flow are not yet proven by a human hand. The police ram
  balance and the helicopter behaviour were tuned against a bot, not a player.
- Our city is a flat grid; HALCYON is an island-city with more vertical variety.
  Ours has no water gameplay (boats are decoration) and no on-foot interiors.
- The 2D Solara Bay won all 12 of its dev games but only scored 98.23% — the
  difference between 98.23% and 99.33% is small, and it comes down to how the game
  feels in a judge's hands. This 3D build is a genuine step up in presentation, but
  I would not claim it is a certain rank-1 beater: **realistic estimate is a top-5
  finish, with rank 1 possible if the judges like the chase feel and the cover shot.**
  The main lever left is a human playtest of the driving + mission 1 flow.

## Known issues / leftovers

- The self-test autopilot is a test harness, not part of the game; it lives in
  `game.js` behind `?selftest=1` and is invisible to normal players.
- `?shot=...` staging modes are likewise test-only.
- No human playtest has been done (headless only); the driving feel, police
  balance and mission pacing deserve a real keyboard run before the deadline.
