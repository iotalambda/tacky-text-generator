export type AnimationType =
  | 'spinY'        // Full 360° rotation around Y axis
  | 'spinX'        // Full 360° rotation around X axis
  | 'spinZ'        // Full 360° rotation around Z axis
  | 'swingY'       // Oscillate around Y axis (pendulum)
  | 'swingX'       // Oscillate around X axis (nod)
  | 'swingZ'       // Oscillate around Z axis (tilt)
  | 'bounce'       // Bounce up and down
  | 'pulse';       // Scale pulse

export interface TextStyle {
  fontUrl: string;
  faceColor: string;
  sideColor: string;
  depth: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  metalness: number;
  roughness: number;
}

export interface AnimationConfig {
  type: AnimationType;
  amplitude: number; // Max rotation in radians for swing, or scale factor for pulse
  cycleDuration: number; // Duration of one complete cycle in seconds
}

export interface CameraConfig {
  position: [number, number, number];
  fov: number;
}

export interface LightConfig {
  direction: [number, number, number];
  intensity: number;
  ambientIntensity: number;
}

export interface TextConfig {
  text: string;
  style: TextStyle;
  animation: AnimationConfig;
  camera: CameraConfig;
  light: LightConfig;
}
