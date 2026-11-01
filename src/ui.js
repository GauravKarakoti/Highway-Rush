import { config } from './config.js';
import { getSettings, saveSettings } from './storage.js';

export class UI {
  constructor(onCarSelect, onSettingsChange, onColorSelect) {
    this.onCarSelect = onCarSelect;
    this.onSettingsChange = onSettingsChange;
    this.onColorSelect = onColorSelect;

    this.hud = document.getElementById('hud');
    this.overlay = document.getElementById('overlay');
    this.menu = document.getElementById('screen-menu');
    this.pause = document.getElementById('screen-pause');
    this.over = document.getElementById('screen-over');
    this.settingsPanel = document.getElementById('screen-settings');

    this.score = document.getElementById('hud-score');
    this.speed = document.getElementById('hud-speed');
    this.high = document.getElementById('hud-high');
    this.menuHigh = document.getElementById('menu-high');

    this.overScore = document.getElementById('over-score');
    this.overCombo = document.getElementById('over-combo');
    this.overDist = document.getElementById('over-dist');
    this.overHigh = document.getElementById('over-high');
    this.newHigh = document.getElementById('new-high');

    this.nitroBar = document.getElementById('nitro-bar');
    this.nitroFill = document.getElementById('nitro-fill');
    this.nitroPercent = document.getElementById('nitro-percent');
    this.brakeIndicator = document.getElementById('brake-indicator');
    this.cameraPill = document.getElementById('camera-pill');

    this.comboBadge = document.getElementById('combo-badge');
    this.comboMultiplier = document.getElementById('combo-multiplier');
    this.comboFill = document.getElementById('combo-fill');

    this.hazardBanner = document.getElementById('hazard-banner');
    this.hazardText = document.getElementById('hazard-text');
    this.hazardTimer = null;
    this.hudDiff = document.getElementById('hud-difficulty');

    this.sbBadge = document.getElementById('speed-breaker-badge');
    this.sbTimer = document.getElementById('sb-timer');
    this.sbBar = document.getElementById('sb-bar');

    this.popups = document.getElementById('popups');
    this.flash = document.getElementById('flash');
    this.touchControls = document.getElementById('touch-controls');

    // On-screen buttons
    this.btnBrake = document.getElementById('btn-brake');
    this.btnNitro = document.getElementById('btn-nitro');
    this.btnSteerLeft = document.getElementById('btn-steer-left');
    this.btnSteerRight = document.getElementById('btn-steer-right');

    // Quick Menu difficulty buttons
    this.btnDiffNormal = document.getElementById('btn-diff-normal');
    this.btnDiffPro = document.getElementById('btn-diff-pro');
    this.btnDiffInsanity = document.getElementById('btn-diff-insanity');

    // Settings difficulty buttons
    this.btnSetDiffNormal = document.getElementById('btn-settings-diff-normal');
    this.btnSetDiffPro = document.getElementById('btn-settings-diff-pro');
    this.btnSetDiffInsanity = document.getElementById('btn-settings-diff-insanity');

    // Settings elements
    this.garageContainer = document.getElementById('garage-cards');
    this.btnModeSmooth = document.getElementById('btn-mode-smooth');
    this.btnModeLane = document.getElementById('btn-mode-lane');
    this.sliderSens = document.getElementById('slider-sensitivity');
    this.labelSens = document.getElementById('label-sensitivity');
    this.checkTouch = document.getElementById('check-touch-controls');
    this.sliderVol = document.getElementById('slider-volume');
    this.labelVol = document.getElementById('label-volume');
    this.sliderShake = document.getElementById('slider-shake');
    this.labelShake = document.getElementById('label-shake');

    this.prevOverlayState = 'MENU';
    this._initSettingsUI();
  }

