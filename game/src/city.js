/* SOLMAR BAY — city: the procedural sun-soaked coastal city of Solmar Bay.
   Grid streets, towers downtown, beach and ocean to the south, palms, props,
   landmarks (casino, garage, diner, marina, docks, warehouse, hospital) and
   the mission beacon. Builds once from a seeded RNG so screenshots are stable. */
(function () {
  'use strict';

  function makeCanvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function windowTexture() {
    return makeCanvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#20242e';
      for (let y = 8; y < h - 8; y += 22)
        for (let x = 8; x < w - 8; x += 18) g.fillRect(x, y, 11, 13);
    });
  }

  function signTexture(text, bg, fg) {
    return makeCanvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = fg; g.font = 'bold 52px Trebuchet MS, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
    });
  }

  function buildCity(scene, seed) {
    const rng = SB.rng(seed || 7);
    const CFG = SB.CFG;
    const colliders = [];
    const d = new THREE.Object3D(); // shared dummy for instanced meshes
    const winTex = windowTexture();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const palette = [0xd8c9b0, 0xc9b8a3, 0xb7c4cc, 0xd9a441, 0x9fb4c7, 0xc77b58, 0x8fa98f, 0xe0d6c2];

    // --- Sky, sun, fog ---
    scene.background = new THREE.Color(0x87bfe8);
    scene.fog = new THREE.Fog(0x9fc8e8, 220, 760);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
    sun.position.set(160, 240, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -170; sun.shadow.camera.right = 170;
    sun.shadow.camera.top = 170; sun.shadow.camera.bottom = -170;
    sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);
    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.55));

    // --- Ground, roads, sidewalks ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0x6f8f5a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
    const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
    const streets = [];
    for (let i = -CFG.GRID; i <= CFG.GRID; i++) streets.push(i * CFG.PITCH);
    for (const s of streets) {
      for (const horizontal of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(560, CFG.ROAD_W), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = horizontal ? 0 : Math.PI / 2;
        road.position.set(horizontal ? 0 : s, 0.02, horizontal ? s : 0);
        road.receiveShadow = true;
        scene.add(road);
        for (const side of [-1, 1]) {
          const walk = new THREE.Mesh(new THREE.PlaneGeometry(560, 3.2), walkMat);
          walk.rotation.x = -Math.PI / 2;
          walk.rotation.z = horizontal ? 0 : Math.PI / 2;
          walk.position.set(
            horizontal ? 0 : s + side * (CFG.ROAD_W / 2 + 1.6),
            0.04,
            horizontal ? s + side * (CFG.ROAD_W / 2 + 1.6) : 0);
          walk.receiveShadow = true;
          scene.add(walk);
        }
      }
    }
    // Center dashes.
    const dashGeo = new THREE.PlaneGeometry(3, 0.5);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    const dashCount = streets.length * 2 * 34;
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    let di = 0;
    for (const s of streets) for (const horizontal of [true, false])
      for (let k = -16; k <= 17; k++) {
        d.position.set(horizontal ? k * 16 : s, 0.05, horizontal ? s : k * 16);
        d.rotation.set(-Math.PI / 2, 0, horizontal ? 0 : Math.PI / 2);
        d.updateMatrix();
        dashes.setMatrixAt(di++, d.matrix);
      }
    dashes.count = di;
    scene.add(dashes);

    // --- Beach and ocean (south edge) ---
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(900, CFG.SEA_Z - CFG.BEACH_Z + 12),
      new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, (CFG.BEACH_Z + CFG.SEA_Z) / 2);
    sand.receiveShadow = true;
    scene.add(sand);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 500),
      new THREE.MeshPhongMaterial({ color: 0x14689e, shininess: 90 }));
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.01, CFG.SEA_Z + 250);
    scene.add(ocean);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(900, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.05, CFG.SEA_Z);
    scene.add(foam);

    // --- Buildings ---
    function addBuilding(x, z, w, hgt, dep, color, sign) {
      const tex = winTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(hgt / 9)));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshLambertMaterial({ color: color, map: tex });
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, hgt, dep);
      m.position.set(x, hgt / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2 });
      if (sign) {
        const sm = new THREE.Mesh(new THREE.PlaneGeometry(sign.w, sign.h),
          new THREE.MeshBasicMaterial({ map: signTexture(sign.text, sign.bg, sign.fg) }));
        sm.position.set(x, sign.y, z + dep / 2 + 0.15);
        scene.add(sm);
      }
      return m;
    }

    const landmarkAt = {};
    for (const key of Object.keys(SB.PLACES)) {
      const p = SB.PLACES[key];
      landmarkAt[Math.round(p.x) + ',' + Math.round(p.z)] = key;
    }

    for (let bx = -CFG.GRID; bx < CFG.GRID; bx++) {
      for (let bz = -CFG.GRID; bz < CFG.GRID; bz++) {
        const cx = bx * CFG.PITCH + CFG.PITCH / 2;
        const cz = bz * CFG.PITCH + CFG.PITCH / 2;
        const key = landmarkAt[Math.round(cx - 30) + ',' + Math.round(cz - 30)];
        const downtown = Math.abs(cx) < 150 && Math.abs(cz) < 150;
        if (key === 'casino') {
          addBuilding(cx, cz, 34, 22, 26, 0x8a6d2f, { text: 'SOLMAR ROYALE', bg: '#1a1a2e', fg: '#ffd75e', w: 30, h: 6, y: 20 });
          addBuilding(cx + 24, cz - 6, 12, 34, 12, 0x5a4a7a);
          continue;
        }
        if (key === 'garage') {
          addBuilding(cx, cz, 26, 9, 18, 0xc75b39, { text: "MAMA LU'S GARAGE", bg: '#222', fg: '#ffd75e', w: 22, h: 4, y: 8 });
          continue;
        }
        if (key === 'diner') {
          addBuilding(cx, cz, 16, 8, 12, 0x7ec8c0, { text: 'PALM ROW DINER', bg: '#0d3b34', fg: '#fff', w: 14, h: 3, y: 7 });
          continue;
        }
        if (key === 'warehouse') {
          addBuilding(cx, cz, 30, 12, 20, 0x7a8894);
          continue;
        }
        if (key === 'hospital') {
          addBuilding(cx, cz, 20, 30, 16, 0xe8e8e8, { text: 'BAY GENERAL', bg: '#fff', fg: '#c22418', w: 16, h: 3, y: 26 });
          continue;
        }
        if (key === 'safehouse' || key === 'hideout') {
          addBuilding(cx, cz, 14, 8, 12, 0x9a7b5a);
          continue;
        }
        if (key === 'docks' || key === 'marina' || key === 'plaza') continue; // open areas
        const n = downtown ? 2 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i++) {
          const w = 12 + rng() * 12, dep = 12 + rng() * 12;
          const ox = (rng() - 0.5) * (CFG.PITCH - CFG.ROAD_W - w - 6);
          const oz = (rng() - 0.5) * (CFG.PITCH - CFG.ROAD_W - dep - 6);
          const hgt = downtown ? 18 + rng() * 52 : 7 + rng() * 14;
          addBuilding(cx + ox, cz + oz, w, hgt, dep, palette[Math.floor(rng() * palette.length)]);
        }
      }
    }

    // --- Docks containers ---
    const contColors = [0xc75b39, 0x3a7bd5, 0x7a9a4d, 0xd9a441];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contColors[i % 4] }));
      m.scale.set(12, 3, 3);
      m.position.set(-232 + (i % 4) * 15, 1.5, 236 + Math.floor(i / 4) * 6);
      m.castShadow = true;
      scene.add(m);
      colliders.push({ minX: m.position.x - 6, maxX: m.position.x + 6, minZ: m.position.z - 1.5, maxZ: m.position.z + 1.5 });
    }

    // --- Marina boats ---
    const boatMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const hullMat = new THREE.MeshLambertMaterial({ color: 0x2e5a7a });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(boxGeo, hullMat);
      hull.scale.set(4, 1.2, 10); hull.position.y = 0.4;
      const cab = new THREE.Mesh(boxGeo, boatMat);
      cab.scale.set(3, 1.6, 4); cab.position.y = 1.6;
      g.add(hull); g.add(cab);
      g.position.set(-120 + i * 70, 0, CFG.SEA_Z + 22 + (i % 2) * 14);
      g.rotation.y = (rng() - 0.5) * 0.4;
      scene.add(g);
    }

    // --- Palm trees (instanced) ---
    const palmSpots = [];
    for (let x = -260; x <= 260; x += 22) palmSpots.push([x, CFG.BEACH_Z + 6]);
    for (let x = -120; x <= 120; x += 24) palmSpots.push([x, 8]);
    for (let i = 0; i < 40; i++) palmSpots.push([(rng() - 0.5) * 480, (rng() - 0.5) * 480]);
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
    const canopyGeo = new THREE.ConeGeometry(3.2, 3.4, 7);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmSpots.length);
    palmSpots.forEach((s, i) => {
      d.position.set(s[0], 3.5, s[1]); d.rotation.set(0, rng() * 6, (rng() - 0.5) * 0.16);
      d.updateMatrix(); trunks.setMatrixAt(i, d.matrix);
      d.position.set(s[0], 8.2, s[1]); d.updateMatrix(); canopies.setMatrixAt(i, d.matrix);
    });
    trunks.castShadow = true;
    scene.add(trunks); scene.add(canopies);

    // --- Streetlights (instanced) ---
    // Streetlights stand at intersection corners, clear of both roads.
    const lightSpots = [];
    for (const s of streets) for (let k = -4; k <= 4; k += 2) {
      lightSpots.push([k * CFG.PITCH + 9, s + 9]);
      lightSpots.push([s + 9, k * CFG.PITCH - 9]);
    }
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 5);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
    const bulbGeo = new THREE.SphereGeometry(0.35, 6, 5);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lightSpots.length);
    lightSpots.forEach((s, i) => {
      d.position.set(s[0], 3.5, s[1]); d.rotation.set(0, 0, 0); d.updateMatrix();
      poles.setMatrixAt(i, d.matrix);
      d.position.set(s[0], 7, s[1]); d.updateMatrix();
      bulbs.setMatrixAt(i, d.matrix);
    });
    scene.add(poles); scene.add(bulbs);

    // --- Clouds ---
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const clouds = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(6 + rng() * 6, 8, 6), cloudMat);
        s.position.set(j * 8 - 8, rng() * 2, rng() * 4);
        s.scale.y = 0.45;
        g.add(s);
      }
      g.position.set((rng() - 0.5) * 600, 90 + rng() * 40, (rng() - 0.5) * 600);
      scene.add(g);
      clouds.push(g);
    }

    // --- Mission beacon ---
    const beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 45;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    arrow.rotation.x = Math.PI; arrow.position.y = 12;
    beacon.add(beam); beacon.add(ring); beacon.add(arrow);
    beacon.visible = false;
    scene.add(beacon);

    let time = 0;
    return {
      colliders: colliders,
      sun: sun,
      setMarker: function (pos) {
        if (!pos) { beacon.visible = false; return; }
        beacon.position.set(pos.x, 0, pos.z);
        beacon.visible = true;
      },
      update: function (dt, playerPos) {
        time += dt;
        for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 340) c.position.x = -340; }
        if (beacon.visible) { ring.rotation.z += dt * 2; arrow.position.y = 12 + Math.sin(time * 3) * 1.2; }
        if (playerPos) {
          sun.position.set(playerPos.x + 160, 240, playerPos.z + 90);
          sun.target.position.set(playerPos.x, 0, playerPos.z);
          sun.target.updateMatrixWorld();
        }
      },
    };
  }

  SB.City = { build: buildCity };
})();
