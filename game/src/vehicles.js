/* SOLMAR BAY — vehicles: car factory, driving physics and street traffic.
   Cars are built from boxes and cylinders, drive on the road grid, and collide
   with buildings, each other and the player. */
(function () {
  'use strict';

  const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);

  function makeCarMesh(model, isPolice) {
    const g = new THREE.Group();
    const bodyColor = isPolice ? 0x1a1a1a : model.color;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4),
      new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 0.62; body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    cabin.position.set(0, 1.18, -0.2); cabin.castShadow = true;
    g.add(cabin);
    if (isPolice) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.y = 0.85;
      g.add(stripe);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(0, 1.55, -0.2);
      g.add(bar);
      g.userData.lightBar = bar;
    }
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    g.userData.wheels = [];
    for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const w = new THREE.Mesh(WHEEL_GEO, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.42, z);
      g.add(w);
      g.userData.wheels.push(w);
    }
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (const x of [-0.6, 0.6]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
      h.position.set(x, 0.7, -2.22); // front is local -z (the car's forward)
      g.add(h);
    }
    return g;
  }

  function Car(scene, model, x, z, angle, isPolice) {
    this.model = model;
    this.isPolice = !!isPolice;
    this.mesh = makeCarMesh(model, this.isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = angle || 0;
    scene.add(this.mesh);
    this.speed = 0;
    this.health = SB.CFG.car.health;
    this.steer = 0;
    this.dead = false;
    this.skidTimer = 0;
    // Traffic state
    this.axis = 'x'; this.dir = 1; this.lane = 3.5;
    this.target = 0;
  }

  Car.prototype.forward = function () {
    return new THREE.Vector3(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y));
  };

  // Player driving: throttle -1..1, steer -1..1, handbrake.
  Car.prototype.drive = function (throttle, steer, dt, colliders, cars) {
    const cfg = SB.CFG.car;
    const top = this.model.topSpeed || cfg.maxSpeed;
    if (throttle > 0) this.speed += cfg.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= cfg.brake * dt;
      else this.speed += cfg.reverseAccel * throttle * dt; // throttle is negative: reverse
    }
    if (throttle === 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    this.speed = Math.max(-cfg.maxReverse, Math.min(top, this.speed));
    const spd = Math.abs(this.speed);
    const turn = steer * cfg.turnRate * (spd / top) * Math.sign(this.speed || 1);
    this.mesh.rotation.y += turn * dt * 1.6;
    const f = this.forward();
    const nx = this.mesh.position.x + f.x * this.speed * dt;
    const nz = this.mesh.position.z + f.z * this.speed * dt;
    const hit = resolveCircle(this.mesh.position, nx, nz, cfg.radius, colliders, cars, this);
    this.mesh.position.x = hit.x; this.mesh.position.z = hit.z;
    if (hit.collided) {
      if (Math.abs(this.speed) > 8 && this.onCrash) this.onCrash(Math.abs(this.speed));
      this.speed *= 0.45;
    }
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2;
    this.skidTimer -= dt;
    if (Math.abs(steer) > 0.7 && spd > 12 && this.skidTimer <= 0 && this.onSkid) {
      this.onSkid(this.mesh.position.x, this.mesh.position.z, this.mesh.rotation.y);
      this.skidTimer = 0.09;
    }
  };

  // Simple traffic driving along the road grid.
  Car.prototype.trafficDrive = function (dt, colliders, cars) {
    const CFG = SB.CFG;
    const cruise = 11;
    const f = this.forward();
    // Pick a new target intersection when close.
    const px = this.mesh.position.x, pz = this.mesh.position.z;
    const along = this.axis === 'x' ? px : pz;
    if (Math.abs(along - this.target) < 2) {
      const streets = [];
      for (let i = -CFG.GRID; i <= CFG.GRID; i++) streets.push(i * CFG.PITCH);
      const here = this.axis === 'x' ? Math.round(pz / CFG.PITCH) : Math.round(px / CFG.PITCH);
      const next = streets[Math.max(0, Math.min(streets.length - 1, here + (Math.random() < 0.5 ? -1 : 1)))];
      if (Math.random() < 0.45) { // turn onto the cross street
        this.axis = this.axis === 'x' ? 'z' : 'x';
        this.dir = Math.random() < 0.5 ? 1 : -1;
        // Snap to the correct right-hand lane of the new street.
        if (this.axis === 'z') {
          const si = Math.max(0, Math.min(streets.length - 1, Math.round(px / CFG.PITCH) + CFG.GRID));
          this.mesh.position.x = streets[si] - 3.5 * this.dir;
        } else {
          const si = Math.max(0, Math.min(streets.length - 1, Math.round(pz / CFG.PITCH) + CFG.GRID));
          this.mesh.position.z = streets[si] + 3.5 * this.dir;
        }
        this.target = next + this.dir * CFG.PITCH * 2;
      } else {
        this.target = along + this.dir * CFG.PITCH * (1 + Math.floor(Math.random() * 2));
      }
      const targetAngle = this.axis === 'x' ? (this.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (this.dir > 0 ? Math.PI : 0);
      this.mesh.rotation.y = targetAngle;
    }
    // Slow down if a car is ahead.
    let blocked = false;
    for (const c of cars) {
      if (c === this || c.dead) continue;
      const dx = c.mesh.position.x - px, dz = c.mesh.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 9 && dx * f.x + dz * f.z > 0) { blocked = true; break; }
    }
    const want = blocked ? 0 : cruise;
    this.speed += (want - this.speed) * Math.min(1, dt * 1.5);
    const nx = px + f.x * this.speed * dt;
    const nz = pz + f.z * this.speed * dt;
    const hit = resolveCircle(this.mesh.position, nx, nz, SB.CFG.car.radius, colliders, cars, this);
    this.mesh.position.x = hit.x; this.mesh.position.z = hit.z;
    if (hit.collided) this.speed = 0;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2;
  };

  // Circle vs building AABBs and other cars. Returns the resolved position.
  function resolveCircle(pos, nx, nz, r, colliders, cars, self) {
    let collided = false;
    for (const b of colliders) {
      const cx = Math.max(b.minX, Math.min(nx, b.maxX));
      const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
      const dx = nx - cx, dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        collided = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r; nz = cz + (dz / d) * r;
        } else {
          nx = pos.x; nz = pos.z;
        }
      }
    }
    if (cars) {
      for (const c of cars) {
        if (c === self || c.dead) continue;
        const dx = nx - c.mesh.position.x, dz = nz - c.mesh.position.z;
        const d = Math.hypot(dx, dz);
        const min = r + SB.CFG.car.radius;
        if (d < min && d > 0.001) {
          collided = true;
          nx = c.mesh.position.x + (dx / d) * min;
          nz = c.mesh.position.z + (dz / d) * min;
        }
      }
    }
    // City bounds: beach wall to the south, city edge elsewhere.
    const B = SB.CFG.CITY_HALF + 40;
    if (nx < -B) { nx = -B; collided = true; }
    if (nx > B) { nx = B; collided = true; }
    if (nz < -B) { nz = -B; collided = true; }
    if (nz > SB.CFG.SEA_Z + 30) { nz = SB.CFG.SEA_Z + 30; collided = true; }
    return { x: nx, z: nz, collided: collided };
  }

  function spawnTraffic(scene, rng, colliders, count) {
    const cars = [];
    const CFG = SB.CFG;
    const streets = [];
    for (let i = -CFG.GRID; i <= CFG.GRID; i++) streets.push(i * CFG.PITCH);
    for (let i = 0; i < count; i++) {
      const model = SB.CAR_MODELS[Math.floor(rng() * SB.CAR_MODELS.length)];
      const horizontal = rng() < 0.5;
      const street = streets[Math.floor(rng() * streets.length)];
      const along = (rng() * 2 - 1) * 220;
      const dir = rng() < 0.5 ? 1 : -1;
      const x = horizontal ? along : street - 3.5 * dir; // southbound keeps right (-x)
      const z = horizontal ? street + 3.5 * dir : along;
      const angle = horizontal ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      const car = new Car(scene, model, x, z, angle, false);
      car.axis = horizontal ? 'x' : 'z';
      car.dir = dir;
      car.target = along + dir * CFG.PITCH;
      cars.push(car);
    }
    return cars;
  }

  // Parked cars the player can steal (placed near roads, not moving).
  function spawnParked(scene, rng, count) {
    const cars = [];
    const CFG = SB.CFG;
    const streets = [];
    for (let i = -CFG.GRID; i <= CFG.GRID; i++) streets.push(i * CFG.PITCH);
    for (let i = 0; i < count; i++) {
      const model = SB.CAR_MODELS[Math.floor(rng() * SB.CAR_MODELS.length)];
      const horizontal = rng() < 0.5;
      const street = streets[Math.floor(rng() * streets.length)];
      const along = (rng() * 2 - 1) * 220;
      const dir = rng() < 0.5 ? 1 : -1;
      const x = horizontal ? along : street + 8.5;
      const z = horizontal ? street + 8.5 : along;
      const angle = horizontal ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      cars.push(new Car(scene, model, x, z, angle, false));
    }
    return cars;
  }

  SB.Vehicles = { Car: Car, makeCarMesh: makeCarMesh, spawnTraffic: spawnTraffic,
    spawnParked: spawnParked, resolveCircle: resolveCircle };
})();
