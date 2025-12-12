import * as THREE from 'three';
import type { TextConfig } from './types';

// Check if animation type requires per-character rendering
export function isPerCharacterAnimation(type: string): boolean {
  return type === 'wave';
}

/**
 * Calculates a 180° flip offset for spin animations to keep text readable.
 * When the text rotates to face away from the viewer (90° to 270° range),
 * we add a 180° flip so the text appears "correct" from the viewer's perspective.
 *
 * @param animationAngle - The current animation rotation angle (0 to 2π)
 * @param initialAngle - The initial angle offset for the relevant axis
 * @returns 0 or π (180°) flip offset
 */
function getFlipOffset(animationAngle: number, initialAngle: number): number {
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;

  // Calculate total rotation, normalized to 0-2π range
  let totalAngle = (animationAngle + initialAngle) % TWO_PI;
  if (totalAngle < 0) totalAngle += TWO_PI;

  // Text faces away from viewer when total rotation is between π/2 (90°) and 3π/2 (270°)
  // In this range, add a 180° flip to keep it readable
  if (totalAngle > HALF_PI && totalAngle < HALF_PI * 3) {
    return Math.PI;
  }

  return 0;
}

// Get Y offset for a character in wave animation
export function getWaveOffset(
  charIndex: number,
  totalChars: number,
  t: number,
  amplitude: number
): number {
  // Create a wave that travels across characters
  // Each character is offset by its position in the text
  const waveLength = totalChars / 15; // How many "waves" fit across the text
  const charPhase = (charIndex / Math.max(totalChars - 1, 1)) * waveLength * Math.PI * 2;
  const timePhase = t * Math.PI * 2;

  return Math.sin(timePhase - charPhase) * amplitude;
}

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
  const initialAngle = config.animation.initialAngle;
  const TWO_PI = Math.PI * 2;

  // For spin animations: apply initial angle AFTER the animation (animation in rotated space)
  // For other animations: apply initial angle BEFORE the animation (animation in viewer space)
  // This is achieved by using quaternion composition

  const animationType = config.animation.type;
  // Animations where the animation happens in the rotated space (around the tilted axis)
  const isRotatedSpaceAnimation = ['spinY', 'spinX', 'spinZ', 'swingY', 'swingX', 'swingZ'].includes(animationType);

  if (isRotatedSpaceAnimation) {
    // Spin and swing animations: animate first, then apply initial angle
    // The animation happens around the object's local axes, then we rotate the whole thing
    // Use quaternions for proper rotation composition

    // First create the animation rotation
    const animQuat = new THREE.Quaternion();
    switch (animationType) {
      case 'spinY': {
        // For Y spin: add 180° to Y when text would face away
        // This makes the text appear to continue rotating smoothly while staying readable
        const animAngle = t * TWO_PI;
        const flipOffset = getFlipOffset(animAngle, initialAngle.y);
        animQuat.setFromEuler(new THREE.Euler(0, animAngle + flipOffset, 0, 'XYZ'));
        break;
      }
      case 'spinX': {
        // For X spin: add 180° to X when text would face away
        const animAngle = t * TWO_PI;
        const flipOffset = getFlipOffset(animAngle, initialAngle.x);
        animQuat.setFromEuler(new THREE.Euler(animAngle + flipOffset, 0, 0, 'XYZ'));
        break;
      }
      case 'spinZ':
        // Z rotation doesn't make text face away, no flip needed
        animQuat.setFromEuler(new THREE.Euler(0, 0, t * TWO_PI, 'XYZ'));
        break;
      case 'swingY':
        animQuat.setFromEuler(new THREE.Euler(0, Math.sin(t * TWO_PI) * amp, 0, 'XYZ'));
        break;
      case 'swingX':
        animQuat.setFromEuler(new THREE.Euler(Math.sin(t * TWO_PI) * amp, 0, 0, 'XYZ'));
        break;
      case 'swingZ':
        animQuat.setFromEuler(new THREE.Euler(0, 0, Math.sin(t * TWO_PI) * amp, 'XYZ'));
        break;
    }

    // Then create the initial angle rotation
    const initialQuat = new THREE.Quaternion();
    initialQuat.setFromEuler(new THREE.Euler(initialAngle.x, initialAngle.y, 0, 'XYZ'));

    // Compose: initial angle first, then animation on top
    // finalQuat = initialQuat * animQuat (rotate by initial, then animate in that rotated space)
    const finalQuat = new THREE.Quaternion();
    finalQuat.multiplyQuaternions(initialQuat, animQuat);

    group.quaternion.copy(finalQuat);
  } else {
    // Bounce and pulse: apply initial angle first, then animate in viewer space
    // We need to use quaternions to compose the rotations properly

    // Start with the initial angle orientation
    const initialQuat = new THREE.Quaternion();
    initialQuat.setFromEuler(new THREE.Euler(initialAngle.x, initialAngle.y, 0, 'XYZ'));

    switch (animationType) {
      case 'bounce':
        // Bounce up and down in viewer space (Y position)
        group.position.y = Math.abs(Math.sin(t * TWO_PI)) * amp;
        break;

      case 'pulse': {
        // Scale pulse (no rotation needed)
        const scale = 1 + Math.sin(t * TWO_PI) * amp;
        group.scale.setScalar(scale);
        break;
      }

      case 'wave':
        // Wave animation is handled per-character in Text3D component
        // Group-level transform only applies initial angle
        break;
    }

    // Apply the initial angle orientation
    group.quaternion.copy(initialQuat);
  }
}
