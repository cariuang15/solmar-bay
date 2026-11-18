/* SOLMAR BAY — player: Kai Reyes on foot. Third-person walk/run, mouse aim,
   pistol combat, and getting in and out of cars. */
(function () {
  'use strict';

  function makePlayerMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.34), jacket);
    body.position.y = 1.0; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.66;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xffc93c }));
    cap.position.y = 1.88;
    g.add(cap);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x22303e });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), legMat);
    legL.position.set(-0.15, 0.3, 0);
    const legR = legL.clone(); legR.position.x = 0.15;
    g.add(legL); g.add(legR);
    // Pistol in the right hand, visible when aiming (front is local -z).
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x181818 }));
    gun.position.set(0.36, 1.05, -0.25);
    g.add(gun);
    g.userData.legL = legL; g.userData.legR = legR; g.userData.gun = gun;
    return g;
  }

  function Player(scene, x, z) {
    this.mesh = makePlayerMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.angle = 0;          // facing angle (radians)
    this.health = SB.CFG.player.health;
    this.inCar = null;       // Car object when driving
    this.walkPhase = 0;
    this.shootCooldown = 0;
    this.aiming = false;
    this.speed = 0;
  }

  Player.prototype.position = function () { return this.mesh.position; };

  // On-foot movement, relative to the camera yaw.
  Player.prototype.updateOnFoot = function (dt, input, camYaw, colliders, cars) {
    const cfg = SB.CFG.player;
    this.shootCooldown -= dt;
    let mx = 0, mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const run = input.run;
    const spd = run ? cfg.runSpeed : cfg.walkSpeed;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      // Rotate the input vector by the camera yaw: W moves away from the
      // camera (the view direction), D moves to the screen's right.
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = mx * cos + mz * sin;
      const wz = -mx * sin + mz * cos;
      const nx = this.mesh.position.x + wx * spd * dt;
      const nz = this.mesh.position.z + wz * spd * dt;
      const hit = SB.Vehicles.resolveCircle(this.mesh.position, nx, nz, cfg.radius, colliders, cars, null);
      this.mesh.position.x = hit.x; this.mesh.position.z = hit.z;
      this.angle = Math.atan2(-wx, -wz);
      this.mesh.rotation.y = this.angle;
      this.walkPhase += dt * spd * 1.6;
      this.speed = spd;
    } else {
      this.speed = 0;
    }
    const swing = moving ? Math.sin(this.walkPhase) * 0.6 : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.gun.visible = this.aiming;
  };

  // Hitscan pistol shot from the camera through the crosshair.
  Player.prototype.shoot = function (camera, targets, onHit) {
    if (this.shootCooldown > 0 || this.inCar) return false;
    this.shootCooldown = 0.28;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.far = 90;
    const hits = ray.intersectObjects(targets, true);
    if (hits.length > 0) {
      onHit(hits[0]);
      return true;
    }
    return false;
  };

  SB.Player = Player;
})();
