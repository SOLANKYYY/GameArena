'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';
import RulesModal from '@/components/RulesModal';

const games = [
  { id: 'limbo', name: 'Limbo', icon: '🚀', description: 'Set a target multiplier and watch the crash point soar.', accent: '#4dabf7', accentDim: 'rgba(77,171,247,0.12)' },
  { id: 'dice', name: 'Dice', icon: '🎲', description: 'Roll over or under your target number to win.', accent: '#c084fc', accentDim: 'rgba(192,132,252,0.12)' },
  { id: 'mines', name: 'Mines', icon: '💎', description: 'Reveal gems and avoid mines. Cash out anytime.', accent: '#22d3ee', accentDim: 'rgba(34,211,238,0.12)' },
  { id: 'moles', name: 'Moles', icon: '🔨', description: 'Whack moles across rounds for big multipliers.', accent: '#fb923c', accentDim: 'rgba(251,146,60,0.12)' },
  { id: 'wheel', name: 'Wheel', icon: '🎡', description: 'Spin the fortune wheel and land on a payout.', accent: '#f472b6', accentDim: 'rgba(244,114,182,0.12)' },
  { id: 'plinko', name: 'Plinko', icon: '📍', description: 'Drop a ball through the pin board to winnings.', accent: '#ed4163', accentDim: 'rgba(237,65,99,0.12)' },
  { id: 'keno', name: 'Keno', icon: '🎯', description: 'Pick your lucky numbers and match the draw.', accent: '#fbbf24', accentDim: 'rgba(251,191,36,0.12)' },
];

interface RecentBet {
  id: number;
  game: string;
  betAmount: number;
  outcome: string;
  payout: number;
  multiplier: number;
  teamName: string;
}

const gameIcons: Record<string, string> = { limbo: '🚀', dice: '🎲', mines: '💎', moles: '🔨', wheel: '🎡', plinko: '📍', keno: '🎯' };

export default function HomePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!token) return;
    const fetchRecent = () => {
      fetch('/api/bets/recent?limit=15', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setRecentBets(d.bets || []))
        .catch(() => {});
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 3000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading || !user) {
    return (
      <div className="lobby-loading">
        <div className="spinner spinner-light" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="lobby-root">
      <RulesModal />
      <Navbar />

      {/* Ambient background effects */}
      <div className="lobby-bg-glow lobby-bg-glow-1" />
      <div className="lobby-bg-glow lobby-bg-glow-2" />

      <main className="lobby-main">
        {/* ═══ HERO SECTION ═══ */}
        <motion.section
          className="lobby-hero"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        >
          <div className="lobby-hero-text">
            <p className="lobby-hero-label">GAME ARENA</p>
            <h1 className="lobby-hero-title">
              Welcome back, <span className="lobby-hero-name">{user.teamName}</span>
            </h1>
            <p className="lobby-hero-subtitle">Choose a game and start growing your balance</p>
          </div>

          {/* Balance Card - Glassmorphism */}
          <motion.div
            className="lobby-balance-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.2, 0, 0, 1] }}
          >
            <div className="lobby-balance-glow" />
            <div className="lobby-balance-inner">
              <div className="lobby-balance-header">
                <span className="lobby-balance-label">TOTAL BALANCE</span>
                <div className="lobby-balance-badge">🟢 Live</div>
              </div>
              <div className="lobby-balance-amount">
                <span className="lobby-balance-coin">🪙</span>
                <span className="lobby-balance-value font-mono">
                  {user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ═══ GAMES GRID ═══ */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="lobby-section-header">
            <h2 className="lobby-section-title">
              <span className="lobby-section-icon">🎮</span>
              Choose Your Game
            </h2>
            <span className="lobby-section-count">{games.length} games available</span>
          </div>

          <div className="lobby-games-grid">
            {games.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05, duration: 0.45, ease: [0.2, 0, 0, 1] }}
              >
                <Link href={`/games/${game.id}`} className="lobby-game-card" style={{ '--game-accent': game.accent, '--game-accent-dim': game.accentDim } as React.CSSProperties}>
                  <div className="lobby-game-card-inner">
                    {/* Icon */}
                    <div className="lobby-game-icon-wrap">
                      <span className="lobby-game-icon">{game.icon}</span>
                    </div>
                    {/* Content */}
                    <div className="lobby-game-content">
                      <h3 className="lobby-game-name">{game.name}</h3>
                      <p className="lobby-game-desc">{game.description}</p>
                    </div>
                    {/* CTA */}
                    <div className="lobby-game-cta">
                      <span className="lobby-game-play">Play</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'transform 0.25s ease' }}>
                        <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  {/* Bottom accent line */}
                  <div className="lobby-game-accent" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ═══ LIVE BETS TICKER ═══ */}
        {recentBets.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="lobby-section-header">
              <h2 className="lobby-section-title">
                <span className="lobby-live-dot" />
                Live Activity
              </h2>
            </div>
            <div className="lobby-ticker-container">
              <div className="lobby-ticker-track">
                {recentBets.map((bet) => (
                  <div key={bet.id} className="lobby-ticker-chip">
                    <span className="lobby-ticker-game-icon">{gameIcons[bet.game] || '🎮'}</span>
                    <span className="lobby-ticker-team">{bet.teamName}</span>
                    <span className="lobby-ticker-divider">·</span>
                    <span className="lobby-ticker-amount font-mono">{bet.betAmount.toFixed(2)}</span>
                    <span
                      className="lobby-ticker-result font-mono"
                      style={{ color: bet.outcome === 'win' ? '#7dff67' : '#ed4163' }}
                    >
                      {bet.outcome === 'win' ? `+${bet.payout.toFixed(2)}` : `-${bet.betAmount.toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* ═══ RECENT BETS ═══ */}
        <motion.section
          className="lobby-panel"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <div className="lobby-panel-header">
            <h3 className="lobby-panel-title">📜 Recent Bets</h3>
            <span className="lobby-panel-badge">Your Activity</span>
          </div>
          <div className="lobby-history-list">
            {recentBets.filter(b => b.teamName === user.teamName).length === 0 ? (
              <p className="lobby-empty-state">No bets yet. Play a game to start!</p>
            ) : (
              recentBets.filter(b => b.teamName === user.teamName).slice(0, 8).map((bet) => (
                <div key={bet.id} className="lobby-history-row">
                  <div className="lobby-history-left">
                    <span className="lobby-history-icon">{gameIcons[bet.game] || '🎮'}</span>
                    <div className="lobby-history-info">
                      <span className="lobby-history-game">{bet.game}</span>
                      <span className="lobby-history-bet font-mono">{bet.betAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className={`lobby-history-result font-mono ${bet.outcome === 'win' ? 'lobby-win' : 'lobby-loss'}`}>
                    {bet.outcome === 'win' ? `+${bet.payout.toFixed(2)}` : `-${bet.betAmount.toFixed(2)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}
