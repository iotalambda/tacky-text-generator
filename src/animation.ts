import * as THREE from 'three';
import type { TextConfig } from './types';

// Apply animation transform to a group based on normalized time t (0-1)
export function applyAnimationTransform(
  group: THREE.Group,
  config: TextConfig,
  t: number
): void {
  // Reset transforms
  group.rotation.set(0, 0, 0);
  group.position.set(0, 0, 0);
  group.scale.setScalar(1);

  const amp = config.animation.amplitude;
  const TWO_PI = Math.PI * 2;

  switch (config.animation.type) {
    case 'spinY':
      // Full 360° rotation around Y axis
      group.rotation.y = t * TWO_PI;
      break;

    case 'spinX':
      // Full 360° rotation around X axis
      group.rotation.x = t * TWO_PI;
      break;

    case 'spinZ':
      // Full 360° rotation around Z axis
      group.rotation.z = t * TWO_PI;
      break;

    case 'swingY':
      // Oscillate around Y axis (uses sin for smooth back-and-forth)
      group.rotation.y = Math.sin(t * TWO_PI) * amp;
      break;

    case 'swingX':
      // Oscillate around X axis
      group.rotation.x = Math.sin(t * TWO_PI) * amp;
      break;

    case 'swingZ':
      // Oscillate around Z axis
      group.rotation.z = Math.sin(t * TWO_PI) * amp;
      break;

    case 'bounce':
      // Bounce up and down (abs of sin for bounce effect)
      group.position.y = Math.abs(Math.sin(t * TWO_PI)) * amp;
      break;

    case 'pulse': {
      // Scale pulse
      const scale = 1 + Math.sin(t * TWO_PI) * amp;
      group.scale.setScalar(scale);
      break;
    }
  }
}
