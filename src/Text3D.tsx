import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { TextConfig } from './types';
import { applyAnimationTransform } from './animation';

interface Text3DComponentProps {
  config: TextConfig;
  groupRef: React.RefObject<THREE.Group | null>;
}

export function Text3DComponent({ config, groupRef }: Text3DComponentProps) {
  const lines = config.text.split('\n');

  // Animation using normalized time (0 to 1 over one cycle)
  useFrame((state) => {
    if (!groupRef.current) return;

    const elapsedTime = state.clock.elapsedTime;
    const cycleDuration = config.animation.cycleDuration;

    // Normalized time: 0 to 1 over one complete cycle
    const t = (elapsedTime % cycleDuration) / cycleDuration;

    applyAnimationTransform(groupRef.current, config, t);
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
