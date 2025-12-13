import { GifWriter } from 'omggif';
import type { ScreenBounds } from './Scene';

// Fixed output fps for consistent GIF sizes
// Lower FPS = smaller file size. 12 FPS is common for retro-style GIFs
const TARGET_FPS = 12;

export interface GifCaptureOptions {
  width: number;
  height: number;
  fps: number; // Legacy - now uses TARGET_FPS constant
  quality: number; // 1-30, lower is better quality but larger file
  getAnimationT: () => number; // Function to get current animation progress (0-1)
  setAnimationT?: (t: number) => void; // Optional: set animation progress for frame-by-frame capture
  cycleDuration: number; // Animation cycle duration in seconds
  screenBounds?: ScreenBounds | null; // Optional screen bounds for cropping
  chromaKey: string; // Hex color to use as transparent background (e.g., '#000000')
}

// Parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// Build a global palette from all frames
function buildGlobalPalette(
  frames: ImageData[],
  chromaKeyRgb: { r: number; g: number; b: number },
  threshold: number
): number[][] {
  const colorCounts: Map<string, number> = new Map();

  // Count colors across all frames
  for (const frame of frames) {
    const data = frame.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip chromaKey pixels
      const dr = Math.abs(r - chromaKeyRgb.r);
      const dg = Math.abs(g - chromaKeyRgb.g);
      const db = Math.abs(b - chromaKeyRgb.b);
      if (dr < threshold && dg < threshold && db < threshold) {
        continue;
      }

      const key = `${r},${g},${b}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }
  }

  // Sort by frequency and take top 255 colors (leaving index 0 for transparent)
  const sortedColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 255)
    .map((entry) => entry[0].split(',').map(Number));

  // Index 0 is transparent color
  const palette: number[][] = [[chromaKeyRgb.r, chromaKeyRgb.g, chromaKeyRgb.b]];
  palette.push(...sortedColors);

  // Pad to 256 colors (2^8)
  while (palette.length < 256) {
    palette.push([0, 0, 0]);
  }

  return palette;
}

// Find closest color in palette using simple Euclidean distance
function findClosestColor(r: number, g: number, b: number, palette: number[][]): number {
  let bestIndex = 1; // Start at 1, skip transparent index
  let bestDist = Infinity;

  for (let i = 1; i < palette.length; i++) {
    const pr = palette[i][0];
    const pg = palette[i][1];
    const pb = palette[i][2];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex;
}

// Convert RGBA image data to indexed pixels using palette
function indexFrame(
  imageData: ImageData,
  palette: number[][],
  chromaKeyRgb: { r: number; g: number; b: number },
  threshold: number
): Uint8Array {
  const data = imageData.data;
  const indexed = new Uint8Array(imageData.width * imageData.height);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if pixel matches chromaKey (transparent)
    const dr = Math.abs(r - chromaKeyRgb.r);
    const dg = Math.abs(g - chromaKeyRgb.g);
    const db = Math.abs(b - chromaKeyRgb.b);

    if (dr < threshold && dg < threshold && db < threshold) {
      indexed[j] = 0; // Transparent index
    } else {
      indexed[j] = findClosestColor(r, g, b, palette);
    }
  }

  return indexed;
}

export async function captureGif(
  canvas: HTMLCanvasElement,
  options: GifCaptureOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const { width, height, setAnimationT, cycleDuration, screenBounds, chromaKey } = options;
  const chromaKeyRgb = hexToRgb(chromaKey);
  // Very strict threshold - only exact black (#000000) or nearly black pixels are transparent
  // This prevents dark dithered pixels from being treated as background
  const threshold = 5;

  // Calculate crop region from screen bounds (if provided)
  const srcX = screenBounds ? Math.floor(screenBounds.minX * canvas.width) : 0;
  const srcY = screenBounds ? Math.floor(screenBounds.minY * canvas.height) : 0;
  const srcW = screenBounds
    ? Math.ceil((screenBounds.maxX - screenBounds.minX) * canvas.width)
    : canvas.width;
  const srcH = screenBounds
    ? Math.ceil((screenBounds.maxY - screenBounds.minY) * canvas.height)
    : canvas.height;

  // Calculate output dimensions while maintaining aspect ratio
  const srcAspect = srcW / srcH;
  const targetAspect = width / height;

  let outputWidth: number;
  let outputHeight: number;

  if (srcAspect > targetAspect) {
    outputWidth = width;
    outputHeight = Math.round(width / srcAspect);
  } else {
    outputHeight = height;
    outputWidth = Math.round(height * srcAspect);
  }

  // Create a canvas for processing frames
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = outputWidth;
  scaledCanvas.height = outputHeight;
  const ctx = scaledCanvas.getContext('2d', { willReadFrequently: true })!;

  // Calculate target frame count and timing
  const targetFrameCount = Math.round(cycleDuration * TARGET_FPS);
  const frameDelay = Math.round(100 / TARGET_FPS); // GIF uses centiseconds (1/100th of second)

  // Frame-by-frame capture: we control the animation timing precisely
  // This works reliably in headless browsers where rAF timing may be inconsistent
  const frames: ImageData[] = [];

  for (let i = 0; i < targetFrameCount; i++) {
    const t = i / targetFrameCount; // 0 to just under 1

    // Set animation to exact position
    if (setAnimationT) {
      setAnimationT(t);
    }

    // Wait for a frame to render - this allows Three.js useFrame to run
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Capture this frame
    ctx.fillStyle = chromaKey;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);

    frames.push(ctx.getImageData(0, 0, outputWidth, outputHeight));

    onProgress?.((i + 1) / targetFrameCount * 0.5); // First 50% is capturing
  }

  onProgress?.(0.5);

  // Build global palette from all frames
  const palette = buildGlobalPalette(frames, chromaKeyRgb, threshold);

  onProgress?.(0.6);

  // Convert palette to packed RGB integers for omggif
  const packedPalette: number[] = palette.map(
    ([r, g, b]) => (r << 16) | (g << 8) | b
  );

  // Estimate buffer size (generous estimate)
  const bufferSize = outputWidth * outputHeight * frames.length * 2 + 10000;
  const buffer = new Uint8Array(bufferSize);

  // Create GIF writer with global palette
  const gif = new GifWriter(buffer, outputWidth, outputHeight, {
    palette: packedPalette,
    loop: 0, // Loop forever
  });

  // Add each frame
  for (let i = 0; i < frames.length; i++) {
    const indexed = indexFrame(frames[i], palette, chromaKeyRgb, threshold);
    gif.addFrame(0, 0, outputWidth, outputHeight, indexed, {
      delay: frameDelay,
      transparent: 0, // Index 0 is transparent
      disposal: 2, // Restore to background
    });

    onProgress?.(0.6 + (i / frames.length) * 0.4); // Last 40% is encoding
  }

  // Get the actual bytes written
  const gifData = buffer.slice(0, gif.end());

  // Create blob
  const blob = new Blob([gifData], { type: 'image/gif' });
  onProgress?.(1);

  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
