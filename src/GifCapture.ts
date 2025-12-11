import GIF from 'gif.js';
import type { ScreenBounds } from './Scene';

export interface GifCaptureOptions {
  width: number;
  height: number;
  fps: number;
  quality: number; // 1-30, lower is better quality but larger file
  getAnimationT: () => number; // Function to get current animation progress (0-1)
  screenBounds?: ScreenBounds | null; // Optional screen bounds for cropping
}

// Apply chroma key: convert black pixels to transparent
function applyChromaKey(ctx: CanvasRenderingContext2D, width: number, height: number, threshold: number = 30) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // If pixel is close to black, make it transparent
    if (r < threshold && g < threshold && b < threshold) {
      data[i + 3] = 0; // Set alpha to 0
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export async function captureGif(
  canvas: HTMLCanvasElement,
  options: GifCaptureOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const { width, height, fps, quality, getAnimationT, screenBounds } = options;

  const frameDelay = Math.round(1000 / fps);

  // Calculate crop region from screen bounds (if provided)
  // screenBounds are in normalized 0-1 coordinates
  const srcX = screenBounds ? Math.floor(screenBounds.minX * canvas.width) : 0;
  const srcY = screenBounds ? Math.floor(screenBounds.minY * canvas.height) : 0;
  const srcW = screenBounds
    ? Math.ceil((screenBounds.maxX - screenBounds.minX) * canvas.width)
    : canvas.width;
  const srcH = screenBounds
    ? Math.ceil((screenBounds.maxY - screenBounds.minY) * canvas.height)
    : canvas.height;

  // Calculate output dimensions while maintaining aspect ratio
  // Scale to fit within the requested width/height
  const srcAspect = srcW / srcH;
  const targetAspect = width / height;

  let outputWidth: number;
  let outputHeight: number;

  if (srcAspect > targetAspect) {
    // Source is wider, fit to width
    outputWidth = width;
    outputHeight = Math.round(width / srcAspect);
  } else {
    // Source is taller, fit to height
    outputHeight = height;
    outputWidth = Math.round(height * srcAspect);
  }

  // Create a canvas for processing frames
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = outputWidth;
  scaledCanvas.height = outputHeight;
  const ctx = scaledCanvas.getContext('2d', { willReadFrequently: true })!;

  // Store frames until cycle completes
  const frames: ImageData[] = [];

  return new Promise((resolve) => {
    // Track animation progress to detect cycle completion
    let previousT = getAnimationT();
    let cycleCompleted = false;

    const captureFrame = () => {
      const currentT = getAnimationT();

      // Detect cycle completion: t wrapped around (became smaller than previous)
      // This means the animation started a new cycle
      if (currentT < previousT && frames.length > 0) {
        cycleCompleted = true;
      }

      previousT = currentT;

      if (cycleCompleted) {
        // Cycle complete - now render the GIF with collected frames
        const gif = new GIF({
          workers: 2,
          quality,
          width: outputWidth,
          height: outputHeight,
          workerScript: '/gif.worker.js',
          transparent: 0x000000,
        });

        gif.on('finished', (blob: Blob) => {
          resolve(blob);
        });

        gif.on('progress', (p: number) => {
          onProgress?.(p);
        });

        // Add all captured frames to the GIF
        for (const frameData of frames) {
          ctx.putImageData(frameData, 0, 0);
          gif.addFrame(scaledCanvas, { delay: frameDelay, copy: true, transparent: 0x000000 });
        }

        gif.render();
        return;
      }

      // Capture this frame (with cropping if bounds provided)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      ctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);

      // Apply chroma key to make black pixels transparent
      applyChromaKey(ctx, outputWidth, outputHeight, 25);

      // Store the frame data
      frames.push(ctx.getImageData(0, 0, outputWidth, outputHeight));

      // Continue capturing
      requestAnimationFrame(captureFrame);
    };

    captureFrame();
  });
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
