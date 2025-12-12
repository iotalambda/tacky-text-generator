import type { TextConfig, TextStyle, AnimationConfig, AnimationType, CameraConfig, LightConfig, FaceMaterialType } from './types';

// Neon color combinations [face, side1 (neon), side2 (different neon), edge (neon)]
// chromaKey is always #000000 (black) - the dithering shader ensures text pixels never become pure black
const COLOR_SCHEMES: [string, string, string, string][] = [
  ['#FF00FF', '#00FF00', '#FFFF00', '#00FFFF'], // Magenta/Green/Yellow/Cyan
  ['#009700', '#FF00FF', '#009dff', '#FFFF00'], // Green/Magenta/Cyan/Yellow
  ['#FF6600', '#ff00a6', '#e5ff00', '#333333'], // Orange/Magenta/Yellow/Dark gray
  ['#0800ff', '#FF6600', '#FF00FF', '#00FF00'], // Blue/Orange/Magenta/Green
  ['#FF6600', '#00ffff', '#FF00FF', '#333333'], // Orange/Cyan/Magenta/Dark gray
  ['#FF0080', '#00FF80', '#FFFF00', '#00FFFF'], // Pink/Mint/Yellow/Cyan
  ['#22ff00', '#002aff', '#ff00aa', '#FFFF00'], // Mint/Blue/Pink/Yellow
  ['#FF3300', '#00FFFF', '#00FF00', '#FF00FF'], // Red/Cyan/Green/Magenta
  ['#6c005d', '#FF0080', '#00FFFF', '#00FF00'], // Purple/Pink/Cyan/Green
  ['#0800ff', '#FFFF00', '#FF00FF', '#00FF00'], // Blue/Yellow/Magenta/Green
  ['#FF00FF', '#FFFF00', '#00FFFF', '#00FF00'], // Magenta/Yellow/Cyan/Green
  ['#00ff00', '#FF3300', '#002aff', '#FF00FF'], // Green/Red/Blue/Magenta
  ['#FF0080', '#00FFFF', '#FFFF00', '#00FF00'], // Pink/Cyan/Yellow/Green
  ['#FF6600', '#00FF00', '#FFFF00', '#333333'], // Orange/Green/Yellow/Dark gray
  ['#0800ff', '#FF00FF', '#FFFF00', '#00FF00'], // Blue/Magenta/Yellow/Green
];

// Transparent background color for GIF export
const CHROMA_KEY = '#000000';

// Fonts with weights for weighted random selection
// Higher weight = more likely to be picked
const WEIGHTED_FONTS: { url: string; weight: number }[] = [
  { url: '/fonts/Oswald-Bold.json', weight: 93 },           // Arial Black alternative
  { url: '/fonts/Anton-Regular.json', weight: 89 },         // Impact alternative
  { url: '/fonts/ComicNeue-Bold.json', weight: 77 },        // Comic Sans alternative
  { url: '/fonts/AlfaSlabOne-Regular.json', weight: 64 },   // Cooper Black alternative
  { url: '/fonts/PlayfairDisplay-Bold.json', weight: 52 },  // Times New Roman Bold alternative
  { url: '/fonts/OpenSans-Bold.json', weight: 39 },         // Verdana Bold alternative
  { url: '/fonts/Lora-Bold.json', weight: 27 },             // Bookman alternative
];

function weightedRandomFont(): string {
  const totalWeight = WEIGHTED_FONTS.reduce((sum, f) => sum + f.weight, 0);
  let random = Math.random() * totalWeight;

  for (const font of WEIGHTED_FONTS) {
    random -= font.weight;
    if (random <= 0) {
      return font.url;
    }
  }

  return WEIGHTED_FONTS[0].url; // Fallback
}

// Initial angle weights - adjust these to tune the experience
// Each entry: { angle: [xDeg, yDeg], weight }
const INITIAL_ANGLE_WEIGHT_STRAIGHT = 100;  // Facing viewer directly
const INITIAL_ANGLE_WEIGHT_CARDINAL = 40;   // 20° up, down, left, right
const INITIAL_ANGLE_WEIGHT_DIAGONAL = 20;   // 30° to corners (bl, tl, br, tr)

