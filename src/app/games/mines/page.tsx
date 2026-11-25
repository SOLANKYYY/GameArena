'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { showGameBoard } from '@/lib/showGameBoard';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function MinesPage() {
  const { user, token, loading, updateBalance } = useAuth();
  const router = useRouter();
  const [betAmount, setBetAmount] = useState('10');
  const [numMines, setNumMines] = useState(3);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [grid, setGrid] = useState<Array<'hidden' | 'gem' | 'mine'>>(Array(25).fill('hidden'));
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  const handleStart = async () => {
    if (isPlaying) return;
    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) return toast.error('Invalid bet amount');
    if (bet > (user?.balance || 0)) return toast.error('Insufficient balance');

    setIsPlaying(true); setGameOver(false);
    setGrid(Array(25).fill('hidden')); setMinePositions([]);
    setCurrentMultiplier(1.0); setPotentialPayout(0);

    try {
      const res = await fetch('/api/games/mines/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betAmount: bet, numMines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showGameBoard();
      setSessionId(data.sessionId);
      updateBalance(data.newBalance);
    } catch (err: any) { toast.error(err.message); setIsPlaying(false); }
  };

  const handleReveal = async (position: number) => {
    if (!sessionId || isRevealing || gameOver || grid[position] !== 'hidden') return;
    setIsRevealing(true);
    try {
      const res = await fetch('/api/games/mines/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, position }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newGrid = [...grid];
      if (data.isMine) {
        newGrid[position] = 'mine';
        data.minePositions.forEach((p: number) => { if (p !== position) newGrid[p] = 'mine'; });
        for (let i = 0; i < 25; i++) if (newGrid[i] === 'hidden') newGrid[i] = 'gem';
        setGrid(newGrid); setMinePositions(data.minePositions);
        setGameOver(true); setIsPlaying(false);
        updateBalance(data.newBalance);
        toast.error('💥 Boom! You hit a mine!');
      } else {
        newGrid[position] = 'gem';
        setGrid(newGrid);
        setCurrentMultiplier(data.currentMultiplier);
        setPotentialPayout(data.potentialPayout);
        updateBalance(data.newBalance);
      }
    } catch (err: any) { toast.error(err.message); }
    setIsRevealing(false);
  };

  const handleCashout = async () => {
    if (!sessionId || !isPlaying) return;
    try {
      const res = await fetch('/api/games/mines/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newGrid = [...grid];
      data.minePositions.forEach((p: number) => { newGrid[p] = 'mine'; });
      for (let i = 0; i < 25; i++) if (newGrid[i] === 'hidden') newGrid[i] = 'gem';
      setGrid(newGrid); setMinePositions(data.minePositions);
      setGameOver(true); setIsPlaying(false);
      updateBalance(data.newBalance);
      toast.success(`Cashed out ${data.payout.toFixed(2)} at ${data.multiplier.toFixed(2)}x! 🎉`);
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading || !user) return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main id="main-content" className="game-page game-mines" style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>💎 Mines</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Reveal gems, avoid mines. Cash out anytime!</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }} className="game-grid-2col">
          {/* Grid */}
          <motion.div id="game-board" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', maxWidth: '400px', margin: '0 auto' }}>
              {grid.map((cell, i) => (
                <motion.button key={i} whileHover={cell === 'hidden' && isPlaying && !gameOver ? { scale: 1.05 } : {}} whileTap={cell === 'hidden' && isPlaying && !gameOver ? { scale: 0.95 } : {}}
                  aria-label={`Tile ${i + 1}, ${cell}`} onClick={() => handleReveal(i)} disabled={cell !== 'hidden' || !isPlaying || gameOver}
                  style={{
                    aspectRatio: '1', borderRadius: '10px', cursor: cell === 'hidden' && isPlaying ? 'pointer' : 'default',
                    fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    background: cell === 'gem' ? 'var(--accent-green-dim)' : cell === 'mine' ? 'var(--accent-red-dim)' : 'var(--bg-tertiary)',
                    border: cell === 'gem' ? '2px solid var(--accent-green)' : cell === 'mine' ? '2px solid var(--accent-red)' : '2px solid var(--border)',
                  }}>
                  {cell === 'gem' ? '💎' : cell === 'mine' ? '💣' : isPlaying ? '❓' : ''}
                </motion.button>
              ))}
            </div>
          </motion.div>
          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            {!isPlaying && !gameOver ? (
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mines ({numMines})</label>
                  <input type="range" min="1" max="24" value={numMines} onChange={(e) => setNumMines(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-green)' }} />
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[1, 3, 5, 10, 24].map(n => (
                      <button key={n} className="quick-btn" onClick={() => setNumMines(n)} style={{ fontSize: '11px', padding: '4px 10px', ...(numMines === n ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)' } : {}) }}>{n}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleStart} className="btn-primary" style={{ width: '100%' }}>💎 Start Game</button>
              </>
            ) : (
              <>
                {isPlaying && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Current Multiplier</p>
                      <p className="font-mono" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-green)' }}>{currentMultiplier.toFixed(2)}×</p>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', textAlign: 'center', marginBottom: '16px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Potential Payout</p>
                      <p className="font-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green)' }}>{potentialPayout.toFixed(2)}</p>
                    </div>
                    <button onClick={handleCashout} className="btn-primary" style={{ width: '100%', fontSize: '16px' }} disabled={currentMultiplier <= 1.0}>
                      💰 Cash Out {potentialPayout.toFixed(2)}
                    </button>
                  </div>
                )}
                {gameOver && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Game Over</p>
                    <button onClick={() => { setGameOver(false); setGrid(Array(25).fill('hidden')); setSessionId(null); }} className="btn-primary" style={{ width: '100%' }}>
                      New Game
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
