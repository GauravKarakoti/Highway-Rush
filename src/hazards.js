import * as THREE from 'three';
import { config, laneX } from './config.js';
import { globalTrackCurve } from './trackCurve.js';

/**
 * 3D Dynamic Road Hazards System.
 * Manages active construction zone lane closures, 3D chevron arrow trailers,
 * traffic cones, heavy concrete Jersey barriers, and iridescent oil slicks.
 */
export class HazardManager {
  constructor(scene) {
    this.scene = scene;
    this.activeHazards = [];
    this.flyingCones = [];

    this.constructionTimer = 22.0;
    this.oilTimer = 14.0;
    this.billboardTimer = 8.0;

    // Materials
    this.concreteMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.coneOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xff4d00,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.coneWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.2,
    });
    this.coneBaseMat = new THREE.MeshStandardMaterial({
      color: 0x181a22,
      roughness: 0.8,
    });
    this.amberStrobeMat = new THREE.MeshStandardMaterial({
      color: 0xffa000,
      emissive: 0xff9900,
      emissiveIntensity: 3.5,
    });
  }

  reset() {
    for (const h of this.activeHazards) {
      this.scene.remove(h.group);
    }
    for (const c of this.flyingCones) {
      this.scene.remove(c.mesh);
    }
    this.activeHazards.length = 0;
    this.flyingCones.length = 0;
    this.constructionTimer = 22.0;
    this.oilTimer = 14.0;
    this.billboardTimer = 8.0;
  }

  /**
   * Updates all active hazards, moves them with the road speed,
   * bends them along track curve and elevation, and checks for collisions.
   */
  update(dt, worldSpeed, playerX, playerLane, isBraking) {
    const events = {
      crashed: false,
      oilSlip: false,
      coneHit: false,
      hazardWarning: null,
      closedLane: -1,
    };

    const dz = worldSpeed * dt;

    // 1. Move and update active hazards
    for (let i = this.activeHazards.length - 1; i >= 0; i--) {
      const h = this.activeHazards[i];
      h.z += dz;

      // Check upcoming lane closure warning for HUD / AI
      if (h.type === 'construction' && h.z < -20 && h.z > -160) {
        events.closedLane = h.lane;
        if (h.z < -30 && h.z > -140) {
          events.hazardWarning = `CAUTION: LANE ${h.lane + 1} CLOSED AHEAD`;
        }
      }

      // Animate LED Arrow Sign if present
      if (h.arrowMat) {
        const frame = Math.floor(performance.now() * 0.004) % 3;
        h.arrowMat.map.offset.x = frame * 0.333;
      }

      // Strobe warning flash
      if (h.strobes) {
        const strobeState = Math.sin(performance.now() * 0.015) > 0;
        for (const s of h.strobes) {
          s.material.emissiveIntensity = strobeState ? 4.0 : 0.2;
        }
      }

      // Synchronize 3D curve and hill elevation
      const curveX = globalTrackCurve.getCurveOffset(h.z);
      const hillY = globalTrackCurve.getHillOffset(h.z);
      const yaw = globalTrackCurve.getCurveYaw(h.z);

      h.group.position.set(h.baseX + curveX, (h.baseY || 0) + hillY, h.z);
      h.group.rotation.y = (h.baseRotY || 0) + yaw;

      // Collision Detection with Player
      if (h.type === 'construction') {
        // Concrete barriers or Arrow Board Trailer collision
        for (const box of h.collisionBoxes) {
          const worldBoxZ = h.z + box.relZ;
          const worldBoxX = h.baseX + box.relX;
          // Player car is at z = 0, length approx 4.1m, width 1.8m
          if (Math.abs(worldBoxZ) < box.halfL + 1.8 && Math.abs(playerX - worldBoxX) < box.halfW + 0.85) {
            events.crashed = true;
          }
        }

        // Cones collision (knocks cone flying with 3D physics!)
        for (let cIdx = h.cones.length - 1; cIdx >= 0; cIdx--) {
          const cone = h.cones[cIdx];
          const coneWorldZ = h.z + cone.relZ;
          const coneWorldX = h.baseX + cone.relX;
          if (Math.abs(coneWorldZ) < 1.4 && Math.abs(playerX - coneWorldX) < 1.1) {
            // Knock cone flying!
            this._launchFlyingCone(coneWorldX + curveX, hillY + 0.3, coneWorldZ, worldSpeed);
            h.group.remove(cone.mesh);
            h.cones.splice(cIdx, 1);
            events.coneHit = true;
          }
        }
      } else if (h.type === 'oil') {
        // Oil slick slip check
        if (Math.abs(h.z) < 2.0 && Math.abs(playerX - h.baseX) < 1.6) {
          events.oilSlip = true;
        }
      }

      // Despawn once behind camera
      if (h.z > config.despawnZ + 10) {
        this.scene.remove(h.group);
        this.activeHazards.splice(i, 1);
      }
    }

    // 2. Update flying cones physics
    for (let i = this.flyingCones.length - 1; i >= 0; i--) {
      const fc = this.flyingCones[i];
      fc.mesh.position.addScaledVector(fc.vel, dt);
      fc.vel.y -= 28.0 * dt; // Gravity
      fc.mesh.rotation.x += fc.angVel.x * dt;
      fc.mesh.rotation.y += fc.angVel.y * dt;
      fc.mesh.rotation.z += fc.angVel.z * dt;

      if (fc.mesh.position.y < 0.1) {
        fc.mesh.position.y = 0.1;
        fc.vel.y = -fc.vel.y * 0.45; // Bounce
        fc.vel.x *= 0.8;
        fc.vel.z *= 0.8;
      }

      fc.life -= dt;
      if (fc.life <= 0 || fc.mesh.position.z > 30) {
        this.scene.remove(fc.mesh);
        this.flyingCones.splice(i, 1);
      }
    }

    // 3. Spawners
    const difficulty = config.activeDifficulty || config.difficulties.PRO;

    // Construction Zone Spawner
    this.constructionTimer -= dt;
    if (this.constructionTimer <= 0) {
      this._spawnConstructionZone();
      this.constructionTimer = difficulty.constructionInterval + Math.random() * 8.0;
    }

    // Oil Slick Spawner
    this.oilTimer -= dt;
    if (this.oilTimer <= 0) {
      this._spawnOilSlick();
      this.oilTimer = difficulty.oilSlickInterval + Math.random() * 6.0;
    }

    // Billboard Spawner
    this.billboardTimer -= dt;
    if (this.billboardTimer <= 0) {
      this._spawnRoadsideBillboard();
      this.billboardTimer = 14.0 + Math.random() * 6.0;
    }

    return events;
  }

  /**
   * Spawns a full 3D Construction Lane Closure Zone.
   * Funnels traffic with traffic cones and seals the lane with concrete Jersey barriers.
   */
  _spawnConstructionZone() {
    // Choose a lane to close: 0 (left) or 3 (right), or occasionally 1 or 2
    const roll = Math.random();
    let lane = 0;
    let mergeDir = 1; // merge right
    if (roll < 0.45) {
      lane = 3;
      mergeDir = -1; // merge left
    } else if (roll < 0.70) {
      lane = 0;
      mergeDir = 1;
    } else {
      lane = 1;
      mergeDir = 1;
    }

    const group = new THREE.Group();
    const spawnZ = config.spawnZ - 10;
    const bX = laneX(lane);

    const collisionBoxes = [];
    const cones = [];
    const strobes = [];

    // 1. Mobile LED Chevron Arrow Board Trailer
    const trailer = this._createArrowTrailer(mergeDir, strobes);
    trailer.position.set(0, 0, -2);
    group.add(trailer);
    collisionBoxes.push({ relX: 0, relZ: -2, halfW: 1.2, halfL: 1.8 });

    // 2. Tapered Traffic Cones funneling out of the lane
    const coneCount = 8;
    for (let c = 0; c < coneCount; c++) {
      const cone = this._createTrafficCone();
      const taperT = c / (coneCount - 1);
      const coneRelZ = -8 - c * 4.2;
      const coneRelX = mergeDir * taperT * (config.laneWidth * 0.45);
      cone.position.set(coneRelX, 0, coneRelZ);
      group.add(cone);
      cones.push({ mesh: cone, relX: coneRelX, relZ: coneRelZ });
    }

    // 3. Concrete Jersey Barriers (K-rails) along the closed lane
    const barrierCount = 8;
    for (let b = 0; b < barrierCount; b++) {
      const barrier = this._createJerseyBarrier();
      const bZ = -44 - b * 5.2;
      barrier.position.set(0, 0.45, bZ);
      group.add(barrier);
      collisionBoxes.push({ relX: 0, relZ: bZ, halfW: 0.9, halfL: 2.5 });
    }

    group.position.set(bX, 0, spawnZ);
    this.scene.add(group);

    this.activeHazards.push({
      type: 'construction',
      group,
      lane,
      baseX: bX,
      baseY: 0,
      z: spawnZ,
      collisionBoxes,
      cones,
      strobes,
    });
  }

  /**
   * Spawns an iridescent 3D oil slick puddle on the road.
   */
  _spawnOilSlick() {
    const lane = Math.floor(Math.random() * config.lanes);
    const bX = laneX(lane) + (Math.random() - 0.5) * 0.8;
    const spawnZ = config.spawnZ - Math.random() * 15;

    const group = new THREE.Group();

    // Oil Slick Puddle Mesh
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Iridescent rainbow fuel sheen
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(30, 144, 255, 0.9)');
    grad.addColorStop(0.35, 'rgba(255, 20, 147, 0.85)');
    grad.addColorStop(0.65, 'rgba(255, 215, 0, 0.8)');
    grad.addColorStop(0.85, 'rgba(0, 255, 127, 0.6)');
    grad.addColorStop(1, 'rgba(10, 15, 25, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const oilTex = new THREE.CanvasTexture(canvas);
    const oilMat = new THREE.MeshStandardMaterial({
      map: oilTex,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.8), oilMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = Math.random() * Math.PI;
    puddle.position.y = 0.035;
    group.add(puddle);

    group.position.set(bX, 0, spawnZ);
    this.scene.add(group);

    this.activeHazards.push({
      type: 'oil',
      group,
      lane,
      baseX: bX,
      baseY: 0,
      z: spawnZ,
      collisionBoxes: [],
      cones: [],
    });
  }

  /**
   * Spawns a massive 3D roadside billboard with retro neon arcade ads.
   */
  _spawnRoadsideBillboard() {
    const side = Math.random() > 0.5 ? 1 : -1;
    const roadWidth = config.lanes * config.laneWidth;
    const bX = side * (roadWidth * 0.5 + 7.5);
    const spawnZ = config.spawnZ - 20;

    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

    // Steel Pillar Mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 10.5, 8), metalMat);
    mast.position.y = 5.25;
    group.add(mast);

    // Billboard Display Board
    const boardGroup = new THREE.Group();
    boardGroup.position.y = 10.5;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(11.2, 5.2, 0.6), metalMat);
    boardGroup.add(frame);

    // Neon Ad Canvas Texture
    const adTex = this._createBillboardAdTexture();
    const adMat = new THREE.MeshBasicMaterial({ map: adTex });
    const adMesh = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 4.6), adMat);
    adMesh.position.z = side > 0 ? -0.32 : 0.32;
    if (side > 0) adMesh.rotation.y = Math.PI;
    boardGroup.add(adMesh);

    group.add(boardGroup);
    group.position.set(bX, 0, spawnZ);
    this.scene.add(group);

    this.activeHazards.push({
      type: 'billboard',
      group,
      baseX: bX,
      baseY: 0,
      z: spawnZ,
      collisionBoxes: [],
      cones: [],
    });
  }

  _createArrowTrailer(mergeDir, strobes) {
    const g = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });

    // Trailer chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 3.2), yellowMat);
    chassis.position.y = 0.55;
    g.add(chassis);

    // Trailer wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.85 });
    for (const x of [-1.15, 1.15]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.35, 0);
      g.add(w);
    }

    // Heavy vertical arrow board frame
    const postLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), metalMat);
    postLeft.position.set(-0.85, 2.1, 0);
    g.add(postLeft);

    const postRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), metalMat);
    postRight.position.set(0.85, 2.1, 0);
    g.add(postRight);

    // Large Animated LED Chevron Arrow Board
    const arrowTex = this._createArrowSignTexture(mergeDir);
    const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTex });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.5), arrowMat);
    board.position.set(0, 2.8, 0.12);
    g.add(board);

    // Flashing amber warning strobes on top
    for (const x of [-0.95, 0.95]) {
      const strobe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8), this.amberStrobeMat.clone());
      strobe.position.set(x, 3.65, 0);
      g.add(strobe);
      strobes.push(strobe);
    }

    return g;
  }

  _createTrafficCone() {
    const g = new THREE.Group();

    // Black Rubber Square Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), this.coneBaseMat);
    base.position.y = 0.03;
    g.add(base);

    // Orange Cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 12), this.coneOrangeMat);
    cone.position.y = 0.45;
    g.add(cone);

    // Reflective White Bands
    const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 12), this.coneWhiteMat);
    band1.position.y = 0.36;
    g.add(band1);

    const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12), this.coneWhiteMat);
    band2.position.y = 0.58;
    g.add(band2);

    return g;
  }

  _createJerseyBarrier() {
    const g = new THREE.Group();

    // Solid Concrete Barrier with sloped profile
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 5.0), this.concreteMat);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    g.add(barrier);

    // Yellow Reflector on ends
    const refMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
    });
    for (const z of [-2.45, 2.45]) {
      const ref = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.08), refMat);
      ref.position.set(0, 0.2, z);
      g.add(ref);
    }

    return g;
  }

  _launchFlyingCone(x, y, z, worldSpeed) {
    const cone = this._createTrafficCone();
    cone.position.set(x, y, z);
    this.scene.add(cone);

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 14.0,
      12.0 + Math.random() * 8.0,
      worldSpeed * 0.45 + Math.random() * 10.0
    );

    const angVel = new THREE.Vector3(
      (Math.random() - 0.5) * 20.0,
      (Math.random() - 0.5) * 20.0,
      (Math.random() - 0.5) * 20.0
    );

    this.flyingCones.push({
      mesh: cone,
      vel,
      angVel,
      life: 2.2,
    });
  }

  _createArrowSignTexture(mergeDir) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, 256, 128);

    // Amber LED Chevrons (<<< or >>>)
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;

    const arrowSymbol = mergeDir > 0 ? '>>>' : '<<<';
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(arrowSymbol, 128, 86);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  _createBillboardAdTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const ads = [
      { bg1: '#7c2d12', bg2: '#b91c1c', title: 'NITRO BOOST', sub: 'MAXIMUM VELOCITY' },
      { bg1: '#0f172a', bg2: '#1e3a8a', title: 'FERRARI 458', sub: 'ITALIAN MASTERPIECE' },
      { bg1: '#14532d', bg2: '#047857', title: 'RADAR CHECK', sub: '250 KM/H SPEED ZONE' },
      { bg1: '#581c87', bg2: '#831843', title: 'NEON EXPRESS', sub: 'RULE THE HIGHWAY' },
    ];
    const ad = ads[Math.floor(Math.random() * ads.length)];

    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, ad.bg1);
    grad.addColorStop(1, ad.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 240);

    ctx.font = '900 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.fillText(ad.title, 256, 110);

    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(ad.sub, 256, 175);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}

