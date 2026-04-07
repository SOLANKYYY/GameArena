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

const gameIcons: Record<string, string> = { limbo: '🚀', dice: '🎲', mines: '💎', moles: '🔨', wheel: '🎡', plinko: '📍', keno: '🎯' };

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
  const [leaderboardLastUpdated, setLeaderboardLastUpdated] = useState<Date | null>(null);

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

  useEffect(() => {
    if (token && user?.role === 'admin') { fetchTeams(); fetchHistory(); fetchSettings(); fetchStats(); fetchSessions(); }
  }, [token, user, fetchTeams, fetchHistory, fetchSettings, fetchStats, fetchSessions]);

  useEffect(() => { if (token) fetchHistory(); }, [historyFilter, token, fetchHistory]);

  // Auto-refresh stats every 10s
  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    const interval = setInterval(() => { fetchStats(); fetchSessions(); }, 10000);
    return () => clearInterval(interval);
  }, [token, user, fetchStats, fetchSessions]);

  // Auto-refresh teams (for live leaderboard) every 5s when on leaderboard tab
  useEffect(() => {
    if (!token || user?.role !== 'admin' || activeTab !== 'leaderboard') return;
    const interval = setInterval(() => {
      fetchTeams();
      setLeaderboardLastUpdated(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, [token, user, activeTab, fetchTeams]);

  // Immediately refresh teams when switching to leaderboard tab
  useEffect(() => {
    if (activeTab === 'leaderboard' && token) {
      fetchTeams();
      setLeaderboardLastUpdated(new Date());
    }
  }, [activeTab, token, fetchTeams]);

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

  // ── Add Team ──
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

  // ── Delete Team ──
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
    return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-light" style={{ width: 32, height: 32 }} /></div>;
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'teams', label: '👥 Teams' },
    { id: 'history', label: '📜 History' },
    { id: 'sessions', label: '🟢 Live Sessions' },
    { id: 'leaderboard', label: '🏆 Leaderboard' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>⚙️ Admin Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Manage teams, monitor activity, and control game settings</p>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: activeTab === tab.id ? 'var(--accent-green-dim)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-green)' : 'var(--text-secondary)',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }} className="game-grid-2col">
              {[
                { label: 'Bets Today', value: stats.totalBets, icon: '🎲' },
                { label: 'Wagered Today', value: stats.totalWagered.toFixed(2), icon: '💰', color: 'var(--accent-yellow)' },
                { label: 'Paid Out Today', value: stats.totalPaidOut.toFixed(2), icon: '💸', color: 'var(--accent-green)' },
                { label: 'House Profit', value: stats.houseProfit.toFixed(2), icon: '🏦', color: stats.houseProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</span>
                    <span style={{ fontSize: '20px' }}>{stat.icon}</span>
                  </div>
                  <p className="font-mono" style={{ fontSize: '24px', fontWeight: 800, color: stat.color || 'var(--text-primary)' }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <button onClick={handleExportCSV} className="btn-secondary" style={{ marginBottom: '16px' }}>
              📥 Export Bet History CSV
            </button>
          </motion.div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowAddTeam(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ➕ Add Team
                </button>
              </div>
              <button onClick={handleResetAll} className="btn-danger btn-sm">🔄 Reset All Balances</button>
            </div>

            {/* Teams Count */}
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {teams.filter(t => t.role === 'player').length} teams registered
            </p>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Team', 'Username', 'Balance', 'Bets', 'Won', 'Lost', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map(team => (
                    <tr key={team.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: '13px' }}>
                        {team.teamName}
                        {team.role === 'admin' && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', fontWeight: 700 }}>ADMIN</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{team.username}</td>
                      <td style={{ padding: '10px 14px' }}><span className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '13px' }}>{team.balance.toFixed(2)}</span></td>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{team.totalBets}</td>
                      <td style={{ padding: '10px 14px' }}><span className="font-mono" style={{ fontSize: '12px', color: 'var(--accent-green)' }}>{team.totalWon.toFixed(2)}</span></td>
                      <td style={{ padding: '10px 14px' }}><span className="font-mono" style={{ fontSize: '12px', color: 'var(--accent-red)' }}>{team.totalLost.toFixed(2)}</span></td>
                      <td style={{ padding: '10px 14px' }}>
                        {team.role !== 'admin' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setBalanceAction({ userId: team.id, action: 'set', amount: team.balance.toString() })} className="btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '11px' }}>Edit</button>
                            <button
                              onClick={() => setDeleteConfirm({ userId: team.id, teamName: team.teamName })}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--accent-red)',
                                background: 'var(--accent-red-dim)', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 600,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-red)'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-red-dim)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teams.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No teams yet</p>}
            </div>

            {/* Balance Edit Modal */}
            <AnimatePresence>
              {balanceAction && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="modal-overlay" onClick={() => setBalanceAction(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="modal-card" onClick={e => e.stopPropagation()}
                  >
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>💰 Edit Balance</h3>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Action</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['set', 'add', 'deduct'].map(a => (
                          <button key={a} className={balanceAction.action === a ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setBalanceAction({ ...balanceAction, action: a })} style={{ flex: 1, textTransform: 'capitalize' }}>{a}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Amount</label>
                      <input type="number" value={balanceAction.amount} onChange={e => setBalanceAction({ ...balanceAction, amount: e.target.value })} className="input-dark" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setBalanceAction(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                      <button onClick={handleBalanceUpdate} className="btn-primary" style={{ flex: 1 }}>Update</button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Team Modal */}
            <AnimatePresence>
              {showAddTeam && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="modal-overlay" onClick={() => setShowAddTeam(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="modal-card" onClick={e => e.stopPropagation()}
                  >
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>➕ Add New Team</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                      Create credentials for a new team. They will start with the default balance.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Name</label>
                      <input
                        type="text" value={newTeam.teamName}
                        onChange={e => setNewTeam({ ...newTeam, teamName: e.target.value })}
                        placeholder="e.g. Team Alpha"
                        className="input-dark"
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                      <input
                        type="text" value={newTeam.username}
                        onChange={e => setNewTeam({ ...newTeam, username: e.target.value })}
                        placeholder="e.g. team_alpha"
                        className="input-dark"
                      />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                      <input
                        type="text" value={newTeam.password}
                        onChange={e => setNewTeam({ ...newTeam, password: e.target.value })}
                        placeholder="e.g. pass1234"
                        className="input-dark"
                      />
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Password is visible so you can share it with the team
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { setShowAddTeam(false); setNewTeam({ username: '', password: '', teamName: '' }); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                      <button onClick={handleCreateTeam} disabled={isCreating} className="btn-primary" style={{ flex: 1 }}>
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
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="modal-overlay" onClick={() => setDeleteConfirm(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="modal-card" onClick={e => e.stopPropagation()}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Delete Team</h3>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Are you sure you want to delete <strong style={{ color: 'var(--accent-red)' }}>{deleteConfirm.teamName}</strong>?
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                        This will permanently remove the team, their bet history, and all game sessions. This cannot be undone.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setDeleteConfirm(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                      <button onClick={handleDeleteTeam} disabled={isDeleting} className="btn-danger" style={{ flex: 1 }}>
                        {isDeleting ? <><span className="spinner spinner-light" style={{ width: 16, height: 16 }} /> Deleting...</> : '🗑️ Delete Forever'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['', 'limbo', 'dice', 'mines', 'moles', 'wheel', 'plinko', 'keno'].map(g => (
                <button key={g} onClick={() => setHistoryFilter(g)} className={historyFilter === g ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ textTransform: 'capitalize', fontSize: '12px', padding: '6px 14px' }}>
                  {g ? `${gameIcons[g] || ''} ${g}` : 'All'}
                </button>
              ))}
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Team', 'Game', 'Bet', 'Result', 'Payout', '×', 'Time'].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(entry => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600 }}>{entry.teamName}</td>
                      <td style={{ padding: '8px 14px', fontSize: '12px' }}>{gameIcons[entry.game]} {entry.game}</td>
                      <td style={{ padding: '8px 14px' }}><span className="font-mono" style={{ fontSize: '12px' }}>{entry.betAmount.toFixed(2)}</span></td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: entry.outcome === 'win' ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)', color: entry.outcome === 'win' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{entry.outcome}</span>
                      </td>
                      <td style={{ padding: '8px 14px' }}><span className="font-mono" style={{ fontSize: '12px', color: entry.outcome === 'win' ? 'var(--accent-green)' : 'var(--text-muted)' }}>{entry.payout.toFixed(2)}</span></td>
                      <td style={{ padding: '8px 14px' }}><span className="font-mono" style={{ fontSize: '12px' }}>{entry.multiplier.toFixed(2)}×</span></td>
                      <td style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(entry.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No bets yet</p>}
            </div>
          </motion.div>
        )}

        {/* Live Sessions Tab */}
        {activeTab === 'sessions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Active Mines and Moles sessions (auto-refreshes every 10s)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sessions.length === 0 ? (
                <p style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>No active sessions</p>
              ) : sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{gameIcons[s.game]}</span>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px' }}>{s.teamName} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px' }}>@{s.username}</span></p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.game} • Started {new Date(s.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="font-mono" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-yellow)' }}>{s.betAmount.toFixed(2)}</span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse-green 2s infinite' }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', animation: 'pulse-green 2s infinite' }} />
                LIVE
              </span>
              {leaderboardLastUpdated && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Updated {leaderboardLastUpdated.toLocaleTimeString()}
                </span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Auto-refreshes every 5s</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {teams.filter(t => t.role === 'player').sort((a, b) => b.balance - a.balance).map((team, i) => (
                <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: '12px', background: 'var(--bg-secondary)', border: `1px solid ${i === 0 ? '#fbbf2440' : i === 1 ? '#94a3b830' : i === 2 ? '#cd7f3230' : 'var(--border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, background: i === 0 ? '#fbbf2422' : i === 1 ? '#94a3b822' : i === 2 ? '#cd7f3222' : 'var(--bg-primary)', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--text-muted)' }}>{i + 1}</span>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '14px' }}>{team.teamName}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{team.username} · {team.totalBets} bets</p>
                    </div>
                  </div>
                  <p className="font-mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-green)' }}>{team.balance.toFixed(2)}</p>
                </div>
              ))}
              {teams.filter(t => t.role === 'player').length === 0 && (
                <p style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>No teams yet</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {gameSettings.map(game => (
                <div key={game.game_name} style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'capitalize' }}>
                      {gameIcons[game.game_name] || '🎮'} {game.game_name}
                    </h3>
                    <button onClick={() => handleToggleGame(game.game_name, !game.is_active)}
                      className={game.is_active ? 'btn-primary btn-sm' : 'btn-danger btn-sm'}
                      style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '12px' }}>
                      {game.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Min: {game.min_bet} · Max: {game.max_bet.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
