import type { TextConfig, TextStyle, AnimationConfig, AnimationType, CameraConfig, LightConfig, FaceMaterialType, SideGradientType } from './types';

// Neon color combinations [face, side1 (neon), side2 (different neon), edge (neon)]
// chromaKey is always #000000 (black) - the dithering shader ensures text pixels never become pure black
const COLOR_SCHEMES: [string, string, string, string][] = [
  // Original schemes
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

  // Vaporwave / Synthwave
  ['#FF6EC7', '#00FFFF', '#FF00FF', '#FFFF00'], // Hot pink/Cyan/Magenta/Yellow
  ['#7B68EE', '#FF1493', '#00CED1', '#FFD700'], // Slate blue/Deep pink/Dark cyan/Gold
  ['#DA70D6', '#40E0D0', '#FF69B4', '#98FB98'], // Orchid/Turquoise/Hot pink/Pale green
  ['#9370DB', '#00FA9A', '#FF6347', '#87CEEB'], // Medium purple/Spring green/Tomato/Sky blue

  // Cyberpunk
  ['#FF073A', '#39FF14', '#00FFFF', '#FFFF00'], // Neon red/Neon green/Cyan/Yellow
  ['#FE019A', '#04D9FF', '#CCFF00', '#FF6600'], // Hot magenta/Electric blue/Lime/Orange
  ['#BC13FE', '#0FF0FC', '#DFFF00', '#FF2281'], // Purple/Cyan/Chartreuse/Pink
  ['#FF10F0', '#00FF7F', '#FFD300', '#00BFFF'], // Fuchsia/Spring green/Gold/Deep sky blue

  // Retro arcade
  ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'], // Classic RGB + Yellow
  ['#FF4500', '#32CD32', '#1E90FF', '#FFD700'], // Orange red/Lime green/Dodger blue/Gold
  ['#DC143C', '#00FF7F', '#4169E1', '#FFA500'], // Crimson/Spring green/Royal blue/Orange
  ['#FF1493', '#7FFF00', '#00CED1', '#FF8C00'], // Deep pink/Chartreuse/Dark cyan/Dark orange

  // Electric / High voltage
  ['#FFFF00', '#00FFFF', '#FF00FF', '#00FF00'], // Yellow/Cyan/Magenta/Green
  ['#FFD700', '#00BFFF', '#FF1493', '#32CD32'], // Gold/Deep sky blue/Deep pink/Lime green
  ['#FFA500', '#00FFFF', '#FF00FF', '#ADFF2F'], // Orange/Cyan/Magenta/Green yellow
  ['#FFFF33', '#33FFFF', '#FF33FF', '#33FF33'], // Bright yellow/Bright cyan/Bright magenta/Bright green

  // Tropical / Miami
  ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'], // Coral/Teal/Yellow/Mint
  ['#F38181', '#00FFAB', '#FDFFAB', '#A8D8EA'], // Salmon/Mint/Pale yellow/Light blue
  ['#FF9A8B', '#00D9FF', '#FFFA65', '#88D8B0'], // Peach/Sky blue/Lemon/Seafoam
  ['#FC5C65', '#26DE81', '#FED330', '#45AAF2'], // Red/Green/Yellow/Blue (bright)

  // Candy / Pastel neon
  ['#FF69B4', '#87CEEB', '#98FB98', '#DDA0DD'], // Hot pink/Sky blue/Pale green/Plum
  ['#FFB6C1', '#00CED1', '#F0E68C', '#DDA0DD'], // Light pink/Dark cyan/Khaki/Plum
  ['#FF85A2', '#85E3FF', '#FFFFA2', '#A2FFD8'], // Pink/Light blue/Light yellow/Mint
  ['#FFC0CB', '#00FFFF', '#FFFF99', '#CC99FF'], // Pink/Cyan/Light yellow/Light purple

  // Fire & Ice
  ['#FF4500', '#00BFFF', '#FFD700', '#4169E1'], // Orange red/Deep sky blue/Gold/Royal blue
  ['#FF6347', '#00CED1', '#FFA07A', '#20B2AA'], // Tomato/Dark cyan/Light salmon/Light sea green
  ['#FF0000', '#00FFFF', '#FF8C00', '#00BFFF'], // Red/Cyan/Dark orange/Deep sky blue
  ['#DC143C', '#1E90FF', '#FF7F50', '#00CED1'], // Crimson/Dodger blue/Coral/Dark cyan

  // Galaxy / Space
  ['#9400D3', '#00FFFF', '#FFD700', '#FF1493'], // Dark violet/Cyan/Gold/Deep pink
  ['#8A2BE2', '#00FA9A', '#FF6347', '#00BFFF'], // Blue violet/Spring green/Tomato/Deep sky blue
  ['#4B0082', '#00FF7F', '#FFD700', '#FF00FF'], // Indigo/Spring green/Gold/Magenta
  ['#6A0DAD', '#00FFFF', '#FFFF00', '#FF69B4'], // Purple/Cyan/Yellow/Hot pink

  // Neon signs
  ['#FF355E', '#00FF00', '#FFFF66', '#FF6EFF'], // Radical red/Green/Laser lemon/Pink
  ['#FF5F1F', '#00FF7F', '#FFFF00', '#FF00FF'], // Orange/Spring green/Yellow/Magenta
  ['#FF2400', '#39FF14', '#FFFF33', '#FF10F0'], // Scarlet/Neon green/Yellow/Fuchsia
  ['#FF3855', '#66FF66', '#FFFF66', '#FF6FFF'], // Sizzling red/Screamin green/Laser lemon/Pink

  // Metallic neon
  ['#C0C0C0', '#00FFFF', '#FFD700', '#FF00FF'], // Silver/Cyan/Gold/Magenta
  ['#B8860B', '#00FF7F', '#FF69B4', '#00BFFF'], // Dark goldenrod/Spring green/Hot pink/Deep sky blue
  ['#CD853F', '#00FFFF', '#FF1493', '#7FFF00'], // Peru/Cyan/Deep pink/Chartreuse
  ['#DAA520', '#00FA9A', '#FF6347', '#1E90FF'], // Goldenrod/Spring green/Tomato/Dodger blue

  // High contrast
  ['#FFFFFF', '#FF00FF', '#00FFFF', '#FFFF00'], // White/Magenta/Cyan/Yellow
  ['#FFFFFF', '#FF0000', '#00FF00', '#0000FF'], // White/Red/Green/Blue
  ['#F0F0F0', '#FF1493', '#00FF7F', '#FFD700'], // Light gray/Deep pink/Spring green/Gold
  ['#E0E0E0', '#FF4500', '#00CED1', '#9400D3'], // Gray/Orange red/Dark cyan/Dark violet
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

// Side gradient types with weights
// Rainbow is rarer since it's the most dramatic
const WEIGHTED_GRADIENTS: { type: SideGradientType; weight: number }[] = [
  { type: 'vertical', weight: 30 },
  { type: 'horizontal', weight: 30 },
  { type: 'diagonal', weight: 25 },
  { type: 'radial', weight: 20 },
  { type: 'split', weight: 20 },
  { type: 'tricolor', weight: 15 },
  { type: 'rainbow', weight: 10 },
];

function weightedRandomGradient(): SideGradientType {
  const totalWeight = WEIGHTED_GRADIENTS.reduce((sum, g) => sum + g.weight, 0);
  let random = Math.random() * totalWeight;

  for (const entry of WEIGHTED_GRADIENTS) {
    random -= entry.weight;
    if (random <= 0) {
      return entry.type;
    }
  }

  return 'vertical'; // Fallback
}

function randomizeStyle(): TextStyle {
  const colors = randomChoice(COLOR_SCHEMES);

  return {
    fontUrl: weightedRandomFont(),
    faceColor: colors[0],
    faceMaterial: randomChoice(FACE_MATERIALS),
    sideColor1: colors[1],
    sideColor2: colors[2],
    sideGradient: weightedRandomGradient(),
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

  // Swing animations look bad from non-zero initial angles, so force them to 0
  // Exception: swingZ can look good with a slight upward tilt (-20°, 0°)
  let initialAngle: { x: number; y: number };
  if (type === 'swingX' || type === 'swingY') {
    initialAngle = { x: 0, y: 0 };
  } else if (type === 'swingZ') {
    initialAngle = { x: -20 * Math.PI / 180, y: 0 };
  } else {
    initialAngle = weightedRandomInitialAngle();
  }

  return {
    type,
    amplitude,
    cycleDuration,
    initialAngle,
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