  _initSettingsUI() {
    const s = getSettings();

    // Populate Garage Cards
    this._renderGarageCards(s.selectedCar);

    // Populate Custom Car Paint Palette
    const paletteContainer = document.getElementById('car-color-palette');
    if (paletteContainer) {
      const chips = paletteContainer.querySelectorAll('.color-chip');
      const activeColor = s.customColorHex;
      chips.forEach((chip) => {
        const colorAttr = chip.getAttribute('data-color');
        const chipColor = colorAttr === 'default' ? null : Number(colorAttr);
        if (
          (activeColor === null && colorAttr === 'default') ||
          (activeColor !== null && chipColor === activeColor)
        ) {
          chip.classList.add('active');
        }
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          chips.forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          this._updateSetting('customColorHex', chipColor);
          if (this.onColorSelect) {
            this.onColorSelect(chipColor);
          }
        });
      });
    }

    // Populate Settings Controls
    if (this.sliderSens) {
      this.sliderSens.value = s.steeringSensitivity;
      this.labelSens.textContent = `${s.steeringSensitivity.toFixed(1)}x`;
      this.sliderSens.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.labelSens.textContent = `${val.toFixed(1)}x`;
        this._updateSetting('steeringSensitivity', val);
      });
    }

    if (this.checkTouch) {
      this.checkTouch.checked = s.touchControls;
      this._applyTouchControlsVisibility(s.touchControls);
      this.checkTouch.addEventListener('change', (e) => {
        this._applyTouchControlsVisibility(e.target.checked);
        this._updateSetting('touchControls', e.target.checked);
      });
    }

    if (this.sliderVol) {
      this.sliderVol.value = Math.round(s.masterVolume * 100);
      this.labelVol.textContent = `${this.sliderVol.value}%`;
      this.sliderVol.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        this.labelVol.textContent = `${pct}%`;
        this._updateSetting('masterVolume', pct / 100);
      });
    }

    if (this.sliderShake) {
      this.sliderShake.value = Math.round(s.screenShake * 100);
      this.labelShake.textContent = `${this.sliderShake.value}%`;
      this.sliderShake.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        this.labelShake.textContent = `${pct}%`;
        this._updateSetting('screenShake', pct / 100);
      });
    }

    // Steering mode toggle buttons
    if (this.btnModeSmooth && this.btnModeLane) {
      this._updateSteeringModeButtons(s.steeringMode);
      this.btnModeSmooth.addEventListener('click', () => {
        this._updateSteeringModeButtons('SMOOTH');
        this._updateSetting('steeringMode', 'SMOOTH');
      });
      this.btnModeLane.addEventListener('click', () => {
        this._updateSteeringModeButtons('LANE');
        this._updateSetting('steeringMode', 'LANE');
      });
    }

    // Difficulty buttons (Menu & Settings)
    const activeDiff = s.difficulty || 'PRO';
    this._updateDifficultyUI(activeDiff);

    const bindDiff = (btn, diff) => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._updateDifficultyUI(diff);
          this._updateSetting('difficulty', diff);
        });
      }
    };

    bindDiff(this.btnDiffNormal, 'NORMAL');
    bindDiff(this.btnDiffPro, 'PRO');
    bindDiff(this.btnDiffInsanity, 'INSANITY');
    bindDiff(this.btnSetDiffNormal, 'NORMAL');
    bindDiff(this.btnSetDiffPro, 'PRO');
    bindDiff(this.btnSetDiffInsanity, 'INSANITY');
  }

  _updateDifficultyUI(diff) {
    if (this.hudDiff) {
      this.hudDiff.textContent = diff;
      this.hudDiff.className = `hud-diff-badge diff-${diff.toLowerCase()}`;
    }

    const setAct = (btn, match) => {
      if (btn) btn.classList.toggle('active', match);
    };

    setAct(this.btnDiffNormal, diff === 'NORMAL');
    setAct(this.btnDiffPro, diff === 'PRO');
    setAct(this.btnDiffInsanity, diff === 'INSANITY');

    setAct(this.btnSetDiffNormal, diff === 'NORMAL');
    setAct(this.btnSetDiffPro, diff === 'PRO');
    setAct(this.btnSetDiffInsanity, diff === 'INSANITY');
  }

  _updateSteeringModeButtons(mode) {
    if (!this.btnModeSmooth || !this.btnModeLane) return;
    this.btnModeSmooth.classList.toggle('active', mode === 'SMOOTH');
    this.btnModeLane.classList.toggle('active', mode === 'LANE');
  }

  _applyTouchControlsVisibility(visible) {
    if (this.touchControls) {
      this.touchControls.classList.toggle('disabled-controls', !visible);
    }
  }

  _updateSetting(key, val) {
    const s = getSettings();
    s[key] = val;
    saveSettings(s);
    if (this.onSettingsChange) {
      this.onSettingsChange(s);
    }
  }

  _renderGarageCards(activeCarId) {
    if (!this.garageContainer) return;
    this.garageContainer.innerHTML = '';

    for (const [id, car] of Object.entries(config.cars)) {
      const card = document.createElement('div');
      card.className = `garage-card ${id === activeCarId ? 'selected' : ''}`;
      card.setAttribute('data-car-id', id);

      const colorHex = '#' + car.color.toString(16).padStart(6, '0');
      card.innerHTML = `
        <div class="card-header">
          <span class="card-brand">${car.brand}</span>
          <span class="card-color-chip" style="background: ${colorHex}"></span>
        </div>
        <div class="card-name">${car.name}</div>
        <div class="card-stats">
          <div class="stat-bar-row">
            <span>SPEED</span>
            <div class="mini-bar"><div class="mini-fill" style="width: ${car.speedStat}%"></div></div>
          </div>
          <div class="stat-bar-row">
            <span>ACCEL</span>
            <div class="mini-bar"><div class="mini-fill" style="width: ${car.accelStat}%"></div></div>
          </div>
          <div class="stat-bar-row">
            <span>GRIP</span>
            <div class="mini-bar"><div class="mini-fill" style="width: ${car.handlingStat}%"></div></div>
          </div>
          <div class="stat-bar-row">
            <span>NITRO</span>
            <div class="mini-bar"><div class="mini-fill" style="width: ${car.nitroStat}%"></div></div>
          </div>
        </div>
        <div class="card-desc">${car.desc}</div>
      `;

      card.addEventListener('click', () => {
        this.selectCar(id);
      });

      this.garageContainer.appendChild(card);
    }
  }

  selectCar(carId) {
    this._updateSetting('selectedCar', carId);
    this._renderGarageCards(carId);
    if (this.onCarSelect) {
      this.onCarSelect(carId);
    }
  }

  openSettings(fromState = 'MENU') {
    this.prevOverlayState = fromState;
    this.menu.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.over.classList.add('hidden');
    this.settingsPanel.classList.remove('hidden');
    this.overlay.classList.remove('playing', 'hidden');
  }

  closeSettings() {
    this.settingsPanel.classList.add('hidden');
    this.setState(this.prevOverlayState, { high: getSettings().high || 0 });
  }

  setState(state, { score = 0, high = 0, isNewHigh = false, maxCombo = 1, distance = 0 } = {}) {
    const playing = state === 'PLAYING';
    this.hud.classList.toggle('hidden', !playing && state !== 'PAUSED');
    this.overlay.classList.toggle('playing', playing);
    this.overlay.classList.toggle('hidden', playing);

    this.menu.classList.toggle('hidden', state !== 'MENU');
    this.pause.classList.toggle('hidden', state !== 'PAUSED');
    this.over.classList.toggle('hidden', state !== 'GAME_OVER');
    this.settingsPanel.classList.add('hidden');

    this.menuHigh.textContent = formatScore(high);
    this.high.textContent = formatScore(high);

    if (state === 'GAME_OVER') {
      this.overScore.textContent = formatScore(score);
      this.overHigh.textContent = formatScore(high);
      this.overCombo.textContent = `x${maxCombo}`;
      this.overDist.textContent = `${distance} m`;
      this.newHigh.classList.toggle('hidden', !isNewHigh);
      this.hideHazardAlert();
    }
  }

  updateHud({ score, speedKmh, high, nitro, nitroState, isBraking, cameraMode }) {
    this.score.textContent = formatScore(score);
    this.speed.textContent = `${Math.round(speedKmh)} km/h`;
    this.high.textContent = formatScore(high);

    const p = Math.max(0, Math.min(1, nitro / 100));
    this.nitroFill.style.transform = `scaleX(${p})`;
    this.nitroPercent.textContent = `${Math.round(p * 100)}%`;

    this.nitroBar.classList.remove('ready', 'active', 'cooldown');
    this.nitroBar.classList.add(nitroState);

    this.brakeIndicator.classList.toggle('hidden', !isBraking);
    if (this.btnBrake) {
      this.btnBrake.classList.toggle('active-press', isBraking);
    }
  }

  updateCameraMode(mode) {
    this.cameraPill.textContent = `CAM: ${mode} [C]`;
  }

  updateCombo(combo, timerFraction) {
    if (combo <= 1) {
      this.comboBadge.classList.add('hidden');
    } else {
      this.comboBadge.classList.remove('hidden');
      this.comboMultiplier.textContent = `x${combo}`;
      this.comboFill.style.transform = `scaleX(${Math.max(0, Math.min(1, timerFraction))})`;
    }
  }

  nearMissPopup(bonusPoints = 50, combo = 1) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.innerHTML = combo > 1
      ? `+${bonusPoints} NEAR MISS! <span class="combo-tag">x${combo} COMBO</span>`
      : `+${bonusPoints} NEAR MISS`;

    this.popups.appendChild(el);
    window.setTimeout(() => el.remove(), 950);
  }

  spawnPopup(text, x = 0, type = 'normal') {
    if (!this.popups) return;
    const el = document.createElement('div');
    el.className = `popup popup-${type}`;
    el.textContent = text;
    this.popups.appendChild(el);
    window.setTimeout(() => el.remove(), 950);
  }

  showHazardAlert(text, type = 'danger') {
    this.hazardBanner.classList.remove('hidden');
    this.hazardText.textContent = text;
    if (this.hazardTimer) clearTimeout(this.hazardTimer);
    this.hazardTimer = setTimeout(() => {
      this.hideHazardAlert();
    }, 4500);
  }

  hideHazardAlert() {
    this.hazardBanner.classList.add('hidden');
  }

  updateSpeedBreakerPenalty(remainingSec, totalSec) {
    if (!this.sbBadge) return;
    this.sbBadge.classList.remove('hidden');
    if (this.sbTimer) {
      this.sbTimer.textContent = `${Math.max(0, remainingSec).toFixed(1)}s`;
    }
    if (this.sbBar) {
      const p = Math.max(0, Math.min(1, remainingSec / totalSec));
      this.sbBar.style.transform = `scaleX(${p})`;
    }
  }

  clearSpeedBreakerPenalty() {
    if (this.sbBadge) {
      this.sbBadge.classList.add('hidden');
    }
  }

  crashFlash(on) {
    this.flash.classList.toggle('on', on);
  }
}

function formatScore(n) {
  return Math.floor(n).toLocaleString('en-US');
}
