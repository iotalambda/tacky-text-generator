import * as THREE from 'three';
import type { SideGradientType } from './types';

/**
 * Custom shader material that colors the bevel edge differently from the side,
 * and blends between two side colors based on gradient type.
 *
 * Detection method: In object/local space, the text is extruded along the Z axis.
 * - Face normals point along Z (normal.z = ±1)
 * - Pure side normals are perpendicular to Z (normal.z = 0)
 * - Bevel normals are angled, so they have a Z component between 0 and ±1
 *
 * By checking the LOCAL normal's Z component, we can reliably detect bevels
 * regardless of viewing angle.
 */
export function createBevelEdgeMaterial(
  sideColor1: string,
  sideColor2: string,
  edgeColor: string,
  edgeColorEnabled: boolean,
  gradientType: SideGradientType = 'vertical',
  time: number = 0
): THREE.ShaderMaterial {
  const sideColor1Vec = new THREE.Color(sideColor1);
  const sideColor2Vec = new THREE.Color(sideColor2);
  const edgeColorVec = new THREE.Color(edgeColor);

  // Force extremely metallic settings for sides/edges
  const metalness = 0.95;
  const roughness = 0.05;

  // Map gradient type to shader integer
  const gradientTypeMap: Record<SideGradientType, number> = {
    'vertical': 0,
    'horizontal': 1,
    'diagonal': 2,
    'radial': 3,
    'split': 4,
    'tricolor': 5,
    'rainbow': 6,
  };

  return new THREE.ShaderMaterial({
    uniforms: {
      sideColor1: { value: sideColor1Vec },
      sideColor2: { value: sideColor2Vec },
      edgeColor: { value: edgeColorVec },
      edgeColorEnabled: { value: edgeColorEnabled ? 1.0 : 0.0 },
      metalness: { value: metalness },
      roughness: { value: roughness },
      gradientType: { value: gradientTypeMap[gradientType] },
      time: { value: time },
      // Ambient lighting only - no directional light
      ambientLightColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vLocalNormal;
      varying vec3 vViewPosition;
      varying vec3 vLocalPosition;
      varying vec2 vUv;

      void main() {
        // World-space normal for lighting
        vNormal = normalize(normalMatrix * normal);
        // Local/object-space normal for bevel detection
        vLocalNormal = normal;
        // Local position for gradient calculations
        vLocalPosition = position;
        // UV coordinates (if available)
        vUv = uv;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sideColor1;
      uniform vec3 sideColor2;
      uniform vec3 edgeColor;
      uniform float edgeColorEnabled;
      uniform float metalness;
      uniform float roughness;
      uniform int gradientType;
      uniform float time;
      uniform vec3 ambientLightColor;

      varying vec3 vNormal;
      varying vec3 vLocalNormal;
      varying vec3 vViewPosition;
      varying vec3 vLocalPosition;
      varying vec2 vUv;

      // HSV to RGB conversion for rainbow effect
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 localNormal = normalize(vLocalNormal);

        // In local space, text is extruded along Z axis:
        // - Face normals: z = ±1 (pointing forward/backward)
        // - Side normals: z = 0 (pointing outward from letter shape)
        // - Bevel normals: z is between 0 and ±1 (angled transition)
        //
        // The bevel connects the face to the side, so its normals have
        // a significant but not full Z component. We detect this range.

        float absLocalZ = abs(localNormal.z);

        // Bevel normals typically have |z| between 0.3 and 0.9
        // Pure sides have |z| < 0.1, faces have |z| > 0.95
        // We want to color the bevel (transition zone) with edge color
        float edgeFactor = smoothstep(0.15, 0.4, absLocalZ) * (1.0 - smoothstep(0.85, 0.95, absLocalZ));

        // Calculate gradient blend factor based on gradient type
        float sideBlend = 0.5;
        vec3 blendedSideColor;

        // Use view direction for some effects
        vec3 viewDir = normalize(vViewPosition);

        if (gradientType == 0) {
          // Vertical: blend based on Y position (top to bottom)
          sideBlend = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
          blendedSideColor = mix(sideColor1, sideColor2, sideBlend);
        }
        else if (gradientType == 1) {
          // Horizontal: blend based on X position (left to right)
          sideBlend = dot(normal, vec3(1.0, 0.0, 0.0)) * 0.5 + 0.5;
          blendedSideColor = mix(sideColor1, sideColor2, sideBlend);
        }
        else if (gradientType == 2) {
          // Diagonal: blend based on combined X+Y
          float diag = (dot(normal, vec3(1.0, 0.0, 0.0)) + dot(normal, vec3(0.0, 1.0, 0.0))) * 0.5;
          sideBlend = diag * 0.5 + 0.5;
          blendedSideColor = mix(sideColor1, sideColor2, sideBlend);
        }
        else if (gradientType == 3) {
          // Radial: blend based on distance from center (using normal angle)
          float radial = length(normal.xy);
          sideBlend = radial;
          blendedSideColor = mix(sideColor1, sideColor2, sideBlend);
        }
        else if (gradientType == 4) {
          // Split: hard boundary between two colors
          float splitVal = dot(normal, vec3(0.0, 1.0, 0.0));
          sideBlend = step(0.0, splitVal);
          blendedSideColor = mix(sideColor1, sideColor2, sideBlend);
        }
        else if (gradientType == 5) {
          // Tricolor: three bands of color
          float band = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
          if (band < 0.33) {
            blendedSideColor = sideColor1;
          } else if (band < 0.66) {
            blendedSideColor = edgeColor; // Use edge color as third color
          } else {
            blendedSideColor = sideColor2;
          }
        }
        else if (gradientType == 6) {
          // Rainbow: animated hue cycling based on position and time
          float hue = fract(dot(normal, vec3(1.0, 1.0, 0.0)) * 0.5 + time * 0.5);
          blendedSideColor = hsv2rgb(vec3(hue, 0.9, 1.0));
        }
        else {
          // Default fallback (same as vertical)
          sideBlend = dot(normal, vec3(1.0, 0.0, 0.0)) * 0.5 + 0.5;
          blendedSideColor = mix(sideColor1, sideColor2, sideBlend);
        }

        // Mix between blended side color and edge color based on edge factor (if enabled)
        // For tricolor mode, don't override with edge color (it's already used)
        float actualEdgeFactor = edgeFactor * edgeColorEnabled;
        if (gradientType == 5) {
          actualEdgeFactor = 0.0; // Tricolor uses edge color differently
        }
        vec3 baseColor = mix(blendedSideColor, edgeColor, actualEdgeFactor);

        // Simple ambient-only lighting - evenly lit from all directions
        vec3 finalColor = ambientLightColor * baseColor;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

/**
 * Updates the time uniform for animated gradients (rainbow)
 */
export function updateBevelMaterialTime(material: THREE.ShaderMaterial, time: number): void {
  if (material.uniforms.time) {
    material.uniforms.time.value = time;
  }
}
