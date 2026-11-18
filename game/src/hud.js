/* SOLMAR BAY — hud: the on-screen HUD and the canvas minimap.
   Minimap draws the road grid, the player, cars, police, pedestrians and the
   mission marker, all from live game state. */
(function () {
  'use strict';

  function Hud() {
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      money: document.getElementById('money'),
      radio: document.getElementById('radio'),
      healthBar: document.getElementById('health-bar'),
      healthText: document.getElementById('health-text'),
      carHealthWrap: document.getElementById('car-health-wrap'),
      carHealthBar: document.getElementById('car-health-bar'),
      speed: document.getElementById('speed'),
      speedUnit: document.getElementById('speed-unit'),
      vehicleName: document.getElementById('vehicle-name'),
      objectiveText: document.getElementById('objective-text'),
      missionTimer: document.getElementById('mission-timer'),
      prompt: document.getElementById('prompt'),
      banner: document.getElementById('banner'),
      crosshair: document.getElementById('crosshair'),
      minimap: document.getElementById('minimap'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.bannerTimer = null;
  }

  Hud.prototype.show = function () { this.el.hud.classList.remove('hidden'); };
  Hud.prototype.hide = function () { this.el.hud.classList.add('hidden'); };

  Hud.prototype.setObjective = function (text) { this.el.objectiveText.textContent = text; };
  Hud.prototype.setTimer = function (seconds) {
    this.el.missionTimer.textContent = seconds > 0 ? '⏱ ' + Math.ceil(seconds) + 's' : '';
  };
  Hud.prototype.setPrompt = function (text) {
    this.el.prompt.textContent = text || '';
    this.el.prompt.style.display = text ? 'block' : 'none';
  };
  Hud.prototype.setCrosshair = function (on) { this.el.crosshair.classList.toggle('hidden', !on); };

  Hud.prototype.banner = function (title, sub) {
    this.el.banner.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), 3200);
  };

  Hud.prototype.update = function (s) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '<span class="off">★</span>';
    this.el.wanted.innerHTML = stars;
    this.el.money.textContent = '$' + Math.floor(s.money).toLocaleString();
    this.el.radio.textContent = s.radio;
    this.el.healthBar.style.width = Math.max(0, s.health) + '%';
    this.el.healthText.textContent = Math.max(0, Math.round(s.health));
    this.el.carHealthWrap.classList.toggle('hidden', !s.inCar);
    if (s.inCar) this.el.carHealthBar.style.width = Math.max(0, s.carHealth) + '%';
    this.el.speed.textContent = Math.round(Math.abs(s.speed) * 2.2);
    this.el.speedUnit.textContent = s.inCar ? 'MPH' : 'ON FOOT';
    this.el.vehicleName.textContent = s.inCar ? s.carName : '';
    this.drawMinimap(s);
  };

  Hud.prototype.drawMinimap = function (s) {
    const g = this.mm, W = 190, H = 190;
    const CFG = SB.CFG;
    const scale = W / (CFG.CITY_HALF * 2 + 120);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    // Sea and sand.
    g.fillStyle = '#1a6f9e';
    g.fillRect(0, toY(CFG.SEA_Z), W, H - toY(CFG.SEA_Z));
    g.fillStyle = '#e8d8a0';
    g.fillRect(0, toY(CFG.BEACH_Z), W, toY(CFG.SEA_Z) - toY(CFG.BEACH_Z));
    // Land.
    g.fillStyle = '#5d7a52';
    g.fillRect(0, 0, W, toY(CFG.BEACH_Z));
    // Roads.
    g.strokeStyle = '#2e3138';
    g.lineWidth = Math.max(2, CFG.ROAD_W * scale);
    for (let i = -CFG.GRID; i <= CFG.GRID; i++) {
      const c = i * CFG.PITCH;
      g.beginPath(); g.moveTo(toX(-CFG.CITY_HALF - 30), toY(c)); g.lineTo(toX(CFG.CITY_HALF + 30), toY(c)); g.stroke();
      g.beginPath(); g.moveTo(toX(c), toY(-CFG.CITY_HALF - 30)); g.lineTo(toX(c), toY(CFG.CITY_HALF + 30)); g.stroke();
    }
    // Landmark dots.
    g.fillStyle = '#ffd75e';
    for (const k of ['garage', 'casino', 'marina', 'diner']) {
      const pl = SB.PLACES[k];
      g.fillRect(toX(pl.x) - 2, toY(pl.z) - 2, 4, 4);
    }
    // Mission marker.
    if (s.marker) {
      const pulse = 5 + Math.sin(s.time * 4) * 2;
      g.fillStyle = '#ffd75e';
      g.beginPath(); g.arc(toX(s.marker.x), toY(s.marker.z), pulse, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000';
      g.beginPath(); g.arc(toX(s.marker.x), toY(s.marker.z), 2.5, 0, Math.PI * 2); g.fill();
    }
    // Traffic dots.
    g.fillStyle = '#ffffff';
    for (const c of s.traffic) {
      g.fillRect(toX(c.mesh.position.x) - 1.5, toY(c.mesh.position.z) - 1.5, 3, 3);
    }
    // Police dots.
    g.fillStyle = '#ff4040';
    for (const c of s.policeCars) {
      g.beginPath(); g.arc(toX(c.mesh.position.x), toY(c.mesh.position.z), 3.5, 0, Math.PI * 2); g.fill();
    }
    if (s.heli) {
      g.fillStyle = '#ff4040';
      g.beginPath(); g.arc(toX(s.heli.position.x), toY(s.heli.position.z), 4, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const px = toX(s.playerX), py = toY(s.playerZ);
    g.save();
    g.translate(px, py);
    g.rotate(-s.playerAngle);
    g.fillStyle = '#ffd75e';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
    g.restore();
    // View ring.
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); g.stroke();
  };

  SB.Hud = Hud;
})();
