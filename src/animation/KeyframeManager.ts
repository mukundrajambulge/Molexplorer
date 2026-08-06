export type ViewState = number[];

export interface Keyframe {
  time: number; // in seconds
  view: ViewState;
}

export class KeyframeManager {
  private keyframes: Keyframe[] = [];

  addKeyframe(time: number, view: ViewState) {
    this.keyframes.push({ time, view });
    this.keyframes.sort((a, b) => a.time - b.time);
  }

  clearKeyframes() {
    this.keyframes = [];
  }

  getKeyframes() {
    return this.keyframes;
  }

  getDuration() {
    if (this.keyframes.length === 0) return 0;
    return this.keyframes[this.keyframes.length - 1].time;
  }

  // Linear interpolation for scalars
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // Spherical linear interpolation (Slerp) for quaternions
  private slerp(q1: number[], q2: number[], t: number): number[] {
    let [x1, y1, z1, w1] = q1;
    let [x2, y2, z2, w2] = q2;

    let dot = x1*x2 + y1*y2 + z1*z2 + w1*w2;

    if (dot < 0.0) {
      x2 = -x2; y2 = -y2; z2 = -z2; w2 = -w2;
      dot = -dot;
    }

    const DOT_THRESHOLD = 0.9995;
    if (dot > DOT_THRESHOLD) {
      // If the inputs are too close, linearly interpolate
      const x = x1 + t*(x2 - x1);
      const y = y1 + t*(y2 - y1);
      const z = z1 + t*(z2 - z1);
      const w = w1 + t*(w2 - w1);
      const invLen = 1.0 / Math.sqrt(x*x + y*y + z*z + w*w);
      return [x*invLen, y*invLen, z*invLen, w*invLen];
    }

    const theta_0 = Math.acos(dot);
    const theta = theta_0 * t;
    const sin_theta = Math.sin(theta);
    const sin_theta_0 = Math.sin(theta_0);

    const s0 = Math.cos(theta) - dot * sin_theta / sin_theta_0;
    const s1 = sin_theta / sin_theta_0;

    return [
      s0*x1 + s1*x2,
      s0*y1 + s1*y2,
      s0*z1 + s1*z2,
      s0*w1 + s1*w2
    ];
  }

  // Interpolates between keyframes to get the view at a specific time
  interpolate(time: number): ViewState | null {
    if (this.keyframes.length === 0) return null;
    if (this.keyframes.length === 1 || time <= this.keyframes[0].time) {
      return [...this.keyframes[0].view];
    }
    const lastKf = this.keyframes[this.keyframes.length - 1];
    if (time >= lastKf.time) {
      return [...lastKf.view];
    }

    // Find surrounding keyframes
    let k0 = this.keyframes[0];
    let k1 = this.keyframes[1];
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (time >= this.keyframes[i].time && time <= this.keyframes[i+1].time) {
        k0 = this.keyframes[i];
        k1 = this.keyframes[i+1];
        break;
      }
    }

    const t = (time - k0.time) / (k1.time - k0.time);
    const v0 = k0.view;
    const v1 = k1.view;

    // Assuming 3Dmol view array: [transX, transY, transZ, rotX, rotY, rotZ, rotW, zoom]
    if (v0.length >= 8 && v1.length >= 8) {
      const trans = [
        this.lerp(v0[0], v1[0], t),
        this.lerp(v0[1], v1[1], t),
        this.lerp(v0[2], v1[2], t)
      ];
      
      const q0 = [v0[3], v0[4], v0[5], v0[6]];
      const q1 = [v1[3], v1[4], v1[5], v1[6]];
      const rot = this.slerp(q0, q1, t);

      const zoom = this.lerp(v0[7], v1[7], t);

      return [...trans, ...rot, zoom];
    }

    // Fallback naive linear interpolation for everything
    return v0.map((val, idx) => this.lerp(val, v1[idx] || val, t));
  }
}
