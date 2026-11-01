import * as THREE from 'three';
import { config } from './config.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Road } from './road.js';
import { HazardManager } from './hazards.js';
import { globalTrackCurve } from './trackCurve.js';
import { UI } from './ui.js';
import { AudioSystem } from './audio.js';
import { getHighScore, saveHighScore, getSettings } from './storage.js';

export class Game {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.audio = new AudioSystem();

    this.player = new Player(scene);
    this.traffic = new Traffic(scene);
    this.road = new Road(scene);
    this.hazards = new HazardManager(scene);
    this.speedLines = createSpeedLines(scene);
    this.debris = createDebrisPool(scene);

    this.ui = new UI(
      (carId) => this._onCarSelect(carId),
      (newSettings) => this._onSettingsChange(newSettings)
    );

    this.state = 'MENU';
    this.score = 0;
    this.high = getHighScore();
    this.speed = config.baseSpeed;
    this.distance = 0;
    this.lastScoreBucket = 0;
    this.crashT = 0;
    this.slowSpeed = config.baseSpeed;
    this.shake = 0;
    this.camFov = config.camera.CHASE.fovBase;
    this.keys = new Set();
    this.isNewHigh = false;

    // Steering input from touch or mouse
    this.touchSteer = 0;

    // Combo system
    this.combo = 1;
    this.comboTimer = 0;
    this.maxComboReached = 1;

    // Camera mode: 'CHASE', 'HOOD', 'DRONE'
    this.cameraModeIndex = 0;
    this.cameraMode = config.cameraModes[this.cameraModeIndex];

