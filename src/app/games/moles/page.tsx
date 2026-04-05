'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function MolesPage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [moleCount, setMoleCount] = useState(2);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'round_result' | 'finished'>('setup');
  const [molePositions, setMolePositions] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(9);
  const [totalHits, setTotalHits] = useState(0);
  const [totalMoles, setTotalMoles] = useState(0);
  const [roundHits, setRoundHits] = useState(0);
  const [clickedHoles, setClickedHoles] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Time per round based on mole count
  const roundTimeLimit = moleCount === 1 ? 800 : moleCount === 2 ? 1100 : 1500; // ms per round

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const handleStart = async () => {
    if (isLoading) return;
    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) return toast.error('Invalid bet amount');
    if (bet > (user?.balance || 0)) return toast.error('Insufficient balance');

    setIsLoading(true);
    try {
      const res = await fetch('/api/games/moles/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, moleCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionId(data.sessionId);
      setMaxRounds(data.maxRounds);
      setCurrentRound(0);
      setTotalHits(0); setTotalMoles(0);
      setMolePositions(data.molePositions);
      setGamePhase('playing');
      setClickedHoles(new Set());
      setRoundHits(0);
      updateBalance(data.newBalance);
      startRoundTimer();
    } catch (err: any) { toast.error(err.message); }
    setIsLoading(false);
  };

  const startRoundTimer = useCallback(() => {
    setTimer(100);
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    const duration = roundTimeLimit;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setTimer(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 50);

    setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGamePhase('round_result');
    }, duration);
  }, [roundTimeLimit]);

  const handleHoleClick = (hole: number) => {
    if (gamePhase !== 'playing' || clickedHoles.has(hole)) return;
    const newClicked = new Set(clickedHoles);
    newClicked.add(hole);
    setClickedHoles(newClicked);
    if (molePositions.includes(hole)) {
      setRoundHits(prev => prev + 1);
    }
  };

  const submitRound = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/games/moles/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, action: 'round_complete', roundHits, roundMisses: moleCount - roundHits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.action === 'game_over') {
        setResult(data);
        setGamePhase('finished');
        updateBalance(data.newBalance);
        if (data.outcome === 'win') toast.success(`Won ${data.payout.toFixed(2)} at ${data.multiplier}x! 🎉`);
        else toast.error('Not enough hits. Lost! 💥');
      } else {
        setTotalHits(data.hits);
        setTotalMoles(data.totalMoles);
        setCurrentRound(data.currentRound);
        setMolePositions(data.molePositions);
        setClickedHoles(new Set());
        setRoundHits(0);
        setGamePhase('playing');
        startRoundTimer();
      }
    } catch (err: any) { toast.error(err.message); }
    setIsLoading(false);
  };

  useEffect(() => {
    if (gamePhase === 'round_result') {
      submitRound();
    }
  }, [gamePhase]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  if (loading || !user) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;

  const hitRate = totalMoles > 0 ? ((totalHits / totalMoles) * 100).toFixed(1) : '0';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>🔨 Moles</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Whack the moles! Higher hit rate = bigger payout.</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }} className="game-grid-2col">
          {/* Game Board */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            {/* Timer bar */}
            {gamePhase === 'playing' && (
              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-primary)', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', background: timer > 30 ? 'var(--accent-green)' : timer > 10 ? 'var(--accent-yellow)' : 'var(--accent-red)', width: `${timer}%`, transition: 'width 0.05s linear' }} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const isMole = molePositions.includes(i);
                const isClicked = clickedHoles.has(i);
                const isHit = isClicked && isMole;
                const isMiss = isClicked && !isMole;
                return (
                  <motion.button key={i} whileHover={gamePhase === 'playing' && !isClicked ? { scale: 1.08 } : {}} whileTap={gamePhase === 'playing' && !isClicked ? { scale: 0.9 } : {}}
                    onClick={() => handleHoleClick(i)} disabled={gamePhase !== 'playing' || isClicked}
                    style={{
                      aspectRatio: '1', borderRadius: '50%', fontSize: '28px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: gamePhase === 'playing' && !isClicked ? 'pointer' : 'default',
                      background: isHit ? 'var(--accent-green-dim)' : isMiss ? 'var(--accent-red-dim)' : isMole && gamePhase === 'playing' ? 'var(--accent-yellow-dim)' : 'var(--bg-tertiary)',
                      border: isHit ? '3px solid var(--accent-green)' : isMiss ? '3px solid var(--accent-red)' : isMole && gamePhase === 'playing' ? '3px solid var(--accent-yellow)' : '3px solid var(--border)',
                      transition: 'all 0.15s ease',
                    }}>
                    {isHit ? '✅' : isMiss ? '❌' : isMole && gamePhase === 'playing' ? '🦔' : '🕳️'}
                  </motion.button>
                );
              })}
            </div>
            {gamePhase === 'setup' && (
              <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '15px' }}>
                <p>Select mole count and place your bet</p>
              </div>
            )}
          </motion.div>
          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            {gamePhase === 'setup' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bet Amount</label>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="input-dark" style={{ width: '100%', marginBottom: '8px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(Math.max(1, parseFloat(betAmount) / 2)))}>½</button>
                    <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(parseFloat(betAmount) * 2))}>2×</button>
                    <button className="quick-btn" style={{ flex: 1 }} onClick={() => setBetAmount(String(user.balance))}>MAX</button>
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moles per Round ({moleCount})</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <button key={n} className="quick-btn" onClick={() => setMoleCount(n)} style={{ flex: 1, ...(moleCount === n ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)', background: 'var(--accent-green-dim)' } : {}) }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <p><strong style={{ color: 'var(--text-secondary)' }}>Payout tiers:</strong></p>
                  <p>≥90% hits → 3× | ≥70% → 2× | ≥50% → 1.5× | &lt;50% → lose</p>
                  <p style={{ marginTop: '6px' }}><strong style={{ color: 'var(--text-secondary)' }}>Time per round:</strong></p>
                  <p>1 mole → 0.8s · 2 moles → 1.1s · 3-6 moles → 1.5s</p>
                  <p style={{ marginTop: '4px' }}>Rounds: {moleCount === 1 ? 8 : 9} · Current: <span style={{ color: 'var(--accent-green)' }}>{(roundTimeLimit / 1000).toFixed(1)}s/round</span></p>
                </div>
                <button onClick={handleStart} disabled={isLoading} className="btn-primary" style={{ width: '100%' }}>
                  {isLoading ? <><span className="spinner" /> Starting...</> : '🔨 Start Game'}
                </button>
              </>
            )}
            {(gamePhase === 'playing' || gamePhase === 'round_result') && (
              <div>
                <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', marginBottom: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Round</p>
                  <p className="font-mono" style={{ fontSize: '24px', fontWeight: 800 }}>{currentRound + 1} / {maxRounds}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hits</p>
                    <p className="font-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-green)' }}>{totalHits + roundHits}</p>
                  </div>
                  <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hit Rate</p>
                    <p className="font-mono" style={{ fontSize: '18px', fontWeight: 700 }}>{hitRate}%</p>
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--accent-yellow)', textAlign: 'center' }}>🎯 Click the moles!</p>
              </div>
            )}
            {gamePhase === 'finished' && result && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>{result.outcome === 'win' ? '🎉' : '💥'}</div>
                <p className="font-mono" style={{ fontSize: '32px', fontWeight: 800, color: result.outcome === 'win' ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '8px' }}>
                  {result.outcome === 'win' ? `+${result.payout.toFixed(2)}` : 'LOST'}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Hit Rate: {result.hitRate}%</p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Multiplier: {result.multiplier}×</p>
                <button onClick={() => { setGamePhase('setup'); setResult(null); setSessionId(null); setMolePositions([]); setClickedHoles(new Set()); setTotalHits(0); setTotalMoles(0); setRoundHits(0); }} className="btn-primary" style={{ width: '100%' }}>
                  Play Again
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
