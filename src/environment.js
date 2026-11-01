import * as THREE from 'three';

/**
 * PBR Environment Reflections and 3D Mountain Horizon System.
 * Elevates the visual quality with realistic clearcoat reflections,
 * metallic car paint specular highlights, and majestic 3D distant mountains.
 */

export function setupEnvironmentMap(renderer, scene) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Radiant Sunset Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 130);
  skyGrad.addColorStop(0, '#09132e');
  skyGrad.addColorStop(0.3, '#1c2654');
  skyGrad.addColorStop(0.6, '#4f2152');
  skyGrad.addColorStop(0.82, '#8a3556');
  skyGrad.addColorStop(0.94, '#d45645');
  skyGrad.addColorStop(1.0, '#ff7c38');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 512, 130);

  // Intense Solar Specular Point
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#fed7aa';
  ctx.shadowBlur = 32;
  ctx.beginPath();
  ctx.arc(256, 112, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Luminous Amber Horizon Line
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 128, 512, 3);

  // Reflective Wet Asphalt Lower Hemisphere
  const groundGrad = ctx.createLinearGradient(0, 131, 0, 256);
  groundGrad.addColorStop(0, '#262d40');
  groundGrad.addColorStop(0.2, '#181e2c');
  groundGrad.addColorStop(1.0, '#0d1017');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 131, 512, 125);

  // Neon Highway Light Reflections
  for (let i = 0; i < 18; i++) {
    const x = i * 28 + 6;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 120, 0, 0.28)' : 'rgba(0, 220, 255, 0.22)';
    ctx.fillRect(x, 133, 16, 75);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const renderTarget = pmremGenerator.fromEquirectangular(texture);
  scene.environment = renderTarget.texture;

  texture.dispose();
  pmremGenerator.dispose();

  return renderTarget.texture;
}

/**
 * Builds multi-layered 3D mountain silhouettes along the far horizon.
 */
export function createMountainHorizons(scene) {
  const mountainGroup = new THREE.Group();

  // Distant Sharp Peaks (Layer 1)
  const peakGeo = new THREE.BufferGeometry();
  const peakCount = 28;
  const positions = [];
  const colors = [];

  const baseZ = -250;
  const widthSpan = 380;
  const startX = -widthSpan * 0.5;
  const stepX = widthSpan / peakCount;

  const cPeak = new THREE.Color(0x28193f);
  const cValley = new THREE.Color(0x130e24);
  const cRim = new THREE.Color(0xb84a62);

  for (let i = 0; i < peakCount; i++) {
    const x0 = startX + i * stepX;
    const x1 = x0 + stepX;
    const midX = (x0 + x1) * 0.5;

    // Organic peak heights
    const peakH = 32 + Math.sin(i * 1.3) * 16 + Math.cos(i * 2.1) * 8;
    const zOffset = (Math.sin(i * 0.9) * 20);

    // Triangle 1: left base -> apex -> mid base
    // Triangle 2: mid base -> apex -> right base
    // Apex
    positions.push(midX, peakH, baseZ + zOffset);
    colors.push(cRim.r, cRim.g, cRim.b);

    // Left Base
    positions.push(x0, 0, baseZ + zOffset);
    colors.push(cValley.r, cValley.g, cValley.b);

    // Right Base
    positions.push(x1, 0, baseZ + zOffset);
    colors.push(cValley.r, cValley.g, cValley.b);
  }

  peakGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  peakGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  peakGeo.computeVertexNormals();

  const peakMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: true,
    side: THREE.DoubleSide,
  });
  const peaksMesh = new THREE.Mesh(peakGeo, peakMat);
  mountainGroup.add(peaksMesh);

  // Closer Rolling Foothills (Layer 2)
  const hillGeo = new THREE.BufferGeometry();
  const hillPositions = [];
  const hillColors = [];
  const hillZ = -225;
  const cHillPeak = new THREE.Color(0x381f48);
  const cHillBase = new THREE.Color(0x1a1228);

  for (let i = 0; i < 20; i++) {
    const x0 = -180 + i * 18;
    const x1 = x0 + 18;
    const midX = (x0 + x1) * 0.5;
    const hillH = 18 + Math.sin(i * 1.7) * 9;

    hillPositions.push(midX, hillH, hillZ);
    hillColors.push(cHillPeak.r, cHillPeak.g, cHillPeak.b);

    hillPositions.push(x0, 0, hillZ);
    hillColors.push(cHillBase.r, cHillBase.g, cHillBase.b);

    hillPositions.push(x1, 0, hillZ);
    hillColors.push(cHillBase.r, cHillBase.g, cHillBase.b);
  }

  hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(hillPositions, 3));
  hillGeo.setAttribute('color', new THREE.Float32BufferAttribute(hillColors, 3));
  hillGeo.computeVertexNormals();

  const hillMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: true,
    side: THREE.DoubleSide,
  });
  const hillsMesh = new THREE.Mesh(hillGeo, hillMat);
  mountainGroup.add(hillsMesh);

  scene.add(mountainGroup);
  return mountainGroup;
}

