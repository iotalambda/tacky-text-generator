import { useState, useRef, useCallback } from 'react';
import { Scene } from './Scene';
import type { SceneHandle, ScreenBounds } from './Scene';
import type { TextConfig } from './types';
import { randomizeTextConfig } from './randomizer';
import { captureGif, downloadBlob } from './GifCapture';
import type { GifCaptureOptions } from './GifCapture';
import './App.css';

function App() {
  const [inputText, setInputText] = useState('Welcome to My\nMediocre Blog');
  const [config, setConfig] = useState<TextConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [screenBounds, setScreenBounds] = useState<ScreenBounds | null>(null);
  const sceneRef = useRef<SceneHandle>(null);

  const handleGenerate = useCallback(() => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setScreenBounds(null); // Reset bounds when generating new config

    // Small delay to show loading state
    setTimeout(() => {
      const newConfig = randomizeTextConfig(inputText);
      setConfig(newConfig);
      setIsGenerating(false);
    }, 100);
  }, [inputText]);

  const handleExportGif = useCallback(async (targetWidth: number) => {
    const canvas = sceneRef.current?.getCanvas();
    if (!canvas || !config) return;

    setIsCapturing(true);
    setCaptureProgress(0);

    // Reset the animation clock to start from beginning
    sceneRef.current?.resetClock();

    // Wait a frame for the clock reset to take effect
    await new Promise(resolve => requestAnimationFrame(resolve));

    const screenBounds = sceneRef.current?.getScreenBounds();

    // GIF capture options - good quality, transparent background via chroma key
    const options: GifCaptureOptions = {
      width: targetWidth,
      height: targetWidth, // Will be adjusted by aspect ratio in captureGif
      fps: 20, // Not used directly, kept for reference
      quality: 20, // Balanced quality/size (1-30, lower = better quality but larger)
      getAnimationT: () => sceneRef.current?.getAnimationT() ?? 0,
      cycleDuration: config.animation.cycleDuration, // Pass cycle duration for correct timing
      screenBounds, // Crop to calibrated bounds
      chromaKey: config.style.chromaKey, // Use the color scheme's chroma key for transparency
    };

    try {
      const blob = await captureGif(canvas, options, (progress) => {
        setCaptureProgress(progress);
      });

      // Generate filename from text
      const filename = config.text
        .split('\n')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .substring(0, 30) + '.gif';

      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Failed to capture GIF:', error);
      alert('Failed to create GIF. Please try again.');
    } finally {
      setIsCapturing(false);
      setCaptureProgress(0);
    }
  }, [config]);

  // Calculate output dimensions based on screen bounds aspect ratio
  const getOutputDimensions = useCallback((targetWidth: number) => {
    if (!screenBounds) return { width: targetWidth, height: targetWidth };

    const boundsWidth = screenBounds.maxX - screenBounds.minX;
    const boundsHeight = screenBounds.maxY - screenBounds.minY;
    const aspectRatio = boundsWidth / boundsHeight;

    const height = Math.round(targetWidth / aspectRatio);
    return { width: targetWidth, height };
  }, [screenBounds]);

  // Calibration is in progress if we have a config but no bounds yet
  const isCalibrating = config !== null && screenBounds === null;

  return (
    <div className="app">
      <header className="header">
        <h1>Tacky 3D Text Generator</h1>
        <a
          href="https://github.com/iotalambda/tacky-text-generator"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
          aria-label="View source on GitHub"
        >
          <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </header>

      <main className="main">
        <div className="controls">
          <div className="input-group">
            <label htmlFor="text-input">Enter your text:</label>
            <textarea
              id="text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text here...\nUse multiple lines!"
              rows={4}
            />
          </div>

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating || isCapturing || !inputText.trim()}
            >
              {isGenerating ? 'Generating...' : 'Generate!'}
            </button>
          </div>

          {config && (
            <div className="export-group">
              {isCapturing ? (
                <div className="capture-progress">
                  Capturing...<br />
                  {Math.round(captureProgress * 100)}%
                </div>
              ) : (
                [320, 640, 1280].map((width) => {
                  const dims = getOutputDimensions(width);
                  return (
                    <button
                      key={width}
                      className="btn btn-secondary btn-export"
                      onClick={() => handleExportGif(width)}
                      disabled={isCapturing || isCalibrating}
                    >
                      Export GIF<br />
                      {dims.width}px × {screenBounds ? `${dims.height}px` : '?px'}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {config && (
            <div className="config-info">
              <h3>Current Style:</h3>
              <ul>
                <li><span className="config-label">Font</span> <span className="config-value">{config.style.fontUrl.split('/').pop()?.replace('.json', '').replace(/-/g, ' ')}</span></li>
                <li><span className="config-label">Animation</span> <span className="config-value">{config.animation.type}</span></li>
                <li><span className="config-label">Angle</span> <span className="config-value">{Math.round(config.animation.initialAngle.x * 180 / Math.PI)}°, {Math.round(config.animation.initialAngle.y * 180 / Math.PI)}°</span></li>
                <li>
                  <span className="config-label">Face</span> <span className="config-value"><span className="color-swatch" style={{ backgroundColor: config.style.faceColor }} /> {config.style.faceColor}</span>
                </li>
                <li>
                  <span className="config-label">Sides</span> <span className="config-value"><span className="color-swatch" style={{ backgroundColor: config.style.sideColor1 }} /> <span className="color-swatch" style={{ backgroundColor: config.style.sideColor2 }} /></span>
                </li>
                <li style={{ opacity: config.style.edgeColorEnabled ? 1 : 0.5 }}>
                  <span className="config-label">Edge</span> <span className="config-value"><span className="color-swatch" style={{ backgroundColor: config.style.edgeColor }} /> {config.style.edgeColorEnabled ? 'On' : 'Off'}</span>
                </li>
                <li><span className="config-label">Cycle</span> <span className="config-value">{config.animation.cycleDuration.toFixed(1)}s</span></li>
              </ul>
            </div>
          )}
        </div>

        <div className="preview">
          <Scene ref={sceneRef} config={config} onCalibrationComplete={setScreenBounds} />
        </div>
      </main>
    </div>
  );
}

export default App;
