/* SOLMAR BAY — police: the wanted system, pursuing police cars and the
   police helicopter that joins the chase at three stars and above. */
(function () {
  'use strict';

  function makeHeliMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    body.castShadow = true;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    glass.position.set(0, 0.3, 1.8);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    tail.position.set(0, 0.3, -4);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x222222 }));
    rotor.position.y = 1.0;
    g.add(rotor);
    g.userData.rotor = rotor;
    const spot = new THREE.SpotLight(0xfff2b0, 2.2, 90, 0.35, 0.5);
    spot.position.set(0, -0.5, 0);
    g.add(spot);
    g.userData.spot = spot;
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -40, 0);
    g.add(spotTarget);
    spot.target = spotTarget;
    return g;
  }

  function Police(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.cars = [];
    this.heli = null;
    this.bustTimer = 0;
    this.decayTimer = 0;
    this.lastCrimeAt = -100;
    this.spawnTimer = 0;
    this.time = 0;
    this.nearHideout = false; // set by missions: near the escape destination the heat gives up
  }

  Police.prototype.addWanted = function (n, now) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.lastCrimeAt = now;
    this.decayTimer = 0;
  };

  Police.prototype.clearWanted = function () {
    this.wanted = 0;
    this.bustTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
  };

  Police.prototype.policeCount = function () {
    if (this.wanted <= 0) return 0;
    return this.wanted <= 1 ? 1 : this.wanted <= 2 ? 2 : this.wanted <= 3 ? 3 : 4;
  };

  Police.prototype.spawnPoliceCar = function (playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 55;
    const z = playerPos.z + Math.sin(angle) * 55;
    const car = new SB.Vehicles.Car(this.scene, { name: 'PD Interceptor', color: 0x111111, topSpeed: 40 },
      x, z, 0, true);
    car.health = 60;
    this.cars.push(car);
    return car;
  };

  Police.prototype.update = function (dt, player, playerCar, colliders, cars, effects, audio, onBusted) {
    this.time += dt;
    const p = player.position();
    // Decay: no crime and no police car close for a while. (The helicopter
    // circles overhead and loses the trail once the cars do, so it does not
    // count here — otherwise a 3-star wanted level could never decay.)
    let nearestPolice = 999;
    for (const c of this.cars) nearestPolice = Math.min(nearestPolice, c.mesh.position.distanceTo(p));
    const decayDelay = this.nearHideout ? 2 : SB.CFG.wanted.decayDelay;
    if (this.wanted > 0 && this.time - this.lastCrimeAt > decayDelay &&
        nearestPolice > SB.CFG.wanted.hideRadius) {
      this.decayTimer += dt;
      if (this.decayTimer > SB.CFG.wanted.decayStep) {
        this.decayTimer = 0;
        this.wanted--;
        if (this.wanted === 0) this.clearWanted();
      }
    } else {
      this.decayTimer = 0;
    }
    // Near the hideout the heat gives up: the helicopter peels off and the
    // police cars leave one by one.
    const hiding = this.nearHideout;
    this.nearHideout = false;
    if (hiding && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
    if (hiding && this.cars.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const c = this.cars.pop();
        this.scene.remove(c.mesh);
        this.spawnTimer = 1.2;
      }
    }

    // Spawn / despawn to match the wanted level (never while hiding).
    this.spawnTimer -= dt;
    const want = this.policeCount();
    if (!hiding && this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnPoliceCar(p);
      this.spawnTimer = 1.5;
    }
    if (this.wanted >= 3 && !this.heli && !hiding) {
      this.heli = makeHeliMesh();
      this.heli.position.set(p.x + 20, 42, p.z + 70);
      this.scene.add(this.heli);
    }
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }

    // Police cars pursue and ram.
    const target = playerCar ? playerCar.mesh.position : p;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.dead) continue;
      const cp = c.mesh.position;
      const dx = target.x - cp.x, dz = target.z - cp.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(-dx, -dz);
      let diff = desired - c.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.mesh.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const speed = Math.min(SB.CFG.police.chaseSpeed, 14 + dist * 0.55);
      const f = c.forward();
      const nx = cp.x + f.x * speed * dt;
      const nz = cp.z + f.z * speed * dt;
      const hit = SB.Vehicles.resolveCircle(cp, nx, nz, SB.CFG.car.radius, colliders, cars, c);
      c.mesh.position.x = hit.x; c.mesh.position.z = hit.z;
      for (const w of c.mesh.userData.wheels) w.rotation.x += speed * dt * 2;
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(Math.floor(this.time * 4) % 2 ? 0xff2222 : 0x2266ff);
      }
      // A police car that cannot close in for 8 seconds loses the trail.
      if (dist > 60) {
        c.farTimer = (c.farTimer || 0) + dt;
        if (c.farTimer > 8) {
          this.scene.remove(c.mesh);
          c.dead = true;
          this.cars.splice(i, 1);
          continue;
        }
      } else {
        c.farTimer = 0;
      }
      // Ram the player car: a thump every so often, not a shredder.
      if (playerCar && dist < 4.6) {
        c.ramTimer = (c.ramTimer || 0) - dt;
        if (c.ramTimer <= 0) {
          playerCar.health -= SB.CFG.police.ramDamage;
          c.ramTimer = SB.CFG.police.ramInterval;
          effects.sparks(c.mesh.position);
          audio.crash();
        }
        playerCar.speed *= Math.max(0, 1 - 0.35 * dt);
      }
      // Busted: police car touches the player on foot.
      if (!playerCar && dist < 3.2) {
        this.bustTimer += dt;
        if (this.bustTimer > SB.CFG.police.bustTime) onBusted();
      }
      // Police car destroyed (wrecked by the player) — remove it.
      if (c.health <= 0) {
        effects.explosion(c.mesh.position);
        audio.explosion();
        this.scene.remove(c.mesh);
        c.dead = true;
        this.cars.splice(i, 1);
      }
    }
    if (!playerCar && nearestPolice > 6) this.bustTimer = Math.max(0, this.bustTimer - dt * 2);

    // Helicopter hovers ahead-right of the player, spotlight on them.
    if (this.heli) {
      const h = this.heli;
      const tx = p.x + 20, tz = p.z + 70;
      h.position.x += (tx - h.position.x) * Math.min(1, dt * 0.7);
      h.position.z += (tz - h.position.z) * Math.min(1, dt * 0.7);
      h.position.y = 42 + Math.sin(this.time * 0.8) * 2;
      h.rotation.y = Math.atan2(-(p.x - h.position.x), -(p.z - h.position.z));
      h.userData.rotor.rotation.y += dt * 22;
    }

    audio.setSiren(this.cars.length > 0 || !!this.heli);
  };

  SB.Police = Police;
})();
