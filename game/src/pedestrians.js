/* SOLMAR BAY — pedestrians: city walkers who stroll the sidewalks and flee
   from gunfire and speeding cars. */
(function () {
  'use strict';

  const SHIRT_COLORS = [0xe86aa0, 0x3a7bd5, 0x7a9a4d, 0xd9a441, 0x8a6fc0, 0x4db8a6, 0xd53a3a, 0xf2f2f2];

  function makePedMesh(shirtColor) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32),
      new THREE.MeshLambertMaterial({ color: shirtColor }));
    body.position.y = 0.95; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.6;
    g.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), legMat);
    legL.position.set(-0.14, 0.28, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    g.add(legL); g.add(legR);
    g.userData.legL = legL; g.userData.legR = legR;
    return g;
  }

  function Pedestrian(scene, x, z, rng) {
    this.mesh = makePedMesh(SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)]);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.speed = 1.2 + rng() * 1.2;
    this.angle = rng() * Math.PI * 2;
    this.mesh.rotation.y = this.angle;
    this.fleeing = false;
    this.fleeTimer = 0;
    this.walkPhase = rng() * 6;
    this.dead = false;
  }

  Pedestrian.prototype.fleeFrom = function (x, z) {
    const dx = this.mesh.position.x - x, dz = this.mesh.position.z - z;
    const d = Math.hypot(dx, dz) || 1;
    this.angle = Math.atan2(-dx, -dz);
    this.fleeing = true;
    this.fleeTimer = 3;
  };

  Pedestrian.prototype.update = function (dt, colliders, danger) {
    if (this.dead) return;
    // React to danger (player car or gunfire nearby).
    if (danger) {
      const dx = this.mesh.position.x - danger.x, dz = this.mesh.position.z - danger.z;
      if (Math.hypot(dx, dz) < 14) this.fleeFrom(danger.x, danger.z);
    }
    this.fleeTimer -= dt;
    if (this.fleeTimer <= 0) this.fleeing = false;
    const spd = this.fleeing ? this.speed * 2.6 : this.speed;
    const nx = this.mesh.position.x + -Math.sin(this.angle) * spd * dt;
    const nz = this.mesh.position.z + -Math.cos(this.angle) * spd * dt;
    // Keep walkers on sidewalks: bounce off buildings and stay in the city.
    const hit = SB.Vehicles.resolveCircle(this.mesh.position, nx, nz, 0.5, colliders, null, null);
    const B = SB.CFG.CITY_HALF + 20;
    if (Math.abs(hit.x) > B || Math.abs(hit.z) > B || hit.z > SB.CFG.BEACH_Z + 8) {
      this.angle += Math.PI * 0.9;
    } else if (hit.collided && !this.fleeing) {
      this.angle += (Math.random() - 0.5) * 2.4;
    } else {
      this.mesh.position.x = hit.x; this.mesh.position.z = hit.z;
    }
    if (!this.fleeing && Math.random() < dt * 0.08) this.angle += (Math.random() - 0.5) * 1.6;
    this.mesh.rotation.y = this.angle;
    this.walkPhase += dt * spd * 2.4;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
  };

  function spawnPedestrians(scene, rng, colliders, count) {
    const peds = [];
    const CFG = SB.CFG;
    const streets = [];
    for (let i = -CFG.GRID; i <= CFG.GRID; i++) streets.push(i * CFG.PITCH);
    for (let i = 0; i < count; i++) {
      const street = streets[Math.floor(rng() * streets.length)];
      const along = (rng() * 2 - 1) * 230;
      const side = rng() < 0.5 ? 1 : -1;
      const horizontal = rng() < 0.5;
      const x = horizontal ? along : street + side * (CFG.ROAD_W / 2 + 2.2);
      const z = horizontal ? street + side * (CFG.ROAD_W / 2 + 2.2) : along;
      peds.push(new Pedestrian(scene, x, z, rng));
    }
    return peds;
  }

  SB.Pedestrians = { Pedestrian: Pedestrian, spawn: spawnPedestrians };
})();
