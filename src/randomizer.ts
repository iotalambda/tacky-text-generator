import type { TextConfig, TextStyle, AnimationConfig, AnimationType, CameraConfig, LightConfig } from './types';

// Tacky WordArt color combinations [face, side] - side must be DIFFERENT from face
const COLOR_SCHEMES: [string, string][] = [
  ['#9966ff', '#8B0000'], // Purple / Maroon
  ['#00ff00', '#006400'], // Lime / Dark Green
  ['#FFD700', '#0000CD'], // Yellow / Blue
  ['#87CEEB', '#191970'], // Light Blue / Navy
  ['#0000CD', '#FFD700'], // Blue / Gold
  ['#FF0000', '#000000'], // Red / Black
  ['#FF6600', '#800080'], // Orange / Purple
  ['#FF69B4', '#4B0082'], // Pink / Indigo
  ['#C0C0C0', '#2F2F2F'], // Silver / Dark Gray
  ['#00FFFF', '#8B0000'], // Cyan / Maroon
  ['#FF00FF', '#006400'], // Magenta / Forest Green
  ['#32CD32', '#8B4513'], // Lime Green / Brown
  ['#FF4500', '#000080'], // OrangeRed / Navy
  ['#9400D3', '#FFD700'], // Violet / Gold
  ['#1E90FF', '#FF4500'], // Dodger Blue / OrangeRed
];

// Tacky WordArt-style fonts from Three.js examples
const FONT_URLS = [
  'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/helvetiker_bold.typeface.json',
  'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/optimer_bold.typeface.json',
  'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/gentilis_bold.typeface.json',
  'https://cdn.jsdelivr.net/npm/three@0.182.0/examples/fonts/droid/droid_serif_bold.typeface.json',
];

// Animation types - includes full spins and oscillations
const ANIMATION_TYPES: AnimationType[] = [
  'spinY',    // Full 360° rotation around Y axis
  'spinX',    // Full 360° rotation around X axis
  'spinZ',    // Full 360° rotation around Z axis
  'swingY',   // Oscillate around Y axis
  'swingX',   // Oscillate around X axis
  'swingZ',   // Oscillate around Z axis
  'bounce',   // Bounce up and down
  'pulse',    // Scale pulse
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomizeStyle(): TextStyle {
  const colors = randomChoice(COLOR_SCHEMES);

  return {
    fontUrl: randomChoice(FONT_URLS),
    faceColor: colors[0],
    sideColor: colors[1],
    depth: randomRange(0.25, 0.5),
    bevelEnabled: true,
    bevelThickness: randomRange(0.02, 0.05),
    bevelSize: randomRange(0.02, 0.04),
    metalness: randomRange(0.6, 0.9),
    roughness: randomRange(0.1, 0.3),
  };
}

function randomizeAnimation(): AnimationConfig {
  const type = randomChoice(ANIMATION_TYPES);

  // Cycle duration between 2 and 4 seconds
  const cycleDuration = randomRange(2.0, 4.0);

  // Amplitude depends on animation type
  let amplitude: number;
  switch (type) {
    case 'spinY':
    case 'spinX':
    case 'spinZ':
      amplitude = 1; // Not used for full spins, but kept for consistency
      break;
    case 'swingY':
    case 'swingX':
    case 'swingZ':
      amplitude = randomRange(0.5, 1.0); // ~29-57 degrees swing
      break;
    case 'bounce':
      amplitude = randomRange(0.3, 0.5);
      break;
    case 'pulse':
      amplitude = randomRange(0.15, 0.25);
      break;
    default:
      amplitude = 0.5;
  }

  return {
    type,
    amplitude,
    cycleDuration,
  };
}

function randomizeCamera(): CameraConfig {
  // Camera positioned further back with wider FOV to ensure text fits
  // Text is centered at origin, so we just need enough distance
  return {
    position: [0, 0, 8], // Further back to fit all text
    fov: 50, // Moderate FOV
  };
}

function randomizeLight(): LightConfig {
  const directions: [number, number, number][] = [
    [2, 2, 3],
    [-2, 2, 3],
    [0, 3, 2],
    [3, 1, 2],
    [-2, 1, 3],
  ];

  return {
    direction: randomChoice(directions),
    intensity: randomRange(1.5, 2.5),
    ambientIntensity: randomRange(0.4, 0.6),
  };
}

export function randomizeTextConfig(text: string): TextConfig {
  return {
    text,
    style: randomizeStyle(),
    animation: randomizeAnimation(),
    camera: randomizeCamera(),
    light: randomizeLight(),
  };
}
