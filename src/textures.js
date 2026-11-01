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

/**
 * Creates high-contrast rotating wheel face disc texture with white sidewall lettering,
 * racing markings, polished rim lip, cross-drilled rotor, and sculpted alloy spokes.
 */
export function createRacingWheelTexture(rimType = 'sport', accentColor = '#f59e0b') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const cx = 128;
  const cy = 128;

  // 1. Black Rubber Tire Tread and Sidewall Base
  ctx.beginPath();
  ctx.arc(cx, cy, 127, 0, Math.PI * 2);
  ctx.fillStyle = '#12141a';
  ctx.fill();

  // Sidewall groove rings
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.strokeStyle = '#1e222d';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 102, 0, Math.PI * 2);
  ctx.strokeStyle = '#090a0e';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 2. High-Contrast White Tire Lettering & Racing Hash Marks
  const lettering = ['SPEED', 'RUSH', 'SPORT', 'ZR20'];
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillText(lettering[i], 0, -111);

    // Vivid red/accent racing hash marks on sidewall
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-8, -125, 4, 8);
    ctx.fillRect(4, -125, 4, 8);
    ctx.restore();
  }

  // 3. Polished Aluminum Rim Outer Lip
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.fillStyle = '#cbd5e1';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 4. Dark Wheel Well Void behind spokes
  ctx.beginPath();
  ctx.arc(cx, cy, 94, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0d14';
  ctx.fill();

  // 5. Cross-Drilled Steel Brake Rotor
  ctx.beginPath();
  ctx.arc(cx, cy, 75, 0, Math.PI * 2);
  ctx.fillStyle = '#475569';
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rotor drilled cooling holes
  ctx.fillStyle = '#0f172a';
  for (let r = 45; r <= 68; r += 11) {
    const count = Math.floor(r * 0.4);
    for (let a = 0; a < count; a++) {
      const angle = (a / count) * Math.PI * 2 + (r * 0.1);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. High-Contrast 5-Spoke / Mesh Alloy Sports Rim
  const spokeCount = rimType === 'mesh' ? 8 : 5;
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Spoke shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-8, 12, 16, 82);

    // Sculpted silver spoke with highlight gradient
    const spokeGrad = ctx.createLinearGradient(-7, 0, 7, 0);
    spokeGrad.addColorStop(0, '#94a3b8');
    spokeGrad.addColorStop(0.35, '#ffffff');
    spokeGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = spokeGrad;

    ctx.beginPath();
    ctx.moveTo(-6, 16);
    ctx.lineTo(-4, 94);
    ctx.lineTo(4, 94);
    ctx.lineTo(6, 16);
    ctx.closePath();
    ctx.fill();

    // Accent line along spoke
    if (i === 0) {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(0, 92);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 7. Center Hub & Chrome Lug Bolts
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center Logo Badge
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();

  // 5 Chrome Lug Nuts
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * 18, cy + Math.sin(angle) * 18, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** Creates high-contrast speed breaker / road hump texture with yellow & black warning chevrons */
export function createSpeedBreakerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Dark asphalt base
  ctx.fillStyle = '#141720';
  ctx.fillRect(0, 0, 256, 128);

  // Alternating diagonal hazard yellow and black stripes
  const stripeWidth = 24;
  ctx.save();
  for (let x = -128; x < 256 + 128; x += stripeWidth * 2) {
    ctx.fillStyle = '#facc15'; // High-visibility highway warning yellow
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth + 64, 128);
    ctx.lineTo(x + 64, 128);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Reflective white edge lines on leading and trailing borders
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 8);
  ctx.fillRect(0, 120, 256, 8);

  // Micro glass beads / road texture stippling
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let i = 0; i < 90; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 128;
    ctx.fillRect(rx, ry, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(6, 1);
  return texture;
}

/** Creates roadside diamond yellow warning sign for Speed Breaker Ahead */
export function createSpeedBumpSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 128, 128);

  // Yellow Diamond sign rotated 45 deg
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI / 4);

  // Outer border & safety yellow fill
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-44, -44, 88, 88);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(-40, -40, 80, 80);

  ctx.restore();

  // Speed Bump Pictogram inside diamond (black hump silhouette)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(32, 66);
  ctx.lineTo(44, 66);
  ctx.bezierCurveTo(48, 46, 80, 46, 84, 66);
  ctx.lineTo(96, 66);
  ctx.lineTo(96, 72);
  ctx.lineTo(32, 72);
  ctx.closePath();
  ctx.fill();

  // Bold Text "BUMP" below hump
  ctx.font = '900 16px "Impact", "Arial Black", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.fillText('BUMP', 64, 88);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
