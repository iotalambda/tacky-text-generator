import GIF from 'gif.js';

export interface GifCaptureOptions {
  width: number;
  height: number;
  fps: number;
  quality: number; // 1-30, lower is better quality but larger file
  getAnimationT: () => number; // Function to get current animation progress (0-1)
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
  const { width, height, fps, quality, getAnimationT } = options;

  const frameDelay = Math.round(1000 / fps);

  // Create a canvas for processing frames
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = width;
  scaledCanvas.height = height;
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
          width,
          height,
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

      // Capture this frame
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);

      // Apply chroma key to make black pixels transparent
      applyChromaKey(ctx, width, height, 25);

      // Store the frame data
      frames.push(ctx.getImageData(0, 0, width, height));

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
