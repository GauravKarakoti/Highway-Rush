import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { config } from './config.js';

let cachedFerrariGltf = null;
let gltfLoadingPromise = null;

/**
 * Loads and caches the real Ferrari 458 Italia 3D model.
 */
export function preloadCarModel() {
  if (cachedFerrariGltf) return Promise.resolve(cachedFerrariGltf);
  if (gltfLoadingPromise) return gltfLoadingPromise;

  const loader = new GLTFLoader();
  gltfLoadingPromise = new Promise((resolve, reject) => {
    loader.load(
      '/ferrari.glb',
      (gltf) => {
        cachedFerrariGltf = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.warn('Could not load /ferrari.glb, will use procedural real car model', err);
        resolve(null);
      }
    );
  });

  return gltfLoadingPromise;
}

/**
 * Creates an instance of the real car 3D model with realistic materials,
 * steerable/spinning wheels, brake lights, and exhaust flame jets.
 */
export function createRealCarInstance(carId = 'ferrari_f40', customColorHex = null) {
  const carCfg = config.cars[carId] || config.cars.ferrari_f40;
  const paintColor = customColorHex !== null ? customColorHex : carCfg.color;

  const g = new THREE.Group();
  const wheels = [];
  const frontWheels = [];
  const flames = [];
  const taillights = [];
  const brakelights = [];
  let bodyMesh = null;

  if (cachedFerrariGltf) {
    // Clone the real 3D Ferrari GLTF scene
    const carScene = SkeletonUtils.clone(cachedFerrariGltf.scene);
    carScene.position.set(0, 0, 0);

    // Setup high-end materials
    const carPaintMaterial = new THREE.MeshPhysicalMaterial({
      color: paintColor,
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });

    const tailMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0025,
      emissive: 0xff0020,
      emissiveIntensity: 3.5,
    });
    brakelights.push(tailMaterial);

    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8e7,
      emissiveIntensity: 3.5,
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x070c14,
      metalness: 0.9,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.88,
    });

    carScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.name === 'body') {
          child.material = carPaintMaterial;
          bodyMesh = child;
        } else if (child.name === 'lights_red') {
          child.material = tailMaterial;
        } else if (child.name === 'lights' || child.name === 'leds') {
          child.material = headMaterial;
        } else if (child.name === 'glass') {
          child.material = glassMaterial;
        }
      }
    });

    g.add(carScene);

    // Wheels lookup in real Ferrari model
    const wfl = carScene.getObjectByName('wheel_fl');
    const wfr = carScene.getObjectByName('wheel_fr');
    const wrl = carScene.getObjectByName('wheel_rl');
    const wrr = carScene.getObjectByName('wheel_rr');

    if (wfl) { wheels.push(wfl); frontWheels.push(wfl); }
    if (wfr) { wheels.push(wfr); frontWheels.push(wfr); }
    if (wrl) wheels.push(wrl);
    if (wrr) wheels.push(wrr);

    // Dual/Triple Exhaust Jets at rear diffuser
    const flameCyan = new THREE.MeshBasicMaterial({ color: 0x00e1ff, transparent: true, opacity: 0.92 });
    const flameOrange = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });

    const exhaustPositions = [-0.22, 0.22];
    for (const x of exhaustPositions) {
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.8, 8), flameCyan);
      inner.rotation.x = Math.PI / 2;
      inner.position.set(x, 0.42, 2.3);
      inner.visible = false;
      g.add(inner);
      flames.push(inner);

      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.3, 8), flameOrange);
      outer.rotation.x = Math.PI / 2;
      outer.position.set(x, 0.42, 2.5);
      outer.visible = false;
      g.add(outer);
      flames.push(outer);
    }

    // Neon underglow
    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 4.4),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.65, depthWrite: false }),
    );
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = 0.04;
    g.add(underglow);

    return {
      group: g,
      wheels,
      frontWheels,
      flames,
      taillights,
      brakelights,
      underglow,
      bodyMesh,
      isRealModel: true,
    };
  }

  return null;
}

export function isRealModelLoaded() {
  return cachedFerrariGltf !== null;
}

/**
 * Creates an authentic real 3D Ferrari model instance optimized for traffic speeders & supercars.
 */
export function createRealTrafficCar(colorHex = 0xffb700) {
  if (!cachedFerrariGltf) return null;
  const g = new THREE.Group();
  const wheels = [];
  const taillights = [];
  let bodyMesh = null;

  const carScene = SkeletonUtils.clone(cachedFerrariGltf.scene);
  const carPaintMaterial = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    metalness: 0.85,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  const tailMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0025,
    emissive: 0xff0020,
    emissiveIntensity: 3.5,
  });
  taillights.push(tailMaterial);

  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff8e7,
    emissiveIntensity: 3.5,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x070c14,
    metalness: 0.9,
    roughness: 0.1,
    transmission: 0.6,
    transparent: true,
    opacity: 0.88,
  });

  carScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.name === 'body') {
        child.material = carPaintMaterial;
        bodyMesh = child;
      } else if (child.name === 'lights_red') {
        child.material = tailMaterial;
      } else if (child.name === 'lights' || child.name === 'leds') {
        child.material = headMaterial;
      } else if (child.name === 'glass') {
        child.material = glassMaterial;
      }
    }
  });

  g.add(carScene);

  for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const w = carScene.getObjectByName(name);
    if (w) wheels.push(w);
  }

  // Forward 3D Headlight Cones projecting onto the highway
  const lightConeMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  for (const x of [-0.62, 0.62]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 9.0, 10, 1, true), lightConeMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(x, 0.45, -6.5);
    g.add(cone);
  }

  return {
    group: g,
    wheels,
    leftBlinkers: [],
    rightBlinkers: [],
    taillights,
    policeStrobes: null,
    bodyMesh,
    halfWidth: 0.9,
    halfLength: 2.1,
    isRealModel: true,
  };
}
