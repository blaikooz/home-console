/**
 * WeatherScene — animated ASCII weather scene, inspired by Veirt/weathr (Rust TUI).
 *
 * Renders a fixed-grid scene composed of:
 *   - Sky layer (stars at night, sun/moon by hour-of-day)
 *   - Drifting clouds (count varies with cloud cover)
 *   - Weather effects (rain, snow, fog, lightning)
 *   - Ground line + brownstone silhouette
 *
 * Runs its own ~10 fps animation loop. Driven purely by `code` (WMO) + `hour`.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  code: number;
  hour: number;
}

const WIDTH = 40;
const HEIGHT = 14;
const FRAME_MS = 100;
const GROUND_Y = HEIGHT - 2;

// === ASCII assets (adapted from Veirt/weathr) ===

const SUN = [
`    \\   |   /
     .---.
  -- (   ) --
     \`---'
    /   |   \\`,
`     .  |  .
      .---.
   ~~ (     ) ~~
      \`---'
     '   |   '`,
];

const MOON = `   _..._
 .'~o~~~\`.
:~~~~~o~~~:
:~~o~~~~.~:
\`.~~~~~o~.'
  \`-...-'`;

const CLOUDS = [
`   .--.
.-(    ).
(___.__)_)`,
`    _  _
  ( \`   )_
 (    )   \`)
  \`--'`,
];

const HOUSE = ` _____
|.| |.|
|=|=|=|
|=|=|=|
|_____|`;

// === scene derivation ===

type Phenomenon = 'clear' | 'partly' | 'overcast' | 'fog' | 'rain' | 'snow' | 'thunder';

function codeToPhenomenon(code: number): Phenomenon {
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95 && code <= 99) return 'thunder';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  return 'overcast';
}

function isNight(hour: number): boolean {
  return hour < 6 || hour >= 20;
}

// === buffer helpers ===

function makeBuffer(): string[][] {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(' '));
}

function stamp(buf: string[][], art: string, x0: number, y0: number) {
  const lines = art.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const y = y0 + i;
    if (y < 0 || y >= HEIGHT) continue;
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const x = x0 + j;
      if (x < 0 || x >= WIDTH) continue;
      const ch = line[j];
      if (ch !== ' ') buf[y][x] = ch;
    }
  }
}

function setCell(buf: string[][], x: number, y: number, ch: string) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  buf[y][x] = ch;
}

function toStr(buf: string[][]): string {
  return buf.map(r => r.join('')).join('\n');
}

// === per-effect state shapes ===

interface Cloud { x: number; y: number; frame: number; speed: number; }
interface Drop { x: number; y: number; vy: number; vx: number; ch: string; }
interface Star { x: number; y: number; phase: number; }
interface Bolt { segs: { x: number; y: number; ch: string }[]; age: number; }

export default function WeatherScene({ code, hour }: Props) {
  const phenomenon = codeToPhenomenon(code);
  const night = isNight(hour);

  const cloudsRef = useRef<Cloud[]>([]);
  const dropsRef = useRef<Drop[]>([]);
  const starsRef = useRef<Star[]>([]);
  const boltRef = useRef<Bolt | null>(null);
  const boltTimerRef = useRef<number>(40);
  const frameNumRef = useRef(0);
  const [frame, setFrame] = useState<string>('');

  // Initialize per-scene state when weather/night changes.
  useEffect(() => {
    let cloudCount = 0;
    if (phenomenon === 'partly') cloudCount = 2;
    else if (phenomenon === 'overcast') cloudCount = 4;
    else if (phenomenon === 'rain' || phenomenon === 'thunder' || phenomenon === 'snow') cloudCount = 3;

    cloudsRef.current = Array.from({ length: cloudCount }, (_, i) => ({
      x: ((i * 14 + Math.floor(Math.random() * 8)) % (WIDTH + 12)) - 6,
      y: Math.floor(Math.random() * 3) + (phenomenon === 'overcast' ? 0 : 1),
      frame: i % CLOUDS.length,
      speed: 1.5 + Math.random(),
    }));

    let drops: Drop[] = [];
    if (phenomenon === 'rain' || phenomenon === 'thunder') {
      const chars = ['\'', '`', '.'];
      drops = Array.from({ length: phenomenon === 'thunder' ? 35 : 28 }, () => ({
        x: Math.floor(Math.random() * WIDTH),
        y: Math.floor(Math.random() * GROUND_Y),
        vy: 1.6 + Math.random() * 0.6,
        vx: -0.15,
        ch: chars[Math.floor(Math.random() * chars.length)],
      }));
    } else if (phenomenon === 'snow') {
      const chars = ['*', '.', '+'];
      drops = Array.from({ length: 22 }, () => ({
        x: Math.floor(Math.random() * WIDTH),
        y: Math.floor(Math.random() * GROUND_Y),
        vy: 0.4 + Math.random() * 0.3,
        vx: 0,
        ch: chars[Math.floor(Math.random() * chars.length)],
      }));
    }
    dropsRef.current = drops;

    starsRef.current = night
      ? Array.from({ length: 16 }, () => ({
          x: Math.floor(Math.random() * WIDTH),
          y: Math.floor(Math.random() * (GROUND_Y - 4)),
          phase: Math.floor(Math.random() * 30),
        }))
      : [];

    boltRef.current = null;
    boltTimerRef.current = 35 + Math.floor(Math.random() * 40);
  }, [phenomenon, night]);

  // Animation loop, throttled to ~10 fps.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      frameNumRef.current += 1;
      const f = frameNumRef.current;

      const buf = makeBuffer();

      // Stars (only at night, drawn behind everything)
      for (const s of starsRef.current) {
        const c = (f + s.phase) % 30;
        const ch = c < 10 ? '.' : c < 20 ? '+' : '*';
        setCell(buf, s.x, s.y, ch);
      }

      // Celestial body — hidden when cloud cover blots it out
      const showCelestial = phenomenon !== 'overcast' && phenomenon !== 'fog' && phenomenon !== 'thunder';
      if (showCelestial) {
        if (night) {
          stamp(buf, MOON, WIDTH - 13, 1);
        } else {
          stamp(buf, SUN[(f >> 2) % 2], WIDTH - 16, 1);
        }
      }

      // Drifting clouds
      for (const cloud of cloudsRef.current) {
        cloud.x += cloud.speed * (FRAME_MS / 1000);
        if (cloud.x > WIDTH + 2) cloud.x = -11;
        stamp(buf, CLOUDS[cloud.frame], Math.round(cloud.x), cloud.y);
      }

      // Fog — horizontal bands shifting sideways
      if (phenomenon === 'fog') {
        for (let y = 2; y <= 8; y += 2) {
          const shift = (f + y * 3) % 4;
          for (let x = shift; x < WIDTH; x += 4) {
            setCell(buf, x, y, '=');
            setCell(buf, x + 1, y, '=');
          }
        }
      }

      // Precipitation
      for (const drop of dropsRef.current) {
        drop.y += drop.vy;
        drop.x += drop.vx;
        if (drop.y >= GROUND_Y) {
          drop.y = 0;
          drop.x = Math.floor(Math.random() * WIDTH);
        }
        if (drop.x < 0) drop.x = WIDTH - 1;
        setCell(buf, Math.floor(drop.x), Math.floor(drop.y), drop.ch);
      }

      // Lightning (thunderstorm only) — procedurally generated zigzag
      if (phenomenon === 'thunder') {
        boltTimerRef.current -= 1;
        if (!boltRef.current && boltTimerRef.current <= 0) {
          const startX = 6 + Math.floor(Math.random() * (WIDTH - 12));
          const segs: { x: number; y: number; ch: string }[] = [];
          let x = startX;
          for (let y = 4; y < GROUND_Y; y++) {
            const dir = Math.floor(Math.random() * 3) - 1;
            x = Math.max(1, Math.min(WIDTH - 2, x + dir));
            const ch = dir === -1 ? '/' : dir === 1 ? '\\' : '|';
            segs.push({ x, y, ch });
          }
          boltRef.current = { segs, age: 0 };
        }
        if (boltRef.current) {
          if (boltRef.current.age < 5) {
            for (const s of boltRef.current.segs) setCell(buf, s.x, s.y, s.ch);
          }
          boltRef.current.age += 1;
          if (boltRef.current.age >= 7) {
            boltRef.current = null;
            boltTimerRef.current = 25 + Math.floor(Math.random() * 40);
          }
        }
      }

      // Ground line + below-ground texture
      for (let x = 0; x < WIDTH; x++) {
        buf[GROUND_Y][x] = x % 2 === 0 ? '_' : '~';
      }
      buf[HEIGHT - 1] = Array(WIDTH).fill('^');

      // Brownstone silhouette
      stamp(buf, HOUSE, 4, GROUND_Y - 5);

      setFrame(toStr(buf));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phenomenon, night]);

  return <>{frame || ' '}</>;
}
