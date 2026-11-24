'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const MULTIPLIER_TABLES: Record<string, Record<string, number[]>> = {
  '8':  { low: [5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6], medium: [13,3,1.3,0.7,0.4,0.7,1.3,3,13], high: [29,4,1.5,0.3,0.2,0.3,1.5,4,29] },
  '9':  { low: [5.6,2,1.6,1,0.7,0.7,1,1.6,2,5.6], medium: [18,4,1.7,0.9,0.5,0.5,0.9,1.7,4,18], high: [43,7,2,0.6,0.2,0.2,0.6,2,7,43] },
  '10': { low: [8.9,3,1.4,1.1,1,0.5,1,1.1,1.4,3,8.9], medium: [22,5,2,1.4,0.6,0.4,0.6,1.4,2,5,22], high: [76,10,3,0.9,0.3,0.2,0.3,0.9,3,10,76] },
  '11': { low: [8.4,3,1.9,1.3,1,0.7,0.7,1,1.3,1.9,3,8.4], medium: [24,6,3,1.8,0.7,0.5,0.5,0.7,1.8,3,6,24], high: [120,14,5.2,1.4,0.4,0.2,0.2,0.4,1.4,5.2,14,120] },
  '12': { low: [10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10], medium: [33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33], high: [170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170] },
  '13': { low: [8.4,3,1.9,1.3,1.1,1,0.7,0.7,1,1.1,1.3,1.9,3,8.4], medium: [43,13,6,3,1.3,0.7,0.4,0.4,0.7,1.3,3,6,13,43], high: [284,37,11,4,1,0.2,0.2,0.2,0.2,1,4,11,37,284] },
  '14': { low: [7.1,4,1.9,1.4,1.3,1.1,1,0.5,1,1.1,1.3,1.4,1.9,4,7.1], medium: [58,15,7,4,1.9,1,0.5,0.2,0.5,1,1.9,4,7,15,58], high: [420,56,18,5,1.9,0.3,0.2,0.2,0.2,0.3,1.9,5,18,56,420] },
  '15': { low: [15,8,3,2,1.5,1.1,1,0.7,0.7,1,1.1,1.5,2,3,8,15], medium: [88,18,11,5,3,1.3,0.5,0.3,0.3,0.5,1.3,3,5,11,18,88], high: [620,83,27,8,3,0.5,0.2,0.2,0.2,0.2,0.5,3,8,27,83,620] },
  '16': { low: [16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16], medium: [110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110], high: [1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000] },
};

// ── Smooth easing functions ──
function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  else if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  else if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  else return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Interpolate with a slight arc (ball falls with gravity curve)
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface TrailParticle {
  x: number;
  y: number;
  alpha: number;
  radius: number;
}

