'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface Team { id: number; username: string; teamName: string; balance: number; role: string; totalBets: number; totalWon: number; totalLost: number; }
interface HistoryEntry { id: number; game: string; betAmount: number; outcome: string; payout: number; multiplier: number; createdAt: string; username: string; teamName: string; }
interface GameSetting { game_name: string; is_active: number; min_bet: number; max_bet: number; }
interface LiveSession { id: string; game: string; betAmount: number; createdAt: string; username: string; teamName: string; }
interface Stats { totalBets: number; totalWagered: number; totalPaidOut: number; houseProfit: number; }
interface RoundInfo { round_number: number; is_active: boolean; timer_duration: number; started_at: string; ends_at: string; }

const gameIcons: Record<string, string> = { limbo: '🚀', dice: '🎲', mines: '💎', moles: '🔨', wheel: '🎡', plinko: '📍', keno: '🎯' };

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function AdminPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState<Team[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSetting[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [historyFilter, setHistoryFilter] = useState('');
  const [balanceAction, setBalanceAction] = useState<{ userId: number; action: string; amount: string } | null>(null);

  // Round management state
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [roundNumber, setRoundNumber] = useState('1');
  const [timerMinutes, setTimerMinutes] = useState('30');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);

  // Team management state
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ username: '', password: '', teamName: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: number; teamName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { if (!loading && (!user || user.role !== 'admin')) router.push('/'); }, [user, loading, router]);

  const fetchTeams = useCallback(async () => {
    try { const res = await fetch('/api/admin/teams', { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); if (res.ok) setTeams(data.teams); } catch {}
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try { const url = historyFilter ? `/api/admin/history?game=${historyFilter}` : '/api/admin/history'; const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); if (res.ok) setHistory(data.history); } catch {}
  }, [token, historyFilter]);

  const fetchSettings = useCallback(async () => {
    try { const res = await fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); if (res.ok) setGameSettings(data.settings); } catch {}
  }, [token]);

  const fetchStats = useCallback(async () => {
    try { const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); if (res.ok) setStats(data.stats); } catch {}
  }, [token]);

  const fetchSessions = useCallback(async () => {
    try { const res = await fetch('/api/admin/stats?type=sessions', { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); if (res.ok) setSessions(data.sessions); } catch {}
  }, [token]);

  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/round');
      const data = await res.json();
      if (res.ok && data.round) {
        setRound(data.round);
        if (data.round.round_number) setRoundNumber(String(data.round.round_number));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (token && user?.role === 'admin') { fetchTeams(); fetchHistory(); fetchSettings(); fetchStats(); fetchSessions(); fetchRound(); }
  }, [token, user, fetchTeams, fetchHistory, fetchSettings, fetchStats, fetchSessions, fetchRound]);

  useEffect(() => { if (token) fetchHistory(); }, [historyFilter, token, fetchHistory]);

  // Auto-refresh stats every 10s
  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    const interval = setInterval(() => { fetchStats(); fetchSessions(); fetchRound(); }, 10000);
    return () => clearInterval(interval);
  }, [token, user, fetchStats, fetchSessions, fetchRound]);

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

  const handleInitializeRound = async () => {
    if (isInitializing) return;
    const mins = parseFloat(timerMinutes);
    const rn = parseInt(roundNumber);
    if (!rn || rn < 1) return toast.error('Invalid round number');
    if (!mins || mins < 0.5) return toast.error('Timer must be at least 0.5 minutes');
    setIsInitializing(true);
    try {
      const res = await fetch('/api/admin/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'initialize', roundNumber: rn, timerDuration: Math.floor(mins * 60) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      fetchRound();
    } catch (err: any) { toast.error(err.message); }
    setIsInitializing(false);
  };

  const handleStopRound = async () => {
    if (!confirm('Stop the current round?')) return;
    try {
      const res = await fetch('/api/admin/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Round stopped');
      fetchRound();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleBalanceUpdate = async () => {
    if (!balanceAction) return;
    try {
      const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: balanceAction.userId, action: balanceAction.action, amount: parseFloat(balanceAction.amount) }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      toast.success(`Balance updated to ${data.newBalance}`); setBalanceAction(null); fetchTeams();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleResetAll = async () => {
    if (!confirm('Reset ALL player balances to default?')) return;
    try {
      const res = await fetch('/api/admin/teams', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      toast.success(data.message); fetchTeams();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleToggleGame = async (gameName: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameName, isActive }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      toast.success(`${gameName} ${isActive ? 'enabled' : 'disabled'}`); fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleExportCSV = () => {
    window.open(`/api/admin/export?token=${token}`, '_blank');
    fetch('/api/admin/export', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'bet_history.csv'; a.click();
        URL.revokeObjectURL(url);
      }).catch(() => {});
  };

  const handleCreateTeam = async () => {
    if (isCreating) return;
    if (!newTeam.username || !newTeam.password || !newTeam.teamName) {
      return toast.error('All fields are required');
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ createTeam: true, ...newTeam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Team "${newTeam.teamName}" created successfully!`);
      setNewTeam({ username: '', password: '', teamName: '' });
      setShowAddTeam(false);
      fetchTeams();
    } catch (err: any) { toast.error(err.message); }
    setIsCreating(false);
  };

  const handleDeleteTeam = async () => {
    if (!deleteConfirm || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/teams', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: deleteConfirm.userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Team "${deleteConfirm.teamName}" deleted`);
      setDeleteConfirm(null);
      fetchTeams();
    } catch (err: any) { toast.error(err.message); }
    setIsDeleting(false);
  };

  if (loading || !user || user.role !== 'admin') {
    return <div className="admin-loading"><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'rounds', label: 'Rounds', icon: '⏱️' },
    { id: 'teams', label: 'Teams', icon: '👥' },
    { id: 'history', label: 'History', icon: '📜' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="admin-root">
      <Navbar />

      {/* Background effects */}
      <div className="admin-bg-glow admin-bg-glow-1" />
      <div className="admin-bg-glow admin-bg-glow-2" />

      <main className="admin-main">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="admin-header">
          <div>
            <h1 className="admin-title">⚙️ Admin Dashboard</h1>
            <p className="admin-subtitle">Manage teams, monitor activity, and control game settings</p>
          </div>
          {round?.is_active && (
            <div className="admin-round-display">
              <span className="admin-round-dot" />
              <span className="admin-round-label">Round {round.round_number}</span>
              <span className="admin-round-timer font-mono">{formatTime(timeLeft)}</span>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="admin-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`admin-tab ${activeTab === tab.id ? 'admin-tab-active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section">
            {/* Stats Cards */}
            <div className="admin-stats-grid">
              {[
                { label: 'Total Bets', value: stats.totalBets, icon: '🎲', color: '#8b5cf6' },
                { label: 'Total Wagered', value: stats.totalWagered.toFixed(2), icon: '💰', color: '#f59e0b' },
                { label: 'Total Paid Out', value: stats.totalPaidOut.toFixed(2), icon: '💸', color: '#10b981' },
                { label: 'House Profit', value: stats.houseProfit.toFixed(2), icon: '🏦', color: stats.houseProfit >= 0 ? '#10b981' : '#ef4444' },
              ].map(stat => (
                <div key={stat.label} className="admin-stat-card" style={{ '--stat-color': stat.color } as React.CSSProperties}>
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">{stat.label}</span>
                    <span className="admin-stat-icon">{stat.icon}</span>
                  </div>
                  <p className="admin-stat-value font-mono" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="admin-actions-grid">
              <button onClick={handleExportCSV} className="admin-action-btn admin-action-cyan">
                <span>📥</span> Export CSV
              </button>
              <button onClick={() => setActiveTab('rounds')} className="admin-action-btn admin-action-purple">
                <span>⏱️</span> Manage Rounds
              </button>
              <button onClick={() => setActiveTab('teams')} className="admin-action-btn admin-action-yellow">
                <span>👥</span> Manage Teams
              </button>
              <button onClick={handleResetAll} className="admin-action-btn admin-action-red">
                <span>🔄</span> Reset All Balances
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ ROUNDS TAB ═══ */}
        {activeTab === 'rounds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section">
            {/* Current Round Status */}
            <div className="admin-round-card">
              <div className="admin-round-card-header">
                <h3>📡 Round Status</h3>
                <span className={`admin-round-status ${round?.is_active ? 'admin-round-status-active' : 'admin-round-status-inactive'}`}>
                  {round?.is_active ? '● ACTIVE' : '○ INACTIVE'}
                </span>
              </div>
              {round?.is_active ? (
                <div className="admin-round-active-info">
                  <div className="admin-round-timer-display">
                    <span className="admin-round-timer-label">Time Remaining</span>
                    <span className="admin-round-timer-value font-mono">{formatTime(timeLeft)}</span>
                  </div>
                  <div className="admin-round-details">
                    <div className="admin-round-detail">
                      <span>Round Number</span>
                      <strong>{round.round_number}</strong>
                    </div>
                    <div className="admin-round-detail">
                      <span>Duration</span>
                      <strong>{Math.floor(round.timer_duration / 60)} min</strong>
                    </div>
                    <div className="admin-round-detail">
                      <span>Started</span>
                      <strong>{new Date(round.started_at).toLocaleTimeString()}</strong>
                    </div>
                    <div className="admin-round-detail">
                      <span>Ends At</span>
                      <strong>{new Date(round.ends_at).toLocaleTimeString()}</strong>
                    </div>
                  </div>
                  <button onClick={handleStopRound} className="admin-action-btn admin-action-red" style={{ width: '100%', marginTop: '16px' }}>
                    ⏹️ Stop Round
                  </button>
                </div>
              ) : (
                <p className="admin-round-inactive-msg">No round is currently active. Initialize a new round below.</p>
              )}
            </div>

            {/* Initialize New Round */}
            <div className="admin-round-card">
              <h3 className="admin-round-init-title">🚀 Initialize New Round</h3>
              <p className="admin-round-init-desc">Set the round number and timer duration, then initialize to start the countdown.</p>
              <div className="admin-round-form">
                <div className="admin-round-field">
                  <label>Round Number</label>
                  <input
                    type="number"
                    value={roundNumber}
                    onChange={e => setRoundNumber(e.target.value)}
                    min="1"
                    className="input-dark"
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="admin-round-field">
                  <label>Timer Duration (minutes)</label>
                  <input
                    type="number"
                    value={timerMinutes}
                    onChange={e => setTimerMinutes(e.target.value)}
                    min="0.5"
                    step="0.5"
                    className="input-dark"
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="admin-round-quick-times">
                  {[5, 10, 15, 30, 45, 60].map(m => (
                    <button
                      key={m}
                      onClick={() => setTimerMinutes(String(m))}
                      className={`admin-quick-time-btn ${timerMinutes === String(m) ? 'admin-quick-time-active' : ''}`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleInitializeRound}
                disabled={isInitializing}
                className="admin-init-round-btn"
              >
                {isInitializing ? (
                  <><span className="spinner" /> Initializing...</>
                ) : (
                  <>🎮 Initialize Round {roundNumber} ({timerMinutes} min timer)</>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ TEAMS TAB ═══ */}
        {activeTab === 'teams' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section">
            <div className="admin-teams-toolbar">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowAddTeam(true)} className="admin-action-btn admin-action-purple" style={{ padding: '10px 20px' }}>
                  ➕ Add Team
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="admin-teams-count">{teams.filter(t => t.role === 'player').length} teams</span>
                <button onClick={handleResetAll} className="admin-action-btn admin-action-red" style={{ padding: '10px 20px' }}>
                  🔄 Reset All
                </button>
              </div>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    {['Team', 'Username', 'Balance', 'Bets', 'Won', 'Lost', 'Actions'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map(team => (
                    <tr key={team.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{team.teamName}</span>
                        {team.role === 'admin' && (
                          <span className="admin-badge-admin">ADMIN</span>
                        )}
                      </td>
                      <td className="admin-table-secondary">{team.username}</td>
                      <td><span className="font-mono" style={{ fontWeight: 700, color: '#10b981' }}>{team.balance.toFixed(2)}</span></td>
                      <td className="admin-table-secondary">{team.totalBets}</td>
                      <td><span className="font-mono" style={{ color: '#10b981', fontSize: '12px' }}>{team.totalWon.toFixed(2)}</span></td>
                      <td><span className="font-mono" style={{ color: '#ef4444', fontSize: '12px' }}>{team.totalLost.toFixed(2)}</span></td>
                      <td>
                        {team.role !== 'admin' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setBalanceAction({ userId: team.id, action: 'set', amount: team.balance.toString() })} className="admin-table-btn admin-table-btn-edit">Edit</button>
                            <button onClick={() => setDeleteConfirm({ userId: team.id, teamName: team.teamName })} className="admin-table-btn admin-table-btn-delete">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teams.length === 0 && <p className="admin-table-empty">No teams yet</p>}
            </div>

            {/* Balance Edit Modal */}
            <AnimatePresence>
              {balanceAction && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setBalanceAction(null)}>
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="admin-modal" onClick={e => e.stopPropagation()}>
                    <h3 className="admin-modal-title">💰 Edit Balance</h3>
                    <div style={{ marginBottom: '16px' }}>
                      <label className="admin-modal-label">Action</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['set', 'add', 'deduct'].map(a => (
                          <button key={a} className={`admin-modal-action-btn ${balanceAction.action === a ? 'admin-modal-action-active' : ''}`} onClick={() => setBalanceAction({ ...balanceAction, action: a })} style={{ flex: 1, textTransform: 'capitalize' }}>{a}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label className="admin-modal-label">Amount</label>
                      <input type="number" value={balanceAction.amount} onChange={e => setBalanceAction({ ...balanceAction, amount: e.target.value })} className="input-dark" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setBalanceAction(null)} className="admin-modal-cancel">Cancel</button>
                      <button onClick={handleBalanceUpdate} className="admin-modal-confirm">Update</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Team Modal */}
            <AnimatePresence>
              {showAddTeam && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowAddTeam(false)}>
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="admin-modal" onClick={e => e.stopPropagation()}>
                    <h3 className="admin-modal-title">➕ Add New Team</h3>
                    <p className="admin-modal-desc">Create credentials for a new team. They will start with the default balance.</p>
                    <div style={{ marginBottom: '16px' }}>
                      <label className="admin-modal-label">Team Name</label>
                      <input type="text" value={newTeam.teamName} onChange={e => setNewTeam({ ...newTeam, teamName: e.target.value })} placeholder="e.g. Team Alpha" className="input-dark" />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label className="admin-modal-label">Username</label>
                      <input type="text" value={newTeam.username} onChange={e => setNewTeam({ ...newTeam, username: e.target.value })} placeholder="e.g. team_alpha" className="input-dark" />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <label className="admin-modal-label">Password</label>
                      <input type="text" value={newTeam.password} onChange={e => setNewTeam({ ...newTeam, password: e.target.value })} placeholder="e.g. pass1234" className="input-dark" />
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Password is visible so you can share it with the team</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { setShowAddTeam(false); setNewTeam({ username: '', password: '', teamName: '' }); }} className="admin-modal-cancel">Cancel</button>
                      <button onClick={handleCreateTeam} disabled={isCreating} className="admin-modal-confirm">
                        {isCreating ? <><span className="spinner" /> Creating...</> : '✅ Create Team'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Delete Confirm Modal */}
            <AnimatePresence>
              {deleteConfirm && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="admin-modal" onClick={e => e.stopPropagation()}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
                      <h3 className="admin-modal-title">Delete Team</h3>
                      <p className="admin-modal-desc">
                        Are you sure you want to delete <strong style={{ color: '#ef4444' }}>{deleteConfirm.teamName}</strong>?
                        <br /><span style={{ fontSize: '12px' }}>This will permanently remove the team, their bet history, and all game sessions.</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setDeleteConfirm(null)} className="admin-modal-cancel">Cancel</button>
                      <button onClick={handleDeleteTeam} disabled={isDeleting} className="admin-modal-delete">
                        {isDeleting ? <><span className="spinner spinner-light" style={{ width: 16, height: 16 }} /> Deleting...</> : '🗑️ Delete Forever'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section">
            <div className="admin-history-filters">
              {['', 'limbo', 'dice', 'mines', 'moles', 'wheel', 'plinko', 'keno'].map(g => (
                <button key={g} onClick={() => setHistoryFilter(g)} className={`admin-filter-btn ${historyFilter === g ? 'admin-filter-active' : ''}`}>
                  {g ? `${gameIcons[g] || ''} ${g}` : 'All'}
                </button>
              ))}
            </div>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    {['Team', 'Game', 'Bet', 'Result', 'Payout', '×', 'Time'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 600, fontSize: '12px' }}>{entry.teamName}</td>
                      <td style={{ fontSize: '12px' }}>{gameIcons[entry.game]} {entry.game}</td>
                      <td><span className="font-mono" style={{ fontSize: '12px' }}>{entry.betAmount.toFixed(2)}</span></td>
                      <td>
                        <span className={`admin-result-badge ${entry.outcome === 'win' ? 'admin-result-win' : 'admin-result-loss'}`}>{entry.outcome}</span>
                      </td>
                      <td><span className="font-mono" style={{ fontSize: '12px', color: entry.outcome === 'win' ? '#10b981' : 'var(--text-muted)' }}>{entry.payout.toFixed(2)}</span></td>
                      <td><span className="font-mono" style={{ fontSize: '12px' }}>{entry.multiplier.toFixed(2)}×</span></td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(entry.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && <p className="admin-table-empty">No bets yet</p>}
            </div>
          </motion.div>
        )}

        {/* ═══ LIVE SESSIONS TAB ═══ */}
        {activeTab === 'sessions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section">
            <p className="admin-section-desc">Active Mines and Moles sessions (auto-refreshes every 10s)</p>
            <div className="admin-sessions-list">
              {sessions.length === 0 ? (
                <p className="admin-empty-state">No active sessions</p>
              ) : sessions.map(s => (
                <div key={s.id} className="admin-session-card">
                  <div className="admin-session-left">
                    <span className="admin-session-icon">{gameIcons[s.game]}</span>
                    <div>
                      <p className="admin-session-team">{s.teamName} <span className="admin-session-username">@{s.username}</span></p>
                      <p className="admin-session-meta">{s.game} • Started {new Date(s.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="admin-session-right">
                    <span className="font-mono admin-session-amount">{s.betAmount.toFixed(2)}</span>
                    <span className="admin-session-live-dot" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ LEADERBOARD TAB ═══ */}
        {activeTab === 'leaderboard' && (() => {
          const players = teams.filter(t => t.role === 'player').sort((a, b) => b.balance - a.balance);
          const topScore = players.length > 0 ? players[0].balance : 0;
          const totalBetsAll = players.reduce((sum, t) => sum + t.totalBets, 0);
          const topThree = players.slice(0, 3);
          // Podium order: 2nd, 1st, 3rd
          const podiumOrder = [1, 0, 2];
          const podiumIcons = ['👑', '🛡️', '🎖️'];
          const podiumColors = [
            { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)', text: '#fbbf24', glow: '0 0 40px rgba(251,191,36,0.10)' },
            { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)', text: '#94a3b8', glow: 'none' },
            { bg: 'rgba(205,127,50,0.08)', border: 'rgba(205,127,50,0.22)', text: '#cd7f32', glow: 'none' },
          ];

          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section adm-lb-section">

              {/* ── Header ── */}
              <div className="adm-lb-top-bar">
                <div className="adm-lb-title-group">
                  <button className="adm-lb-back" onClick={() => setActiveTab('overview')}>←</button>
                  <div className="adm-lb-icon-circle">🏆</div>
                  <div>
                    <h2 className="adm-lb-title">Leaderboard</h2>
                    <p className="adm-lb-subtitle">Live Rankings</p>
                  </div>
                </div>
                <div className="adm-lb-live-badge">
                  <span className="adm-lb-live-dot" />
                  <span>Updates every 10s</span>
                </div>
              </div>

              {/* ── Summary Stats ── */}
              <div className="adm-lb-stats-row">
                {[
                  { icon: '👥', label: 'Teams', value: players.length },
                  { icon: '🏆', label: 'Top Score', value: topScore.toFixed(0) },
                  { icon: '🎲', label: 'Total Bets', value: totalBetsAll },
                ].map(stat => (
                  <div key={stat.label} className="adm-lb-stat-card">
                    <div className="adm-lb-stat-icon">{stat.icon}</div>
                    <span className="adm-lb-stat-label">{stat.label}</span>
                    <span className="adm-lb-stat-value font-mono">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* ── Podium Top 3 ── */}
              {topThree.length > 0 && (
                <div className="adm-lb-podium-wrap">
                  <div className="adm-lb-podium">
                    {podiumOrder.map((idx) => {
                      const entry = topThree[idx];
                      if (!entry) return <div key={`empty-${idx}`} className="adm-lb-podium-empty" />;
                      const rank = idx;
                      const isFirst = rank === 0;
                      const rc = podiumColors[rank];
                      return (
                        <motion.div
                          key={`podium-${entry.id}`}
                          className={`adm-lb-podium-card ${isFirst ? 'adm-lb-podium-first' : ''}`}
                          style={{
                            '--p-bg': rc.bg,
                            '--p-border': rc.border,
                            '--p-text': rc.text,
                            '--p-glow': rc.glow,
                          } as React.CSSProperties}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + rank * 0.08 }}
                        >
                          <div className="adm-lb-podium-icon-wrap" style={{ background: rc.bg, borderColor: rc.border }}>
                            {podiumIcons[rank]}
                          </div>
                          <h4 className="adm-lb-podium-name">{entry.teamName}</h4>
                          <p className="adm-lb-podium-score font-mono" style={{ color: rc.text }}>{entry.balance.toFixed(0)}</p>
                          <p className="adm-lb-podium-meta">{entry.totalBets > 0 ? `${entry.totalBets} bets` : '0 bets'}</p>
                          <div className="adm-lb-podium-rank-badge" style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                            #{rank + 1}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── All Teams Table ── */}
              <div className="adm-lb-table-section">
                <div className="adm-lb-table-header">
                  <div className="adm-lb-table-title-group">
                    <span className="adm-lb-table-icon">🛡️</span>
                    <h3 className="adm-lb-table-title">All Teams</h3>
                  </div>
                  <span className="adm-lb-table-count">{players.length} registered</span>
                </div>
                <div className="adm-lb-table-wrap">
                  <table className="adm-lb-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>Bets</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((team, i) => (
                        <tr key={team.id} className={i < 3 ? 'adm-lb-table-top' : ''}>
                          <td>
                            <span className={`adm-lb-tbl-rank ${i < 3 ? `adm-lb-tbl-rank-${i}` : ''}`}>
                              {i + 1}
                            </span>
                          </td>
                          <td>
                            <span className="adm-lb-tbl-team-name">{team.teamName}</span>
                          </td>
                          <td className="adm-lb-tbl-meta">{team.totalBets}</td>
                          <td>
                            <span className={`adm-lb-tbl-score font-mono ${i === 0 ? 'adm-lb-tbl-score-gold' : ''}`}>
                              {team.balance.toFixed(0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {players.length === 0 && (
                        <tr><td colSpan={4} className="adm-lb-tbl-empty">No teams registered yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          );
        })()}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="admin-section">
            <div className="admin-settings-grid">
              {gameSettings.map(game => (
                <div key={game.game_name} className="admin-setting-card">
                  <div className="admin-setting-header">
                    <h3 className="admin-setting-name">
                      {gameIcons[game.game_name] || '🎮'} {game.game_name}
                    </h3>
                    <button
                      onClick={() => handleToggleGame(game.game_name, !game.is_active)}
                      className={`admin-setting-toggle ${game.is_active ? 'admin-setting-active' : 'admin-setting-disabled'}`}
                    >
                      {game.is_active ? '● Active' : '○ Disabled'}
                    </button>
                  </div>
                  <p className="admin-setting-limits">Min: {game.min_bet} · Max: {game.max_bet.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
