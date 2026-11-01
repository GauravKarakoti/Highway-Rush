import * as THREE from 'three';

/**
 * TrackCurve System
 * Provides continuous mathematical highway curvature, banking, and elevation undulation.
 * Synchronizes road ribbon, markings, curbs, guardrails, gantries, streetlamps, buildings,
 * hazards, and all traffic vehicles into a cohesive 3D winding highway.
 */
export class TrackCurve {
  constructor() {
    this.travelDistance = 0;
    this.curvature = 0; // Current road curve intensity (-2.2 to +2.2)
    this.targetCurvature = 0;
    this.elevation = 0; // Current hill pitch intensity
    this.curveTimer = 3.0; // Time until next curve transition
    this.curvePhase = 0;
  }

  reset() {
    this.travelDistance = 0;
    this.curvature = 0;
    this.targetCurvature = 0;
    this.elevation = 0;
    this.curveTimer = 3.0;
    this.curvePhase = 0;
  }

  update(dt, speed) {
    const dz = speed * dt;
    this.travelDistance += dz;

    // Organic highway curve sequencer: transitions between straight stretches and sweeping left/right bends
    this.curveTimer -= dt;
    if (this.curveTimer <= 0) {
      // Pick next curve target: gentle straights (0) or sweeping turns (±0.8 to ±1.8)
      this.curvePhase = (this.curvePhase + 1) % 5;
      if (this.curvePhase === 0 || this.curvePhase === 2) {
        this.targetCurvature = 0; // Straight stretch
        this.curveTimer = 4.0 + Math.random() * 3.0;
      } else if (this.curvePhase === 1) {
        this.targetCurvature = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 0.8);
        this.curveTimer = 5.0 + Math.random() * 4.0;
      } else if (this.curvePhase === 3) {
        // S-curve opposite direction
        this.targetCurvature = -this.curvature * 0.85 || (Math.random() > 0.5 ? 1.2 : -1.2);
        this.curveTimer = 4.5 + Math.random() * 3.5;
      } else {
        this.targetCurvature = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.7);
        this.curveTimer = 4.0 + Math.random() * 3.0;
      }
    }

    // Smooth transition into turns
    this.curvature = THREE.MathUtils.damp(this.curvature, this.targetCurvature, 1.4, dt);

    // Rolling highway elevation hills (hills, crests, and dips)
    this.elevation = Math.sin(this.travelDistance * 0.006) * 1.6;
  }

  /**
   * Lateral X offset for any world Z position ahead.
   * At z = 0 (player position), offset is exactly 0.
   */
  getCurveOffset(z) {
    if (z > 2) return 0;
    // Quadratic curvature offset into the distance
    const distZ = Math.min(0, z);
    return this.curvature * (distZ * distZ * 0.00014);
  }

  /**
   * Elevation Y offset for rolling hills.
   */
  getHillOffset(z) {
    if (z > 2) return 0;
    const distZ = Math.min(0, z);
    return this.elevation * Math.sin(-distZ * 0.022 + this.travelDistance * 0.012) * 1.2;
  }

  /**
   * Tangent yaw angle (in radians) along the curve.
   */
  getCurveYaw(z) {
    if (z > 2) return 0;
    const distZ = Math.min(0, z);
    return this.curvature * (2.0 * distZ * 0.00014);
  }

  /**
   * Bank angle (roll) for dynamic camera and chassis.
   */
  getBanking(z = 0) {
    return -this.curvature * 0.032;
  }
}

export const globalTrackCurve = new TrackCurve();

