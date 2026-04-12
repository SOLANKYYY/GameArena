'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const KENO_PAYOUTS: Record<number, Record<number, number>> = {
  1:  { 0: 0, 1: 3.96 },
  2:  { 0: 0, 1: 1, 2: 9 },
  3:  { 0: 0, 1: 0, 2: 2.2, 3: 25 },
  4:  { 0: 0, 1: 0, 2: 1.5, 3: 5, 4: 80 },
  5:  { 0: 0, 1: 0, 2: 1, 3: 3, 4: 12, 5: 300 },
  6:  { 0: 0, 1: 0, 2: 0, 3: 2, 4: 8, 5: 50, 6: 1000 },
  7:  { 0: 0, 1: 0, 2: 0, 3: 1.5, 4: 4, 5: 20, 6: 200, 7: 4000 },
  8:  { 0: 0, 1: 0, 2: 0, 3: 1, 4: 3, 5: 10, 6: 75, 7: 500, 8: 10000 },
  9:  { 0: 0, 1: 0, 2: 0, 3: 0, 4: 2, 5: 5, 6: 30, 7: 200, 8: 2000, 9: 25000 },
  10: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1.5, 5: 3, 6: 15, 7: 80, 8: 500, 9: 5000, 10: 100000 },
};

export default function KenoPage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [picks, setPicks] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [revealedNumbers, setRevealedNumbers] = useState<number[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const togglePick = (num: number) => {
    if (isPlaying || isRevealing) return;
    if (picks.includes(num)) {
      setPicks(picks.filter(p => p !== num));
    } else if (picks.length < 10) {
      setPicks([...picks, num]);
    } else {
      toast.error('Maximum 10 picks');
    }
  };

  const handlePlay = async () => {
    if (isPlaying || isRevealing) return;
    if (picks.length === 0) return toast.error('Pick at least 1 number');
    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) return toast.error('Invalid bet');
    if (bet > (user?.balance || 0)) return toast.error('Insufficient balance');

    setIsPlaying(true); setResult(null); setRevealedNumbers([]);
    try {
      const res = await fetch('/api/games/keno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, picks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Animate number reveal one at a time
      setIsRevealing(true);
      const drawnNumbers = data.drawnNumbers;
      for (let i = 0; i < drawnNumbers.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        setRevealedNumbers(prev => [...prev, drawnNumbers[i]]);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      setResult(data);
      setIsRevealing(false);
      setIsPlaying(false);
      updateBalance(data.newBalance);
      if (data.won) toast.success(`${data.matchCount} matches! Won ${data.payout.toFixed(2)} at ${data.multiplier}x! 🎯`);
      else toast.error(`${data.matchCount} matches — not enough to win`);
    } catch (err: any) { toast.error(err.message); setIsPlaying(false); setIsRevealing(false); }
  };

  const clearAll = () => { if (!isPlaying && !isRevealing) { setPicks([]); setResult(null); setRevealedNumbers([]); } };

  const randomPick = () => {
    if (isPlaying || isRevealing) return;
    const count = Math.max(1, Math.min(10 - picks.length, 5));
    const available = Array.from({ length: 40 }, (_, i) => i + 1).filter(n => !picks.includes(n));
    const newPicks = [...picks];
    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      newPicks.push(available[idx]);
      available.splice(idx, 1);
    }
    setPicks(newPicks);
  };

  if (loading || !user) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;

  const payoutTable = picks.length > 0 ? (KENO_PAYOUTS[picks.length] || {}) : {};

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>🎯 Keno</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Pick up to 10 numbers. Match the draws to win!</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }} className="game-grid-2col">
          {/* Number Grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', marginBottom: '16px' }}>
              {Array.from({ length: 40 }, (_, i) => i + 1).map(num => {
                const isPicked = picks.includes(num);
                const isRevealed = revealedNumbers.includes(num);
                const isMatch = isPicked && isRevealed;
                const isDrawnOnly = isRevealed && !isPicked;
                let bg = 'var(--bg-tertiary)';
                let border = '2px solid var(--border)';
                let color = 'var(--text-primary)';
                if (isMatch) { bg = 'var(--accent-green-dim)'; border = '2px solid var(--accent-green)'; color = 'var(--accent-green)'; }
                else if (isDrawnOnly) { bg = 'var(--accent-red-dim)'; border = '2px solid var(--accent-red)'; color = 'var(--accent-red)'; }
                else if (isPicked) { bg = 'var(--accent-blue-dim)'; border = '2px solid var(--accent-blue)'; color = 'var(--accent-blue)'; }
                return (
                  <motion.button key={num} whileHover={!isPlaying && !isRevealing ? { scale: 1.08 } : {}} whileTap={!isPlaying && !isRevealing ? { scale: 0.95 } : {}}
                    onClick={() => togglePick(num)}
                    style={{
                      aspectRatio: '1', borderRadius: '8px', border, background: bg, color, cursor: isPlaying ? 'default' : 'pointer',
                      fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.15s ease',
                      boxShadow: isMatch ? '0 0 12px rgba(0,231,1,0.3)' : 'none',
                    }}>
                    {num}
                  </motion.button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary btn-sm" onClick={clearAll} style={{ flex: 1 }}>Clear All</button>
              <button className="btn-secondary btn-sm" onClick={randomPick} style={{ flex: 1 }}>Random +5</button>
            </div>
            {/* Result display */}
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: result.won ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', textAlign: 'center' }}>
                <p className="font-mono" style={{ fontSize: '28px', fontWeight: 800, color: result.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {result.matchCount} match{result.matchCount !== 1 ? 'es' : ''} → {result.multiplier}×
                </p>
                <p style={{ fontSize: '16px', fontWeight: 600, color: result.won ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: '4px' }}>
                  {result.won ? `+${result.payout.toFixed(2)}` : 'No payout'}
                </p>
              </motion.div>
            )}
          </motion.div>
          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Picks: {picks.length}/10
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '36px' }}>
                {picks.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click numbers to pick</span>
                ) : [...picks].sort((a, b) => a - b).map(p => (
                  <span key={p} className="font-mono" style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 700 }}>{p}</span>
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
            {/* Payout table */}
            {picks.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payout Table</label>
                <div style={{ background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-input)', padding: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                  {Object.entries(payoutTable).map(([matches, mult]) => (
                    <div key={matches} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{matches} hits</span>
                      <span className="font-mono" style={{ fontWeight: 700, color: (mult as number) > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>{String(mult)}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={handlePlay} disabled={isPlaying || isRevealing || picks.length === 0} className="btn-primary" style={{ width: '100%' }}>
              {isPlaying || isRevealing ? <><span className="spinner" /> Drawing...</> : '🎯 Draw Numbers'}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