export default function PlinkoPage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [pins, setPins] = useState(12);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [isDropping, setIsDropping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation state refs (avoid React re-renders during animation)
  const animRef = useRef<number | null>(null);
  const ballRef = useRef<{ x: number; y: number } | null>(null);
  const trailRef = useRef<TrailParticle[]>([]);
  const hitBucketRef = useRef<number | null>(null);
  const hitFlashRef = useRef(0);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const multipliers = MULTIPLIER_TABLES[String(pins)]?.[risk] || [];

  // ── High-DPI canvas setup ──
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }, []);

  // ── Main render function (called every frame) ──
  const renderBoard = useCallback((
    highlightBucket: number | null = null,
    flashIntensity: number = 0
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.getBoundingClientRect().width;
    const H = canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, W, H);

    const rowSpacing = (H - 70) / (pins + 1);
    const pinSpacing = Math.min(24, (W - 60) / (pins + 2));
    const pinRadius = 3.5;

    // ── Draw pins with subtle glow ──
    for (let row = 0; row < pins; row++) {
      const y = 45 + (row + 1) * rowSpacing;
      const numPins = row + 3;
      const startX = W / 2 - ((numPins - 1) * pinSpacing) / 2;
      for (let col = 0; col < numPins; col++) {
        const x = startX + col * pinSpacing;
        // Subtle glow
        ctx.beginPath();
        ctx.arc(x, y, pinRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(85, 112, 134, 0.15)';
        ctx.fill();
        // Pin body
        ctx.beginPath();
        ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, pinRadius);
        grad.addColorStop(0, '#8aa3b5');
        grad.addColorStop(1, '#445566');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // ── Draw multiplier buckets ──
    const numBuckets = pins + 1;
    const bucketW = (W - 20) / numBuckets;
    const bucketY = H - 38;
    const currentMultipliers = MULTIPLIER_TABLES[String(pins)]?.[risk] || [];

    for (let i = 0; i < numBuckets; i++) {
      const bx = 10 + i * bucketW;
      const m = currentMultipliers[i] || 0;

      // Color based on multiplier value
      let baseColor: [number, number, number];
      if (m >= 10)      baseColor = [251, 191, 36];  // gold
      else if (m >= 3)  baseColor = [255, 122, 26];     // green
      else if (m >= 1)  baseColor = [34, 180, 85];    // dark green
      else              baseColor = [20, 60, 40];     // dim

      // Flash the winning bucket
      let alpha = 0.85;
      if (highlightBucket === i && flashIntensity > 0) {
        alpha = 1;
        baseColor = [255, 163, 71]; // bright green flash
        // glow effect
        ctx.save();
        ctx.shadowColor = `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]}, ${flashIntensity * 0.6})`;
        ctx.shadowBlur = 20 * flashIntensity;
        ctx.fillStyle = `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(bx + 2, bucketY, bucketW - 4, 30, 4);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(bx + 2, bucketY, bucketW - 4, 30, 4);
        ctx.fill();
      }

      // Multiplier text
      ctx.fillStyle = m >= 1 ? '#fff' : '#6a8399';
      ctx.font = `bold ${Math.min(11, bucketW * 0.4)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${m}×`, bx + bucketW / 2, bucketY + 15);
    }

    // ── Draw ball trail ──
    const trail = trailRef.current;
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      if (p.alpha <= 0) { trail.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha * 0.5})`;
      ctx.fill();
      p.alpha -= 0.035;
      p.radius *= 0.97;
    }

    // ── Draw ball ──
    const ball = ballRef.current;
    if (ball) {
      // Outer glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.15)';
      ctx.fill();

      // Inner glow
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
      ctx.fill();

      // Ball body with gradient
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
      const ballGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, 7);
      ballGrad.addColorStop(0, '#ffcb8e');
      ballGrad.addColorStop(0.5, '#fb923c');
      ballGrad.addColorStop(1, '#c2410c');
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Specular highlight
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
      ctx.restore();
    }
  }, [pins, risk]);

  // ── Initial board render ──
  useEffect(() => {
    const setup = () => {
      setupCanvas();
      renderBoard(hitBucketRef.current, hitFlashRef.current);
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, [pins, risk, setupCanvas, renderBoard]);

  // ── Smooth animation loop using requestAnimationFrame ──
  const animateBall = useCallback((
    path: { x: number; y: number }[],
    data: any,
  ) => {
    const SEGMENT_DURATION = 80; // ms per segment (= speed of ball)
    const totalDuration = path.length * SEGMENT_DURATION;
    const startTime = performance.now();
    trailRef.current = [];
    ballRef.current = path[0];

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      // Find which segment we're in
      const totalSegments = path.length - 1;
      const rawSegment = progress * totalSegments;
      const segIndex = Math.min(Math.floor(rawSegment), totalSegments - 1);
      const segProgress = rawSegment - segIndex;

      // Easing per segment: ease-out for falling, slight bounce at each pin
      const easedT = easeInOutCubic(segProgress);

      const from = path[segIndex];
      const to = path[segIndex + 1];

      // Interpolated position with slight arc
      const x = lerp(from.x, to.x, easedT);
      // Add a gravity arc: ball dips slightly in the middle of each segment  
      const arcHeight = Math.abs(to.x - from.x) * 0.15;
      const arc = Math.sin(easedT * Math.PI) * arcHeight;
      const y = lerp(from.y, to.y, easedT) + arc * (1 - easedT);

      ballRef.current = { x, y };

      // Add trail particles periodically
      if (elapsed % 16 < 17) { // ~60fps trail spawn
        trailRef.current.push({
          x: x + (Math.random() - 0.5) * 3,
          y: y + (Math.random() - 0.5) * 3,
          alpha: 0.6,
          radius: 3 + Math.random() * 2,
        });
        // Cap trail length
        if (trailRef.current.length > 40) trailRef.current.shift();
      }

      // Render frame
      if (progress >= 1) {
        // Landing flash - animate the bucket glow
        hitBucketRef.current = data.bucketIndex;
        let flashStart = performance.now();
        const flashDuration = 600;

        const flashLoop = (fNow: number) => {
          const fElapsed = fNow - flashStart;
          const fProgress = Math.min(fElapsed / flashDuration, 1);
          const intensity = 1 - fProgress; // fade out
          hitFlashRef.current = intensity;
          renderBoard(data.bucketIndex, intensity);

          if (fProgress < 1) {
            animRef.current = requestAnimationFrame(flashLoop);
          } else {
            hitBucketRef.current = null;
            hitFlashRef.current = 0;
            ballRef.current = null;
            trailRef.current = [];
            renderBoard();
            // Done!
            setResult(data);
            setIsDropping(false);
            updateBalance(data.newBalance);
            if (data.won) toast.success(`Won ${data.payout.toFixed(2)} at ${data.multiplier}× 📍`);
            else toast.error(`${data.multiplier}× — No profit 💨`);
          }
        };
        animRef.current = requestAnimationFrame(flashLoop);
      } else {
        renderBoard();
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  }, [renderBoard, updateBalance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // ── Handle drop ──
  const handleDrop = async () => {
    if (isDropping) return;
    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) return toast.error('Invalid bet');
    if (bet > (user?.balance || 0)) return toast.error('Insufficient balance');

    setIsDropping(true);
    setResult(null);
    ballRef.current = null;
    trailRef.current = [];
    hitBucketRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    try {
      const res = await fetch('/api/games/plinko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, pins, risk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Build ball path waypoints
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const rowSpacing = (H - 70) / (pins + 1);
      const pinSpacing = Math.min(24, (W - 60) / (pins + 2));

      const path: { x: number; y: number }[] = [{ x: W / 2, y: 20 }];
      let xPos = W / 2;

      for (let i = 0; i < pins; i++) {
        const dir = data.path[i] === 'right' ? 1 : -1;
        xPos += dir * (pinSpacing / 2);
        path.push({ x: xPos, y: 45 + (i + 1) * rowSpacing });
      }

      // Final position: center of the landing bucket
      const bucketW = (W - 20) / (pins + 1);
      const bucketCenterX = 10 + data.bucketIndex * bucketW + bucketW / 2;
      path.push({ x: bucketCenterX, y: H - 23 });

      animateBall(path, data);
    } catch (err: any) {
      toast.error(err.message);
      setIsDropping(false);
    }
  };

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-light" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>📍 Plinko</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
            Drop a ball and watch it bounce to a multiplier!
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }} className="game-grid-2col">
          {/* ── Canvas Board ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                maxWidth: '460px',
                height: '500px',
                borderRadius: '12px',
              }}
            />
            {result && !isDropping && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ marginTop: '16px', textAlign: 'center' }}
              >
                <p className="font-mono" style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: result.multiplier >= 1 ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {result.multiplier}× → {result.multiplier >= 1 ? `+${result.payout.toFixed(2)}` : `${result.payout.toFixed(2)}`}
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* ── Controls Panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
            }}
          >
            {/* Pins slider */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Rows ({pins})
              </label>
              <input
                type="range" min="8" max="16" value={pins}
                onChange={(e) => setPins(parseInt(e.target.value))}
                disabled={isDropping}
                style={{ width: '100%', accentColor: 'var(--accent-green)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>8</span><span>12</span><span>16</span>
              </div>
            </div>

            {/* Risk selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Risk
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['low', 'medium', 'high'] as const).map(r => (
                  <button
                    key={r}
                    className={risk === r ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                    onClick={() => setRisk(r)}
                    disabled={isDropping}
                    style={{ flex: 1, textTransform: 'capitalize', fontSize: '13px' }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Bet amount */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bet Amount
              </label>
              <input
                type="number" value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isDropping}
                className="input-dark" style={{ width: '100%', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="quick-btn" style={{ flex: 1 }} disabled={isDropping} onClick={() => setBetAmount(String(Math.max(1, parseFloat(betAmount) / 2)))}>½</button>
                <button className="quick-btn" style={{ flex: 1 }} disabled={isDropping} onClick={() => setBetAmount(String(parseFloat(betAmount) * 2))}>2×</button>
                <button className="quick-btn" style={{ flex: 1 }} disabled={isDropping} onClick={() => setBetAmount(String(user.balance))}>MAX</button>
              </div>
            </div>

            {/* Drop button */}
            <button onClick={handleDrop} disabled={isDropping} className="btn-primary" style={{ width: '100%' }}>
              {isDropping ? <><span className="spinner" /> Dropping...</> : '📍 Drop Ball'}
            </button>

            {/* Multiplier preview */}
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Multipliers
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {multipliers.map((m, i) => (
                  <span
                    key={i}
                    className="font-mono"
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 4px',
                      borderRadius: '4px',
                      background: m >= 10 ? 'rgba(251,191,36,0.15)' : m >= 3 ? 'rgba(255, 122, 26,0.1)' : 'rgba(255,255,255,0.04)',
                      color: m >= 10 ? '#fbbf24' : m >= 3 ? '#ff7a1a' : '#557086',
                    }}
                  >
                    {m}×
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
