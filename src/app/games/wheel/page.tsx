'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const SEGMENT_COLORS: Record<string, string[]> = {
  low: ['#00e701', '#1a9e1a', '#115511', '#1a9e1a', '#333', '#1a9e1a', '#115511', '#1a9e1a', '#00e701', '#333'],
  medium: ['#333', '#4dabf7', '#333', '#1a9e1a', '#333', '#fbbf24', '#333', '#1a9e1a', '#333', '#c084fc'],
  high: ['#333', '#333', '#333', '#333', '#333', '#333', '#333', '#333', '#333', '#fbbf24'],
};

export default function WheelPage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [segments, setSegments] = useState(10);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [payouts, setPayouts] = useState<number[]>([]);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  // Draw wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;

    ctx.clearRect(0, 0, size, size);
    const anglePerSegment = (2 * Math.PI) / segments;
    const colors = ['#00e701', '#1a9e1a', '#115511', '#4dabf7', '#c084fc', '#fbbf24', '#fb923c', '#22d3ee', '#f472b6', '#333'];

    for (let i = 0; i < segments; i++) {
      const start = i * anglePerSegment - Math.PI / 2;
      const end = start + anglePerSegment;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();

      const payout = payouts[i] ?? 0;
      let color;
      if (payout >= 5) color = '#fbbf24';
      else if (payout >= 2) color = '#00e701';
      else if (payout >= 1) color = '#1a9e1a';
      else if (payout > 0) color = '#115511';
      else color = '#1a2c38';

      if (result && !isSpinning && result.segmentIndex === i) {
        color = result.won ? '#00ff44' : '#ff4444';
      }

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f1923';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (segments <= 20) {
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(start + anglePerSegment / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = payout > 0 ? '#fff' : '#557086';
        ctx.font = `bold ${segments <= 10 ? 13 : 10}px JetBrains Mono, monospace`;
        ctx.fillText(`${payout}×`, radius * 0.7, 4);
        ctx.restore();
      }
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#0f1923';
    ctx.fill();
    ctx.strokeStyle = 'var(--border)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [segments, risk, payouts, result, isSpinning]);

  // Update payouts when config changes
  useEffect(() => {
    const WHEEL_PAYOUTS: Record<string, Record<string, number[]>> = {
      '10': { low: [1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0], medium: [0,1.9,0,1.5,0,2,0,1.5,0,3], high: [0,0,0,0,0,0,0,0,0,9.9] },
      '20': { low: [1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0], medium: [1.5,0,2,0,2,0,2,0,1.5,0,3,0,1.8,0,2,0,2,0,2,0], high: [...Array(19).fill(0),19.8] },
      '30': { low: [1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0], medium: [1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.7,0,4,0,1.5,0,2,0], high: [...Array(29).fill(0),29.7] },
      '40': { low: [1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0], medium: [2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.6,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0], high: [...Array(39).fill(0),39.6] },
      '50': { low: [1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0,1.5,1.2,1.2,1.2,0,1.2,1.2,1.2,1.2,0], medium: [2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,5,0,1.5,0,2,0,1.5,0], high: [...Array(49).fill(0),49.5] },
    };
    setPayouts(WHEEL_PAYOUTS[String(segments)]?.[risk] || []);
  }, [segments, risk]);

  const handleSpin = async () => {
    if (isSpinning) return;
    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) return toast.error('Invalid bet amount');
    if (bet > (user?.balance || 0)) return toast.error('Insufficient balance');

    setIsSpinning(true); setResult(null);
    try {
      const res = await fetch('/api/games/wheel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, segments, risk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const segAngle = 360 / segments;
      // The pointer is at 12 o'clock (top). Canvas segment 0 starts at 12 o'clock.
      // To land segmentIndex under the pointer, we rotate so that segment's center aligns with top.
      // Segment center angle (from top, clockwise) = segmentIndex * segAngle + segAngle / 2
      // We need to rotate the wheel by -(that angle) mod 360, i.e. 360 - that angle
      const segmentCenterAngle = data.segmentIndex * segAngle + segAngle / 2;
      const targetAngle = 360 - segmentCenterAngle; // where the wheel must stop (mod 360)
      const spins = 5 + Math.floor(Math.random() * 3); // full rotations for effect
      // Calculate absolute final rotation: enough full spins + exact target offset
      const currentNormalized = rotation % 360;
      const delta = targetAngle - currentNormalized;
      // Add full spins and adjust so we always spin forward
      const totalRotation = rotation + spins * 360 + ((delta % 360) + 360) % 360;
      setRotation(totalRotation);

      setTimeout(() => {
        setResult(data);
        setIsSpinning(false);
        updateBalance(data.newBalance);
        if (data.won) toast.success(`Won ${data.payout.toFixed(2)} at ${data.multiplier}x! 🎡`);
        else toast.error('No payout this spin 💨');
      }, 4000);
    } catch (err: any) { toast.error(err.message); setIsSpinning(false); }
  };

  if (loading || !user) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>🎡 Wheel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Spin the wheel and land on a multiplier!</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }} className="game-grid-2col">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Pointer */}
            <div style={{ position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '18px solid var(--accent-green)', filter: 'drop-shadow(0 0 6px rgba(0,231,1,0.4))' }} />
            <div style={{ transform: `rotate(${rotation}deg)`, transition: isSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none' }}>
              <canvas ref={canvasRef} width={320} height={320} style={{ borderRadius: '50%' }} />
            </div>
            {result && !isSpinning && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '20px', textAlign: 'center' }}>
                <p className="font-mono" style={{ fontSize: '32px', fontWeight: 800, color: result.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {result.multiplier}×
                </p>
                <p style={{ color: result.won ? 'var(--accent-green)' : 'var(--text-muted)', fontSize: '16px', fontWeight: 600 }}>
                  {result.won ? `+${result.payout.toFixed(2)}` : 'No payout'}
                </p>
              </motion.div>
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Segments</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[10, 20, 30, 40, 50].map(s => (
                  <button key={s} className="quick-btn" onClick={() => setSegments(s)} style={{ flex: 1, fontSize: '12px', ...(segments === s ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)', background: 'var(--accent-green-dim)' } : {}) }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Level</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['low', 'medium', 'high'] as const).map(r => (
                  <button key={r} className={risk === r ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setRisk(r)} style={{ flex: 1, textTransform: 'capitalize', fontSize: '13px' }}>{r}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bet Amount</label>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="input-dark" style={{ width: '100%', marginBottom: '8px' }} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(Math.max(1, parseFloat(betAmount) / 2)))}>½</button>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(parseFloat(betAmount) * 2))}>2×</button>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(user.balance))}>MAX</button>
              </div>
            </div>
            <button onClick={handleSpin} disabled={isSpinning} className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              {isSpinning ? <><span className="spinner" /> Spinning...</> : '🎡 Spin Wheel'}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
