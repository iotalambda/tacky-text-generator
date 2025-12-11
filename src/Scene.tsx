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

// Screen-space bounding box (normalized 0-1 coordinates)
export interface ScreenBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SceneHandle {
  getCanvas: () => HTMLCanvasElement | null;
  resetClock: () => void;
  getAnimationT: () => number; // Get current animation progress (0-1)
  getScreenBounds: () => ScreenBounds | null; // Get calibrated screen bounds
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
const SHOW_BOUNDING_BOX = import.meta.env.DEV && import.meta.env.VITE_SHOW_BOUNDING_BOX === 'true';

interface CameraCalibratorProps {
  config: TextConfig;
  textGroupRef: React.RefObject<THREE.Group | null>;
  onCalibrated: (cameraZ: number, screenBounds: ScreenBounds) => void;
}

// Calibrates camera distance by running through animation and checking bounds
function CameraCalibrator({ config, textGroupRef, onCalibrated }: CameraCalibratorProps) {
  const calibrationRef = useRef({
    phase: 'waiting' as 'waiting' | 'calibrating' | 'bounds' | 'done',
    currentZ: 3, // Start close
    maxZ: 20, // Don't go further than this
    stepSize: 0.3,
    stepsPerCycle: 24, // Check this many animation positions per camera distance
    animationStep: 0, // Current animation step being checked
    // Screen bounds tracking (accumulated across all animation frames)
    screenBounds: { minX: 1, maxX: 0, minY: 1, maxY: 0 } as ScreenBounds,
    finalZ: 3, // Store final camera Z for bounds pass
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
            // Max reached, move to bounds calculation phase
            cal.finalZ = cal.maxZ;
            cal.phase = 'bounds';
            cal.animationStep = 0;
            cal.screenBounds = { minX: 1, maxX: 0, minY: 1, maxY: 0 };
            if (SHOW_CALIBRATION) {
              console.log('Camera calibration complete (max reached):', cal.maxZ, '- calculating bounds');
            }
            return;
          }
        } else {
          // This step passed, move to next
          cal.animationStep++;

          if (cal.animationStep >= cal.stepsPerCycle) {
            // All steps passed! Move to bounds calculation phase
            cal.finalZ = cal.currentZ;
            cal.phase = 'bounds';
            cal.animationStep = 0;
            cal.screenBounds = { minX: 1, maxX: 0, minY: 1, maxY: 0 };
            if (SHOW_CALIBRATION) {
              console.log('Camera calibration complete:', cal.currentZ, '- calculating bounds');
            }
            return;
          }
        }
      }
    }

    // Phase 3: Calculate screen-space bounds at final camera position
    if (cal.phase === 'bounds') {
      const stepsPerFrame = SHOW_CALIBRATION ? 1 : 10;
      let stepsThisFrame = 0;

      while (stepsThisFrame < stepsPerFrame && cal.phase === 'bounds') {
        stepsThisFrame++;

        // Position camera at final Z
        cam.position.z = cal.finalZ;
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();

        // Apply animation transform for current step
        const t = cal.animationStep / cal.stepsPerCycle;
        applyAnimationTransform(group, config, t);
        group.updateMatrixWorld(true);

        // Get bounding box and project corners to screen space
        const box = new THREE.Box3().setFromObject(group);
        if (!box.isEmpty()) {
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
            // Project to normalized device coordinates (-1 to 1)
            corner.project(cam);
            // Convert to 0-1 screen space (0,0 is top-left)
            const screenX = (corner.x + 1) / 2;
            const screenY = (1 - corner.y) / 2; // Flip Y for screen coords

            // Update bounds
            cal.screenBounds.minX = Math.min(cal.screenBounds.minX, screenX);
            cal.screenBounds.maxX = Math.max(cal.screenBounds.maxX, screenX);
            cal.screenBounds.minY = Math.min(cal.screenBounds.minY, screenY);
            cal.screenBounds.maxY = Math.max(cal.screenBounds.maxY, screenY);
          }
        }

        cal.animationStep++;

        if (cal.animationStep >= cal.stepsPerCycle) {
          // Bounds calculation complete!
          cal.phase = 'done';
          state.clock.elapsedTime = 0;

          // Add a small padding to bounds (2%)
          const padding = 0.02;
          const bounds: ScreenBounds = {
            minX: Math.max(0, cal.screenBounds.minX - padding),
            maxX: Math.min(1, cal.screenBounds.maxX + padding),
            minY: Math.max(0, cal.screenBounds.minY - padding),
            maxY: Math.min(1, cal.screenBounds.maxY + padding),
          };

          if (SHOW_CALIBRATION) {
            console.log('Bounds calibration complete:', bounds);
          }
          onCalibrated(cal.finalZ, bounds);
          return;
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
  onCalibrationComplete: (bounds: ScreenBounds) => void;
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

  const handleCalibrated = (z: number, bounds: ScreenBounds) => {
    setCalibratedZ(z);
    onCalibrationComplete(bounds);
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

// Debug overlay showing the calibrated bounding box
function BoundingBoxOverlay({ bounds }: { bounds: ScreenBounds }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${bounds.minX * 100}%`,
        top: `${bounds.minY * 100}%`,
        width: `${(bounds.maxX - bounds.minX) * 100}%`,
        height: `${(bounds.maxY - bounds.minY) * 100}%`,
        border: '2px solid rgba(128, 128, 128, 0.8)',
        backgroundColor: 'rgba(128, 128, 128, 0.1)',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

export const Scene = forwardRef<SceneHandle, SceneProps>(({ config }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockFnsRef = useRef<{ reset: () => void; getT: () => number } | null>(null);
  const screenBoundsRef = useRef<ScreenBounds | null>(null);

  // Track which config we've completed calibration for
  const configKey = config ? JSON.stringify(config) : null;
  const [calibratedConfigKey, setCalibratedConfigKey] = useState<string | null>(null);
  const [displayBounds, setDisplayBounds] = useState<ScreenBounds | null>(null);

  // We're calibrating if we have a config but haven't completed calibration for this specific config
  const isCalibrating = configKey !== null && calibratedConfigKey !== configKey;

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    resetClock: () => clockFnsRef.current?.reset(),
    getAnimationT: () => clockFnsRef.current?.getT() ?? 0,
    getScreenBounds: () => screenBoundsRef.current,
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
          onCalibrationComplete={(bounds) => {
            screenBoundsRef.current = bounds;
            setDisplayBounds(bounds);
            setCalibratedConfigKey(configKey);
          }}
        />
      </Canvas>

      {/* Debug overlay showing calibrated bounding box */}
      {SHOW_BOUNDING_BOX && displayBounds && <BoundingBoxOverlay bounds={displayBounds} />}
    </div>
  );
});

Scene.displayName = 'Scene';
