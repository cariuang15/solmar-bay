/* SOLMAR BAY — effects: particles, skid marks, muzzle flashes, explosions.
   One pooled particle system keeps the frame budget flat. */
(function () {
  'use strict';

  const MAX_PARTICLES = 600;

  function Effects(scene) {
    this.scene = scene;
    this.particles = [];
    this.geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.skids = [];
    this.skidGeo = new THREE.PlaneGeometry(0.5, 1.6);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0.55 });
    this.skidMesh = new THREE.InstancedMesh(this.skidGeo, this.skidMat, 240);
    this.skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidMesh.count = 0;
    this.skidMesh.frustumCulled = false;
    this.skidMesh.rotation.x = -Math.PI / 2;
    scene.add(this.skidMesh);
    this.skidIndex = 0;
  }

  Effects.prototype.burst = function (pos, color, count, speed, life, up) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * Math.cos(e) * s,
        vy: Math.sin(e) * s + (up || 0),
        vz: Math.sin(a) * Math.cos(e) * s,
        life: life * (0.6 + Math.random() * 0.7), age: 0,
        color: color, size: 0.6 + Math.random() * 1.1,
      });
    }
  };

  Effects.prototype.smoke = function (pos) { this.burst(pos, 0x9aa0a6, 3, 1.2, 0.9, 1.2); };
  Effects.prototype.sparks = function (pos) { this.burst(pos, 0xffc93c, 10, 6, 0.4, 2); };
  Effects.prototype.blood = function (pos) { this.burst(pos, 0xc22418, 8, 3, 0.5, 1); };
  Effects.prototype.muzzle = function (pos) { this.burst(pos, 0xffe08a, 6, 5, 0.12, 0); };
  Effects.prototype.explosion = function (pos) {
    this.burst(pos, 0xff7a1a, 26, 9, 0.8, 4);
    this.burst(pos, 0x333333, 18, 4, 1.6, 5);
    this.burst(pos, 0xffd75e, 12, 6, 0.5, 3);
  };
  Effects.prototype.confetti = function (pos) {
    const cols = [0xffd75e, 0xff6aa0, 0x6ac8ff, 0x7dff9b];
    for (let i = 0; i < 40; i++) this.burst(pos, cols[i % 4], 1, 4, 1.4, 5);
  };

  Effects.prototype.addSkid = function (x, z, angle) {
    const m = new THREE.Matrix4();
    m.makeRotationY(angle);
    m.setPosition(x, 0.06, z);
    this.skidMesh.setMatrixAt(this.skidIndex, m);
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.skidIndex = (this.skidIndex + 1) % 240;
    if (this.skidMesh.count < 240) this.skidMesh.count++;
  };

  Effects.prototype.update = function (dt) {
    const alive = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= 9 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      alive.push(p);
    }
    this.particles = alive;
    const col = new THREE.Color();
    for (let i = 0; i < alive.length; i++) {
      const p = alive[i];
      const f = 1 - p.age / p.life;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(p.size * (0.5 + f * 0.5));
      this.dummy.rotation.set(p.age * 3, p.age * 2, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      col.setHex(p.color).multiplyScalar(0.4 + f * 0.6);
      this.mesh.setColorAt(i, col);
    }
    this.mesh.count = alive.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  };

  SB.Effects = Effects;
})();
