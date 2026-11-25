'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { showGameBoard } from '@/lib/showGameBoard';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function LimboPage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [targetMultiplier, setTargetMultiplier] = useState('2.00');
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<{ won: boolean; resultMultiplier: number; payout: number } | null>(null);
  const [animatedMultiplier, setAnimatedMultiplier] = useState(1.0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const animateMultiplier = (target: number, callback: () => void) => {
    setIsAnimating(true);
    setAnimatedMultiplier(1.0);
    const startTime = Date.now();
    const duration = Math.min(2000, 500 + target * 200);
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedMultiplier(Math.round((1 + (target - 1) * eased) * 100) / 100);
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else { setAnimatedMultiplier(target); setIsAnimating(false); callback(); }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  const handlePlay = async () => {
    if (isPlaying || isAnimating) return;
    const bet = parseFloat(betAmount);
    const target = parseFloat(targetMultiplier);
    if (!bet || bet <= 0 || !target || target < 1.01) { toast.error('Invalid bet or target'); return; }
    if (bet > (user?.balance || 0)) { toast.error('Insufficient balance'); return; }

    setIsPlaying(true);
    setResult(null);
    try {
      const res = await fetch('/api/games/limbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, targetMultiplier: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showGameBoard();
      animateMultiplier(data.resultMultiplier, () => {
        setResult(data);
        updateBalance(data.newBalance);
        if (data.won) toast.success(`Won ${data.payout.toFixed(2)} coins! 🎉`);
        else toast.error(`Crashed at ${data.resultMultiplier}x 💥`);
        setIsPlaying(false);
      });
    } catch (err: any) { toast.error(err.message); setIsPlaying(false); }
  };

  if (loading || !user) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;

  const winChance = parseFloat(targetMultiplier) > 0 ? (99 / parseFloat(targetMultiplier)).toFixed(4) : '0';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main id="main-content" className="game-page game-limbo" style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>🚀 Limbo</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Set a target multiplier. If the crash point is higher, you win!</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="game-grid-2col">
          {/* Game Display */}
          <motion.div id="game-board" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
            {result && (
              <div style={{ position: 'absolute', inset: 0, background: result.won ? 'radial-gradient(circle at center, rgba(255, 122, 26,0.1) 0%, transparent 70%)' : 'radial-gradient(circle at center, rgba(237,65,99,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            )}
            <AnimatePresence mode="wait">
              {isAnimating || result ? (
                <motion.div key="result" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div className="font-mono" style={{ fontSize: '64px', fontWeight: 800, color: !isAnimating && result ? (result.won ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-primary)', lineHeight: 1, marginBottom: '12px' }}>
                    {animatedMultiplier.toFixed(2)}x
                  </div>
                  {!isAnimating && result && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      style={{ fontSize: '18px', fontWeight: 700, color: result.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {result.won ? `+${result.payout.toFixed(2)} 🎉` : 'Busted 💥'}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚀</div>
                  <p style={{ fontSize: '16px' }}>Place your bet to launch</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bet Amount</label>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="1" className="input-dark" style={{ width: '100%', marginBottom: '8px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(Math.max(1, parseFloat(betAmount) / 2)))}>½</button>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(parseFloat(betAmount) * 2))}>2×</button>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(user.balance))}>MAX</button>
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Multiplier</label>
              <input type="number" value={targetMultiplier} onChange={(e) => setTargetMultiplier(e.target.value)} min="1.01" step="0.1" className="input-dark" />
              <div className="limbo-presets" style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {['1.5', '2', '3', '5', '10', '50', '100'].map(v => (
                  <button key={v} className="quick-btn" onClick={() => setTargetMultiplier(parseFloat(v).toFixed(2))}
                    style={{ flex: 1, padding: '6px', fontSize: '11px', ...(targetMultiplier === parseFloat(v).toFixed(2) ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)', background: 'var(--accent-green-dim)' } : {}) }}>
                    {v}×
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Win Chance</p>
                <p className="font-mono" style={{ fontSize: '16px', fontWeight: 700 }}>{winChance}%</p>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Potential Win</p>
                <p className="font-mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>
                  {(parseFloat(betAmount || '0') * parseFloat(targetMultiplier || '0')).toFixed(2)}
                </p>
              </div>
            </div>
            <button onClick={handlePlay} disabled={isPlaying || isAnimating} className="btn-primary" style={{ width: '100%' }}>
              {isPlaying || isAnimating ? <><span className="spinner" /> Launching...</> : '🚀 Launch'}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
