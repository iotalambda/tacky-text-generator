import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import type { TextConfig } from './types';
import { applyAnimationTransform, isPerCharacterAnimation, getWaveOffset } from './animation';
import { createBevelEdgeMaterial, updateBevelMaterialTime } from './BevelEdgeMaterial';
import { calculateCharPositions } from './textMeasure';

interface Text3DComponentProps {
  config: TextConfig;
  groupRef: React.RefObject<THREE.Group | null>;
}

export function Text3DComponent({ config, groupRef }: Text3DComponentProps) {
  const lines = config.text.split('\n');
  const isWaveAnimation = isPerCharacterAnimation(config.animation.type);

  // Refs for individual character groups (for wave animation) - use array for guaranteed order
  const charGroupRefs = useRef<THREE.Group[]>([]);

  const charSpacing = 0.05; // Small gap between characters
  const lineHeight = 1.4;
  const charSize = 0.8;

  // Count total characters across all lines for wave animation
  const totalChars = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.length, 0);
  }, [lines]);

  // Pre-calculate character positions for all lines using canvas measurement
  const lineCharPositions = useMemo(() => {
    if (!isWaveAnimation) return [];
    return lines.map(line =>
      calculateCharPositions(line, config.style.fontUrl, charSize, charSpacing)
    );
  }, [lines, config.style.fontUrl, charSize, charSpacing, isWaveAnimation]);

  // Animation using normalized time (0 to 1 over one cycle)
  useFrame((state) => {
    if (!groupRef.current) return;

    const elapsedTime = state.clock.elapsedTime;
    const cycleDuration = config.animation.cycleDuration;

    // Normalized time: 0 to 1 over one complete cycle
    const t = (elapsedTime % cycleDuration) / cycleDuration;

    applyAnimationTransform(groupRef.current, config, t);

    // Apply per-character wave animation
    if (isWaveAnimation && charGroupRefs.current.length > 0) {
      charGroupRefs.current.forEach((charGroup, charIndex) => {
        if (charGroup) {
          const yOffset = getWaveOffset(charIndex, totalChars, t, config.animation.amplitude);
          charGroup.position.y = yOffset;
        }
      });
    }

    // Update time uniform for animated gradients (rainbow)
    if (config.style.sideGradient === 'rainbow') {
      updateBevelMaterialTime(sideMaterialRef.current, elapsedTime);
    }
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
      config.style.edgeColorEnabled,
      config.style.sideGradient
    );
  }, [config.style.sideColor1, config.style.sideColor2, config.style.edgeColor, config.style.edgeColorEnabled, config.style.sideGradient]);

  // Store ref to side material for animated gradients
  const sideMaterialRef = useRef<THREE.ShaderMaterial>(sideMaterial);
  sideMaterialRef.current = sideMaterial;

  // Track global character index for wave animation (used during render)
  let globalCharIndex = 0;

  return (
    <group ref={groupRef}>
      <Center>
        <group>
          {lines.map((line, lineIndex) => {
            const charPositions = lineCharPositions[lineIndex] || [];

            return (
              <group key={lineIndex} position={[0, -lineIndex * lineHeight, 0]}>
                {isWaveAnimation ? (
                  // Per-character rendering for wave animation
                  <group>
                    {line.split('').map((char, charIndexInLine) => {
                      const charKey = `${lineIndex}-${charIndexInLine}`;
                      const currentGlobalIndex = globalCharIndex++;
                      const xPos = charPositions[charIndexInLine] ?? 0;

                      return (
                        <group
                          key={charKey}
                          position={[xPos, 0, 0]}
                          ref={(ref: THREE.Group | null) => {
                            if (ref) {
                              charGroupRefs.current[currentGlobalIndex] = ref;
                            }
                          }}
                        >
                          <Text3D
                            font={config.style.fontUrl}
                            size={charSize}
                            height={config.style.depth}
                            bevelEnabled={config.style.bevelEnabled}
                            bevelThickness={config.style.bevelThickness}
                            bevelSize={config.style.bevelSize}
                            bevelSegments={4}
                            curveSegments={16}
                            material={[faceMaterial, sideMaterial]}
                          >
                            {char}
                          </Text3D>
                        </group>
                      );
                    })}
                  </group>
                ) : (
                  // Standard line rendering for other animations
                  <Center>
                    <Text3D
                      font={config.style.fontUrl}
                      size={charSize}
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
                )}
              </group>
            );
          })}
        </group>
      </Center>
    </group>
  );
}
