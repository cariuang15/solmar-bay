/* SOLMAR BAY — missions: seven story jobs for Kai Reyes, from Mama Lu.
   A small step engine: goto, steal, deliver, escape, combat and pickup steps,
   with timers, rewards, armed guards and a story-complete ending. */
(function () {
  'use strict';

  function makeEnemyMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x8e2f26 }));
    body.position.y = 1.0; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38),
      new THREE.MeshLambertMaterial({ color: 0xd8a070 }));
    head.position.y = 1.66;
    g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x181818 }));
    gun.position.set(0.36, 1.05, -0.3); // front is local -z
    g.add(gun);
    return g;
  }

  function Enemy(scene, x, z) {
    this.mesh = makeEnemyMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.health = 100;
    this.shootTimer = 1 + Math.random();
    this.dead = false;
  }

  Enemy.prototype.update = function (dt, playerPos, ctx) {
    if (this.dead) return;
    const p = this.mesh.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const dist = Math.hypot(dx, dz);
    this.mesh.rotation.y = Math.atan2(-dx, -dz);
    if (dist < 34 && dist > 2) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 1.1 + Math.random() * 0.7;
        ctx.enemyShoot(p, dist);
      }
    }
  };

  function MissionManager(ctx) {
    this.ctx = ctx;
    this.nextIndex = 0;      // next mission to offer (0-based)
    this.active = null;      // { mission, stepIndex, timer, targetCar, enemies, item }
    this.enemies = [];
    this.itemMesh = null;
    this.time = 0;
  }

  MissionManager.prototype.availableMission = function () {
    return this.nextIndex < SB.MISSIONS.length ? SB.MISSIONS[this.nextIndex] : null;
  };

  MissionManager.prototype.startMission = function () {
    const m = this.availableMission();
    if (!m || this.active) return false;
    this.active = { mission: m, stepIndex: 0, timer: m.timeLimit || 0, targetCar: null, kills: 0 };
    this.ctx.banner('MISSION: ' + m.name, m.giver + ' — ' + m.briefing);
    this.ctx.audio.missionOk();
    this.beginStep();
    return true;
  };

  MissionManager.prototype.beginStep = function () {
    const a = this.active;
    const step = a.mission.steps[a.stepIndex];
    const ctx = this.ctx;
    ctx.setTimer(a.mission.timeLimit && a.stepIndex === 0 ? a.mission.timeLimit : 0);
    ctx.setObjective(step.text);
    if (step.type === 'goto' || step.type === 'deliver' || step.type === 'escape') {
      const pl = SB.PLACES[step.place];
      ctx.city.setMarker(pl);
    } else if (step.type === 'steal') {
      const pl = SB.PLACES.marina;
      const car = new SB.Vehicles.Car(ctx.scene, SB.CAR_MODELS[1],
        pl.x + 12, pl.z - 6, Math.PI / 2, false);
      ctx.cars.push(car);
      a.targetCar = car;
      ctx.city.setMarker({ x: car.mesh.position.x, z: car.mesh.position.z });
    } else if (step.type === 'stealTruck') {
      const pl = SB.PLACES.docks;
      const car = new SB.Vehicles.Car(ctx.scene, SB.TRUCK_MODEL, pl.x + 10, pl.z - 10, 0, false);
      car.mesh.scale.set(1.15, 1.3, 1.5);
      ctx.cars.push(car);
      a.targetCar = car;
      ctx.city.setMarker({ x: car.mesh.position.x, z: car.mesh.position.z });
    } else if (step.type === 'combat') {
      const pl = SB.PLACES[step.place];
      for (let i = 0; i < step.count; i++) {
        const e = new Enemy(ctx.scene, pl.x + (Math.random() - 0.5) * 36, pl.z + (Math.random() - 0.5) * 36);
        this.enemies.push(e);
      }
      ctx.city.setMarker(pl);
    } else if (step.type === 'pickup') {
      const pl = SB.PLACES[step.place];
      const item = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 1),
        new THREE.MeshBasicMaterial({ color: 0xffd75e }));
      item.position.set(pl.x, 1, pl.z);
      ctx.scene.add(item);
      this.itemMesh = item;
      ctx.city.setMarker(pl);
    }
    if (step.type === 'escape') {
      ctx.police.addWanted(step.wanted, this.time);
      if (step.heli) ctx.police.addWanted(0, this.time); // helicopter comes with 3+ stars
    }
  };

  MissionManager.prototype.completeStep = function () {
    const a = this.active;
    a.stepIndex++;
    this.ctx.audio.pickup();
    if (a.stepIndex >= a.mission.steps.length) this.completeMission();
    else this.beginStep();
  };

  MissionManager.prototype.completeMission = function () {
    const a = this.active;
    const m = a.mission;
    this.ctx.addMoney(m.reward);
    this.ctx.banner('MISSION COMPLETE', m.name + ' — $' + m.reward.toLocaleString());
    this.ctx.audio.missionOk();
    this.ctx.effects.confetti(this.ctx.player.position().clone().add(new THREE.Vector3(0, 3, 0)));
    this.nextIndex++;
    this.active = null;
    this.clearMissionObjects();
    this.ctx.setObjective(this.availableMission()
      ? 'Next job: go to Mama Lu\'s garage (yellow L marker)'
      : 'Story complete — free roam Solmar Bay!');
    this.ctx.setTimer(0);
    this.ctx.city.setMarker(this.availableMission() ? SB.PLACES.garage : null);
    this.ctx.save();
    if (this.nextIndex >= SB.MISSIONS.length) this.ctx.onStoryComplete();
  };

  MissionManager.prototype.failMission = function (reason) {
    if (!this.active) return;
    this.ctx.banner('MISSION FAILED', reason);
    this.active = null;
    this.clearMissionObjects();
    this.ctx.setObjective('Go to Mama Lu\'s garage to retry the job');
    this.ctx.setTimer(0);
    this.ctx.city.setMarker(SB.PLACES.garage);
  };

  MissionManager.prototype.clearMissionObjects = function () {
    for (const e of this.enemies) this.ctx.scene.remove(e.mesh);
    this.enemies = [];
    if (this.itemMesh) { this.ctx.scene.remove(this.itemMesh); this.itemMesh = null; }
  };

  MissionManager.prototype.abort = function () { this.failMission('Job aborted'); };

  MissionManager.prototype.update = function (dt) {
    this.time += dt;
    const a = this.active;
    const ctx = this.ctx;
    // Distance is measured from the car when driving: the player mesh stays
    // where the player got in, so it goes stale behind the wheel.
    const car = ctx.playerCar();
    const p = car ? car.mesh.position : ctx.player.position();
    // Timer (courier job).
    if (a && a.timer > 0) {
      a.timer -= dt;
      ctx.setTimer(Math.max(0, a.timer));
      if (a.timer <= 0) { this.failMission('Out of time — the parcels went cold.'); return; }
    }
    // Enemies shoot and track.
    for (const e of this.enemies) e.update(dt, p, ctx);
    if (this.itemMesh) this.itemMesh.rotation.y += dt * 2;
    if (!a) return;
    const step = a.mission.steps[a.stepIndex];
    const distTo = (pl) => Math.hypot(p.x - pl.x, p.z - pl.z);
    if (step.type === 'goto') {
      if (distTo(SB.PLACES[step.place]) < 9) this.completeStep();
    } else if (step.type === 'steal' || step.type === 'stealTruck') {
      if (ctx.player.inCar === a.targetCar) {
        ctx.banner('GOT IT', step.type === 'stealTruck' ? 'The truck is yours. Drive it out.' : 'The sedan is yours. Drive it out.');
        this.completeStep();
      }
    } else if (step.type === 'deliver') {
      if (car === a.targetCar && distTo(SB.PLACES[step.place]) < 12) this.completeStep();
      else if (car && car !== a.targetCar) ctx.setObjective(step.text + ' — get back in the marked vehicle!');
    } else if (step.type === 'combat') {
      if (a.kills >= step.count) this.completeStep();
    } else if (step.type === 'pickup') {
      if (this.itemMesh && distTo(SB.PLACES[step.place]) < 3.5) {
        ctx.scene.remove(this.itemMesh);
        this.itemMesh = null;
        ctx.audio.pickup();
        this.completeStep();
      }
    } else if (step.type === 'escape') {
      const pl = SB.PLACES[step.place];
      // Near the destination the heat gives up faster: the back streets hide you.
      if (distTo(pl) < 30) ctx.police.nearHideout = true;
      if (ctx.police.wanted === 0 && distTo(pl) < 12) this.completeStep();
    }
  };

  // Called by the game when the player shoots something.
  MissionManager.prototype.registerKill = function (enemy) {
    enemy.dead = true;
    this.ctx.scene.remove(enemy.mesh);
    this.enemies = this.enemies.filter((e) => e !== enemy);
    if (this.active) this.active.kills++;
  };

  SB.Missions = { MissionManager: MissionManager, Enemy: Enemy };
})();
