import { Suspense, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Text3DComponent } from './Text3D';
import { applyAnimationTransform } from './animation';
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

// Show visible calibration in development mode
const SHOW_CALIBRATION = import.meta.env.DEV && import.meta.env.VITE_SHOW_CALIBRATION === 'true';

interface CameraCalibratorProps {
  config: TextConfig;
  textGroupRef: React.RefObject<THREE.Group | null>;
  onCalibrated: (cameraZ: number) => void;
}

// Calibrates camera distance by running through animation and checking bounds
function CameraCalibrator({ config, textGroupRef, onCalibrated }: CameraCalibratorProps) {
  const calibrationRef = useRef({
    phase: 'waiting' as 'waiting' | 'calibrating' | 'done',
    currentZ: 3, // Start close
    maxZ: 20, // Don't go further than this
    stepSize: 0.3,
    stepsPerCycle: 24, // Check this many animation positions per camera distance
    animationStep: 0, // Current animation step being checked
  });

  useFrame((state) => {
    const cal = calibrationRef.current;
    if (cal.phase === 'done' || !textGroupRef.current) return;

    const group = textGroupRef.current;
    const cam = state.camera as THREE.PerspectiveCamera;

    // Phase 1: Wait for geometry to load
    if (cal.phase === 'waiting') {
      const testBox = new THREE.Box3().setFromObject(group);
      if (testBox.isEmpty() || testBox.max.x - testBox.min.x < 0.01) {
        return; // Geometry not ready yet
      }
      cal.phase = 'calibrating';
      if (SHOW_CALIBRATION) {
        console.log('Calibration started at z =', cal.currentZ);
      }
    }

    // Phase 2: Calibrate
    if (cal.phase === 'calibrating') {
      // In dev mode with SHOW_CALIBRATION: run one step per frame (visible)
      // In production mode: run multiple steps per frame but yield between frames
      // This allows the loading animation to update
      const stepsPerFrame = SHOW_CALIBRATION ? 1 : 10;
      let stepsThisFrame = 0;

      while (stepsThisFrame < stepsPerFrame && cal.phase === 'calibrating') {
        stepsThisFrame++;
        // Position camera
        cam.position.z = cal.currentZ;
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();

        // Apply animation transform for current step
        const t = cal.animationStep / cal.stepsPerCycle;
        applyAnimationTransform(group, config, t);
        group.updateMatrixWorld(true);

        // Check bounds
        const box = new THREE.Box3().setFromObject(group);
        let overflowDetected = false;

        if (!box.isEmpty()) {
          const frustum = new THREE.Frustum();
          const projScreenMatrix = new THREE.Matrix4();
          projScreenMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
          frustum.setFromProjectionMatrix(projScreenMatrix);

          const corners = [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z),
          ];

          for (const corner of corners) {
            if (!frustum.containsPoint(corner)) {
              overflowDetected = true;
              break;
            }
          }
        }

        if (overflowDetected) {
          // Back off camera and restart animation check
          cal.currentZ += cal.stepSize;
          cal.animationStep = 0;
          if (SHOW_CALIBRATION) {
            console.log('Overflow detected, backing off to z =', cal.currentZ);
          }

          if (cal.currentZ >= cal.maxZ) {
            cal.phase = 'done';
            state.clock.elapsedTime = 0;
            if (SHOW_CALIBRATION) {
              console.log('Calibration complete (max reached):', cal.maxZ);
            }
            onCalibrated(cal.maxZ);
            return;
          }
        } else {
          // This step passed, move to next
          cal.animationStep++;

          if (cal.animationStep >= cal.stepsPerCycle) {
            // All steps passed! Calibration complete
            cal.phase = 'done';
            state.clock.elapsedTime = 0;
            if (SHOW_CALIBRATION) {
              console.log('Calibration complete:', cal.currentZ);
            }
            onCalibrated(cal.currentZ);
            return;
          }
        }
      }
    }
  });

  return null;
}

// Inner scene content that runs inside Canvas
interface SceneContentProps {
  config: TextConfig;
  configKey: string; // Unique key to force re-mount when config changes
  onClockMount: (fns: { reset: () => void; getT: () => number }) => void;
  onCalibrationComplete: () => void;
}

// Component to apply calibrated camera position
function CameraPositionSetter({ z }: { z: number }) {
  useFrame((state) => {
    (state.camera as THREE.PerspectiveCamera).position.z = z;
  });
  return null;
}

function SceneContent({ config, onClockMount, onCalibrationComplete }: SceneContentProps) {
  const textGroupRef = useRef<THREE.Group>(null);
  const [calibratedZ, setCalibratedZ] = useState<number | null>(null);

  const handleCalibrated = (z: number) => {
    setCalibratedZ(z);
    onCalibrationComplete();
  };

  return (
    <>
      <ClockController
        cycleDuration={config.animation.cycleDuration}
        onMount={onClockMount}
      />

      {/* Run calibration if not yet calibrated, otherwise apply calibrated position */}
      {calibratedZ === null ? (
        <CameraCalibrator
          config={config}
          textGroupRef={textGroupRef}
          onCalibrated={handleCalibrated}
        />
      ) : (
        <CameraPositionSetter z={calibratedZ} />
      )}

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
        <Text3DComponent groupRef={textGroupRef} config={config} />
      </Suspense>
    </>
  );
}

// Loading overlay component for when calibration is running (production mode)
function LoadingOverlay() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#fff',
      fontSize: '1.5rem',
      fontFamily: 'monospace',
      zIndex: 10,
    }}>
      Generating...
    </div>
  );
}

export const Scene = forwardRef<SceneHandle, SceneProps>(({ config }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockFnsRef = useRef<{ reset: () => void; getT: () => number } | null>(null);

  // Track which config we've completed calibration for
  const configKey = config ? JSON.stringify(config) : null;
  const [calibratedConfigKey, setCalibratedConfigKey] = useState<string | null>(null);

  // We're calibrating if we have a config but haven't completed calibration for this specific config
  const isCalibrating = configKey !== null && calibratedConfigKey !== configKey;

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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Show loading overlay during calibration in production mode */}
      {isCalibrating && !SHOW_CALIBRATION && <LoadingOverlay />}

      <Canvas
        ref={canvasRef}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          alpha: true,
        }}
        camera={{
          position: [0, 0, 3], // Start close, calibrator will adjust
          fov: config.camera.fov,
        }}
        style={{ background: '#000000' }}
      >
        {/* Black background for chroma key */}
        <color attach="background" args={['#000000']} />

        <SceneContent
          key={JSON.stringify(config)}
          config={config}
          configKey={JSON.stringify(config)}
          onClockMount={(fns) => { clockFnsRef.current = fns; }}
          onCalibrationComplete={() => setCalibratedConfigKey(configKey)}
        />
      </Canvas>
    </div>
  );
});

Scene.displayName = 'Scene';
