import * as THREE from 'three';
import { config, laneX } from './config.js';
import { getSettings } from './storage.js';
import { preloadCarModel, createRealCarInstance } from './carModelLoader.js';
import { globalTrackCurve } from './trackCurve.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.settings = getSettings();
    this.carId = this.settings.selectedCar || 'ferrari_italia';

    this.lane = 1;
    this.fromLane = 1;
    this.toLane = 1;
    this.switchT = 1;
    this.buffered = 0;

    // Continuous analog-like steering coordinates
    this.x = laneX(1);
    this.vx = 0;
    this.tilt = 0;
    this.pitch = 0;
    this.steeringYaw = 0;

    this.steerInput = 0; // -1 (left), 0 (none), 1 (right)

    this.nitroHeld = false;
    this.nitroActive = false;
    this.nitro = 100;
    this.lockout = 0;

    this.brakeHeld = false;
    this.isBraking = false;

    // Build the initial car mesh (procedural first)
    this._loadCarModel(this.carId);

    // Preload the real 3D GLTF model and upgrade seamlessly
    preloadCarModel().then((gltf) => {
      if (gltf) {
        this._loadCarModel(this.carId);
      }
    });
  }

  setCar(carId) {
    if (!config.cars[carId]) return;
    this.carId = carId;
    this._loadCarModel(carId);
  }

  _loadCarModel(carId) {
    if (this.group) {
      this.scene.remove(this.group);
    }

    // Try real 3D car model first
    let carData = createRealCarInstance(carId);
    if (!carData) {
      carData = buildRealCar(carId);
    }

    this.carData = carData;
    this.group = carData.group;
    this.wheels = carData.wheels;
    this.frontWheels = carData.frontWheels;
    this.flames = carData.flames;
    this.taillights = carData.taillights;
    this.brakelights = carData.brakelights;
    this.underglow = carData.underglow;

    // Forward 3D Headlight Beams illuminating the road ahead
    const headlightConeMat = new THREE.MeshBasicMaterial({
      color: 0xfff6cf,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    for (const x of [-0.62, 0.62]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 16.0, 12, 1, true), headlightConeMat);
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(x, 0.45, -10.0);
      this.group.add(cone);
    }

    this.group.position.set(this.x, 0, 0);
    this.scene.add(this.group);
    this.setFlames(false);
  }

  applyOilSlip() {
    this.oilSlipTimer = 1.1;
    const slipDir = this.vx !== 0 ? Math.sign(this.vx) : (Math.random() > 0.5 ? 1 : -1);
    this.vx = slipDir * 12.0;
    this.steeringYaw = -slipDir * 0.42;
  }

  reset() {
    this.lane = 1;
    this.fromLane = 1;
    this.toLane = 1;
    this.switchT = 1;
    this.buffered = 0;
    this.x = laneX(1);
    this.vx = 0;
    this.tilt = 0;
    this.pitch = 0;
    this.steeringYaw = 0;
    this.steerInput = 0;
    this.oilSlipTimer = 0;

    this.nitroHeld = false;
    this.nitroActive = false;
    this.nitro = 100;
    this.lockout = 0;
    this.brakeHeld = false;
    this.isBraking = false;

    this.group.position.set(this.x, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.setFlames(false);
    this.setBrakeVisuals(false);
  }

  setSteerInput(val) {
    this.steerInput = THREE.MathUtils.clamp(val, -1, 1);
  }

  requestLane(dir) {
    if (this.settings.steeringMode === 'SMOOTH') {
      this.steerInput = dir;
      return;
    }

    // Classic lane-switch mode
    const next = THREE.MathUtils.clamp(this.toLane + dir, 0, config.lanes - 1);
    if (next === this.toLane) return;
    if (this.switchT < 1) {
      this.buffered = dir;
      return;
    }
    this.fromLane = this.lane;
    this.toLane = next;
    this.switchT = 0;
  }

  setNitroHeld(held) {
    this.nitroHeld = held;
  }

  setBrakeHeld(held) {
    this.brakeHeld = held;
  }

  addNitro(amount) {
    this.nitro = Math.min(100, this.nitro + amount);
  }

  update(dt, currentSpeed) {
    this.settings = getSettings();
    const sens = this.settings.steeringSensitivity || 1.0;
    const roadHalfWidth = (config.lanes * config.laneWidth) * 0.5 - 0.75;

    // Movement Logic
    if (this.settings.steeringMode === 'SMOOTH') {
      // Fluid Analog Steering Mode
      const targetVx = this.steerInput * config.freeSteerSpeed * sens;
      this.vx = THREE.MathUtils.damp(this.vx, targetVx, config.freeSteerDamp, dt);

      // Natural soft return towards nearest lane center when hands off controls
      if (Math.abs(this.steerInput) < 0.05) {
        const currentApproxLane = THREE.MathUtils.clamp(
          Math.round((this.x / config.laneWidth) + (config.lanes - 1) / 2),
          0,
          config.lanes - 1
        );
        const centerDist = laneX(currentApproxLane) - this.x;
        this.vx += centerDist * config.freeSteerReturn * dt;
      }

      this.x += this.vx * dt;
      this.x = THREE.MathUtils.clamp(this.x, -roadHalfWidth, roadHalfWidth);

      // Calculate current approximate lane for scoring and traffic checks
      this.lane = THREE.MathUtils.clamp(
        Math.round((this.x / config.laneWidth) + (config.lanes - 1) / 2),
        0,
        config.lanes - 1
      );

      // Dynamics: Wheel steering angle & Chassis lateral body roll
      const targetYaw = -this.vx * 0.022;
      this.steeringYaw = THREE.MathUtils.damp(this.steeringYaw, targetYaw, 14, dt);

      const targetTilt = -this.vx * 0.016;
      this.tilt = THREE.MathUtils.damp(this.tilt, targetTilt, 12, dt);

    } else {
      // Discrete Arcade Lane Snapping Mode
      if (this.switchT < 1) {
        this.switchT = Math.min(1, this.switchT + dt / config.playerSwitchTime);
        const e = easeOutCubic(this.switchT);
        this.x = THREE.MathUtils.lerp(laneX(this.fromLane), laneX(this.toLane), e);
        const rollDir = this.toLane - this.fromLane;
        this.tilt = -rollDir * config.playerTiltMax * Math.sin(this.switchT * Math.PI);
        this.steeringYaw = -rollDir * 0.35 * Math.sin(this.switchT * Math.PI);

        if (this.switchT >= 1) {
          this.lane = this.toLane;
          this.tilt = 0;
          this.steeringYaw = 0;
          if (this.buffered) {
            const dir = this.buffered;
            this.buffered = 0;
            this.requestLane(dir);
          }
        }
      } else {
        this.x = laneX(this.lane);
        this.tilt *= Math.max(0, 1 - dt * 14);
        this.steeringYaw *= Math.max(0, 1 - dt * 16);
      }
    }

    // Nitro handling
    this.lockout = Math.max(0, this.lockout - dt);
    const canStart =
      this.nitroHeld && !this.brakeHeld && this.lockout <= 0 && this.nitro >= config.nitroMinToStart;
    const keepGoing = this.nitroHeld && !this.brakeHeld && this.nitro > 0 && this.lockout <= 0 && this.nitroActive;
    const wasActive = this.nitroActive;
    this.nitroActive = canStart || keepGoing;

    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - config.nitroDrainPerSec * dt);
      if (this.nitro <= 0) {
        this.nitroActive = false;
        this.lockout = config.nitroLockoutSec;
      }
    } else {
      this.nitro = Math.min(100, this.nitro + config.nitroRechargePerSec * dt);
    }

    // Braking state
    this.isBraking = this.brakeHeld && !this.nitroActive;
    this.setBrakeVisuals(this.isBraking);

    // Dynamic pitch: lifts nose under nitro boost, dips on braking
    const targetPitch = this.nitroActive ? -0.06 : (this.isBraking ? 0.08 : 0);
    this.pitch = THREE.MathUtils.damp(this.pitch, targetPitch, 8, dt);

    // Oil slip handling
    if (this.oilSlipTimer > 0) {
      this.oilSlipTimer -= dt;
      this.steeringYaw += Math.sin(this.oilSlipTimer * 14) * 0.12;
    }

    // High-speed suspension flutter
    const bounce = Math.sin(performance.now() * 0.035) * (currentSpeed * 0.0006);

    // Update car transforms
    this.group.position.x = this.x;
    this.group.position.y = bounce;
    this.group.rotation.z = this.tilt + (globalTrackCurve.curvature * 0.024);
    this.group.rotation.x = this.pitch;
    this.group.rotation.y = this.steeringYaw * 0.45;

    // Spin wheels according to speed
    const wheelAngularSpeed = (currentSpeed / 0.38) * dt;
    for (const w of this.wheels) {
      w.rotation.x += wheelAngularSpeed;
    }
    // Front wheels steer with steering yaw
    for (const fw of this.frontWheels) {
      fw.rotation.y = this.steeringYaw * 0.95;
    }

    // Animated exhaust flames flicker
    this.setFlames(this.nitroActive);
    if (this.nitroActive) {
      for (const f of this.flames) {
        f.scale.z = 0.8 + Math.random() * 0.6;
        f.scale.x = 0.85 + Math.random() * 0.3;
      }
    }

    // Underglow pulsing
    if (this.underglow) {
      this.underglow.material.opacity = this.nitroActive ? 0.9 : (this.isBraking ? 0.85 : 0.6);
      if (this.nitroActive) {
        this.underglow.material.color.setHex(0xffaa22);
      } else if (this.isBraking) {
        this.underglow.material.color.setHex(0xff2244);
      } else {
        this.underglow.material.color.setHex(0x00f0ff);
      }
    }

    return {
      nitroJustStarted: this.nitroActive && !wasActive,
      isBraking: this.isBraking,
    };
  }

  nitroState() {
    if (this.nitroActive) return 'active';
    if (this.lockout > 0 || this.nitro < config.nitroMinToStart) return 'cooldown';
    return 'ready';
  }

  collider() {
    return {
      x: this.x,
      z: 0,
      hw: config.playerHalfWidth,
      hl: config.playerHalfLength,
    };
  }

  setFlames(on) {
    for (const f of this.flames) {
      f.visible = on;
    }
  }

  setBrakeVisuals(on) {
    for (const mat of this.brakelights) {
      mat.emissiveIntensity = on ? 4.5 : 2.4;
      mat.color.setHex(on ? 0xff0025 : 0xdd0020);
    }
  }
}

