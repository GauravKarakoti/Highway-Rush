import * as THREE from 'three';
import { config, laneX } from './config.js';
import { globalTrackCurve } from './trackCurve.js';
import { createTruckContainerTexture, createTruckRearHazardTexture } from './textures.js';
import { createRealTrafficCar, isRealModelLoaded } from './carModelLoader.js';

const KINDS = ['sedan', 'van', 'truck', 'speeder', 'police'];
// High-Visibility Ultra-Vibrant Arcade Colors (Zero dark muddy tones)
const TRAFFIC_COLORS = [
  0xff2244, // Vibrant Hot Red
  0x00c8ff, // Bright Neon Cyan
  0xffb700, // Vivid Solar Gold
  0x10d876, // Bright Emerald Green
  0xb53df5, // Neon Purple
  0xff1493, // Deep Pink
  0xff6600, // Vibrant Orange
  0xffe033, // Electric Yellow
  0x00f5d4, // Bright Turquoise
  0xf8fafc, // Gloss Pure White
  0x38bdf8, // Sky Blue
  0xf43f5e, // Rose Red
];

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.spawnTimer = 1.0;
    this.policeTimer = config.traffic.policeSpawnInterval;
    this.policeWarningActive = false;

    // Pre-allocate vehicle pool with diverse 3D body types
    for (let i = 0; i < config.pool.traffic; i++) {
      const kind = KINDS[i % KINDS.length];
      const carData = buildTrafficVehicle(kind, randomColor());
      carData.group.visible = false;
      scene.add(carData.group);

      this.pool.push({
        group: carData.group,
        wheels: carData.wheels,
        leftBlinkers: carData.leftBlinkers,
        rightBlinkers: carData.rightBlinkers,
        taillights: carData.taillights,
        policeStrobes: carData.policeStrobes,
        bodyMesh: carData.bodyMesh,
        kind,
        alive: false,
        lane: 1,
        targetLane: 1,
        baseX: laneX(1),
        baseRotY: 0,
        baseRotZ: 0,
        isChangingLane: false,
        laneChangeT: 1,
        laneChangeDir: 0,
        blinkerTimer: 0,
        speedFactor: 1.0,
        isBraking: false,
        brakeTimer: 0,
        nearMissDone: false,
        halfWidth: carData.halfWidth,
        halfLength: carData.halfLength,
        isRealModel: false,
      });
    }
  }

  reset() {
    for (const car of this.pool) {
      this._release(car);
    }
    this.active.length = 0;
    this.spawnTimer = 1.0;
    this.policeTimer = config.traffic.policeSpawnInterval;
    this.policeWarningActive = false;
  }

  update(dt, worldSpeed, playerLane, playerX, closedLane = -1) {
    const events = {
      crashed: false,
      nearMiss: false,
      blinkerTick: false,
      policeWarning: false,
      policeActive: false,
      brakeCheckAlert: false,
    };

    const difficulty = config.activeDifficulty || config.difficulties.PRO;

    // Update active traffic vehicles
    for (let i = this.active.length - 1; i >= 0; i--) {
      const car = this.active[i];

      // Relative forward movement
      let effectiveSpeedFactor = car.speedFactor;
      if (car.isBraking) {
        effectiveSpeedFactor *= 0.55; // Decelerates rapidly when brake-checking
        car.brakeTimer -= dt;
        if (car.brakeTimer <= 0) {
          car.isBraking = false;
          for (const tl of car.taillights) {
            tl.emissiveIntensity = 3.5;
          }
        }
      }

      const relativeSpeed = worldSpeed * (2.0 - effectiveSpeedFactor);
      car.group.position.z += relativeSpeed * dt;

      // Wheel spinning animation
      const wheelSpin = (relativeSpeed / 0.35) * dt;
      for (const w of car.wheels) {
        w.rotation.x += wheelSpin;
      }

      // Police strobe lights animation
      if (car.kind === 'police' && car.policeStrobes) {
        events.policeActive = true;
        const strobePhase = Math.floor(performance.now() * 0.012) % 4;
        const redOn = strobePhase < 2;
        car.policeStrobes.red.emissiveIntensity = redOn ? 4.5 : 0.2;
        car.policeStrobes.blue.emissiveIntensity = !redOn ? 4.5 : 0.2;
      }

      // AI Lane changing behavior
      if (car.blinkerTimer > 0) {
        car.blinkerTimer -= dt;
        // Blink indicator lights at ~3.2 Hz
        const blinkState = Math.sin(car.blinkerTimer * Math.PI * 6.4) > 0;
        const blinkers = car.laneChangeDir < 0 ? car.leftBlinkers : car.rightBlinkers;
        for (const b of blinkers) {
          b.emissiveIntensity = blinkState ? 3.5 : 0.1;
        }

        // Trigger blinker audio tick
        if (Math.abs(car.group.position.z) < 45 && Math.sin(car.blinkerTimer * Math.PI * 6.4) > 0.8) {
          events.blinkerTick = true;
        }

        if (car.blinkerTimer <= 0) {
          // Warning done -> start smooth lane change
          car.isChangingLane = true;
          car.laneChangeT = 0;
          for (const b of blinkers) b.emissiveIntensity = 0.1;
        }
      }

      if (car.isChangingLane) {
        car.laneChangeT += dt / config.traffic.laneChangeTime;
        const t = Math.min(1, car.laneChangeT);
        const startX = laneX(car.lane);
        const endX = laneX(car.targetLane);
        car.baseX = THREE.MathUtils.lerp(startX, endX, easeInOutQuad(t));
        // Subtle tilt & yaw during lane merge
        car.baseRotZ = -car.laneChangeDir * 0.16 * Math.sin(t * Math.PI);
        car.baseRotY = car.laneChangeDir * 0.12 * Math.sin(t * Math.PI);

        if (car.laneChangeT >= 1) {
          car.lane = car.targetLane;
          car.baseX = laneX(car.lane);
          car.baseRotZ = 0;
          car.baseRotY = 0;
          car.isChangingLane = false;
        }
      }

      // Synchronize with 3D Highway Curvature & Rolling Hills
      const z = car.group.position.z;
      const curveX = globalTrackCurve.getCurveOffset(z);
      const hillY = globalTrackCurve.getHillOffset(z);
      const yaw = globalTrackCurve.getCurveYaw(z);

      car.group.position.x = car.baseX + curveX;
      car.group.position.y = hillY;
      car.group.rotation.y = car.baseRotY + yaw;
      car.group.rotation.z = car.baseRotZ;

      // Despawn if passed behind player camera
      if (car.group.position.z > config.despawnZ) {
        this._release(car);
        this.active.splice(i, 1);
        continue;
      }

      // Near miss check (close adjacent pass)
      if (!car.nearMissDone) {
        const carZ = car.group.position.z;
        const currentCarLane = Math.round((car.baseX / config.laneWidth) + (config.lanes - 1) / 2);
        const adjacent = Math.abs(currentCarLane - playerLane) === 1;
        if (adjacent && carZ > -config.nearMissZ && carZ < config.nearMissZ) {
          car.nearMissDone = true;
          events.nearMiss = true;
        }
      }

      // AABB Collision check
      if (aabbHit(playerX, car)) {
        events.crashed = true;
      }
    }

    // Opportunity check for AI lane changes & sudden brake checks
    this._updateAiDecisions(closedLane, difficulty);

    // Police pursuit event timer
    this.policeTimer -= dt;
    if (this.policeTimer <= 3.5 && this.policeTimer > 0) {
      events.policeWarning = true;
    }
    if (this.policeTimer <= 0) {
      this._spawnPolicePursuit();
      this.policeTimer = difficulty.policeInterval + Math.random() * 12;
    }

    // Wave Spawner
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnWave(worldSpeed, closedLane, difficulty);
      const speedT = THREE.MathUtils.clamp(
        (worldSpeed - config.baseSpeed) / (config.maxSpeed * config.nitroMultiplier - config.baseSpeed),
        0,
        1,
      );
      const interval = THREE.MathUtils.lerp(
        config.spawnIntervalStart,
        config.spawnIntervalMin,
        speedT,
      );
      this.spawnTimer = interval * (config.baseSpeed / Math.max(worldSpeed, config.baseSpeed));
    }

    return events;
  }

  _updateAiDecisions(closedLane, difficulty) {
    for (const car of this.active) {
      if (car.isChangingLane || car.blinkerTimer > 0) continue;
      if (car.group.position.z > -15 || car.group.position.z < -110) continue;

      // 1. Mandatory Merge for Cars in Closed Construction Lane
      if (closedLane !== -1 && (car.lane === closedLane || car.targetLane === closedLane)) {
        const mergeDir = closedLane === 0 ? 1 : (closedLane === config.lanes - 1 ? -1 : (Math.random() > 0.5 ? 1 : -1));
        const targetL = car.lane + mergeDir;
        if (targetL >= 0 && targetL < config.lanes) {
          car.laneChangeDir = mergeDir;
          car.targetLane = targetL;
          car.blinkerTimer = 0.5; // Fast emergency merge
          continue;
        }
      }

      // 2. Sudden Brake-Check Chance (Increases in PRO & INSANITY)
      if (!car.isBraking && car.kind !== 'police' && Math.random() < difficulty.brakeCheckChance * 0.008) {
        car.isBraking = true;
        car.brakeTimer = 1.0 + Math.random() * 0.8;
        for (const tl of car.taillights) {
          tl.emissiveIntensity = 5.5; // Blinding bright brake flare
        }
      }

      // 3. AI Lane Changing & Overtaking
      const changeChance = car.kind === 'speeder' ? 0.028 : difficulty.laneChangeChance * 0.012;
      if (Math.random() < changeChance) {
        const possibleDirs = [];
        if (car.lane > 0 && car.lane - 1 !== closedLane && this._laneClearForShift(car.lane - 1, car.group.position.z)) {
          possibleDirs.push(-1);
        }
        if (car.lane < config.lanes - 1 && car.lane + 1 !== closedLane && this._laneClearForShift(car.lane + 1, car.group.position.z)) {
          possibleDirs.push(1);
        }

        if (possibleDirs.length > 0) {
          const dir = possibleDirs[(Math.random() * possibleDirs.length) | 0];
          car.laneChangeDir = dir;
          car.targetLane = car.lane + dir;
          car.blinkerTimer = config.traffic.blinkerWarningTime;
        }
      }
    }
  }

  _laneClearForShift(targetLane, z) {
    for (const other of this.active) {
      if (other.lane === targetLane || other.targetLane === targetLane) {
        if (Math.abs(other.group.position.z - z) < 16) return false;
      }
    }
    return true;
  }

  _spawnWave(worldSpeed, closedLane, difficulty) {
    // Determine wave count (1 to 3 cars out of 4 lanes)
    // Guarantee that at least 1 lane is always open and passable!
    const roll = Math.random();
    let count = 1;
    if (roll < 0.35) count = 2;
    else if (roll < 0.78) count = 3;

    // Filter available lanes (avoid spawning in closed construction lane)
    const allLanes = [];
    for (let l = 0; l < config.lanes; l++) {
      if (l !== closedLane) allLanes.push(l);
    }
    shuffle(allLanes);
    const chosenLanes = allLanes.slice(0, Math.min(count, allLanes.length - 1));

    let z = config.spawnZ - Math.random() * 8;

    for (let i = 0; i < chosenLanes.length; i++) {
      const lane = chosenLanes[i];
      if (!this._laneClear(lane, z)) continue;
      if (this._wouldSealPath(lane, z, closedLane)) continue;

      let kind = randomKind();
      // Outer lanes have more slow heavy trucks
      if ((lane === 0 || lane === 3) && Math.random() < 0.45) {
        kind = 'truck';
      }

      this._activate(lane, z, kind);
      z -= 8 + Math.random() * 10;
    }
  }

  _spawnPolicePursuit() {
    const lane = (Math.random() * config.lanes) | 0;
    const z = config.spawnZ - 12;
    this._activate(lane, z, 'police');
  }

  _laneClear(lane, z) {
    for (const car of this.active) {
      if (car.lane === lane && Math.abs(car.group.position.z - z) < config.minSameLaneGap) {
        return false;
      }
    }
    return true;
  }

  _wouldSealPath(lane, z, closedLane) {
    const blocked = new Set([lane]);
    if (closedLane !== -1) blocked.add(closedLane);
    for (const car of this.active) {
      if (Math.abs(car.group.position.z - z) < config.minCrossBlockGap) {
        blocked.add(car.lane);
        if (car.targetLane !== undefined) {
          blocked.add(car.targetLane);
        }
      }
    }
    return blocked.size >= config.lanes;
  }

  _activate(lane, z, kind) {
    // If real 3D model is loaded and kind is speeder, try to use or upgrade to real Ferrari 3D model
    let car = null;
    if (kind === 'speeder' && isRealModelLoaded()) {
      car = this.pool.find((c) => !c.alive && c.isRealModel);
      if (!car) {
        // Upgrade an unused pool car to real Ferrari model
        const unused = this.pool.find((c) => !c.alive && !c.isRealModel);
        if (unused) {
          const realCarData = createRealTrafficCar(randomColor());
          if (realCarData) {
            this.scene.remove(unused.group);
            this.scene.add(realCarData.group);
            unused.group = realCarData.group;
            unused.wheels = realCarData.wheels;
            unused.taillights = realCarData.taillights;
            unused.bodyMesh = realCarData.bodyMesh;
            unused.isRealModel = true;
            unused.kind = 'speeder';
            car = unused;
          }
        }
      }
    }

    if (!car) {
      car =
        this.pool.find((c) => !c.alive && c.kind === kind) ||
        this.pool.find((c) => !c.alive);
    }
    if (!car) return;

    car.alive = true;
    car.lane = lane;
    car.targetLane = lane;
    car.baseX = laneX(lane);
    car.baseRotY = 0;
    car.baseRotZ = 0;
    car.isChangingLane = false;
    car.laneChangeT = 1;
    car.blinkerTimer = 0;
    car.isBraking = false;
    car.brakeTimer = 0;
    car.nearMissDone = false;

    // Set speed factor based on vehicle kind
    car.speedFactor = config.traffic.speeds[car.kind] || 0.88;
    if (car.kind === 'speeder') car.speedFactor += Math.random() * 0.18;

    // Random vivid color for cars
    if (car.bodyMesh && car.kind !== 'police') {
      car.bodyMesh.material.color.setHex(randomColor());
    }

    car.group.visible = true;
    car.group.position.set(laneX(lane), 0, z);
    car.group.rotation.set(0, 0, 0);

    this.active.push(car);
  }

  _release(car) {
    car.alive = false;
    car.group.visible = false;
    car.isBraking = false;
    for (const b of car.leftBlinkers) b.emissiveIntensity = 0.1;
    for (const b of car.rightBlinkers) b.emissiveIntensity = 0.1;
    for (const tl of car.taillights) tl.emissiveIntensity = 3.5;
  }
}

