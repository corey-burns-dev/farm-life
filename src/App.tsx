import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const TILE_SIZE = 40;
const GRID_COLS = 20;
const GRID_ROWS = 14;
const GROW_INTERVAL_MS = 2000;

type CropStage = 'soil' | 'sprout' | 'growing' | 'ready';

interface Crop {
  gridX: number;
  gridY: number;
  stage: CropStage;
  plantedAt: number;
}

function App() {
  const [gridPos, setGridPos] = useState({ x: 5, y: 5 });
  const [crops, setCrops] = useState<Crop[]>([]);
  const [gold, setGold] = useState(10);
  const [seeds, setSeeds] = useState(5);
  const [facing, setFacing] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const keysPressed = useRef<Record<string, boolean>>({});
  const requestRef = useRef<number>(0);
  const lastGrowRef = useRef(0);
  const lastMoveTime = useRef(0);
  const MOVE_DELAY_MS = 140;

  const pixelX = gridPos.x * TILE_SIZE + TILE_SIZE / 2;
  const pixelY = gridPos.y * TILE_SIZE + TILE_SIZE / 2;

  const getCropAt = useCallback(
    (gx: number, gy: number) => crops.find((c) => c.gridX === gx && c.gridY === gy),
    [crops]
  );

  const isTillable = useCallback(
    (gx: number, gy: number) => !getCropAt(gx, gy),
    [getCropAt]
  );

  const advanceCropGrowth = useCallback(() => {
    const now = Date.now();
    setCrops((prev) =>
      prev.map((c) => {
        if (c.stage === 'ready') return c;
        const elapsed = now - c.plantedAt;
        let stage: CropStage = c.stage;
        if (c.stage === 'soil' && elapsed > GROW_INTERVAL_MS * 0.25) stage = 'sprout';
        else if (c.stage === 'sprout' && elapsed > GROW_INTERVAL_MS * 0.5) stage = 'growing';
        else if (c.stage === 'growing' && elapsed > GROW_INTERVAL_MS) stage = 'ready';
        return { ...c, stage };
      })
    );
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
      if (e.key === ' ') {
        e.preventDefault();
        const crop = getCropAt(gridPos.x, gridPos.y);
        if (crop?.stage === 'ready') {
          setCrops((prev) => prev.filter((c) => !(c.gridX === gridPos.x && c.gridY === gridPos.y)));
          setGold((g) => g + 3);
        } else if (isTillable(gridPos.x, gridPos.y) && seeds > 0) {
          setSeeds((s) => s - 1);
          setCrops((prev) => [
            ...prev,
            { gridX: gridPos.x, gridY: gridPos.y, stage: 'soil', plantedAt: Date.now() },
          ]);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gridPos, getCropAt, isTillable, seeds]);

  useEffect(() => {
    const update = (t: number) => {
      if (t - lastGrowRef.current > 500) {
        lastGrowRef.current = t;
        advanceCropGrowth();
      }

      let moveX = 0,
        moveY = 0;
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) moveX = -1;
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) moveX = 1;
      if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) moveY = -1;
      if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) moveY = 1;
      const now = performance.now();
      if ((moveX !== 0 || moveY !== 0) && now - lastMoveTime.current >= MOVE_DELAY_MS) {
        lastMoveTime.current = now;
        if (moveX !== 0) setFacing(moveX > 0 ? 'right' : 'left');
        else setFacing(moveY > 0 ? 'down' : 'up');
        setGridPos((prev) => {
          const nx = Math.max(0, Math.min(GRID_COLS - 1, prev.x + moveX));
          const ny = Math.max(0, Math.min(GRID_ROWS - 1, prev.y + moveY));
          return { x: nx, y: ny };
        });
      }
      requestRef.current = requestAnimationFrame(update);
    };
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [advanceCropGrowth]);

  return (
    <div className="game-container">
      <div className="sky" />
      <div className="farm-grid">
        {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
          const gx = i % GRID_COLS;
          const gy = Math.floor(i / GRID_COLS);
          const crop = getCropAt(gx, gy);
          const isPlayer = gridPos.x === gx && gridPos.y === gy;
          return (
            <div
              key={`${gx}-${gy}`}
              className={`tile ${crop ? 'tilled' : ''} ${isPlayer ? 'player-cell' : ''}`}
              style={{
                left: gx * TILE_SIZE,
                top: gy * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
              }}
            >
              {crop && (
                <div className={`crop crop-${crop.stage}`}>
                  {crop.stage === 'soil' && <span className="crop-seed" />}
                  {crop.stage === 'sprout' && <span className="crop-sprout" />}
                  {crop.stage === 'growing' && <span className="crop-leaf" />}
                  {crop.stage === 'ready' && <span className="crop-ready" />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="character"
        data-facing={facing}
        style={{
          left: pixelX - TILE_SIZE / 2,
          top: pixelY - TILE_SIZE / 2,
          width: TILE_SIZE,
          height: TILE_SIZE,
        }}
      >
        <div className="character-inner">
          <div className="character-eyes" />
          <div className="character-cheeks" />
        </div>
      </div>

      <div className="ui-panel">
        <h1 className="game-title">Farm Life</h1>
        <div className="stats">
          <span className="stat">
            <span className="stat-icon">🌾</span>
            <span>{seeds}</span>
          </span>
          <span className="stat gold">
            <span className="stat-icon">🪙</span>
            <span>{gold}</span>
          </span>
        </div>
        <button
          type="button"
          className="buy-btn"
          onClick={() => {
          if (gold >= 2) {
            setGold((g) => g - 2);
            setSeeds((s) => s + 1);
          }
        }}
          disabled={gold < 2}
        >
          Buy seed (2🪙)
        </button>
        <p className="hint">WASD move · SPACE plant / harvest</p>
      </div>
    </div>
  );
}

export default App;
