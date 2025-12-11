import { useState, useRef, useCallback } from 'react';
import { Scene } from './Scene';
import type { SceneHandle } from './Scene';
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
  const sceneRef = useRef<SceneHandle>(null);

  const handleGenerate = useCallback(() => {
    if (!inputText.trim()) return;
    setIsGenerating(true);

    // Small delay to show loading state
    setTimeout(() => {
      const newConfig = randomizeTextConfig(inputText);
      setConfig(newConfig);
      setIsGenerating(false);
    }, 100);
  }, [inputText]);

  const handleExportGif = useCallback(async () => {
    const canvas = sceneRef.current?.getCanvas();
    if (!canvas || !config) return;

    setIsCapturing(true);
    setCaptureProgress(0);

    // Reset the animation clock to start from beginning
    sceneRef.current?.resetClock();

    // Wait a frame for the clock reset to take effect
    await new Promise(resolve => requestAnimationFrame(resolve));

    // GIF capture options - good quality, transparent background via chroma key
    const options: GifCaptureOptions = {
      width: 480, // Max resolution
      height: 480, // Max resolution (actual size depends on bounds aspect ratio)
      fps: 20, // Not used directly, kept for reference
      quality: 10, // Good quality (1-30, lower = better)
      getAnimationT: () => sceneRef.current?.getAnimationT() ?? 0,
      cycleDuration: config.animation.cycleDuration, // Pass cycle duration for correct timing
      screenBounds: sceneRef.current?.getScreenBounds(), // Crop to calibrated bounds
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

  return (
    <div className="app">
      <header className="header">
        <h1>Tacky 3D Text Generator</h1>
        <p>Create glorious WordArt-style animated GIFs!</p>
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
              disabled={isGenerating || !inputText.trim()}
            >
              {isGenerating ? 'Generating...' : 'Generate!'}
            </button>

            {config && (
              <button
                className="btn btn-secondary"
                onClick={handleExportGif}
                disabled={isCapturing}
              >
                {isCapturing
                  ? `Capturing... ${Math.round(captureProgress * 100)}%`
                  : 'Export GIF'}
              </button>
            )}
          </div>

          {config && (
            <div className="config-info">
              <h3>Current Style:</h3>
              <ul>
                <li>Font: {config.style.fontUrl.split('/').pop()?.replace('.json', '').replace(/-/g, ' ')}</li>
                <li>Animation: {config.animation.type}</li>
                <li>Initial angle: {Math.round(config.animation.initialAngle.x * 180 / Math.PI)}°, {Math.round(config.animation.initialAngle.y * 180 / Math.PI)}°</li>
                <li>
                  Face: <span className="color-swatch" style={{ backgroundColor: config.style.faceColor }} /> {config.style.faceColor}
                </li>
                <li>
                  Sides: <span className="color-swatch" style={{ backgroundColor: config.style.sideColor }} /> {config.style.sideColor}
                </li>
                <li>Cycle: {config.animation.cycleDuration.toFixed(1)}s</li>
              </ul>
            </div>
          )}
        </div>

        <div className="preview">
          <Scene ref={sceneRef} config={config} />
        </div>
      </main>
    </div>
  );
}

export default App;
