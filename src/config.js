/** All tunable gameplay and presentation values live here. */
export const config = {
  lanes: 4,
  laneWidth: 3.5,

  // Forward speed in world units per second. Soft-caps toward maxSpeed.
  baseSpeed: 30,
  maxSpeed: 90,
  speedRamp: 0.48,
  minSpeed: 14,
  brakeDecel: 36,

  // Display conversion so 30 u/s ≈ 135 km/h, 90 u/s ≈ 405 km/h, nitro top ≈ 620 km/h.
  kmhPerUnit: 4.5,

  spawnZ: -140,
  despawnZ: 18,
  minSameLaneGap: 20,
  minCrossBlockGap: 12,

  spawnIntervalStart: 0.95,
  spawnIntervalMin: 0.30,

  // Player car handling
  playerSwitchTime: 0.16,
  playerTiltMax: 0.32,
  playerHalfWidth: 0.9,
  playerHalfLength: 2.05,

  // Smooth continuous steering
  freeSteerSpeed: 25.0,
  freeSteerDamp: 12.0,
  freeSteerReturn: 4.2,

  // Nitro mechanics
  nitroMultiplier: 1.68,
  nitroDrainPerSec: 35,
  nitroRechargePerSec: 14,
  nitroLockoutSec: 1.1,
  nitroMinToStart: 8,
  nitroScoreMul: 2.2,
  nitroFovBoost: 19,
  nearMissNitroBonus: 14,

  // Scoring & Combo System
  scorePerUnit: 1.25,
  speedScoreFactor: 0.04,
  nearMissZ: 3.6,
  nearMissBonus: 50,
  comboWindow: 2.4,
  maxComboMultiplier: 10,

  crashDuration: 1.0,

  // Speed Breaker mechanics
  speedBreaker: {
    duration: 2.5, // 2-3 seconds speed reduction penalty
    reducedSpeed: 16.0, // Reduced speed cap during penalty (~45 km/h)
    safeCrossingSpeed: 22.0, // Below this speed + braking, crossing is smooth
    bumpHeight: 0.16,
    bumpDepth: 1.5,
  },

  // Difficulty presets
  difficulties: {
    NORMAL: {
      name: 'NORMAL',
      label: 'NORMAL',
      baseSpeed: 24,
      maxSpeed: 74,
      speedRamp: 0.35,
      spawnIntervalStart: 1.25,
      spawnIntervalMin: 0.42,
      laneChangeChance: 0.28,
      brakeCheckChance: 0.05,
      constructionInterval: 38,
      oilSlickInterval: 30,
      policeInterval: 32,
      speedBreakerInterval: 24,
      densityMul: 1.0,
      description: 'Classic arcade cruise. Steady traffic flow and wide passing opportunities.',
    },
    PRO: {
      name: 'PRO',
      label: 'PRO (CHALLENGE)',
      baseSpeed: 30,
      maxSpeed: 90,
      speedRamp: 0.48,
      spawnIntervalStart: 0.95,
      spawnIntervalMin: 0.30,
      laneChangeChance: 0.52,
      brakeCheckChance: 0.22,
      constructionInterval: 22,
      oilSlickInterval: 18,
      policeInterval: 20,
      speedBreakerInterval: 18,
      densityMul: 1.35,
      description: 'Fast & demanding. Rapid lane-cutters, sudden brake checks, and construction chicanes.',
    },
    INSANITY: {
      name: 'INSANITY',
      label: 'INSANITY (CHAOS)',
      baseSpeed: 38,
      maxSpeed: 108,
      speedRamp: 0.72,
      spawnIntervalStart: 0.75,
      spawnIntervalMin: 0.22,
      laneChangeChance: 0.75,
      brakeCheckChance: 0.38,
      constructionInterval: 15,
      oilSlickInterval: 12,
      policeInterval: 14,
      speedBreakerInterval: 14,
      densityMul: 1.7,
      description: 'Maximum adrenaline! Relentless traffic swarms, slick oil patches, and high-speed pursuits.',
    },
  },

  // Real Cars Database
  cars: {
    ferrari_italia: {
      id: 'ferrari_italia',
      name: 'Ferrari 458 Italia',
      brand: 'FERRARI',
      color: 0xef1122,
      accent: 0x111620,
      speedStat: 99,
      accelStat: 98,
      handlingStat: 96,
      nitroStat: 95,
      desc: 'Authentic 3D Real Model. Mid-engine V8 with sculpted aerodynamics & clearcoat finish.',
      isRealModel: true,
    },
    porsche_gt3: {
      id: 'porsche_gt3',
      name: 'Porsche 911 GT3 RS',
      brand: 'PORSCHE',
      color: 0x10d860,
      accent: 0x111620,
      speedStat: 88,
      accelStat: 90,
      handlingStat: 98,
      nitroStat: 85,
      desc: 'Precision Track Weapon with swan-neck aero wing & razor-sharp handling.',
    },
    lambo_aventador: {
      id: 'lambo_aventador',
      name: 'Lamborghini Aventador SVJ',
      brand: 'LAMBORGHINI',
      color: 0xffc300,
      accent: 0x181a24,
      speedStat: 98,
      accelStat: 94,
      handlingStat: 86,
      nitroStat: 95,
      desc: 'Stealth-fighter wedge with howling V12 exhaust and extreme top speed.',
    },
    nissan_gtr: {
      id: 'nissan_gtr',
      name: 'Nissan Skyline GT-R R34',
      brand: 'NISSAN',
      color: 0x1d4ed8,
      accent: 0xd97706,
      speedStat: 90,
      accelStat: 96,
      handlingStat: 92,
      nitroStat: 100,
      desc: 'Japanese twin-turbo legend featuring iconic circular halo taillights.',
    },
    ferrari_f40: {
      id: 'ferrari_f40',
      name: 'Ferrari F40 Twin-Turbo',
      brand: 'FERRARI',
      color: 0xef1122,
      accent: 0x111620,
      speedStat: 96,
      accelStat: 95,
      handlingStat: 90,
      nitroStat: 88,
      desc: 'Raw 80s supercar icon with iconic high box wing and triple exhausts.',
    },
  },

  // Camera presets
  cameraModes: ['CHASE', 'HOOD', 'DRONE'],
  camera: {
    CHASE: {
      height: 4.6,
      back: 8.6,
      lookAhead: 28,
      followX: 0.42,
      fovBase: 60,
      fovSpeedGain: 14,
    },
    HOOD: {
      height: 1.35,
      back: 0.5,
      lookAhead: 35,
      followX: 0.95,
      fovBase: 72,
      fovSpeedGain: 18,
    },
    DRONE: {
      height: 9.2,
      back: 14.5,
      lookAhead: 24,
      followX: 0.28,
      fovBase: 52,
      fovSpeedGain: 9,
    },
    shakeNitro: 0.15,
    shakeBrake: 0.09,
    shakeCrash: 0.60,
  },

  // Traffic AI behaviors
  traffic: {
    laneChangeChance: 0.52,
    blinkerBlinkRate: 3.2,
    blinkerWarningTime: 0.85,
    laneChangeTime: 0.65,
    policeSpawnInterval: 20,
    speeds: {
      truck: 0.62,
      van: 0.78,
      sedan: 0.90,
      speeder: 1.32,
      police: 1.58,
    },
  },

  // Atmosphere & Colors (High-Visibility Radiant Sunset Palette)
  fogColor: 0x42264c,
  fogNear: 85,
  fogFar: 250,
  skyColor: 0x241b38,

  audio: {
    master: 0.6,
  },

  pool: {
    traffic: 40,
    particles: 64,
    sparks: 40,
    scenery: 24,
  },
};

/** Converts a 0-indexed lane number to its 3D X coordinate */
export function laneX(lane) {
  return (lane - (config.lanes - 1) / 2) * config.laneWidth;
}

export function applyDifficulty(diffKey = 'PRO') {
  const d = config.difficulties[diffKey] || config.difficulties.PRO;
  config.activeDifficulty = d;
  config.baseSpeed = d.baseSpeed;
  config.maxSpeed = d.maxSpeed;
  config.speedRamp = d.speedRamp;
  config.spawnIntervalStart = d.spawnIntervalStart;
  config.spawnIntervalMin = d.spawnIntervalMin;
  config.traffic.laneChangeChance = d.laneChangeChance;
  config.traffic.policeSpawnInterval = d.policeInterval;
  return d;
}

// Attach to config object so config.applyDifficulty() works everywhere
config.applyDifficulty = applyDifficulty;

// Initialize with PRO as default
applyDifficulty('PRO');