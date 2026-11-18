/* SOLMAR BAY — game: the main loop, input, chase camera, car stealing,
   shooting, crimes, busted/wasted, menus and the screenshot staging modes.
   Wires every system together. */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const SEED = parseInt(params.get('seed') || '7', 10) || 7;
  const SHOT = params.get('shot') || '';
  const SELFTEST = params.get('selftest') === '1';
  const LOWFX = params.get('lowfx') === '1'; // faster headless rendering: no shadows
  // Time scale for headless self-tests (SwiftShader renders ~1 FPS, so the
  // game clock would otherwise crawl); 1 in normal play.
  const TIMESCALE = Math.max(1, Math.min(8, parseFloat(params.get('timescale') || '1') || 1));

  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(LOWFX ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !LOWFX;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 60, 120);

  const city = SB.City.build(scene, SEED);
  const colliders = city.colliders;
  const effects = new SB.Effects(scene);
  const audio = new SB.AudioEngine();
  const hud = new SB.Hud();
  const rng = SB.rng(SEED * 13 + 5);

  const player = new SB.Player(scene, SB.PLACES.garage.x + 6, SB.PLACES.garage.z + 4);
  const police = new SB.Police(scene);
  const trafficCars = SB.Vehicles.spawnTraffic(scene, rng, colliders, SB.CFG.trafficCount);
  const parkedCars = SB.Vehicles.spawnParked(scene, rng, 8);
  const peds = SB.Pedestrians.spawn(scene, rng, colliders, SB.CFG.pedCount);
  const allCars = trafficCars.concat(parkedCars);

  // ---- Game state ----
  const G = {
    state: 'menu', // menu | playing | paused | busted | wasted | complete
    money: SB.CFG.startMoney,
    time: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    camDist: 8,
    dragFreeze: 0,
    lastDamageAt: -100,
    shotCrimeAt: -100,
    menuOrbit: 0,
    storyDone: false,
    freeRoam: false,
  };

  const input = { forward: false, back: false, left: false, right: false, run: false };

  // ---- Missions ----
  const missionCtx = {
    scene: scene, player: player, police: police, effects: effects, audio: audio, city: city,
    cars: allCars,
    playerCar: function () { return player.inCar; },
    addMoney: function (n) { G.money += n; },
    setObjective: function (t) { hud.setObjective(t); },
    setTimer: function (s) { hud.setTimer(s); },
    banner: function (t, s) { hud.banner(t, s); },
    save: function () { saveNow(); },
    onStoryComplete: function () { storyComplete(); },
    enemyShoot: function (fromPos, dist) {
      // Enemy fire: hit chance falls with distance; tracer spark near the player.
      const hitChance = Math.max(0.06, 0.3 - dist * 0.006);
      if (Math.random() < hitChance) damagePlayer(6 + Math.random() * 6);
      effects.sparks(player.position().clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2)));
      audio.shoot();
    },
  };
  const missions = new SB.Missions.MissionManager(missionCtx);

  // ---- Save / load ----
  function saveNow() {
    SB.Save.save({
      money: G.money, missionsDone: missions.nextIndex,
      px: player.position().x, pz: player.position().z,
      storyDone: G.storyDone,
    });
  }
  function applySave(d) {
    G.money = d.money;
    missions.nextIndex = Math.min(d.missionsDone, SB.MISSIONS.length);
    player.position().x = d.px; player.position().z = d.pz;
    G.storyDone = !!d.storyDone;
  }
  const saved = SB.Save.load();
  if (saved) {
    document.getElementById('btn-continue').classList.remove('hidden');
    document.getElementById('continue-info').textContent =
      '$' + saved.money.toLocaleString() + ' · ' + saved.missionsDone + '/7 jobs done';
  }
  window.addEventListener('beforeunload', function () { if (G.state === 'playing') saveNow(); });

  // ---- Screens ----
  const screens = ['menu', 'pause', 'busted', 'wasted', 'complete'];
  function showScreen(id) {
    for (const s of screens) document.getElementById(s).classList.toggle('hidden', s !== id);
    if (!id) for (const s of screens) document.getElementById(s).classList.add('hidden');
  }
  function startGame(freeRoam, useSave) {
    if (useSave && saved) applySave(saved);
    G.freeRoam = !!freeRoam;
    G.state = 'playing';
    showScreen(null);
    hud.show();
    audio.click();
    if (missions.availableMission() && !missions.active) {
      city.setMarker(SB.PLACES.garage);
      hud.setObjective('Go to Mama Lu\'s garage (yellow L marker) — press E to start the next job');
    } else if (!missions.availableMission()) {
      hud.setObjective('Story complete — free roam Solmar Bay!');
    }
    hud.banner(freeRoam ? 'FREE ROAM' : 'SOLMAR BAY', freeRoam
      ? 'The whole city is yours. Jobs wait at Mama Lu\'s garage.'
      : 'Kai Reyes is in town. Make a name.');
  }
  function pauseGame() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    document.getElementById('pause-stats').textContent =
      'Money $' + Math.floor(G.money).toLocaleString() + ' · Jobs done ' + missions.nextIndex + '/7 · Wanted ' + police.wanted + '★';
    showScreen('pause');
  }
  function resumeGame() {
    if (G.state !== 'paused') return;
    G.state = 'playing';
    showScreen(null);
    audio.click();
  }
  function quitToMenu() {
    saveNow();
    G.state = 'menu';
    police.clearWanted();
    showScreen('menu');
    hud.hide();
  }
  function busted() {
    if (G.state !== 'playing') return;
    G.state = 'busted';
    audio.busted();
    police.clearWanted();
    missions.failMission('Busted by the Solmar Bay PD.');
    showScreen('busted');
  }
  function wasted() {
    if (G.state !== 'playing') return;
    G.state = 'wasted';
    audio.busted();
    police.clearWanted();
    missions.failMission('You went down in Solmar Bay.');
    showScreen('wasted');
  }
  function respawn() {
    G.money = Math.max(0, Math.floor(G.money * 0.9));
    player.health = SB.CFG.player.health;
    if (player.inCar) { player.inCar = null; }
    player.position().set(SB.PLACES.safehouse.x, 0, SB.PLACES.safehouse.z);
    player.mesh.rotation.y = 0;
    G.camYaw = Math.PI;
    saveNow();
    G.state = 'playing';
    showScreen(null);
    hud.banner('BACK ON THE STREET', 'The PD took 10% of your cash. Mama Lu still has work.');
  }
  function storyComplete() {
    G.storyDone = true;
    G.state = 'complete';
    document.getElementById('complete-text').textContent =
      'Seven jobs, one legend. Kai Reyes went from a busted car to the biggest score in Solmar Bay history — $' +
      Math.floor(G.money).toLocaleString() + ' in the pocket and the whole city talking. Mama Lu is proud. The Bay is yours.';
    showScreen('complete');
    saveNow();
  }
  function damagePlayer(n) {
    player.health -= n;
    G.lastDamageAt = G.time;
    if (player.health <= 0) wasted();
  }

  // ---- Buttons ----
  document.getElementById('btn-start').addEventListener('click', function () { startGame(false, false); });
  document.getElementById('btn-continue').addEventListener('click', function () { startGame(false, true); });
  document.getElementById('btn-free').addEventListener('click', function () { startGame(true, false); });
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-restart').addEventListener('click', function () {
    SB.Save.clear(); missions.nextIndex = 0; G.money = SB.CFG.startMoney;
    player.position().set(SB.PLACES.garage.x + 6, 0, SB.PLACES.garage.z + 4);
    player.health = SB.CFG.player.health;
    startGame(false, false);
  });
  document.getElementById('btn-quit').addEventListener('click', quitToMenu);
  document.getElementById('btn-busted').addEventListener('click', respawn);
  document.getElementById('btn-wasted').addEventListener('click', respawn);
  document.getElementById('btn-complete').addEventListener('click', function () {
    G.state = 'playing'; showScreen(null);
  });
  document.getElementById('btn-complete-menu').addEventListener('click', quitToMenu);

  // Audio starts on the first real user gesture (a click or keypress), never
  // before — creating an AudioContext earlier only logs autoplay warnings.
  window.addEventListener('pointerdown', function () { audio.init(); }, { once: true });
  window.addEventListener('keydown', function () { audio.init(); }, { once: true });

  // ---- Input ----
  const KEYMAP = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  window.addEventListener('keydown', function (e) {
    if (KEYMAP[e.code] !== undefined) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
    if (e.code === 'KeyM') { audio.setMuted(!audio.muted); }
    if (e.code === 'KeyR' && G.state === 'playing') {
      hud.el.radio.textContent = audio.nextStation();
      audio.click();
    }
    if ((e.code === 'KeyP' || e.code === 'Escape')) {
      if (G.state === 'playing') pauseGame();
      else if (G.state === 'paused') resumeGame();
    }
    if (e.code === 'KeyE' && G.state === 'playing') interact();
  });
  window.addEventListener('keyup', function (e) {
    if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
  });

  // Mouse: drag orbits the camera; a click (no drag) shoots on foot.
  let dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
    audio.init();
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    G.camYaw -= dx * 0.005;
    G.camPitch = Math.max(0.08, Math.min(1.1, G.camPitch + dy * 0.004));
    G.dragFreeze = 2;
  });
  window.addEventListener('pointerup', function () {
    if (dragging && dragMoved < 6 && G.state === 'playing' && !player.inCar) shoot();
    dragging = false;
  });
  canvas.addEventListener('wheel', function (e) {
    G.camDist = Math.max(4.5, Math.min(16, G.camDist + Math.sign(e.deltaY) * 1.2));
    e.preventDefault();
  }, { passive: false });

  // ---- Interact: enter / steal a car, exit a car, start a mission ----
  function nearestCar(pos, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of allCars) {
      if (c.dead || c.isPolice) continue;
      const d = c.mesh.position.distanceTo(pos);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  function enterCar(car) {
    player.inCar = car;
    car.speed = 0;
    player.mesh.visible = false;
    const idx = trafficCars.indexOf(car);
    if (idx >= 0) trafficCars.splice(idx, 1); // stolen from traffic
    G.camDist = 8.5;
    audio.click();
  }
  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    const side = new THREE.Vector3(Math.cos(car.mesh.rotation.y), 0, -Math.sin(car.mesh.rotation.y));
    player.position().set(car.mesh.position.x + side.x * 3, 0, car.mesh.position.z + side.z * 3);
    player.mesh.visible = true;
    player.inCar = null;
    car.speed = 0;
    G.camDist = 8;
    audio.click();
  }
  function interact() {
    if (player.inCar) { exitCar(); return; }
    // Start a mission at the garage.
    if (!missions.active && missions.availableMission()) {
      const g = SB.PLACES.garage;
      if (Math.hypot(player.position().x - g.x, player.position().z - g.z) < 9) {
        missions.startMission();
        return;
      }
    }
    const car = nearestCar(player.position(), 4.5);
    if (car) {
      enterCar(car);
      police.addWanted(1, G.time); // grand theft auto is a crime
      hud.banner('CAR STOLEN', car.model.name + ' — the PD has been called (1★)');
    }
  }

  // ---- Shooting ----
  function shoot() {
    const targets = [];
    for (const e of missions.enemies) targets.push(e.mesh);
    for (const p of peds) if (!p.dead) targets.push(p.mesh);
    for (const c of police.cars) targets.push(c.mesh);
    const muzzle = player.position().clone().add(new THREE.Vector3(0, 1.3, 0));
    const fired = player.shoot(camera, targets, function (hit) {
      // Walk up to the owner object.
      let o = hit.object, owner = null;
      while (o) { if (o.userData && o.userData.owner) { owner = o.userData.owner; break; } o = o.parent; }
      if (owner && owner instanceof SB.Missions.Enemy) {
        owner.health -= 34;
        effects.blood(hit.point);
        if (owner.health <= 0) {
          missions.registerKill(owner);
          hud.banner('GUARD DOWN', missions.active ? (missions.active.kills + '/' + missions.active.mission.steps[missions.active.stepIndex].count + ' guards down') : '');
        }
      } else if (owner && owner.health !== undefined && owner.mesh) {
        // Police car hit.
        owner.health -= 22;
        effects.sparks(hit.point);
        police.addWanted(2, G.time);
      } else if (owner) {
        // Pedestrian hit: they go down, and it is a crime.
        owner.dead = true;
        owner.mesh.visible = false;
        effects.blood(hit.point);
        police.addWanted(1, G.time);
      }
    });
    if (fired) {
      effects.muzzle(muzzle);
      audio.shoot();
      if (G.time - G.shotCrimeAt > 10) {
        G.shotCrimeAt = G.time;
        police.addWanted(1, G.time); // shots fired in public
      }
    }
  }

  // Tag owners for hit detection (enemy and ped meshes).
  function tagOwners() {
    for (const e of missions.enemies) e.mesh.userData.owner = e;
    for (const p of peds) p.mesh.userData.owner = p;
    for (const c of police.cars) c.mesh.userData.owner = c;
  }

  // ---- Camera ----
  function updateCamera(dt) {
    const target = player.inCar ? player.inCar.mesh.position : player.position();
    const ty = player.inCar ? 2.4 : 1.8;
    G.dragFreeze -= dt;
    // Auto-follow: ease the camera behind the direction of travel.
    // (Camera offset is (sin yaw, cos yaw), so yaw == facing angle puts the
    // camera behind the player/car, looking along their forward.)
    if (G.dragFreeze <= 0 && G.state === 'playing') {
      let wantYaw;
      if (player.inCar) wantYaw = player.inCar.mesh.rotation.y;
      else if (player.speed > 0.5) wantYaw = player.angle;
      if (wantYaw !== undefined) {
        let diff = wantYaw - G.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        G.camYaw += diff * Math.min(1, dt * (player.inCar ? 2.2 : 0.8));
      }
    }
    const dist = G.camDist;
    const cp = Math.cos(G.camPitch), sp = Math.sin(G.camPitch);
    const cx = target.x + Math.sin(G.camYaw) * cp * dist;
    const cz = target.z + Math.cos(G.camYaw) * cp * dist;
    const cy = ty + sp * dist;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 8);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 8);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 8);
    camera.lookAt(target.x, ty, target.z);
  }

  // ---- Main update ----
  const clock = new THREE.Clock();
  function update(dt) {
    G.time += dt;
    city.update(dt, player.position());
    effects.update(dt);
    tagOwners();

    if (G.state === 'menu') {
      // Slow orbit over the city behind the title screen.
      G.menuOrbit += dt * 0.05;
      camera.position.set(Math.sin(G.menuOrbit) * 180, 70, Math.cos(G.menuOrbit) * 180);
      camera.lookAt(0, 10, 0);
      for (const c of trafficCars) c.trafficDrive(dt, colliders, allCars);
      for (const p of peds) p.update(dt, colliders, null);
      return;
    }
    if (G.state !== 'playing') return;

    // Health regen.
    if (G.time - G.lastDamageAt > 5 && player.health < SB.CFG.player.health) {
      player.health = Math.min(SB.CFG.player.health, player.health + 3 * dt);
    }

    // Player: drive or walk.
    if (player.inCar) {
      const car = player.inCar;
      const throttle = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      car.onCrash = function (spd) { audio.crash(); effects.sparks(car.mesh.position); damagePlayer(0); };
      car.onSkid = function (x, z, a) { effects.addSkid(x, z, a); };
      car.drive(throttle, steer, dt, colliders, allCars);
      // Running over pedestrians is a crime.
      for (const p of peds) {
        if (!p.dead && p.mesh.position.distanceTo(car.mesh.position) < 2.6) {
          p.dead = true; p.mesh.visible = false;
          effects.blood(p.mesh.position);
          police.addWanted(1, G.time);
          hud.banner('PEDESTRIAN DOWN', 'The PD has been called (1★)');
        }
      }
      // Car destroyed.
      if (car.health <= 0) {
        effects.explosion(car.mesh.position);
        audio.explosion();
        car.dead = true;
        scene.remove(car.mesh);
        const idx = allCars.indexOf(car);
        if (idx >= 0) allCars.splice(idx, 1);
        player.inCar = null;
        player.mesh.visible = true;
        player.position().set(car.mesh.position.x + 3, 0, car.mesh.position.z);
        damagePlayer(25);
        hud.banner('CAR DESTROYED', 'You got out just in time.');
      }
      audio.setEngine(Math.abs(car.speed) / (car.model.topSpeed || 38), true);
    } else {
      player.aiming = true;
      player.updateOnFoot(dt, input, G.camYaw, colliders, allCars);
      audio.setEngine(0, false);
    }

    // Traffic and pedestrians.
    for (const c of trafficCars) c.trafficDrive(dt, colliders, allCars);
    for (const p of peds) {
      const danger = player.inCar ? { x: player.inCar.mesh.position.x, z: player.inCar.mesh.position.z } : null;
      p.update(dt, colliders, danger);
    }

    // Police and missions.
    police.update(dt, player, player.inCar, colliders, allCars, effects, audio, busted);
    missions.update(dt);

    // Mission start prompt at the garage.
    if (!missions.active && missions.availableMission()) {
      const g = SB.PLACES.garage;
      if (Math.hypot(player.position().x - g.x, player.position().z - g.z) < 9) {
        hud.setPrompt('Press E — start job: ' + missions.availableMission().name + ' ($' + missions.availableMission().reward + ')');
      } else {
        hud.setPrompt('');
      }
    } else if (!missions.active) {
      hud.setPrompt('');
    } else {
      const car = nearestCar(player.position(), 4.5);
      hud.setPrompt(car && !player.inCar ? 'Press E — steal ' + car.model.name : (player.inCar ? '' : ''));
    }
    hud.setCrosshair(!player.inCar);
    hud.update({
      wanted: police.wanted,
      money: G.money,
      radio: audio.stationName(),
      health: player.health,
      inCar: !!player.inCar,
      carHealth: player.inCar ? player.inCar.health : 0,
      speed: player.inCar ? player.inCar.speed : 0,
      carName: player.inCar ? player.inCar.model.name : '',
      marker: currentMarker(),
      traffic: trafficCars,
      policeCars: police.cars,
      heli: police.heli,
      playerX: player.position().x,
      playerZ: player.position().z,
      playerAngle: player.inCar ? player.inCar.mesh.rotation.y : player.angle,
      time: G.time,
    });
  }

  function currentMarker() {
    // The beacon position is the mission marker; read it from the city object.
    return city.markerPos || null;
  }

  // Expose the marker position for the minimap.
  const origSetMarker = city.setMarker;
  city.markerPos = null;
  city.setMarker = function (pos) {
    city.markerPos = pos ? { x: pos.x, z: pos.z } : null;
    origSetMarker(pos);
  };

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta()) * TIMESCALE;
    update(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Snap the camera straight to the chase position (no slow lerp-in), so the
  // first frame of a staged shot is already composed.
  function snapCamera() {
    const target = player.inCar ? player.inCar.mesh.position : player.position();
    const ty = player.inCar ? 2.4 : 1.8;
    const cp = Math.cos(G.camPitch), sp = Math.sin(G.camPitch);
    camera.position.set(
      target.x + Math.sin(G.camYaw) * cp * G.camDist,
      ty + sp * G.camDist,
      target.z + Math.cos(G.camYaw) * cp * G.camDist);
    camera.lookAt(target.x, ty, target.z);
  }

  // ---- Screenshot staging modes (?shot=) ----
  function stageShot(mode) {
    startGame(true, false);
    const g = SB.PLACES.garage;
    if (mode === 'start') { G.state = 'menu'; showScreen('menu'); hud.hide(); return; }
    if (mode === 'chase') {
      // Player in a fast car downtown, 3 stars, police + helicopter on the tail.
      const car = new SB.Vehicles.Car(scene, SB.CAR_MODELS[1], 0, -60, Math.PI, false);
      allCars.push(car);
      enterCar(car);
      car.speed = 26;
      player.position().set(0, 0, -60);
      police.addWanted(3, G.time);
      // Two interceptors head-on ahead of the player, closing in.
      const pc1 = new SB.Vehicles.Car(scene, { name: 'PD Interceptor', color: 0x111111, topSpeed: 40 }, 0, -10, 0, true);
      const pc2 = new SB.Vehicles.Car(scene, { name: 'PD Interceptor', color: 0x111111, topSpeed: 40 }, -6, 5, 0, true);
      police.cars.push(pc1, pc2);
      missions.nextIndex = 2; // show the getaway job as the objective
      missions.startMission();
      // Extra traffic ahead for a busy chase frame.
      for (let i = 0; i < 4; i++) {
        const t = new SB.Vehicles.Car(scene, SB.CAR_MODELS[i % SB.CAR_MODELS.length], (i - 1.5) * 8, -20 + i * 14, Math.PI, false);
        t.speed = 10;
        trafficCars.push(t); allCars.push(t);
      }
      G.camYaw = Math.PI; // behind the car (it faces +z, rotation.y = PI)
      input.forward = true; // keep the getaway rolling for the shot
      snapCamera();
      return;
    }
    if (mode === 'street') {
      // On foot on a busy downtown sidewalk by the casino: traffic, pedestrians,
      // palms and towers in frame, first job offered.
      player.position().set(52, 0, 68);
      player.angle = -Math.PI / 2; // facing east, down the street toward the casino
      const srng = SB.rng(SEED * 31 + 2);
      for (const [px, pz] of [[58, 66], [64, 70], [46, 66], [70, 66], [40, 70]]) {
        const ped = new SB.Pedestrians.Pedestrian(scene, px, pz, srng);
        peds.push(ped);
      }
      missions.nextIndex = 0;
      hud.setObjective('Go to Mama Lu\'s garage (yellow L marker) — press E to start the next job');
      city.setMarker(SB.PLACES.garage);
      G.camYaw = -Math.PI / 2;
      G.camPitch = 0.24;
      snapCamera();
      return;
    }
    if (mode === 'drive') {
      const car = new SB.Vehicles.Car(scene, SB.CAR_MODELS[5], -120, 0, -Math.PI / 2, false);
      allCars.push(car);
      enterCar(car);
      car.speed = 30;
      police.addWanted(1, G.time);
      missions.nextIndex = 1;
      missions.startMission();
      G.camYaw = -Math.PI / 2; // behind the car (it faces +x, rotation.y = -PI/2)
      input.forward = true;
      snapCamera();
      return;
    }
  }

  // ---- Self-test autopilot (?selftest=1): plays mission 1 end to end ----
  async function selftest() {
    const log = function (m) { console.log('[SELFTEST] ' + m); window.__selftestLog = (window.__selftestLog || '') + m + '\n'; };
    const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    const result = { mission1: 'not-run', errors: [] };
    window.__selftest = result;
    window.addEventListener('error', function (e) { result.errors.push(String(e.message)); });
    try {
      startGame(false, false);
      log('game started, state=' + G.state);
      // Walk/drive to the garage and start mission 1.
      player.position().set(SB.PLACES.garage.x + 3, 0, SB.PLACES.garage.z + 3);
      await sleep(300);
      interact();
      await sleep(300);
      log('mission active: ' + (missions.active ? missions.active.mission.name : 'NONE'));
      if (!missions.active) throw new Error('mission 1 did not start');
      // Autopilot: drive the street grid (Manhattan route) to a target.
      // Every leg snaps to a street so the car follows roads, not buildings;
      // the last leg is the short off-road approach to the marker itself.
      const driveTo = async function (tx, tz, arriveDist, timeoutMs) {
        const t0 = Date.now();
        const snap = (v) => Math.round(v / 60) * 60;
        const car0 = player.inCar;
        if (!car0) return 'no-car';
        const sx = car0.mesh.position.x, sz = car0.mesh.position.z;
        const txS = snap(tx), tzS = snap(tz);
        const onVertical = Math.abs(sx - snap(sx)) <= Math.abs(sz - snap(sz));
        const waypoints = onVertical
          ? [{ x: snap(sx), z: tzS }, { x: txS, z: tzS }, { x: tx, z: tz }]
          : [{ x: txS, z: snap(sz) }, { x: txS, z: tzS }, { x: tx, z: tz }];
        let wi = 0;
        // Skip any waypoint the car is already at.
        while (wi < waypoints.length - 1 &&
               Math.hypot(waypoints[wi].x - sx, waypoints[wi].z - sz) < 8) wi++;
        let lastPos = { x: car0.mesh.position.x, z: car0.mesh.position.z };
        let lastMoveAt = Date.now();
        let reversingUntil = 0;
        let lastLogAt = 0;
        while (Date.now() - t0 < timeoutMs) {
          const car = player.inCar;
          if (!car) return 'no-car';
          const wp = waypoints[wi];
          const dx = wp.x - car.mesh.position.x, dz = wp.z - car.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 8 && wi < waypoints.length - 1) { wi++; continue; }
          const total = Math.hypot(tx - car.mesh.position.x, tz - car.mesh.position.z);
          if (total < arriveDist) return 'arrived';
          if (Date.now() - lastLogAt > 10000) {
            lastLogAt = Date.now();
            log('driveTo: wp' + wi + '/' + (waypoints.length - 1) + ' car=(' +
              Math.round(car.mesh.position.x) + ',' + Math.round(car.mesh.position.z) +
              ') speed=' + Math.round(car.speed) + ' total=' + Math.round(total));
          }
          // Stuck means the car genuinely has not moved, not that the target
          // distance grew while it turns around: a U-turn looks like that.
          const moved = Math.hypot(car.mesh.position.x - lastPos.x, car.mesh.position.z - lastPos.z);
          if (moved > 3) { lastPos = { x: car.mesh.position.x, z: car.mesh.position.z }; lastMoveAt = Date.now(); }
          if (Date.now() - lastMoveAt > 4000) reversingUntil = Date.now() + 1500;
          const reversing = Date.now() < reversingUntil;
          const want = Math.atan2(-dx, -dz);
          let diff = want - car.mesh.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          input.forward = !reversing;
          input.back = reversing;
          input.left = diff > 0.12 ? true : false;
          input.right = diff < -0.12 ? true : false;
          await sleep(120);
        }
        return 'timeout';
      };
      // Steal the nearest parked car first (retry if the car is lost).
      async function stealNearestCar() {
        for (let attempt = 0; attempt < 3; attempt++) {
          const near = nearestCar(player.position(), 60) || parkedCars[0];
          if (!near) return false;
          player.position().set(near.mesh.position.x + 2, 0, near.mesh.position.z);
          await sleep(300);
          interact();
          await sleep(300);
          if (player.inCar) return true;
        }
        return false;
      }
      // Drive somewhere, re-stealing a car if the current one is lost.
      async function driveWithCar(tx, tz, arriveDist, timeoutMs) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!player.inCar && !(await stealNearestCar())) return 'no-car';
          const r = await driveTo(tx, tz, arriveDist, timeoutMs);
          if (r === 'arrived') return r;
          if (r === 'no-car') continue;
          return r;
        }
        return 'timeout';
      }
      if (!(await stealNearestCar())) throw new Error('could not enter a car');
      log('in car: ' + (player.inCar ? player.inCar.model.name : 'NO'));
      // Step 1: goto the marina.
      let r = await driveWithCar(SB.PLACES.marina.x, SB.PLACES.marina.z, 10, 150000);
      log('drive to marina: ' + r + ' (step now ' + (missions.active ? missions.active.stepIndex : 'done') + ')');
      await sleep(500);
      // Step 2: steal the mission sedan.
      if (missions.active && missions.active.stepIndex === 1) {
        const target = missions.active.targetCar;
        exitCar();
        await sleep(200);
        player.position().set(target.mesh.position.x + 2, 0, target.mesh.position.z);
        await sleep(200);
        interact();
        await sleep(300);
        log('stole mission sedan: ' + (player.inCar === target));
        if (player.inCar !== target) throw new Error('could not steal the mission sedan');
      }
      // Step 3: deliver to the garage.
      r = await driveWithCar(SB.PLACES.garage.x, SB.PLACES.garage.z, 12, 150000);
      log('drive to garage: ' + r + ' (missions done: ' + missions.nextIndex + ')');
      await sleep(800);
      input.forward = false; input.back = false; input.left = false; input.right = false;
      result.mission1 = missions.nextIndex >= 1 ? 'pass' : 'fail';
      result.money = Math.floor(G.money);
      result.wanted = police.wanted;
      log('RESULT mission1=' + result.mission1 + ' money=' + result.money + ' wanted=' + result.wanted);
    } catch (e) {
      result.mission1 = 'error: ' + e.message;
      log('ERROR ' + e.message);
    }
    window.__selftest = result;
  }

  // ---- Debug handle for headless playtests ----
  window.SOLMAR = {
    G: G, player: player, police: police, missions: missions,
    cars: allCars, traffic: trafficCars, peds: peds,
    input: input, startGame: startGame, interact: interact,
    stageShot: stageShot, hud: hud, audio: audio,
  };

  animate();
  if (SHOT) stageShot(SHOT);
  if (SELFTEST) setTimeout(selftest, 800);
})();
