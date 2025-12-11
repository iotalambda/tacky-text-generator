import { Suspense, forwardRef, useImperativeHandle, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Text3DComponent } from './Text3D';
import type { TextConfig } from './types';

interface SceneProps {
  config: TextConfig | null;
}

export interface SceneHandle {
  getCanvas: () => HTMLCanvasElement | null;
  resetClock: () => void;
  getAnimationT: () => number; // Get current animation progress (0-1)
}

interface ClockControllerProps {
  cycleDuration: number;
  onMount: (fns: { reset: () => void; getT: () => number }) => void;
}

// Component to expose clock control
function ClockController({ cycleDuration, onMount }: ClockControllerProps) {
  const { clock } = useThree();

  // Expose the reset and getT functions on mount
  useImperativeHandle(
    { current: null },
    () => {
      onMount({
        reset: () => {
          clock.start();
          clock.elapsedTime = 0;
        },
        getT: () => {
          const t = (clock.elapsedTime % cycleDuration) / cycleDuration;
          return t;
        },
      });
      return null;
    },
    [clock, cycleDuration, onMount]
  );

  return null;
}

export const Scene = forwardRef<SceneHandle, SceneProps>(({ config }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockFnsRef = useRef<{ reset: () => void; getT: () => number } | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    resetClock: () => clockFnsRef.current?.reset(),
    getAnimationT: () => clockFnsRef.current?.getT() ?? 0,
  }));

  if (!config) {
    return (
      <div className="scene-placeholder">
        <p>Enter text and click "Generate" to create your tacky 3D animation!</p>
      </div>
    );
  }

  return (
    <Canvas
      ref={canvasRef}
      gl={{
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
      }}
      camera={{
        position: config.camera.position,
        fov: config.camera.fov,
      }}
      style={{ background: '#000000' }}
    >
      {/* Black background for chroma key */}
      <color attach="background" args={['#000000']} />

      <ClockController
        cycleDuration={config.animation.cycleDuration}
        onMount={(fns) => { clockFnsRef.current = fns; }}
      />

      {/* Lighting for better metallic reflections */}
      <ambientLight intensity={config.light.ambientIntensity} />
      <directionalLight
        position={config.light.direction}
        intensity={config.light.intensity}
        castShadow
      />
      <pointLight position={[-5, 5, 5]} intensity={0.8} />
      <pointLight position={[5, -2, 3]} intensity={0.5} />

      {/* Environment map for reflections */}
      <Environment preset="studio" />

      <Suspense fallback={null}>
        <Text3DComponent config={config} />
      </Suspense>
    </Canvas>
  );
});

Scene.displayName = 'Scene';