/** Builds distinct procedural 3D traffic vehicles with blinkers, taillights, and wheels */
export function buildTrafficVehicle(kind, color) {
  const g = new THREE.Group();
  const wheels = [];
  const leftBlinkers = [];
  const rightBlinkers = [];
  const taillights = [];
  let policeStrobes = null;
  let bodyMesh = null;

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a20, roughness: 0.9 });
  const wheelHubMat = new THREE.MeshStandardMaterial({ color: 0xd8e2ee, metalness: 0.85, roughness: 0.2 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x162234,
    metalness: 0.85,
    roughness: 0.15,
    transparent: true,
    opacity: 0.85,
  });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6cf, emissiveIntensity: 3.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0020, emissiveIntensity: 3.5 });

  // Blinker materials (Vivid Amber emissive)
  const blinkerLeftMat = new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff8800, emissiveIntensity: 0.1 });
  const blinkerRightMat = new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff8800, emissiveIntensity: 0.1 });
  leftBlinkers.push(blinkerLeftMat);
  rightBlinkers.push(blinkerRightMat);
  taillights.push(tailMat);

  let halfW = 0.9;
  let halfL = 2.0;

  // 3D Forward Headlight Beams
  const lightConeMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4,
    transparent: true,
    opacity: 0.10,
    depthWrite: false,
  });

  if (kind === 'truck') {
    // 18-WHEELER SEMI-TRUCK WITH CARGO CONTAINER
    halfW = 1.15;
    halfL = 4.2;

    const cabMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.25 });
    const containerMat = new THREE.MeshStandardMaterial({
      map: createTruckContainerTexture(color),
      roughness: 0.45,
      metalness: 0.35,
    });

    // Front Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.8, 2.2), cabMat);
    cab.position.set(0, 1.1, -2.8);
    cab.castShadow = true;
    g.add(cab);
    bodyMesh = cab;

    // Windshield
    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.12), glassMat);
    cabGlass.position.set(0, 1.45, -3.85);
    g.add(cabGlass);

    // Chrome Grille & Bumper
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 0.15), chromeMat);
    grille.position.set(0, 0.65, -3.88);
    g.add(grille);

    // Dual vertical exhaust stacks
    for (const x of [-0.98, 0.98]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), chromeMat);
      stack.position.set(x, 1.7, -1.8);
      g.add(stack);
    }

    // Long Cargo Container Trailer
    const container = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 5.8), containerMat);
    container.position.set(0, 1.4, 1.1);
    container.castShadow = true;
    g.add(container);

    // High-visibility hazard chevron on rear container doors
    const hazardMat = new THREE.MeshBasicMaterial({ map: createTruckRearHazardTexture() });
    const rearHazard = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), hazardMat);
    rearHazard.position.set(0, 1.4, 4.02);
    g.add(rearHazard);

    // Multi-axle truck wheels
    const truckZ = [-3.0, 1.8, 3.2];
    for (const z of truckZ) {
      for (const x of [-1.08, 1.08]) {
        const w = createSimpleWheel(tireMat, wheelHubMat, 0.42, 0.36);
        w.position.set(x, 0.42, z);
        g.add(w);
        wheels.push(w);
      }
    }

    // Headlights
    for (const x of [-0.75, 0.75]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), headMat);
      hl.position.set(x, 0.65, -3.9);
      g.add(hl);
    }

    // Forward light cones
    for (const x of [-0.75, 0.75]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 10.0, 10, 1, true), lightConeMat);
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(x, 0.65, -8.9);
      g.add(cone);
    }

    // Taillights
    for (const x of [-0.85, 0.85]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.1), tailMat);
      tl.position.set(x, 0.6, 4.02);
      g.add(tl);
    }

    // Blinkers
    const blF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.08), blinkerLeftMat);
    blF.position.set(-1.02, 0.65, -3.86);
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.08), blinkerLeftMat);
    blR.position.set(-1.02, 0.6, 4.02);
    g.add(blF, blR);

    const brF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.08), blinkerRightMat);
    brF.position.set(1.02, 0.65, -3.86);
    const brR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.08), blinkerRightMat);
    brR.position.set(1.02, 0.6, 4.02);
    g.add(brF, brR);

  } else if (kind === 'police') {
    // POLICE INTERCEPTOR WITH STROBE LIGHTBAR
    halfW = 0.95;
    halfL = 2.1;

    const policeBodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.25 });
    const blackPanelMat = new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.6, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 3.8), policeBodyMat);
    body.position.set(0, 0.52, 0);
    body.castShadow = true;
    g.add(body);
    bodyMesh = body;

    const hoodDecal = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.02, 1.4), blackPanelMat);
    hoodDecal.position.set(0, 0.82, -1.1);
    g.add(hoodDecal);

    const roofDecal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.1), blackPanelMat);
    roofDecal.position.set(0, 1.25, 0);
    g.add(roofDecal);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.52, 1.8), glassMat);
    cabin.position.set(0, 0.98, -0.1);
    g.add(cabin);

    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.25), chromeMat);
    bullBar.position.set(0, 0.48, -1.98);
    g.add(bullBar);

    // Roof Police Lightbar
    const strobeRedMat = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0020, emissiveIntensity: 4.5 });
    const strobeBlueMat = new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0066ff, emissiveIntensity: 4.5 });
    const lightbarBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.2), chromeMat);
    lightbarBase.position.set(0, 1.28, -0.1);
    const strobeRed = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.18), strobeRedMat);
    strobeRed.position.set(-0.26, 1.35, -0.1);
    const strobeBlue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.18), strobeBlueMat);
    strobeBlue.position.set(0.26, 1.35, -0.1);
    g.add(lightbarBase, strobeRed, strobeBlue);
    policeStrobes = { red: strobeRedMat, blue: strobeBlueMat };

    for (const z of [-1.15, 1.15]) {
      for (const x of [-0.92, 0.92]) {
        const w = createSimpleWheel(tireMat, wheelHubMat, 0.35, 0.28);
        w.position.set(x, 0.35, z);
        g.add(w);
        wheels.push(w);
      }
    }

    for (const x of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), headMat);
      hl.position.set(x, 0.54, -1.92);
      g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), tailMat);
      tl.position.set(x, 0.56, 1.92);
      g.add(tl);
    }

    const blF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), blinkerLeftMat);
    blF.position.set(-0.84, 0.54, -1.91);
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), blinkerLeftMat);
    blR.position.set(-0.84, 0.56, 1.91);
    g.add(blF, blR);

    const brF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), blinkerRightMat);
    brF.position.set(0.84, 0.54, -1.91);
    const brR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), blinkerRightMat);
    brR.position.set(0.84, 0.56, 1.91);
    g.add(brF, brR);

  } else if (kind === 'speeder') {
    // SLEEK RACING / TUNER COUPE
    halfW = 0.88;
    halfL = 1.95;

    const tunerMat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.44, 3.6), tunerMat);
    body.position.set(0, 0.46, 0);
    body.castShadow = true;
    g.add(body);
    bodyMesh = body;

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 3.6), chromeMat);
    stripe.position.set(0, 0.69, 0);
    g.add(stripe);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.46, 1.6), glassMat);
    cabin.position.set(0, 0.84, -0.1);
    g.add(cabin);

    // GT Wing Spoiler
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.38), tunerMat);
    spoiler.position.set(0, 1.08, 1.65);
    spoiler.rotation.x = 0.08;
    g.add(spoiler);
    for (const x of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.12), chromeMat);
      post.position.set(x, 0.88, 1.62);
      g.add(post);
    }

    for (const z of [-1.15, 1.15]) {
      for (const x of [-0.88, 0.88]) {
        const w = createSimpleWheel(tireMat, wheelHubMat, 0.34, 0.28);
        w.position.set(x, 0.34, z);
        g.add(w);
        wheels.push(w);
      }
    }

    for (const x of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), headMat);
      hl.position.set(x, 0.48, -1.82);
      g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), tailMat);
      tl.position.set(x, 0.52, 1.82);
      g.add(tl);
    }

    const blF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), blinkerLeftMat);
    blF.position.set(-0.8, 0.48, -1.81);
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), blinkerLeftMat);
    blR.position.set(-0.8, 0.52, 1.81);
    g.add(blF, blR);

    const brF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), blinkerRightMat);
    brF.position.set(0.8, 0.48, -1.81);
    const brR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), blinkerRightMat);
    brR.position.set(0.8, 0.52, 1.81);
    g.add(brF, brR);

  } else if (kind === 'van') {
    // DELIVERY / CARGO VAN
    halfW = 0.92;
    halfL = 2.2;

    const vanMat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.35, 4.2), vanMat);
    body.position.set(0, 1.05, 0);
    body.castShadow = true;
    g.add(body);
    bodyMesh = body;

    const frontCab = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.95, 0.9), vanMat);
    frontCab.position.set(0, 0.78, -2.35);
    g.add(frontCab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.6, 0.1), glassMat);
    windshield.position.set(0, 1.25, -2.05);
    g.add(windshield);

    for (const z of [-1.3, 1.3]) {
      for (const x of [-0.94, 0.94]) {
        const w = createSimpleWheel(tireMat, wheelHubMat, 0.38, 0.3);
        w.position.set(x, 0.38, z);
        g.add(w);
        wheels.push(w);
      }
    }

    for (const x of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.08), headMat);
      hl.position.set(x, 0.68, -2.82);
      g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.08), tailMat);
      tl.position.set(x, 1.05, 2.12);
      g.add(tl);
    }

    const blF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), blinkerLeftMat);
    blF.position.set(-0.86, 0.68, -2.81);
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), blinkerLeftMat);
    blR.position.set(-0.86, 1.05, 2.12);
    g.add(blF, blR);

    const brF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), blinkerRightMat);
    brF.position.set(0.86, 0.68, -2.81);
    const brR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), blinkerRightMat);
    brR.position.set(0.86, 1.05, 2.12);
    g.add(brF, brR);

  } else {
    // STANDARD SEDAN / COMMUTER CAR
    halfW = 0.88;
    halfL = 1.9;

    const sedanMat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.58, 3.6), sedanMat);
    body.position.set(0, 0.54, 0);
    body.castShadow = true;
    g.add(body);
    bodyMesh = body;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.52, 1.8), glassMat);
    cabin.position.set(0, 0.98, -0.05);
    g.add(cabin);

    for (const z of [-1.1, 1.1]) {
      for (const x of [-0.88, 0.88]) {
        const w = createSimpleWheel(tireMat, wheelHubMat, 0.34, 0.26);
        w.position.set(x, 0.34, z);
        g.add(w);
        wheels.push(w);
      }
    }

    for (const x of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.08), headMat);
      hl.position.set(x, 0.54, -1.82);
      g.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.08), tailMat);
      tl.position.set(x, 0.56, 1.82);
      g.add(tl);
    }

    const blF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), blinkerLeftMat);
    blF.position.set(-0.8, 0.54, -1.81);
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), blinkerLeftMat);
    blR.position.set(-0.8, 0.56, 1.81);
    g.add(blF, blR);

    const brF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), blinkerRightMat);
    brF.position.set(0.8, 0.54, -1.81);
    const brR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), blinkerRightMat);
    brR.position.set(0.8, 0.56, 1.81);
    g.add(brF, brR);
  }

  return {
    group: g,
    wheels,
    leftBlinkers,
    rightBlinkers,
    taillights,
    policeStrobes,
    bodyMesh,
    halfWidth: halfW,
    halfLength: halfL,
  };
}

function createSimpleWheel(tireMat, hubMat, radius, width) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), tireMat);
  tire.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width + 0.02, 8), hubMat);
  hub.rotation.z = Math.PI / 2;
  g.add(tire, hub);
  return g;
}

function aabbHit(playerX, car) {
  const hw = car.halfWidth + config.playerHalfWidth;
  const hl = car.halfLength + config.playerHalfLength;
  const dx = Math.abs(playerX - car.baseX);
  const dz = Math.abs(0 - car.group.position.z);
  return dx < hw * 0.82 && dz < hl * 0.78;
}

function randomColor() {
  return TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0];
}

function randomKind() {
  const r = Math.random();
  if (r < 0.35) return 'sedan';
  if (r < 0.58) return 'van';
  if (r < 0.82) return 'truck';
  return 'speeder';
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
