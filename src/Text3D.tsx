import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { TextConfig } from './types';

interface Text3DComponentProps {
  config: TextConfig;
}

export function Text3DComponent({ config }: Text3DComponentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lines = config.text.split('\n');

  // Animation using normalized time (0 to 1 over one cycle)
  useFrame((state) => {
    if (!groupRef.current) return;

    const elapsedTime = state.clock.elapsedTime;
    const cycleDuration = config.animation.cycleDuration;

    // Normalized time: 0 to 1 over one complete cycle
    const t = (elapsedTime % cycleDuration) / cycleDuration;

    // Reset transforms
    groupRef.current.rotation.set(0, 0, 0);
    groupRef.current.position.set(0, 0, 0);
    groupRef.current.scale.setScalar(1);

    const amp = config.animation.amplitude;
    const TWO_PI = Math.PI * 2;

    switch (config.animation.type) {
      case 'spinY':
        // Full 360° rotation around Y axis
        groupRef.current.rotation.y = t * TWO_PI;
        break;

      case 'spinX':
        // Full 360° rotation around X axis
        groupRef.current.rotation.x = t * TWO_PI;
        break;

      case 'spinZ':
        // Full 360° rotation around Z axis
        groupRef.current.rotation.z = t * TWO_PI;
        break;

      case 'swingY':
        // Oscillate around Y axis (uses sin for smooth back-and-forth)
        groupRef.current.rotation.y = Math.sin(t * TWO_PI) * amp;
        break;

      case 'swingX':
        // Oscillate around X axis
        groupRef.current.rotation.x = Math.sin(t * TWO_PI) * amp;
        break;

      case 'swingZ':
        // Oscillate around Z axis
        groupRef.current.rotation.z = Math.sin(t * TWO_PI) * amp;
        break;

      case 'bounce':
        // Bounce up and down (abs of sin for bounce effect)
        groupRef.current.position.y = Math.abs(Math.sin(t * TWO_PI)) * amp;
        break;

      case 'pulse': {
        // Scale pulse
        const scale = 1 + Math.sin(t * TWO_PI) * amp;
        groupRef.current.scale.setScalar(scale);
        break;
      }
    }
  });

  // Create materials
  const faceMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: config.style.faceColor,
      metalness: config.style.metalness,
      roughness: config.style.roughness,
      envMapIntensity: 1.5,
    });
  }, [config.style.faceColor, config.style.metalness, config.style.roughness]);

  const sideMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: config.style.sideColor,
      metalness: config.style.metalness * 0.8,
      roughness: config.style.roughness + 0.1,
    });
  }, [config.style.sideColor, config.style.metalness, config.style.roughness]);

  const lineHeight = 1.4;

  return (
    <group ref={groupRef}>
      <Center>
        <group>
          {lines.map((line, index) => (
            <Center key={index} position={[0, -index * lineHeight, 0]}>
              <Text3D
                font={config.style.fontUrl}
                size={0.8}
                height={config.style.depth}
                bevelEnabled={config.style.bevelEnabled}
                bevelThickness={config.style.bevelThickness}
                bevelSize={config.style.bevelSize}
                bevelSegments={4}
                curveSegments={16}
                material={[faceMaterial, sideMaterial]}
              >
                {line}
              </Text3D>
            </Center>
          ))}
        </group>
      </Center>
    </group>
  );
}
