import * as THREE from 'three';

/**
 * Procedural Canvas Texture Generator.
 * Creates rich, crisp textures using HTML5 2D canvas at runtime without any external asset files.
 */

/** Creates a tiled asphalt road surface texture with gravel grain and skid marks */
export function createAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base asphalt high-contrast slate gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#363d50');
  grad.addColorStop(0.5, '#2e3444');
  grad.addColorStop(1, '#33394a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Grain noise speckles
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise + 2));
  }
  ctx.putImageData(imgData, 0, 0);

  // Faint longitudinal aggregate grain / wear tracks
  ctx.strokeStyle = 'rgba(10, 12, 18, 0.4)';
  ctx.lineWidth = 4;
  for (let x = 60; x < 512; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x + (Math.random() * 20 - 10), 0);
    ctx.lineTo(x + (Math.random() * 20 - 10), 512);
    ctx.stroke();
  }

  // Faint rubber skid marks
  ctx.strokeStyle = 'rgba(6, 8, 12, 0.55)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(180, 20);
  ctx.bezierCurveTo(184, 180, 192, 320, 186, 500);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(330, 80);
  ctx.bezierCurveTo(325, 220, 318, 380, 322, 480);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 16);
  return texture;
}

/** Creates striped curbs / rumble strip texture (diagonal red and white hazard stripes) */
export function createRumbleStripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#dc2626'; // Vibrant red
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#f8fafc'; // Crisp white
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(64, 0);
  ctx.lineTo(128, 64);
  ctx.lineTo(128, 128);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(64, 128);
  ctx.lineTo(0, 128);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 24);
  return texture;
}

/** Creates an electronic LED dot-matrix highway gantry sign texture */
export function createGantrySignTexture(title = 'HIGHWAY 101', status = 'ALL LANES OPEN', alertLevel = 'normal') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Dark matte board with border
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 120);

  // Amber LED header
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = alertLevel === 'danger' ? '#ef4444' : '#f59e0b';
  ctx.shadowColor = alertLevel === 'danger' ? '#ef4444' : '#fbbf24';
  ctx.shadowBlur = 10;
  ctx.fillText(title, 256, 44);

  // Secondary subtext
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillStyle = alertLevel === 'danger' ? '#fca5a5' : '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.fillText(status, 256, 86);

  // Digital lane status indicators below (green arrows)
  ctx.shadowBlur = 0;
  for (let i = 0; i < 4; i++) {
    const x = 120 + i * 90;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(x, 102);
    ctx.lineTo(x + 10, 114);
    ctx.lineTo(x - 10, 114);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** Creates skyscraper facade window texture with glowing windows */
export function createBuildingWindowsTexture(hue = 210) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Concrete dark building base
  ctx.fillStyle = '#0f1422';
  ctx.fillRect(0, 0, 256, 512);

  // Grid of illuminated windows
  const cols = 8;
  const rows = 24;
  const w = 20;
  const h = 14;
  const gapX = 12;
  const gapY = 8;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 8 + c * (w + gapX);
      const y = 8 + r * (h + gapY);
      const lit = Math.random() < 0.45;
      if (lit) {
        const sat = 70 + Math.random() * 30;
        const light = 55 + Math.random() * 35;
        // Warm gold, cyan, or magenta accents
        const hOffset = Math.random() < 0.2 ? 40 : (Math.random() < 0.1 ? 140 : 0);
        ctx.fillStyle = `hsl(${hue + hOffset}, ${sat}%, ${light}%)`;
      } else {
        ctx.fillStyle = '#161c2e';
      }
      ctx.fillRect(x, y, w, h);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Creates shipping container corrugated sides texture */
export function createTruckContainerTexture(baseColorHex = 0x2563eb) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const hexStr = '#' + baseColorHex.toString(16).padStart(6, '0');
  ctx.fillStyle = hexStr;
  ctx.fillRect(0, 0, 256, 128);

  // Corrugated vertical ridges
  for (let x = 0; x < 256; x += 12) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(x, 0, 5, 128);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x + 5, 0, 3, 128);
  }

  // Logistics Logo stripe
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 48, 216, 32);
  ctx.fillStyle = hexStr;
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GLOBAL CARGO', 128, 72);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** Creates high-visibility yellow & black diagonal hazard stripes for truck trailer doors */
export function createTruckRearHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fbbf24'; // Vivid safety yellow
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#1e1b18'; // Dark charcoal stripe
  const stripeW = 24;
  for (let i = -128; i < 256; i += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + stripeW, 0);
    ctx.lineTo(i + stripeW - 128, 128);
    ctx.lineTo(i - 128, 128);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