const WEIGHTED_INITIAL_ANGLES: { angle: { x: number; y: number }; weight: number }[] = [
  // Straight at viewer
  { angle: { x: 0, y: 0 }, weight: INITIAL_ANGLE_WEIGHT_STRAIGHT },
  // Cardinal directions (20 degrees) - excluding down
  { angle: { x: -20 * Math.PI / 180, y: 0 }, weight: INITIAL_ANGLE_WEIGHT_CARDINAL },  // Up
  { angle: { x: 0, y: -20 * Math.PI / 180 }, weight: INITIAL_ANGLE_WEIGHT_CARDINAL },  // Left
  { angle: { x: 0, y: 20 * Math.PI / 180 }, weight: INITIAL_ANGLE_WEIGHT_CARDINAL },   // Right
  // Diagonal directions (30 degrees) - only top-left and top-right
  { angle: { x: -30 * Math.PI / 180, y: -30 * Math.PI / 180 }, weight: INITIAL_ANGLE_WEIGHT_DIAGONAL }, // Top-left
  { angle: { x: -30 * Math.PI / 180, y: 30 * Math.PI / 180 }, weight: INITIAL_ANGLE_WEIGHT_DIAGONAL },  // Top-right
];

function weightedRandomInitialAngle(): { x: number; y: number } {
  const totalWeight = WEIGHTED_INITIAL_ANGLES.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const entry of WEIGHTED_INITIAL_ANGLES) {
    random -= entry.weight;
    if (random <= 0) {
      return { ...entry.angle };
    }
  }

  return { x: 0, y: 0 }; // Fallback
}

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
  'wave',     // Wave animation - characters move in a wave pattern
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Face material types
const FACE_MATERIALS: FaceMaterialType[] = ['matte', 'metallic', 'glossy'];

function randomizeStyle(): TextStyle {
  const colors = randomChoice(COLOR_SCHEMES);

  return {
    fontUrl: weightedRandomFont(),
    faceColor: colors[0],
    faceMaterial: randomChoice(FACE_MATERIALS),
    sideColor1: colors[1],
    sideColor2: colors[2],
    edgeColor: colors[3],
    edgeColorEnabled: Math.random() < 0.5,
    chromaKey: CHROMA_KEY,
    depth: randomRange(0.25, 0.5),
    bevelEnabled: true,
    bevelThickness: randomRange(0.04, 0.08),
    bevelSize: randomRange(0.04, 0.07),
    metalness: randomRange(0.6, 0.9),
    roughness: randomRange(0.1, 0.3),
  };
}

function randomizeAnimation(): AnimationConfig {
  const type = randomChoice(ANIMATION_TYPES);

  // Cycle duration and amplitude depend on animation type
  // Spin animations look good with longer durations (2-4s)
  // Bounce/pulse/swing look better with shorter durations (1-2s)
  let cycleDuration: number;
  let amplitude: number;

  switch (type) {
    case 'spinY':
    case 'spinX':
    case 'spinZ':
      cycleDuration = randomRange(2.0, 4.0);
      amplitude = 1; // Not used for full spins, but kept for consistency
      break;
    case 'swingY':
    case 'swingX':
    case 'swingZ':
      cycleDuration = randomRange(1.0, 2.0);
      amplitude = randomRange(0.5, 1.0); // ~29-57 degrees swing
      break;
    case 'bounce':
      cycleDuration = randomRange(0.8, 1.5);
      amplitude = randomRange(0.3, 0.5);
      break;
    case 'pulse':
      cycleDuration = randomRange(0.8, 1.5);
      amplitude = randomRange(0.15, 0.25);
      break;
    case 'wave':
      cycleDuration = randomRange(1.5, 2.5);
      amplitude = randomRange(0.2, 0.4); // Wave height
      break;
    default:
      cycleDuration = randomRange(1.5, 3.0);
      amplitude = 0.5;
  }

  return {
    type,
    amplitude,
    cycleDuration,
    initialAngle: weightedRandomInitialAngle(),
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
    intensity: randomRange(0.1, 0.3),
    ambientIntensity: randomRange(0.1, 0.3),
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
