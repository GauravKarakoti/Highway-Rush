const HIGH_KEY = 'highwayRush_highScore';
const MUTE_KEY = 'highwayRush_mute';
const SETTINGS_KEY = 'highwayRush_settings';

export const DEFAULT_SETTINGS = {
  difficulty: 'PRO', // 'NORMAL', 'PRO', 'INSANITY'
  steeringMode: 'SMOOTH', // 'SMOOTH' (fluid continuous) or 'LANE' (discrete lane-snap)
  selectedCar: 'ferrari_italia', // 'ferrari_italia', 'porsche_gt3', 'lambo_aventador', 'nissan_gtr', 'ferrari_f40'
  customColorHex: null, // Custom user chosen paint color
  steeringSensitivity: 1.0, // 0.5 to 2.0
  touchControls: true, // Show on-screen brake/nitro buttons
  screenShake: 1.0, // 0.0 to 1.5
  masterVolume: 0.6, // 0.0 to 1.0
  cameraView: 'CHASE', // 'CHASE', 'HOOD', 'DRONE'
};

export function getHighScore() {
  try {
    const n = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  try {
    localStorage.setItem(HIGH_KEY, String(Math.floor(score)));
  } catch {
    // Private mode / disabled storage — ignore.
  }
}

export function getMute() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMute(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
