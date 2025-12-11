import { useMemo } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Extend three-fiber to recognize these classes
extend({ EffectComposer, RenderPass, ShaderPass });

// Ordered dithering shader using Bayer matrix pattern
const DitherShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    colorLevels: { value: 8.0 }, // Number of color levels per channel
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float colorLevels;

    varying vec2 vUv;

    // 8x8 Bayer matrix for ordered dithering
    float bayer8x8(vec2 pos) {
      int x = int(mod(pos.x, 8.0));
      int y = int(mod(pos.y, 8.0));

      // Bayer 8x8 matrix values (0-63, normalized to 0-1)
      int bayer[64];
      bayer[0] = 0;  bayer[1] = 32; bayer[2] = 8;  bayer[3] = 40; bayer[4] = 2;  bayer[5] = 34; bayer[6] = 10; bayer[7] = 42;
      bayer[8] = 48; bayer[9] = 16; bayer[10] = 56; bayer[11] = 24; bayer[12] = 50; bayer[13] = 18; bayer[14] = 58; bayer[15] = 26;
      bayer[16] = 12; bayer[17] = 44; bayer[18] = 4;  bayer[19] = 36; bayer[20] = 14; bayer[21] = 46; bayer[22] = 6;  bayer[23] = 38;
      bayer[24] = 60; bayer[25] = 28; bayer[26] = 52; bayer[27] = 20; bayer[28] = 62; bayer[29] = 30; bayer[30] = 54; bayer[31] = 22;
      bayer[32] = 3;  bayer[33] = 35; bayer[34] = 11; bayer[35] = 43; bayer[36] = 1;  bayer[37] = 33; bayer[38] = 9;  bayer[39] = 41;
      bayer[40] = 51; bayer[41] = 19; bayer[42] = 59; bayer[43] = 27; bayer[44] = 49; bayer[45] = 17; bayer[46] = 57; bayer[47] = 25;
      bayer[48] = 15; bayer[49] = 47; bayer[50] = 7;  bayer[51] = 39; bayer[52] = 13; bayer[53] = 45; bayer[54] = 5;  bayer[55] = 37;
      bayer[56] = 63; bayer[57] = 31; bayer[58] = 55; bayer[59] = 23; bayer[60] = 61; bayer[61] = 29; bayer[62] = 53; bayer[63] = 21;

      int index = y * 8 + x;
      return float(bayer[index]) / 64.0;
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Skip dithering for fully transparent pixels (black background)
      if (color.r < 0.05 && color.g < 0.05 && color.b < 0.05) {
        gl_FragColor = color;
        return;
      }

      // Get pixel position for dithering pattern
      vec2 pixelPos = vUv * resolution;

      // Get dither threshold
      float threshold = bayer8x8(pixelPos) - 0.5;

      // Calculate step size for color quantization
      float step = 1.0 / colorLevels;

      // Apply dithering: add threshold before quantizing
      vec3 dithered = color.rgb + threshold * step;

      // Quantize to limited color palette
      vec3 quantized = floor(dithered * colorLevels + 0.5) / colorLevels;

      // Clamp to valid range
      quantized = clamp(quantized, 0.0, 1.0);

      gl_FragColor = vec4(quantized, color.a);
    }
  `,
};

export function DitherEffect() {
  const { gl, scene, camera, size } = useThree();

  // Create the effect composer with dither pass
  // Re-created when size changes, which handles resolution updates
  const composer = useMemo(() => {
    const comp = new EffectComposer(gl);
    comp.addPass(new RenderPass(scene, camera));

    const ditherPass = new ShaderPass(DitherShader);
    ditherPass.uniforms.resolution.value.set(size.width, size.height);
    ditherPass.uniforms.colorLevels.value = 4.0; // Lower = rougher quantization (more visible dithering)
    comp.addPass(ditherPass);

    comp.setSize(size.width, size.height);
    return comp;
  }, [gl, scene, camera, size.width, size.height]);

  // Render with post-processing
  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}