    this._bindInput();
    this.ui.setState('MENU', { high: this.high });
    this.ui.updateCameraMode(this.cameraMode);
  }

  _onCarSelect(carId) {
    this.player.setCar(carId);
    this.audio.click();
  }

  _onSettingsChange(settings) {
    if (settings.masterVolume !== undefined) {
      this.audio.setMasterVolume(settings.masterVolume);
    }
    if (settings.difficulty !== undefined) {
      config.applyDifficulty(settings.difficulty);
      this.speed = Math.max(this.speed, config.baseSpeed);
    }
  }

  cycleCamera() {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % config.cameraModes.length;
    this.cameraMode = config.cameraModes[this.cameraModeIndex];
    this.ui.updateCameraMode(this.cameraMode);
    this.audio.click();
  }

  update(dt) {
    if (this.state === 'PAUSED' || this.state === 'MENU') return;

    if (this.state === 'CRASHING') {
      this._updateCrash(dt);
      this._updateCamera(dt);
      return;
    }

    // Process continuous steering inputs
    let steer = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) steer -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) steer += 1;
    if (this.touchSteer !== 0) steer = this.touchSteer;
    this.player.setSteerInput(steer);

    // Natural speed ramp target based on distance traveled
    const targetBaseSpeed =
      config.maxSpeed - (config.maxSpeed - config.baseSpeed) * Math.exp(-this.distance * 0.0018);

    // Apply Braking or Acceleration
    if (this.player.isBraking) {
      this.speed = Math.max(config.minSpeed, this.speed - config.brakeDecel * dt);
    } else {
      this.speed = THREE.MathUtils.damp(this.speed, targetBaseSpeed, config.speedRamp, dt);
    }

    const nitroMul = this.player.nitroActive ? config.nitroMultiplier : 1;
    const worldSpeed = this.speed * nitroMul;

    // Update Player movements
    const playerInfo = this.player.update(dt, worldSpeed);
    if (playerInfo.nitroJustStarted) this.audio.nitroWhoosh();

    // Update Road & Environment
    this.road.update(dt, worldSpeed);
    updateSpeedLines(this.speedLines, dt, worldSpeed, this.player.nitroActive);

    // Update Road Hazards (Construction Zone Lane Closures, Oil Slicks, Billboards)
    const hazardEvents = this.hazards.update(dt, worldSpeed, this.player.x, this.player.lane, this.player.isBraking);

    // Update Traffic AI with awareness of closed construction lane
    const events = this.traffic.update(dt, worldSpeed, this.player.lane, this.player.x, hazardEvents.closedLane);

    if (hazardEvents.hazardWarning) {
      this.ui.showHazardAlert(hazardEvents.hazardWarning, 'danger');
    }
    if (hazardEvents.oilSlip) {
      this.player.applyOilSlip();
      this.audio.carHorn();
      this.ui.showHazardAlert('TRACTION LOSS! COUNTER-STEER!', 'danger');
      this.shake = 0.24;
    }
    if (hazardEvents.coneHit) {
      this.audio.click();
    }
    if (hazardEvents.crashed) {
      this._beginCrash();
      return;
    }

    // Blinker audio & Police audio
    if (events.blinkerTick) this.audio.blinkerTick();
    if (events.policeActive) {
      this.audio.startPoliceSiren();
      this.ui.showHazardAlert('HIGH SPEED POLICE PURSUIT', 'danger');
    } else {
      this.audio.stopPoliceSiren();
    }

    // Update Combo Timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.ui.updateCombo(1, 0);
      } else {
        this.ui.updateCombo(this.combo, this.comboTimer / config.comboWindow);
      }
    }

    // Handle Near Miss & Combo Stacking
    if (events.nearMiss) {
      this.combo = Math.min(config.maxComboMultiplier, this.combo + 1);
      this.comboTimer = config.comboWindow;
      this.maxComboReached = Math.max(this.maxComboReached, this.combo);

      // Score bonus with combo multiplier
      const bonus = config.nearMissBonus * this.combo * (this.player.nitroActive ? config.nitroScoreMul : 1);
      this.score += bonus;

      // Rewarding nitro boost on close passes
      this.player.addNitro(config.nearMissNitroBonus);

      // Dynamic audio
      this.audio.nearMiss(this.combo);
      this.audio.carHorn();

      this.ui.nearMissPopup(bonus, this.combo);
      this.ui.updateCombo(this.combo, 1);
    }

    // Distance & Continuous Score
    this.distance += worldSpeed * dt;
    const scoreMul = (this.player.nitroActive ? config.nitroScoreMul : 1) * (1 + (this.combo - 1) * 0.15);
    this.score += worldSpeed * dt * config.scorePerUnit * (1 + this.speed * config.speedScoreFactor) * scoreMul;

    // Milestone Ping
    const bucket = Math.floor(this.score / 200);
    if (bucket > this.lastScoreBucket) {
      this.lastScoreBucket = bucket;
      this.audio.scorePing();
    }

    // Engine Audio
    this.audio.updateEngine(worldSpeed, this.player.nitroActive, this.player.isBraking);

    // Camera shake with settings multiplier
    const shakeMult = getSettings().screenShake || 1.0;
    if (this.player.nitroActive) {
      this.shake = config.camera.shakeNitro * shakeMult;
    } else if (this.player.isBraking) {
      this.shake = config.camera.shakeBrake * shakeMult;
    } else {
      this.shake *= Math.max(0, 1 - dt * 8);
    }

    this._updateCamera(dt);
    this._updateHud(worldSpeed);

    // Collision check
    if (events.crashed) {
      this._beginCrash();
    }
  }

  _beginCrash() {
    this.state = 'CRASHING';
    this.crashT = 0;
    this.slowSpeed = this.speed * (this.player.nitroActive ? config.nitroMultiplier : 1);
    this.shake = config.camera.shakeCrash * (getSettings().screenShake || 1.0);
    this.player.nitroActive = false;
    this.player.setFlames(false);
    this.audio.crash();
    this.audio.stopEngine();
    this.ui.crashFlash(true);

    // Trigger 3D flying debris explosion
    spawnDebrisExplosion(this.debris, this.player.x, 0.5, 0);
  }

  _updateCrash(dt) {
    this.crashT += dt;
    const k = 1 - Math.min(1, this.crashT / config.crashDuration);
    const spd = this.slowSpeed * k * k;

    this.road.update(dt, spd);
    this.traffic.update(dt, spd, this.player.lane, this.player.x);
    this.hazards.update(dt, spd, this.player.x, this.player.lane, false);
    updateDebris(this.debris, dt);

    this.shake = config.camera.shakeCrash * k * (getSettings().screenShake || 1.0);
    if (this.crashT > 0.14) this.ui.crashFlash(false);
    if (this.crashT >= config.crashDuration) this._gameOver();
  }

  _gameOver() {
    const rounded = Math.floor(this.score);
    this.isNewHigh = rounded > this.high;
    if (this.isNewHigh) {
      this.high = rounded;
      saveHighScore(this.high);
    }
    this.state = 'GAME_OVER';
    this.ui.crashFlash(false);
    this.ui.setState('GAME_OVER', {
      score: rounded,
      high: this.high,
      isNewHigh: this.isNewHigh,
      maxCombo: this.maxComboReached,
      distance: Math.floor(this.distance),
    });
  }

  _start() {
    const s = getSettings();
    config.applyDifficulty(s.difficulty || 'PRO');

    this.player.reset();
    this.traffic.reset();
    this.hazards.reset();
    globalTrackCurve.reset();
    resetDebris(this.debris);
    this.score = 0;
    this.distance = 0;
    this.speed = config.baseSpeed;
    this.lastScoreBucket = 0;
    this.crashT = 0;
    this.shake = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.maxComboReached = 1;
    this.isNewHigh = false;
    this.touchSteer = 0;
    this.state = 'PLAYING';
    this.ui.setState('PLAYING', { high: this.high });
    this.ui.updateCombo(1, 0);
    this.ui.crashFlash(false);
    this.audio.resume();
  }

  _updateHud(worldSpeed) {
    this.ui.updateHud({
      score: this.score,
      speedKmh: worldSpeed * config.kmhPerUnit,
      high: this.high,
      nitro: this.player.nitro,
      nitroState: this.player.nitroState(),
      isBraking: this.player.isBraking,
      cameraMode: this.cameraMode,
    });
  }

  _updateCamera(dt) {
    const camCfg = config.camera[this.cameraMode] || config.camera.CHASE;
    const nitro = this.player.nitroActive;
    const speedT = THREE.MathUtils.clamp(
      (this.speed - config.baseSpeed) / (config.maxSpeed - config.baseSpeed),
      0,
      1,
    );

    const targetFov = camCfg.fovBase + camCfg.fovSpeedGain * speedT + (nitro ? config.nitroFovBoost : 0);
    this.camFov = THREE.MathUtils.damp(this.camFov, targetFov, 6, dt);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();

    const followX = this.player.x * camCfg.followX;
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    if (this.cameraMode === 'HOOD') {
      this.camera.position.set(this.player.x + sx * 0.5, camCfg.height + sy * 0.5, camCfg.back);
      this.camera.lookAt(this.player.x + (this.player.steeringYaw || 0) * 2.0, 0.9, -camCfg.lookAhead);
    } else {
      this.camera.position.set(followX + sx, camCfg.height + sy, camCfg.back);
      this.camera.lookAt(this.player.x * 0.28, 0.8, -camCfg.lookAhead);
    }

    // Dynamic 3D Camera Banking into Highway Curves & G-Force Roll
    this.camera.rotation.z = -globalTrackCurve.curvature * 0.028 + (this.player.tilt * 0.12);
  }

  _bindInput() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      this.audio.resume();
      const key = e.key.toLowerCase();

      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'spacebar'].includes(key) || e.code === 'Space') {
        e.preventDefault();
      }
      if (this.keys.has(e.code)) return;
      this.keys.add(e.code);

      if (key === 'm') this.audio.toggleMute();
      if (key === 'c') this.cycleCamera();

      if (this.state === 'MENU' && (key === 'enter' || key === ' ')) {
        this.audio.click();
        this._start();
        return;
      }
      if (this.state === 'GAME_OVER' && (key === 'enter' || key === ' ')) {
        this.audio.click();
        this._start();
        return;
      }
      if ((key === 'p' || key === 'escape') && (this.state === 'PLAYING' || this.state === 'PAUSED')) {
        this.audio.click();
        if (this.state === 'PLAYING') {
          this.state = 'PAUSED';
          this.audio.stopEngine();
          this.ui.setState('PAUSED', { high: this.high });
        } else {
          this.state = 'PLAYING';
          this.ui.setState('PLAYING', { high: this.high });
        }
        return;
      }

      if (this.state !== 'PLAYING') return;

      // Lane-snap tap fallback
      if (key === 'arrowleft' || key === 'a') this.player.requestLane(-1);
      if (key === 'arrowright' || key === 'd') this.player.requestLane(1);

      // Braking
      if (key === 'arrowdown' || key === 's') {
        this.player.setBrakeHeld(true);
      }

      // Nitro
      if (key === 'arrowup' || key === 'w' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.player.setNitroHeld(true);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const key = e.key.toLowerCase();

      if (key === 'arrowdown' || key === 's') {
        this.player.setBrakeHeld(false);
      }

      if (key === 'arrowup' || key === 'w' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.player.setNitroHeld(false);
      }
    });

    // Wire up On-Screen Interactive Buttons
    this._bindTouchButtons();

    // Wire up Settings and Menu Navigation Buttons
    this._bindMenuButtons();
  }

  _bindTouchButtons() {
    const bindPress = (el, onDown, onUp) => {
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        this.audio.resume();
        onDown();
      };
      const end = (e) => {
        e.preventDefault();
        onUp();
      };
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
    };

    // On-screen Brake Button
    bindPress(
      this.ui.btnBrake,
      () => this.player.setBrakeHeld(true),
      () => this.player.setBrakeHeld(false)
    );

    // On-screen Nitro Button
    bindPress(
      this.ui.btnNitro,
      () => this.player.setNitroHeld(true),
      () => this.player.setNitroHeld(false)
    );

    // On-screen Steer Left Button
    bindPress(
      this.ui.btnSteerLeft,
      () => {
        this.touchSteer = -1;
        this.player.requestLane(-1);
      },
      () => {
        this.touchSteer = 0;
      }
    );

    // On-screen Steer Right Button
    bindPress(
      this.ui.btnSteerRight,
      () => {
        this.touchSteer = 1;
        this.player.requestLane(1);
      },
      () => {
        this.touchSteer = 0;
      }
    );
  }

  _bindMenuButtons() {
    const btnStart = document.getElementById('btn-start');
    const btnRestart = document.getElementById('btn-restart');
    const btnResume = document.getElementById('btn-resume');

    const btnSettingsHud = document.getElementById('btn-settings-hud');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnPauseSettings = document.getElementById('btn-pause-settings');
    const btnOverSettings = document.getElementById('btn-over-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');

    if (btnStart) btnStart.addEventListener('click', () => { this.audio.click(); this._start(); });
    if (btnRestart) btnRestart.addEventListener('click', () => { this.audio.click(); this._start(); });
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.audio.click();
        this.state = 'PLAYING';
        this.ui.setState('PLAYING', { high: this.high });
      });
    }

    // Open Settings Modals
    if (btnSettingsHud) {
      btnSettingsHud.addEventListener('click', () => {
        this.audio.click();
        if (this.state === 'PLAYING') {
          this.state = 'PAUSED';
          this.audio.stopEngine();
        }
        this.ui.openSettings('PAUSED');
      });
    }

    if (btnOpenSettings) btnOpenSettings.addEventListener('click', () => { this.audio.click(); this.ui.openSettings('MENU'); });
    if (btnPauseSettings) btnPauseSettings.addEventListener('click', () => { this.audio.click(); this.ui.openSettings('PAUSED'); });
    if (btnOverSettings) btnOverSettings.addEventListener('click', () => { this.audio.click(); this.ui.openSettings('GAME_OVER'); });
    if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => { this.audio.click(); this.ui.closeSettings(); });
  }
}

