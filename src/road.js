import * as THREE from 'three';
import { config } from './config.js';
import { globalTrackCurve } from './trackCurve.js';
import {
  createAsphaltTexture,
  createRumbleStripeTexture,
  createGantrySignTexture,
  createBuildingWindowsTexture,
} from './textures.js';

const TRACK_LOOP = 240;

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.movers = [];
    this.beacons = [];
    this.travelDistance = 0;

    const roadWidth = config.lanes * config.laneWidth; // 14.0
    const totalRoadLength = 280;

    // 1. Moving Textured Asphalt Road Surface Ribbon (Segmented for 3D Curvature)
    this.asphaltTexture = createAsphaltTexture();
    const asphaltMat = new THREE.MeshStandardMaterial({
      map: this.asphaltTexture,
      roughness: 0.65,
      metalness: 0.15,
    });

    // 64 length segments enable smooth 3D road bending and hill undulations
    this.roadSegX = 8;
    this.roadSegZ = 64;
    this.asphaltGeo = new THREE.PlaneGeometry(roadWidth + 1.2, totalRoadLength, this.roadSegX, this.roadSegZ);
    this.origPositions = this.asphaltGeo.attributes.position.array.slice();

    this.asphalt = new THREE.Mesh(this.asphaltGeo, asphaltMat);
    this.asphalt.rotation.x = -Math.PI / 2;
    this.asphalt.position.set(0, 0, -totalRoadLength * 0.4);
    this.asphalt.receiveShadow = true;
    scene.add(this.asphalt);

    // 2. Roadside Curbs & Rumble Strips (Segmented in movers for curve tracking)
    this.rumbleTexture = createRumbleStripeTexture();
    const rumbleMat = new THREE.MeshStandardMaterial({
      map: this.rumbleTexture,
      roughness: 0.6,
      metalness: 0.2,
    });

    const curbSectionLen = 10;
    const curbCount = Math.ceil(totalRoadLength / curbSectionLen);
    for (const side of [-1, 1]) {
      const curbX = side * (roadWidth * 0.5 + 0.85);
      for (let i = 0; i < curbCount; i++) {
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, curbSectionLen + 0.2), rumbleMat);
        curb.position.set(curbX, 0.06, -i * curbSectionLen);
        curb.userData.baseX = curbX;
        curb.userData.baseY = 0.06;
        curb.userData.baseRotY = 0;
        scene.add(curb);
        this.movers.push(curb);
      }
    }

    // 3. Dashed Lane Markings (Between the 4 lanes)
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dividerX = [-config.laneWidth, 0, config.laneWidth];
    for (const x of dividerX) {
      for (let i = 0; i < 36; i++) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 3.2), dashMat);
        dash.position.set(x, 0.03, -i * 6.5);
        dash.userData.baseX = x;
        dash.userData.baseY = 0.03;
        dash.userData.baseRotY = 0;
        scene.add(dash);
        this.movers.push(dash);
      }
    }

    // Reflective Cat-Eye Road Studs
    const studMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const x of dividerX) {
      for (let i = 0; i < 36; i++) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.18), studMat);
        stud.position.set(x, 0.04, -i * 6.5 + 1.8);
        stud.userData.baseX = x;
        stud.userData.baseY = 0.04;
        stud.userData.baseRotY = 0;
        scene.add(stud);
        this.movers.push(stud);
      }
    }

    // Outer Solid Shoulder Lines (Crisp Golden Amber)
    const solidLineMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (const side of [-1, 1]) {
      const lineXPos = side * (roadWidth * 0.5 - 0.2);
      for (let i = 0; i < 24; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 8.5), solidLineMat);
        line.position.set(lineXPos, 0.03, -i * 10);
        line.userData.baseX = lineXPos;
        line.userData.baseY = 0.03;
        line.userData.baseRotY = 0;
        scene.add(line);
        this.movers.push(line);
      }
    }

    // Transverse Asphalt Seams / Tar Expansion Joints
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x1a202c });
    for (let i = 0; i < 16; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.015, 0.25), seamMat);
      seam.position.set(0, 0.02, -i * 15);
      seam.userData.baseX = 0;
      seam.userData.baseY = 0.02;
      seam.userData.baseRotY = 0;
      scene.add(seam);
      this.movers.push(seam);
    }

    // 4. Steel Highway Guardrails with Posts & Cat-Eye Reflectors (Segmented)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
    });
    const reflectorMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff3300,
      emissiveIntensity: 1.8,
    });

    const railSectionLen = 8;
    const railCount = Math.ceil(totalRoadLength / railSectionLen);
    for (const side of [-1, 1]) {
      const railX = side * (roadWidth * 0.5 + 1.85);

      // Segmented rail bars
      for (let i = 0; i < railCount; i++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, railSectionLen + 0.1), railMat);
        rail.position.set(railX, 0.65, -i * railSectionLen);
        rail.userData.baseX = railX;
        rail.userData.baseY = 0.65;
        rail.userData.baseRotY = 0;
        scene.add(rail);
        this.movers.push(rail);
      }

      // Guardrail posts & reflective cat-eyes
      for (let i = 0; i < 32; i++) {
        const postGroup = new THREE.Group();
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), postMat);
        post.position.y = 0.45;
        postGroup.add(post);

        const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.12), reflectorMat);
        reflector.position.set(side > 0 ? -0.1 : 0.1, 0.62, 0);
        postGroup.add(reflector);

        postGroup.position.set(railX, 0, -i * 7.5);
        postGroup.userData.baseX = railX;
        postGroup.userData.baseY = 0;
        postGroup.userData.baseRotY = 0;
        scene.add(postGroup);
        this.movers.push(postGroup);
      }
    }

    // 5. Overhead Electronic Gantries with LED Dot-Matrix Signs
    this._createHighwayGantries(roadWidth);

    // 6. Overhead Highway Flyover Bridges
    this._createFlyoverBridges(roadWidth);

    // 7. Highway Streetlamps with Downward Light Cones
    this._createStreetLamps(roadWidth);

    // 8. Cyberpunk City Skyline with Illuminated Skyscrapers
    this._createSkylineBuildings();
  }

  update(dt, speed) {
    const dz = speed * dt;
    this.travelDistance += dz;

    // ACTIVE ROAD MOVEMENT: Physical texture scrolling on asphalt and rumble curbs
    if (this.asphaltTexture) {
      this.asphaltTexture.offset.y -= dz * 0.022;
    }
    if (this.rumbleTexture) {
      this.rumbleTexture.offset.y -= dz * 0.022;
    }

    // Update global 3D track curvature and rolling hills
    globalTrackCurve.update(dt, speed);

    // BEND ROAD SURFACE MESH VERTICES
    const posAttr = this.asphaltGeo.attributes.position;
    const pos = posAttr.array;
    const orig = this.origPositions;
    const vertexCount = posAttr.count;

    for (let i = 0; i < vertexCount; i++) {
      const idx = i * 3;
      const ox = orig[idx];
      const oy = orig[idx + 1];
      const oz = orig[idx + 2];

      // Convert local unrotated plane vertex to world Z
      // Mesh is rotated -Math.PI/2 around X and placed at z = -112
      // Local +Y corresponds to world -Z, so worldZ = -oy - 112
      const worldZ = -oy - 112;

      const curveX = globalTrackCurve.getCurveOffset(worldZ);

      // In unrotated plane: X is lateral, Y is length (-Z), Z is elevation (Y)
      pos[idx] = ox + curveX;
      pos[idx + 2] = oz; // Flat road elevation ensures road never clips or overlaps cars
    }
    posAttr.needsUpdate = true;

    // Move all looping road elements toward camera and bend along 3D track curve
    for (const m of this.movers) {
      m.position.z += dz;
      if (m.position.z > 22) {
        m.position.z -= TRACK_LOOP;
      }

      const z = m.position.z;
      const curveX = globalTrackCurve.getCurveOffset(z);
      const yaw = globalTrackCurve.getCurveYaw(z);

      m.position.x = m.userData.baseX + curveX;
      m.position.y = (m.userData.baseY || 0);
      m.rotation.y = (m.userData.baseRotY || 0) + yaw;
    }

    // Pulsing aviation warning beacons
    const beaconState = Math.sin(performance.now() * 0.005) > 0.3;
    for (const mat of this.beacons) {
      mat.emissiveIntensity = beaconState ? 3.5 : 0.2;
    }
  }

  _createHighwayGantries(roadWidth) {
    const gantryPositions = [-45, -125, -205];
    const messages = [
      { title: 'RADAR SPEED ZONE', status: 'SPEED LIMIT 250 KM/H', alert: 'normal' },
      { title: 'CAUTION: CONGESTION', status: 'ACCIDENT REPORTED AHEAD', alert: 'danger' },
      { title: 'HIGHWAY RUSH EXPRESS', status: 'NITRO BOOST PERMITTED', alert: 'normal' },
    ];

    for (let i = 0; i < gantryPositions.length; i++) {
      const z = gantryPositions[i];
      const gantryGroup = new THREE.Group();
      const span = roadWidth + 5.5;

      const metalMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.8,
        roughness: 0.3,
      });

      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 6.2, 8), metalMat);
        col.position.set(side * (span * 0.5), 3.1, 0);
        gantryGroup.add(col);
      }

      const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.6, 0.8), metalMat);
      beam.position.set(0, 5.8, 0);
      gantryGroup.add(beam);

      const signTex = createGantrySignTexture(messages[i].title, messages[i].status, messages[i].alert);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.1), signMat);
      signMesh.position.set(0, 4.6, 0.42);
      gantryGroup.add(signMesh);

      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.2,
      });
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), beaconMat);
      beacon.position.set(0, 6.2, 0);
      gantryGroup.add(beacon);
      this.beacons.push(beaconMat);

      gantryGroup.position.set(0, 0, z);
      gantryGroup.userData.baseX = 0;
      gantryGroup.userData.baseY = 0;
      gantryGroup.userData.baseRotY = 0;
      this.scene.add(gantryGroup);
      this.movers.push(gantryGroup);
    }
  }

  _createFlyoverBridges(roadWidth) {
    const bridgePositions = [-85, -185];
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.1,
    });

    for (const z of bridgePositions) {
      const bridgeGroup = new THREE.Group();
      const bridgeSpan = roadWidth + 12;

      const overpass = new THREE.Mesh(new THREE.BoxGeometry(bridgeSpan, 1.2, 5.5), concreteMat);
      overpass.position.set(0, 6.8, 0);
      overpass.castShadow = true;
      bridgeGroup.add(overpass);

      for (const bz of [-2.6, 2.6]) {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(bridgeSpan, 0.8, 0.3), concreteMat);
        parapet.position.set(0, 7.6, bz);
        bridgeGroup.add(parapet);
      }

      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7.0, 4.0), concreteMat);
        pillar.position.set(side * (bridgeSpan * 0.5 - 1.2), 3.5, 0);
        bridgeGroup.add(pillar);
      }

      bridgeGroup.position.set(0, 0, z);
      bridgeGroup.userData.baseX = 0;
      bridgeGroup.userData.baseY = 0;
      bridgeGroup.userData.baseRotY = 0;
      this.scene.add(bridgeGroup);
      this.movers.push(bridgeGroup);
    }
  }

  _createStreetLamps(roadWidth) {
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    const luminaireMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffea9f,
      emissiveIntensity: 3.5,
    });
    const lightConeMat = new THREE.MeshBasicMaterial({
      color: 0xffea9f,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });

    for (let i = 0; i < 14; i++) {
      const z = -i * 18;
      const side = i % 2 === 0 ? -1 : 1;
      const lampGroup = new THREE.Group();
      const poleX = side * (roadWidth * 0.5 + 2.8);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6.5, 8), lampMat);
      pole.position.set(0, 3.25, 0);
      lampGroup.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), lampMat);
      arm.position.set(-side * 1.0, 6.4, 0);
      lampGroup.add(arm);

      const luminaire = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.3), luminaireMat);
      luminaire.position.set(-side * 2.0, 6.35, 0);
      lampGroup.add(luminaire);

      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 6.2, 10, 1, true), lightConeMat);
      cone.position.set(-side * 2.0, 3.1, 0);
      lampGroup.add(cone);

      lampGroup.position.set(poleX, 0, z);
      lampGroup.userData.baseX = poleX;
      lampGroup.userData.baseY = 0;
      lampGroup.userData.baseRotY = 0;
      this.scene.add(lampGroup);
      this.movers.push(lampGroup);
    }
  }

  _createSkylineBuildings() {
    const buildingColors = [210, 260, 185, 330];
    const sidePositions = [-1, 1];

    for (let i = 0; i < config.pool.scenery; i++) {
      const side = sidePositions[i % 2];
      const distFromRoad = 14 + (i % 4) * 3.2;
      const x = side * distFromRoad;
      const z = -i * 10;
      const height = 14 + (i * 7) % 28;
      const width = 4.2 + (i % 3) * 1.8;
      const depth = 5.0 + (i % 2) * 2.5;

      const group = new THREE.Group();
      const winTex = createBuildingWindowsTexture(buildingColors[i % buildingColors.length]);
      const buildingMat = new THREE.MeshStandardMaterial({
        map: winTex,
        roughness: 0.6,
        metalness: 0.3,
      });

      const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMat);
      tower.position.y = height * 0.5;
      tower.castShadow = true;
      group.add(tower);

      if (height > 22) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.12, 4.5, 6),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }),
        );
        spire.position.y = height + 2.25;
        group.add(spire);

        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xff0022,
          emissive: 0xff0022,
          emissiveIntensity: 2.5,
        });
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), beaconMat);
        beacon.position.y = height + 4.5;
        group.add(beacon);
        this.beacons.push(beaconMat);
      }

      group.position.set(x, 0, z);
      group.userData.baseX = x;
      group.userData.baseY = 0;
      group.userData.baseRotY = 0;
      this.scene.add(group);
      this.movers.push(group);
    }
  }
}
