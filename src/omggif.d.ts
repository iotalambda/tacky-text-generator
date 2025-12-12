declare module 'omggif' {
  interface GifWriterOptions {
    palette?: number[];
    loop?: number | null;
    background?: number;
  }

  interface AddFrameOptions {
    palette?: number[];
    delay?: number;
    disposal?: number;
    transparent?: number;
  }

  export class GifWriter {
    constructor(buf: Uint8Array, width: number, height: number, gopts?: GifWriterOptions);
    addFrame(
      x: number,
      y: number,
      w: number,
      h: number,
      indexed_pixels: Uint8Array,
      opts?: AddFrameOptions
    ): void;
    end(): number;
  }

  export class GifReader {
    constructor(buf: Uint8Array);
    width: number;
    height: number;
    numFrames(): number;
    frameInfo(frame_num: number): {
      x: number;
      y: number;
      width: number;
      height: number;
      has_local_palette: boolean;
      palette_offset: number;
      palette_size: number;
      data_offset: number;
      data_length: number;
      transparent_index: number;
      interlaced: boolean;
      delay: number;
      disposal: number;
    };
    decodeAndBlitFrameRGBA(frame_num: number, pixels: Uint8Array): void;
  }
}