/** 3D Speed Lines Particles */
function createSpeedLines(scene) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.04, 0.04, 2.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.0,
  });
  const items = [];
  for (let i = 0; i < config.pool.particles; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    resetLine(m);
    group.add(m);
    items.push(m);
  }
  scene.add(group);
  return items;
}

function updateSpeedLines(items, dt, speed, nitro) {
  const targetOpacity = nitro ? 0.75 : (speed > 55 ? 0.25 : 0.0);
  for (const m of items) {
    m.material.opacity = THREE.MathUtils.damp(m.material.opacity, targetOpacity, 8, dt);
    m.position.z += speed * dt * 2.2;
    if (m.position.z > 8) resetLine(m);
  }
}

function resetLine(m) {
  const side = Math.random() < 0.5 ? -1 : 1;
  m.position.set(
    side * (1.8 + Math.random() * 8),
    0.4 + Math.random() * 4.5,
    -15 - Math.random() * 95,
  );
}

/** 3D Crash Flying Debris Pool */
function createDebrisPool(scene) {
  const pool = [];
  const debrisColors = [0x10d860, 0xffc300, 0x1d4ed8, 0xef1122, 0xd8e4f0];
  const group = new THREE.Group();

  for (let i = 0; i < 28; i++) {
    const size = 0.2 + Math.random() * 0.35;
    const geo = i % 3 === 0
      ? new THREE.CylinderGeometry(size * 0.7, size * 0.7, 0.15, 8)
      : new THREE.BoxGeometry(size, size, size * 1.5);
    const mat = new THREE.MeshStandardMaterial({
      color: debrisColors[i % debrisColors.length],
      metalness: 0.8,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);

    pool.push({
      mesh,
      vx: 0,
      vy: 0,
      vz: 0,
      rotVx: 0,
      rotVy: 0,
      rotVz: 0,
      active: false,
    });
  }

  scene.add(group);
  return pool;
}

function spawnDebrisExplosion(pool, x, y, z) {
  for (const p of pool) {
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.set(x + (Math.random() - 0.5) * 1.2, y, z + (Math.random() - 0.5) * 2);
    p.vx = (Math.random() - 0.5) * 22;
    p.vy = 6 + Math.random() * 14;
    p.vz = (Math.random() - 0.5) * 20;
    p.rotVx = (Math.random() - 0.5) * 15;
    p.rotVy = (Math.random() - 0.5) * 15;
    p.rotVz = (Math.random() - 0.5) * 15;
  }
}

function updateDebris(pool, dt) {
  const gravity = -32;
  for (const p of pool) {
    if (!p.active) continue;
    p.vy += gravity * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y = Math.max(0.1, p.mesh.position.y + p.vy * dt);
    p.mesh.position.z += p.vz * dt;

    p.mesh.rotation.x += p.rotVx * dt;
    p.mesh.rotation.y += p.rotVy * dt;
    p.mesh.rotation.z += p.rotVz * dt;

    if (p.mesh.position.y <= 0.12 && p.vy < 0) {
      p.vy = -p.vy * 0.45;
      p.vx *= 0.7;
      p.vz *= 0.7;
    }
  }
}

function resetDebris(pool) {
  for (const p of pool) {
    p.active = false;
    p.mesh.visible = false;
  }
}