/**
 * Builds iconic real car models procedurally using Three.js primitives.
 * Supported cars:
 * 1. Porsche 911 GT3 RS
 * 2. Lamborghini Aventador SVJ
 * 3. Nissan Skyline GT-R R34
 * 4. Ferrari F40
 */
export function buildRealCar(carId = 'porsche_gt3') {
  const carCfg = config.cars[carId] || config.cars.porsche_gt3;
  const g = new THREE.Group();

  const paintMat = new THREE.MeshStandardMaterial({
    color: carCfg.color,
    metalness: 0.75,
    roughness: 0.22,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    metalness: 0.85,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0c121e,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.88,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181f, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8e4f0, metalness: 0.85, roughness: 0.2 });
  const goldRimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff1e38, metalness: 0.4, roughness: 0.3 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });

  const wheels = [];
  const frontWheels = [];
  const flames = [];
  const taillights = [];
  const brakelights = [];

  // Wheel setup helper
  function addWheels(activeRimMat = rimMat) {
    const wheelPositions = [
      { x: -0.92, y: 0.36, z: -1.35, isFront: true },
      { x: 0.92, y: 0.36, z: -1.35, isFront: true },
      { x: -0.94, y: 0.38, z: 1.35, isFront: false },
      { x: 0.94, y: 0.38, z: 1.35, isFront: false },
    ];
    for (const pos of wheelPositions) {
      const wheelAnchor = new THREE.Group();
      wheelAnchor.position.set(pos.x, pos.y, pos.z);

      const rotatingHub = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      rotatingHub.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.33, 12), activeRimMat);
      rim.rotation.z = Math.PI / 2;
      rotatingHub.add(rim);

      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 0.06), activeRimMat);
        spoke.rotation.x = (s * Math.PI) / 2.5;
        spoke.position.x = pos.x > 0 ? 0.16 : -0.16;
        rotatingHub.add(spoke);
      }

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.14), caliperMat);
      caliper.position.set(pos.x > 0 ? -0.06 : 0.06, 0.14, 0);
      wheelAnchor.add(caliper);

      wheelAnchor.add(rotatingHub);
      g.add(wheelAnchor);
      wheels.push(rotatingHub);
      if (pos.isFront) frontWheels.push(wheelAnchor);
    }
  }

  // Common Exhaust Flames Generator
  function addExhaustFlames(positions) {
    const flameMatCyan = new THREE.MeshBasicMaterial({ color: 0x00e1ff, transparent: true, opacity: 0.92 });
    const flameMatOrange = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });

    for (const pos of positions) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.25, 10), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(pos.x, pos.y, pos.z);
      g.add(pipe);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.85, 8), flameMatCyan);
      inner.rotation.x = Math.PI / 2;
      inner.position.set(pos.x, pos.y, pos.z + 0.45);
      inner.visible = false;
      g.add(inner);
      flames.push(inner);

      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.4, 8), flameMatOrange);
      outer.rotation.x = Math.PI / 2;
      outer.position.set(pos.x, pos.y, pos.z + 0.7);
      outer.visible = false;
      g.add(outer);
      flames.push(outer);
    }
  }

  // Underglow
  const underglowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 4.4),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  underglowPlane.rotation.x = -Math.PI / 2;
  underglowPlane.position.y = 0.04;
  g.add(underglowPlane);

  // BUILD SPECIFIC REAL CAR
  if (carId === 'porsche_gt3') {
    // ----------------------------------------------------
    // PORSCHE 911 GT3 RS
    // Signature curved teardrop silhouette, round bug-eye headlights, swan-neck GT wing
    // ----------------------------------------------------
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.24, 4.2), carbonMat);
    chassis.position.set(0, 0.26, 0);
    g.add(chassis);

    // Curvaceous Main Body with Wide Rear Haunches
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.44, 2.6), paintMat);
    body.position.set(0, 0.52, 0.2);
    body.castShadow = true;
    g.add(body);

    // Front Sloped Hood with Radiator Vents
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.32, 1.5), paintMat);
    hood.position.set(0, 0.46, -1.4);
    hood.rotation.x = 0.16;
    g.add(hood);

    // Front Hood Nostril Vents
    for (const x of [-0.25, 0.25]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.35), carbonMat);
      vent.position.set(x, 0.62, -1.35);
      g.add(vent);
    }

    // Teardrop Fastback Cockpit Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.48, 1.7), glassMat);
    canopy.position.set(0, 0.88, -0.05);
    g.add(canopy);

    // Roof aero fins
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 1.3), paintMat);
    roof.position.set(0, 1.13, 0.05);
    g.add(roof);

    // Iconic Bug-Eye Round 3D Headlights
    const porscheHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaae0ff, emissiveIntensity: 3.5 });
    for (const x of [-0.62, 0.62]) {
      const headlightCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 14), porscheHeadMat);
      headlightCyl.rotation.x = 0.35;
      headlightCyl.position.set(x, 0.62, -2.0);
      g.add(headlightCyl);
    }

    // Swan-Neck GT3 RS Rear Wing Spoiler
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.08, 0.42), carbonMat);
    wingBlade.position.set(0, 1.25, 1.95);
    wingBlade.rotation.x = 0.12;
    wingBlade.castShadow = true;
    g.add(wingBlade);

    // Swan neck arched struts
    for (const x of [-0.55, 0.55]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.16), carbonMat);
      strut.position.set(x, 1.02, 1.9);
      g.add(strut);
    }

    // Taillight Bar
    const porscheTailMat = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0020, emissiveIntensity: 2.8 });
    const tailbar = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 0.08), porscheTailMat);
    tailbar.position.set(0, 0.68, 2.05);
    g.add(tailbar);
    brakelights.push(porscheTailMat);

    // Wheels
    addWheels(rimMat);

    // Center dual titanium exhausts
    addExhaustFlames([{ x: -0.15, y: 0.36, z: 2.12 }, { x: 0.15, y: 0.36, z: 2.12 }]);

  } else if (carId === 'lambo_aventador') {
    // ----------------------------------------------------
    // LAMBORGHINI AVENTADOR SVJ
    // Razor-sharp geometric wedge, Y-shaped headlights, hexagonal taillights
    // ----------------------------------------------------
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 4.3), carbonMat);
    chassis.position.set(0, 0.25, 0);
    g.add(chassis);

    // Ultra-low Wedge Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.38, 2.5), paintMat);
    body.position.set(0, 0.48, 0.25);
    g.add(body);

    const wedgeNose = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.28, 1.7), paintMat);
    wedgeNose.position.set(0, 0.42, -1.45);
    wedgeNose.rotation.x = 0.14;
    g.add(wedgeNose);

    // Angular Cockpit
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.44, 1.8), glassMat);
    canopy.position.set(0, 0.82, -0.05);
    g.add(canopy);

    // Giant Angular ALA Rear Wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.08, 0.48), carbonMat);
    wing.position.set(0, 1.18, 1.95);
    g.add(wing);

    for (const x of [-0.65, 0.65]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.18), carbonMat);
      strut.position.set(x, 0.96, 1.92);
      g.add(strut);
    }

    // Y-Shaped LED Headlights
    const lamboHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaae0ff, emissiveIntensity: 3.5 });
    for (const x of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.08), lamboHeadMat);
      hl.position.set(x, 0.46, -2.25);
      g.add(hl);
    }

    // Hexagonal Rear Taillights
    const lamboTailMat = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0020, emissiveIntensity: 3.0 });
    for (const x of [-0.55, 0.55]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), lamboTailMat);
      tl.position.set(x, 0.65, 2.12);
      g.add(tl);
    }
    brakelights.push(lamboTailMat);

    addWheels(rimMat);

    // High-Mounted Dual Center Exhausts
    addExhaustFlames([{ x: -0.25, y: 0.58, z: 2.15 }, { x: 0.25, y: 0.58, z: 2.15 }]);

  } else if (carId === 'nissan_gtr') {
    // ----------------------------------------------------
    // NISSAN SKYLINE GT-R R34
    // Iconic twin-round halo taillights, muscular Japanese tuner body, tall GT wing
    // ----------------------------------------------------
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.26, 4.1), carbonMat);
    chassis.position.set(0, 0.26, 0);
    g.add(chassis);

    // Muscular Tuner Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.52, 2.6), paintMat);
    body.position.set(0, 0.54, 0.2);
    g.add(body);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.38, 1.5), paintMat);
    hood.position.set(0, 0.48, -1.4);
    g.add(hood);

    // Front Intercooler Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.12), chromeMat);
    grille.position.set(0, 0.35, -2.18);
    g.add(grille);

    // Cabin
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.52, 1.8), glassMat);
    canopy.position.set(0, 0.94, -0.05);
    g.add(canopy);

    // Tall GT-R Pedestal Wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 0.4), carbonMat);
    wing.position.set(0, 1.16, 1.95);
    g.add(wing);

    for (const x of [-0.62, 0.62]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.14), paintMat);
      strut.position.set(x, 0.96, 1.92);
      g.add(strut);
    }

    // ICONIC DUAL TWIN-ROUND CIRCULAR HALO TAILLIGHTS
    const gtrTailMat = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0020, emissiveIntensity: 3.2 });
    const tailZ = 2.12;
    for (const side of [-1, 1]) {
      // Outer round light
      const outerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 14), gtrTailMat);
      outerRing.rotation.x = Math.PI / 2;
      outerRing.position.set(side * 0.68, 0.64, tailZ);
      g.add(outerRing);

      // Inner round light
      const innerRing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 14), gtrTailMat);
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.set(side * 0.36, 0.64, tailZ);
      g.add(innerRing);
    }
    brakelights.push(gtrTailMat);

    // Headlights
    const gtrHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 3.2 });
    for (const x of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.08), gtrHeadMat);
      hl.position.set(x, 0.54, -2.15);
      g.add(hl);
    }

    // Gold Spoke JDM Rims
    addWheels(goldRimMat);

    // JDM Angled Big Cannon Exhaust on left rear
    addExhaustFlames([{ x: -0.62, y: 0.32, z: 2.14 }]);

  } else {
    // ----------------------------------------------------
    // FERRARI F40
    // Legendary wide integrated box wing, pop-up lights, triple center exhausts
    // ----------------------------------------------------
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.24, 4.2), carbonMat);
    chassis.position.set(0, 0.25, 0);
    g.add(chassis);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.44, 2.5), paintMat);
    body.position.set(0, 0.5, 0.2);
    g.add(body);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.32, 1.6), paintMat);
    hood.position.set(0, 0.44, -1.45);
    hood.rotation.x = 0.14;
    g.add(hood);

    // NACA ducts on hood
    for (const x of [-0.3, 0.3]) {
      const naca = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.3), carbonMat);
      naca.position.set(x, 0.56, -1.35);
      g.add(naca);
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.46, 1.7), glassMat);
    canopy.position.set(0, 0.86, -0.1);
    g.add(canopy);

    // Famous Integrated Rear Box Wing
    const boxWingTop = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.08, 0.45), paintMat);
    boxWingTop.position.set(0, 1.25, 1.95);
    g.add(boxWingTop);

    for (const x of [-0.9, 0.9]) {
      const boxSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.45), paintMat);
      boxSide.position.set(x, 0.94, 1.95);
      g.add(boxSide);
    }

    // Taillights
    const f40TailMat = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0020, emissiveIntensity: 3.2 });
    for (const side of [-1, 1]) {
      for (const offset of [-0.15, 0.15]) {
        const roundL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), f40TailMat);
        roundL.rotation.x = Math.PI / 2;
        roundL.position.set(side * 0.55 + offset, 0.65, 2.1);
        g.add(roundL);
      }
    }
    brakelights.push(f40TailMat);

    // Pop-up driving lights
    const f40HeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 3.2 });
    for (const x of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.1), f40HeadMat);
      hl.position.set(x, 0.48, -2.2);
      g.add(hl);
    }

    addWheels(rimMat);

    // Iconic Triple Center Exhaust Pipes
    addExhaustFlames([
      { x: -0.2, y: 0.35, z: 2.14 },
      { x: 0.0, y: 0.38, z: 2.14 },
      { x: 0.2, y: 0.35, z: 2.14 },
    ]);
  }

  return {
    group: g,
    wheels,
    frontWheels,
    flames,
    taillights: [paintMat],
    brakelights,
    underglow: underglowPlane,
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
