'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function DicePage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [target, setTarget] = useState(50);
  const [condition, setCondition] = useState<'over' | 'under'>('over');
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rollAnimation, setRollAnimation] = useState<number | null>(null);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const winChance = condition === 'over' ? 100 - target : target;
  const multiplier = winChance > 0 ? Math.round((99 / winChance) * 10000) / 10000 : 0;

  const handlePlay = async () => {
    if (isPlaying) return;
    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) return toast.error('Invalid bet amount');
    if (bet > (user?.balance || 0)) return toast.error('Insufficient balance');

    setIsPlaying(true);
    setResult(null);
    try {
      const res = await fetch('/api/games/dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, target, condition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let count = 0;
      const interval = setInterval(() => {
        setRollAnimation(Math.round(Math.random() * 10000) / 100);
        count++;
        if (count > 15) {
          clearInterval(interval);
          setRollAnimation(null);
          setResult(data);
          updateBalance(data.newBalance);
          if (data.won) toast.success(`Won ${data.payout.toFixed(2)} coins! 🎲`);
          else toast.error(`Rolled ${data.roll.toFixed(2)} — Lost! 💥`);
          setIsPlaying(false);
        }
      }, 80);
    } catch (err: any) { toast.error(err.message); setIsPlaying(false); }
  };

  if (loading || !user) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>🎲 Dice</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Roll {condition} {target.toFixed(2)} to win!</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="game-grid-2col">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '340px' }}>
            <AnimatePresence mode="wait">
              {rollAnimation !== null ? (
                <motion.div key="rolling" style={{ textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: '56px', fontWeight: 800, color: 'var(--text-primary)' }}>{rollAnimation.toFixed(2)}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Rolling...</p>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center' }}>
                  <div className="font-mono" style={{ fontSize: '56px', fontWeight: 800, color: result.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>{result.roll.toFixed(2)}</div>
                  <p style={{ fontSize: '18px', fontWeight: 700, marginTop: '8px', color: result.won ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {result.won ? `+${result.payout.toFixed(2)} 🎉` : 'Lost 💥'}
                  </p>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎲</div><p>Set your target and roll</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ width: '100%', marginTop: '32px' }}>
              <div style={{ position: 'relative', height: '8px', borderRadius: '4px', background: 'var(--bg-primary)', marginBottom: '8px' }}>
                <div style={{ position: 'absolute', left: condition === 'over' ? `${target}%` : '0', right: condition === 'over' ? '0' : `${100 - target}%`, top: 0, bottom: 0, borderRadius: '4px', background: 'var(--accent-green)', opacity: 0.4 }} />
                {result && <div style={{ position: 'absolute', left: `${result.roll}%`, top: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: result.won ? 'var(--accent-green)' : 'var(--accent-red)', transform: 'translateX(-50%)', boxShadow: result.won ? '0 0 12px rgba(255, 122, 26,0.5)' : '0 0 12px rgba(237,65,99,0.5)' }} />}
              </div>
              <input type="range" min="1" max="99" step="1" value={target} onChange={(e) => setTarget(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-green)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['over', 'under'] as const).map(c => (
                  <button key={c} onClick={() => setCondition(c)} className={condition === c ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ flex: 1, textTransform: 'capitalize' }}>
                    Roll {c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target ({target.toFixed(2)})</label>
              <input type="number" value={target} onChange={(e) => setTarget(Math.max(1, Math.min(99, parseInt(e.target.value) || 50)))} className="input-dark" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bet Amount</label>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="1" className="input-dark" style={{ width: '100%', marginBottom: '8px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(Math.max(1, parseFloat(betAmount) / 2)))}>½</button>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(parseFloat(betAmount) * 2))}>2×</button>
                <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(user.balance))}>MAX</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Multiplier</p>
                <p className="font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-green)' }}>{multiplier.toFixed(4)}×</p>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Win Chance</p>
                <p className="font-mono" style={{ fontSize: '15px', fontWeight: 700 }}>{winChance.toFixed(0)}%</p>
              </div>
              <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Payout</p>
                <p className="font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-green)' }}>{(parseFloat(betAmount || '0') * multiplier).toFixed(2)}</p>
              </div>
            </div>
            <button onClick={handlePlay} disabled={isPlaying} className="btn-primary" style={{ width: '100%' }}>
              {isPlaying ? <><span className="spinner" /> Rolling...</> : '🎲 Roll Dice'}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
