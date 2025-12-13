import { Suspense, forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Text3DComponent } from './Text3D';
import { applyAnimationTransform } from './animation';
import { DitherEffect } from './DitherEffect';
import type { TextConfig } from './types';

interface SceneProps {
  config: TextConfig | null;
  onCalibrationComplete?: (bounds: ScreenBounds) => void;
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
  setAnimationT: (t: number) => void; // Set animation progress (0-1) for frame-by-frame capture
  getScreenBounds: () => ScreenBounds | null; // Get calibrated screen bounds
  getCycleDuration: () => number; // Get animation cycle duration in seconds
}

interface ClockControllerProps {
  cycleDuration: number;
  onMount: (fns: { reset: () => void; getT: () => number; setT: (t: number) => void }) => void;
}

// Component to expose clock control
function ClockController({ cycleDuration, onMount }: ClockControllerProps) {
  const { clock } = useThree();

  // Expose the reset, getT, and setT functions on mount
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
        setT: (t: number) => {
          // Set clock time to match the desired t value (0-1)
          clock.elapsedTime = t * cycleDuration;
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
    numCycles: 2, // Run through 2 full cycles to catch all edge cases
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
        // Use modulo to wrap t within 0-1 range across multiple cycles
        const totalSteps = cal.stepsPerCycle * cal.numCycles;
        const t = (cal.animationStep % cal.stepsPerCycle) / cal.stepsPerCycle;
        applyAnimationTransform(group, config, t);
        group.updateMatrixWorld(true);

        // Check bounds
        const box = new THREE.Box3().setFromObject(group);
        let overflowDetected = false;

        // For wave animations, expand the bounding box vertically to account for
        // per-character wave motion that isn't captured in the group transform
        const isWaveAnimation = config.animation.type === 'wave';
        if (isWaveAnimation) {
          box.min.y -= config.animation.amplitude;
          box.max.y += config.animation.amplitude;
        }

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

          if (cal.animationStep >= totalSteps) {
            // All steps across all cycles passed! Move to bounds calculation phase
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
      const totalSteps = cal.stepsPerCycle * cal.numCycles;

      while (stepsThisFrame < stepsPerFrame && cal.phase === 'bounds') {
        stepsThisFrame++;

        // Position camera at final Z
        cam.position.z = cal.finalZ;
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();

        // Apply animation transform for current step
        // Use modulo to wrap t within 0-1 range across multiple cycles
        const t = (cal.animationStep % cal.stepsPerCycle) / cal.stepsPerCycle;
        applyAnimationTransform(group, config, t);
        group.updateMatrixWorld(true);

        // Project actual mesh vertices to get tight screen bounds
        // This avoids the AABB inflation issue when text is rotated
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            const geometry = child.geometry;
            const positionAttr = geometry.getAttribute('position');
            if (positionAttr) {
              const vertex = new THREE.Vector3();
              // Sample vertices (every 10th to keep it fast, but still accurate)
              for (let i = 0; i < positionAttr.count; i += 10) {
                vertex.fromBufferAttribute(positionAttr, i);
                // Transform vertex to world space
                vertex.applyMatrix4(child.matrixWorld);
                // Project to screen space
                vertex.project(cam);
                // Convert to 0-1 screen space (0,0 is top-left)
                const screenX = (vertex.x + 1) / 2;
                const screenY = (1 - vertex.y) / 2;

                // Update bounds
                cal.screenBounds.minX = Math.min(cal.screenBounds.minX, screenX);
                cal.screenBounds.maxX = Math.max(cal.screenBounds.maxX, screenX);
                cal.screenBounds.minY = Math.min(cal.screenBounds.minY, screenY);
                cal.screenBounds.maxY = Math.max(cal.screenBounds.maxY, screenY);
              }
            }
          }
        });

        cal.animationStep++;

        if (cal.animationStep >= totalSteps) {
          // Bounds calculation complete (after all cycles)!
          cal.phase = 'done';
          state.clock.elapsedTime = 0;

          // Add padding to bounds
          // Base padding is 2%, but wave animations need extra vertical padding
          // because the per-character wave motion isn't captured during calibration
          const basePadding = 0.02;
          const isWaveAnimation = config.animation.type === 'wave';
          // Wave amplitude is in world units, convert roughly to screen proportion
          // The amplitude causes characters to move up/down, so add extra Y padding
          const waveExtraPadding = isWaveAnimation ? config.animation.amplitude * 0.15 : 0;

          const bounds: ScreenBounds = {
            minX: Math.max(0, cal.screenBounds.minX - basePadding),
            maxX: Math.min(1, cal.screenBounds.maxX + basePadding),
            minY: Math.max(0, cal.screenBounds.minY - basePadding - waveExtraPadding),
            maxY: Math.min(1, cal.screenBounds.maxY + basePadding + waveExtraPadding),
          };

          if (SHOW_CALIBRATION) {
            console.log('Bounds calibration complete:', bounds, isWaveAnimation ? '(wave padding applied)' : '');
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
  onClockMount: (fns: { reset: () => void; getT: () => number; setT: (t: number) => void }) => void;
  onCalibrationComplete: (bounds: ScreenBounds) => void;
}

// Component to apply calibrated camera position
function CameraPositionSetter({ z }: { z: number }) {
  useFrame((state) => {
    (state.camera as THREE.PerspectiveCamera).position.z = z;
  });
  return null;
}

// 16 static lights surrounding the text at various positions
function SurroundingLights() {
  // Generate 16 light positions distributed around the text
  // Using a combination of spherical distribution for good coverage
  const lights = [];
  const numLights = 16;

  for (let i = 0; i < numLights; i++) {
    // Use golden ratio spiral for even distribution on sphere
    const phi = Math.acos(1 - 2 * (i + 0.5) / numLights); // Polar angle
    const theta = Math.PI * (1 + Math.sqrt(5)) * i; // Azimuthal angle (golden ratio)

    // Vary distance between 4 and 8 units
    const distance = 4 + (i % 4) * 1.5;

    const x = distance * Math.sin(phi) * Math.cos(theta);
    const y = distance * Math.sin(phi) * Math.sin(theta);
    const z = distance * Math.cos(phi);

    lights.push(
      <pointLight
        key={i}
        position={[x, y, z]}
        intensity={2}
        color="#ffffff"
        distance={30}
        decay={1}
      />
    );
  }

  return <>{lights}</>;
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
      {/* 16 lights surrounding the text */}
      <SurroundingLights />

      {/* Environment map for reflections - background: false ensures it doesn't override our chroma key */}
      <Environment preset="lobby" background={false} />

      <Suspense fallback={null}>
        <Text3DComponent groupRef={textGroupRef} config={config} />
      </Suspense>

      {/* Dithering post-processing effect - skip dithering on chroma key background */}
      <DitherEffect chromaKey={config.style.chromaKey} />
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

export const Scene = forwardRef<SceneHandle, SceneProps>(({ config, onCalibrationComplete: onCalibrationCompleteProp }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockFnsRef = useRef<{ reset: () => void; getT: () => number; setT: (t: number) => void } | null>(null);
  const screenBoundsRef = useRef<ScreenBounds | null>(null);
  const cycleDurationRef = useRef<number>(2); // Default, will be updated when config changes

  // Track which config we've completed calibration for
  const configKey = config ? JSON.stringify(config) : null;
  const [calibratedConfigKey, setCalibratedConfigKey] = useState<string | null>(null);
  const [displayBounds, setDisplayBounds] = useState<ScreenBounds | null>(null);

  // We're calibrating if we have a config but haven't completed calibration for this specific config
  const isCalibrating = configKey !== null && calibratedConfigKey !== configKey;

  // Update cycleDurationRef when config changes
  useEffect(() => {
    if (config) {
      cycleDurationRef.current = config.animation.cycleDuration;
    }
  }, [config]);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    resetClock: () => clockFnsRef.current?.reset(),
    getAnimationT: () => clockFnsRef.current?.getT() ?? 0,
    setAnimationT: (t: number) => clockFnsRef.current?.setT(t),
    getScreenBounds: () => screenBoundsRef.current,
    getCycleDuration: () => cycleDurationRef.current,
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
        style={{ background: config.style.chromaKey }}
      >
        {/* Chroma key background - distinct from text colors for clean GIF transparency */}
        <color attach="background" args={[config.style.chromaKey]} />

        <SceneContent
          key={JSON.stringify(config)}
          config={config}
          configKey={JSON.stringify(config)}
          onClockMount={(fns) => { clockFnsRef.current = fns; }}
          onCalibrationComplete={(bounds) => {
            screenBoundsRef.current = bounds;
            setDisplayBounds(bounds);
            setCalibratedConfigKey(configKey);
            onCalibrationCompleteProp?.(bounds);
          }}
        />
      </Canvas>

      {/* Debug overlay showing calibrated bounding box */}
      {SHOW_BOUNDING_BOX && displayBounds && <BoundingBoxOverlay bounds={displayBounds} />}
    </div>
  );
});

Scene.displayName = 'Scene';
