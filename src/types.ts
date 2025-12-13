export type AnimationType =
  | 'spinY'        // Full 360° rotation around Y axis
  | 'spinX'        // Full 360° rotation around X axis
  | 'swingY'       // Oscillate around Y axis (pendulum)
  | 'swingX'       // Oscillate around X axis (nod)
  | 'swingZ'       // Oscillate around Z axis (tilt)
  | 'bounce'       // Bounce up and down
  | 'pulse'        // Scale pulse
  | 'wave';        // Wave animation - characters move in a wave pattern

export type FaceMaterialType =
  | 'matte'        // Flat, non-reflective surface
  | 'metallic'     // Highly reflective metal look
  | 'glossy';      // Shiny plastic look

export type SideGradientType =
  | 'vertical'     // Top to bottom gradient (original)
  | 'horizontal'   // Left to right gradient
  | 'diagonal'     // Diagonal gradient (top-left to bottom-right)
  | 'radial'       // Radial gradient from center
  | 'split'        // Hard split between two colors
  | 'tricolor'     // Three color bands
  | 'rainbow';     // Animated rainbow cycling

export interface TextStyle {
  fontUrl: string;
  faceColor: string;
  faceMaterial: FaceMaterialType; // Material type for the face
  sideColor1: string; // First side color (blends with sideColor2)
  sideColor2: string; // Second side color (blends with sideColor1)
  sideGradient: SideGradientType; // Type of gradient pattern on sides
  edgeColor: string; // Color for the bevel edge between face and side
  edgeColorEnabled: boolean; // Whether edge coloring is used
  chromaKey: string; // Background color used for GIF transparency (should be distinct from text colors)
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
  initialAngle: { x: number; y: number }; // Initial rotation offset in radians (applied to spin/pulse only)
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
