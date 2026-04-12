'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion } from 'framer-motion';

interface LeaderboardEntry {
  id: number;
  username: string;
  teamName: string;
  balance: number;
  totalBets: number;
  totalWon: number;
  totalLost: number;
}

interface RoundInfo {
  round_number: number;
  is_active: boolean;
  timer_duration: number;
  started_at: string;
  ends_at: string;
}

const podiumIcons = ['👑', '🛡️', '🎖️'];
const podiumColors = [
  { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)', text: '#fbbf24', glow: '0 0 40px rgba(251,191,36,0.10)' },
  { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)', text: '#94a3b8', glow: 'none' },
  { bg: 'rgba(205,127,50,0.08)', border: 'rgba(205,127,50,0.22)', text: '#cd7f32', glow: 'none' },
];

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LeaderboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const fetchLeaderboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch {}
  }, [token]);

  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/round');
      const data = await res.json();
      if (res.ok && data.round) {
        setRound(data.round);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (token) {
      fetchLeaderboard();
      fetchRound();
      const interval = setInterval(() => {
        fetchLeaderboard();
        fetchRound();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [token, fetchLeaderboard, fetchRound]);

  // Countdown timer
  useEffect(() => {
    if (!round?.is_active || !round.ends_at) return;
    const tick = () => {
      const remaining = Math.max(0, (new Date(round.ends_at).getTime() - Date.now()) / 1000);
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [round]);

  if (loading || !user) {
    return (
      <div className="lb-page-loading">
        <div className="spinner spinner-light" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const topThree = leaderboard.slice(0, 3);
  const topScore = leaderboard.length > 0 ? leaderboard[0].balance : 0;
  const totalBetsAll = leaderboard.reduce((sum, t) => sum + t.totalBets, 0);
  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [1, 0, 2];

  return (
    <div className="lb-page-root">
      <Navbar />

      {/* Ambient background */}
      <div className="lb-bg-glow lb-bg-glow-purple" />
      <div className="lb-bg-glow lb-bg-glow-cyan" />

      <main className="lb-page-main">

        {/* ── Header ── */}
        <motion.div
          className="lb-top-bar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="lb-title-group">
            <button className="lb-back-btn" onClick={() => router.push('/')}>←</button>
            <div className="lb-icon-circle">🏆</div>
            <div>
              <h1 className="lb-hdr-title">Leaderboard</h1>
              <p className="lb-hdr-subtitle">Live Rankings</p>
            </div>
          </div>
          <div className="lb-live-badge">
            <span className="lb-live-dot-green" />
            <span>Updates every 10s</span>
          </div>
        </motion.div>

        {/* ── Summary Stats ── */}
        <motion.div
          className="lb-stats-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          {[
            { icon: '👥', label: 'Teams', value: leaderboard.length },
            { icon: '🏆', label: 'Top Score', value: topScore.toFixed(0) },
            { icon: '⚡', label: 'Total Bets', value: totalBetsAll },
          ].map(stat => (
            <div key={stat.label} className="lb-stat-card">
              <div className="lb-stat-icon">{stat.icon}</div>
              <span className="lb-stat-label">{stat.label}</span>
              <span className="lb-stat-value font-mono">{stat.value}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Podium Top 3 ── */}
        {topThree.length > 0 && (
          <motion.div
            className="lb-podium-wrap"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <div className={`lb-podium lb-podium-count-${topThree.length}`}>
              {(topThree.length >= 3 ? podiumOrder : topThree.length === 2 ? [1, 0] : [0]).map((idx) => {
                const entry = topThree[idx];
                if (!entry) return null;
                const rank = idx;
                const isFirst = rank === 0;
                const rc = podiumColors[rank];
                return (
                  <motion.div
                    key={`podium-${entry.id}`}
                    className={`lb-podium-card ${isFirst ? 'lb-podium-first' : ''}`}
                    style={{
                      '--p-bg': rc.bg,
                      '--p-border': rc.border,
                      '--p-text': rc.text,
                      '--p-glow': rc.glow,
                    } as React.CSSProperties}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + rank * 0.1, duration: 0.5 }}
                  >
                    <div className="lb-podium-icon-wrap" style={{ background: rc.bg, borderColor: rc.border }}>
                      {podiumIcons[rank]}
                    </div>
                    <h3 className="lb-podium-name">{entry.teamName}</h3>
                    <p className="lb-podium-score font-mono" style={{ color: rc.text }}>{entry.balance.toFixed(0)}</p>
                    <p className="lb-podium-meta">{entry.totalBets} bets</p>
                    <div className="lb-podium-rank-badge" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                      #{rank + 1}
                    </div>
                    {entry.teamName === user.teamName && (
                      <div className="lb-you-badge">YOU</div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── All Teams Table ── */}
        <motion.div
          className="lb-table-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <div className="lb-table-hdr">
            <div className="lb-table-title-group">
              <span className="lb-table-icon">🛡️</span>
              <h2 className="lb-table-heading">All Teams</h2>
            </div>
            <span className="lb-table-count">{leaderboard.length} registered</span>
          </div>
          <div className="lb-table-wrapper">
            <table className="lb-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Bets</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`lb-table-row ${entry.teamName === user.teamName ? 'lb-table-row-you' : ''} ${i < 3 ? 'lb-table-row-top' : ''}`}
                  >
                    <td>
                      <span className={`lb-table-rank ${i < 3 ? `lb-table-rank-${i}` : ''}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="lb-table-team">
                        <span className="lb-table-team-name">
                          {entry.teamName}
                          {entry.teamName === user.teamName && <span className="lb-you-tag-sm">YOU</span>}
                        </span>
                      </div>
                    </td>
                    <td className="lb-table-stat">{entry.totalBets}</td>
                    <td>
                      <span className={`lb-table-balance font-mono ${i === 0 ? 'lb-table-balance-gold' : ''}`}>
                        {entry.balance.toFixed(0)}
                      </span>
                    </td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={4} className="lb-table-empty">No teams registered yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      </main>
    </div>
  );
}
