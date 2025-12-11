import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { TextConfig } from './types';
import { applyAnimationTransform } from './animation';
import { createBevelEdgeMaterial } from './BevelEdgeMaterial';

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

  // Create face material based on material type
  const faceMaterial = useMemo(() => {
    const baseProps = {
      color: config.style.faceColor,
      emissive: config.style.faceColor,
      emissiveIntensity: 0.001,
    };

    switch (config.style.faceMaterial) {
      case 'matte':
        // Flat, non-reflective surface
        return new THREE.MeshStandardMaterial({
          ...baseProps,
          metalness: 0.0,
          roughness: 0.9,
          envMapIntensity: 0.1,
        });
      case 'glossy':
        // Shiny plastic look - non-metallic but reflective
        return new THREE.MeshStandardMaterial({
          ...baseProps,
          metalness: 0.0,
          roughness: 0.15,
          envMapIntensity: 0.8,
        });
      case 'metallic':
      default:
        // Highly reflective metal look (original)
        return new THREE.MeshStandardMaterial({
          ...baseProps,
          metalness: 0.95,
          roughness: 0.05,
          envMapIntensity: 1.0,
        });
    }
  }, [config.style.faceColor, config.style.faceMaterial]);

  const sideMaterial = useMemo(() => {
    return createBevelEdgeMaterial(
      config.style.sideColor1,
      config.style.sideColor2,
      config.style.edgeColor,
      config.style.edgeColorEnabled
    );
  }, [config.style.sideColor1, config.style.sideColor2, config.style.edgeColor, config.style.edgeColorEnabled]);

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
