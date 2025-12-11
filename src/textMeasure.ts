// Cache for measured character widths per font
const charWidthCache = new Map<string, Map<string, number>>();

// Measure text width using canvas 2D context
export function measureTextWidth(text: string, fontFamily: string, fontSize: number): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSize * 0.5; // Fallback estimate

  ctx.font = `${fontSize}px "${fontFamily}"`;
  return ctx.measureText(text).width;
}

// Get width of a single character, with caching
export function getCharWidth(char: string, fontFamily: string, fontSize: number): number {
  const cacheKey = `${fontFamily}-${fontSize}`;

  if (!charWidthCache.has(cacheKey)) {
    charWidthCache.set(cacheKey, new Map());
  }

  const fontCache = charWidthCache.get(cacheKey)!;

  if (fontCache.has(char)) {
    return fontCache.get(char)!;
  }

  const width = measureTextWidth(char, fontFamily, fontSize);
  fontCache.set(char, width);
  return width;
}

// Map from font JSON URLs to approximate CSS font family names
// These are the Google Fonts we're using
const fontUrlToFamily: Record<string, string> = {
  '/fonts/Oswald-Bold.json': 'Oswald',
  '/fonts/Anton-Regular.json': 'Anton',
  '/fonts/ComicNeue-Bold.json': 'Comic Neue',
  '/fonts/AlfaSlabOne-Regular.json': 'Alfa Slab One',
  '/fonts/PlayfairDisplay-Bold.json': 'Playfair Display',
  '/fonts/OpenSans-Bold.json': 'Open Sans',
  '/fonts/Lora-Bold.json': 'Lora',
};

// Get font family name from font URL, with fallback
export function getFontFamilyFromUrl(fontUrl: string): string {
  return fontUrlToFamily[fontUrl] || 'Arial';
}

// Calculate positions for all characters in a line
export function calculateCharPositions(
  line: string,
  fontUrl: string,
  charSize: number,
  charSpacing: number
): number[] {
  const fontFamily = getFontFamilyFromUrl(fontUrl);
  // Use a reference size for measurement, then scale
  const measureSize = 100;
  const scale = charSize / measureSize;

  // Scaling factor to compensate for 3D text geometry being wider than canvas 2D measurement
  // 3D text has bevels and different font rendering that makes it wider
  const widthCompensationFactor = 1.01;
  const widthCompensationTerm = 0.12;

  const positions: number[] = [];
  let currentX = 0;

  for (let i = 0; i < line.length; i++) {
    positions.push(currentX);
    const charWidth = getCharWidth(line[i], fontFamily, measureSize) * scale * widthCompensationFactor + widthCompensationTerm;
    currentX += charWidth + charSpacing;
  }

  // Calculate total width to center the line
  const totalWidth = currentX - charSpacing; // Remove last spacing

  // Offset all positions to center
  return positions.map(x => x - totalWidth / 2);
}

// Clear cache (useful if fonts change)
export function clearCharWidthCache(): void {
  charWidthCache.clear();
}
