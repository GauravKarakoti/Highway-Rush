import * as THREE from 'three';
import { config } from './config.js';
import { Game } from './game.js';
import { setupEnvironmentMap, createMountainHorizons } from './environment.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(config.skyColor, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);
scene.background = new THREE.Color(config.skyColor);

const camera = new THREE.PerspectiveCamera(
  config.camera.CHASE.fovBase,
  window.innerWidth / window.innerHeight,
  0.1,
  240,
);
camera.position.set(0, config.camera.CHASE.height, config.camera.CHASE.back);

// 1. Atmospheric Gradient Sky Dome (High-Visibility Radiant Sunset)
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 128;
skyCanvas.height = 256;
const skyCtx = skyCanvas.getContext('2d');
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
skyGrad.addColorStop(0, '#0a122e');    // Deep navy space apex
skyGrad.addColorStop(0.35, '#192454'); // Royal dusk
skyGrad.addColorStop(0.65, '#3e245a'); // Violet twilight
skyGrad.addColorStop(0.85, '#78325e'); // Magenta sunset glow
skyGrad.addColorStop(0.95, '#b84c52'); // Warm coral
skyGrad.addColorStop(1.0, '#e5723e');  // Luminous radiant horizon
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 128, 256);
const skyTex = new THREE.CanvasTexture(skyCanvas);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(180, 24, 16),
  new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  }),
);
scene.add(skyDome);

// 2. Twinkling Starfield in High Sky
const starGeo = new THREE.BufferGeometry();
const starCount = 350;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 0.75); // Upper hemisphere only
  const r = 175;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi) + 15;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: 0xbae6fd,
  size: 1.4,
  transparent: true,
  opacity: 0.9,
  fog: false,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// 3. Dynamic Scene Lighting (Crisp & High-Visibility)
const hemiLight = new THREE.HemisphereLight(0xa5c4f5, 0x483244, 0.85);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff6ec, 1.45);
sunLight.position.set(-14, 30, 14);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 180;
sunLight.shadow.camera.left = -24;
sunLight.shadow.camera.right = 24;
sunLight.shadow.camera.top = 22;
sunLight.shadow.camera.bottom = -140;
sunLight.shadow.bias = -0.0003;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x7088a8, 0.65);
scene.add(ambientLight);

// 4. PBR Environment Map & 3D Mountain Horizon Parallax
setupEnvironmentMap(renderer, scene);
createMountainHorizons(scene);

// 5. Initialize Game Instance
const game = new Game(scene, camera);

// 5. Responsive Resize
window.addEventListener('resize', onResize);

// 6. Frame Loop
let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  game.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
}
