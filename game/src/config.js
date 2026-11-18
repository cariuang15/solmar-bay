/* SOLMAR BAY — config: city layout, tuning, story and mission data.
   One place for every number the other files share. */
(function () {
  'use strict';

  // Seeded RNG (mulberry32) so the city is stable per seed, for screenshots.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CFG = {
    // City grid: streets every PITCH units, roads ROAD_W wide.
    PITCH: 60,
    ROAD_W: 14,
    GRID: 4,                 // streets at -4..4 * PITCH  (9 x 9 streets)
    CITY_HALF: 4 * 60 + 30,  // outer edge of the built city
    BEACH_Z: 4 * 60 + 30,    // sand starts here (south edge)
    SEA_Z: 4 * 60 + 78,      // ocean starts here

    player: { walkSpeed: 6.5, runSpeed: 11, radius: 0.6, health: 100 },
    car: { accel: 26, brake: 42, reverseAccel: 14, maxSpeed: 38, maxReverse: 10,
           turnRate: 1.9, grip: 6, radius: 2.3, health: 100 },
    police: { chaseSpeed: 40, ramDamage: 3, ramInterval: 1.5, bustTime: 2.0 },
    wanted: { decayDelay: 9, decayStep: 6, hideRadius: 70 },
    trafficCount: 16,
    pedCount: 22,
    startMoney: 500,
  };

  // Named places in the city (x, z) — shared by missions, minimap and spawn points.
  // Each sits on a street corner (multiple of 60) so its landmark building lands
  // in the block just south-east of it (block centre = place + 30, +30).
  const PLACES = {
    garage:      { x: -180, z: 120, name: "Mama Lu's Garage" },
    diner:       { x: 60,   z: -60, name: 'Palm Row Diner' },
    marina:      { x: 150,  z: 252, name: 'Solmar Marina' },
    docks:       { x: -210, z: 252, name: 'East Docks' },
    casino:      { x: 60,   z: 60,  name: 'Solmar Royale Casino' },
    warehouse:   { x: -180, z: -120, name: 'Harbor Warehouse' },
    safehouse:   { x: -120, z: -180, name: 'Safehouse' },
    hideout:     { x: 180,  z: -180, name: 'Beach Hideout' },
    plaza:       { x: 0,    z: 0,   name: 'Solmar Plaza' },
    hospital:    { x: 180,  z: -120, name: 'Bay General' },
  };

  // The story: seven jobs for Kai Reyes, fixer Mama Lu.
  const MISSIONS = [
    { id: 1, name: 'First Wheels', giver: 'Mama Lu',
      briefing: 'A customer left a sedan at the marina lot and "forgot" it. Bring it to my garage. Quietly.',
      reward: 800,
      steps: [
        { type: 'goto', place: 'marina', text: 'Go to the marina parking lot' },
        { type: 'steal', text: 'Steal the marked sedan (press E near it)' },
        { type: 'deliver', place: 'garage', text: 'Deliver the sedan to Mama Lu\'s garage' },
      ] },
    { id: 2, name: 'Sunset Courier', giver: 'Mama Lu',
      briefing: 'Three parcels, three corners of the city, one sunset. Drive fast, drive clean.',
      reward: 1200, timeLimit: 150,
      steps: [
        { type: 'goto', place: 'diner', text: 'Drop parcel 1 at the Palm Row Diner' },
        { type: 'goto', place: 'hospital', text: 'Drop parcel 2 at Bay General' },
        { type: 'goto', place: 'docks', text: 'Drop parcel 3 at the East Docks' },
      ] },
    { id: 3, name: 'The Pickup', giver: 'Mama Lu',
      briefing: 'Rocco is waiting at the diner with heat on his tail. Pick him up, then lose the cops and get him to the safehouse.',
      reward: 1600,
      steps: [
        { type: 'goto', place: 'diner', text: 'Pick up Rocco at the diner' },
        { type: 'escape', place: 'safehouse', wanted: 2, text: 'Lose the cops — reach the safehouse with no wanted level' },
      ] },
    { id: 4, name: 'Hot Cargo', giver: 'Mama Lu',
      briefing: 'A box truck full of "imported" goods is parked at the docks. Take it. The harbor crew will not wave you through.',
      reward: 2200,
      steps: [
        { type: 'goto', place: 'docks', text: 'Reach the box truck at the East Docks' },
        { type: 'stealTruck', text: 'Steal the box truck (press E near it)' },
        { type: 'deliver', place: 'warehouse', text: 'Deliver the truck to the Harbor Warehouse' },
      ] },
    { id: 5, name: 'Marina Heat', giver: 'Mama Lu',
      briefing: 'A rival crew stashed a case at the marina and posted guards. On foot. Take them down, grab the case, get back to your car.',
      reward: 2800,
      steps: [
        { type: 'goto', place: 'marina', text: 'Reach the marina on foot' },
        { type: 'combat', count: 4, place: 'marina', text: 'Take out the 4 guards at the marina' },
        { type: 'pickup', place: 'marina', text: 'Grab the case' },
        { type: 'goto', place: 'garage', text: 'Bring the case back to the garage' },
      ] },
    { id: 6, name: 'Eyes in the Sky', giver: 'Mama Lu',
      briefing: 'You are hot — three stars and a police helicopter overhead. Get to the safehouse alive. Do not get busted.',
      reward: 3200,
      steps: [
        { type: 'escape', place: 'safehouse', wanted: 3, heli: true, text: 'Escape the 3-star manhunt — reach the safehouse clean' },
      ] },
    { id: 7, name: 'The Big Score', giver: 'Mama Lu',
      briefing: 'Tonight we hit the Solmar Royale vault. Get in, take the cash, and outrun the whole city. This is the one they will remember.',
      reward: 6000,
      steps: [
        { type: 'goto', place: 'casino', text: 'Reach the Solmar Royale Casino' },
        { type: 'combat', count: 5, place: 'casino', text: 'Fight through the 5 vault guards' },
        { type: 'pickup', place: 'casino', text: 'Grab the vault cash' },
        { type: 'escape', place: 'hideout', wanted: 4, heli: true, text: 'Escape the 4-star response — reach the Beach Hideout' },
      ] },
  ];

  const CAR_MODELS = [
    { name: 'Palm Sedan', color: 0x3a7bd5, topSpeed: 34 },
    { name: 'Sunset Coupe', color: 0xd53a3a, topSpeed: 40 },
    { name: 'Bay Taxi', color: 0xf2c200, topSpeed: 32 },
    { name: 'Dune Pickup', color: 0x7a9a4d, topSpeed: 34 },
    { name: 'Marina Van', color: 0x8a8f96, topSpeed: 28 },
    { name: 'Coral Convertible', color: 0xe86aa0, topSpeed: 38 },
  ];
  const TRUCK_MODEL = { name: 'Harbor Box Truck', color: 0xcfd6dd, topSpeed: 26 };

  const RADIO_STATIONS = [
    { name: 'SOL FM', bpm: 96, root: 45, wave: 'sawtooth', mood: 'chill' },
    { name: 'BAY 101', bpm: 112, root: 41, wave: 'square', mood: 'funk' },
    { name: 'PALM BEAT', bpm: 128, root: 38, wave: 'sawtooth', mood: 'drive' },
  ];

  window.SB = window.SB || {};
  SB.CFG = CFG;
  SB.PLACES = PLACES;
  SB.MISSIONS = MISSIONS;
  SB.CAR_MODELS = CAR_MODELS;
  SB.TRUCK_MODEL = TRUCK_MODEL;
  SB.RADIO_STATIONS = RADIO_STATIONS;
  SB.rng = mulberry32;
})();
