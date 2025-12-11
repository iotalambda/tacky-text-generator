import * as THREE from 'three';

/**
 * Custom shader material that colors the bevel edge differently from the side,
 * and blends between two side colors based on viewing angle.
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
  edgeColorEnabled: boolean
): THREE.ShaderMaterial {
  const sideColor1Vec = new THREE.Color(sideColor1);
  const sideColor2Vec = new THREE.Color(sideColor2);
  const edgeColorVec = new THREE.Color(edgeColor);

  // Force extremely metallic settings for sides/edges
  const metalness = 0.95;
  const roughness = 0.05;

  return new THREE.ShaderMaterial({
    uniforms: {
      sideColor1: { value: sideColor1Vec },
      sideColor2: { value: sideColor2Vec },
      edgeColor: { value: edgeColorVec },
      edgeColorEnabled: { value: edgeColorEnabled ? 1.0 : 0.0 },
      metalness: { value: metalness },
      roughness: { value: roughness },
      // Ambient lighting only - no directional light
      ambientLightColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vLocalNormal;
      varying vec3 vViewPosition;

      void main() {
        // World-space normal for lighting
        vNormal = normalize(normalMatrix * normal);
        // Local/object-space normal for bevel detection
        vLocalNormal = normal;

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
      uniform vec3 ambientLightColor;

      varying vec3 vNormal;
      varying vec3 vLocalNormal;
      varying vec3 vViewPosition;

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

        // Blend between side colors based on view-space normal
        // This creates a gradient effect as the object rotates
        // Use the dot product with view direction to determine blend
        vec3 viewDir = normalize(vViewPosition);
        float sideBlend = dot(normal, vec3(1.0, 0.0, 0.0)) * 0.5 + 0.5; // Map -1..1 to 0..1
        vec3 blendedSideColor = mix(sideColor1, sideColor2, sideBlend);

        // Mix between blended side color and edge color based on edge factor (if enabled)
        float actualEdgeFactor = edgeFactor * edgeColorEnabled;
        vec3 baseColor = mix(blendedSideColor, edgeColor, actualEdgeFactor);

        // Simple ambient-only lighting - evenly lit from all directions
        vec3 finalColor = ambientLightColor * baseColor;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}
