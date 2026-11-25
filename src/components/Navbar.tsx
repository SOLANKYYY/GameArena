'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RulesModal from '@/components/RulesModal';
import HauntedEmblem from '@/components/HauntedEmblem';

const navLinks = [
  { href: '/games/limbo', label: 'Limbo', icon: '🚀' },
  { href: '/games/dice', label: 'Dice', icon: '🎲' },
  { href: '/games/mines', label: 'Mines', icon: '💎' },
  { href: '/games/moles', label: 'Moles', icon: '🔨' },
  { href: '/games/wheel', label: 'Wheel', icon: '🎡' },
  { href: '/games/plinko', label: 'Plinko', icon: '📍' },
  { href: '/games/keno', label: 'Keno', icon: '🎯' },
];


function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface RoundInfo {
  round_number: number;
  is_active: boolean;
  ends_at: string;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  const isAdminUser = user?.role === 'admin';

  // Fetch round info for players to show timer
  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/round');
      const data = await res.json();
      if (res.ok && data.round) {
        setRound(data.round);
      } else {
        setRound(null);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (!user || isAdminUser) return;
    fetchRound();
    const interval = setInterval(fetchRound, 5000);
    return () => clearInterval(interval);
  }, [user, isAdminUser, fetchRound]);

  // Countdown timer
  useEffect(() => {
    if (!round?.is_active || !round.ends_at) {
      setTimeLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, (new Date(round.ends_at).getTime() - Date.now()) / 1000);
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [round]);

  if (!user) return null;

  const roundActive = round?.is_active && timeLeft > 0;

  return (
    <>
      {!isAdminUser && <RulesModal />}
      <nav className="navbar-root" aria-label="Main navigation" data-open={menuOpen}
        onKeyDown={event => {
          if (menuOpen && event.key === 'Escape') {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}>
        <div className="navbar-inner">
          {/* Logo */}
          <Link href="/" aria-label="Game Arena lobby" className="navbar-logo-link">
            <HauntedEmblem size={36} />
            <span className="navbar-brand">Game Arena</span>
          </Link>

          <button type="button" ref={menuButton} className="navbar-menu-toggle"
            aria-expanded={menuOpen} aria-controls="arena-links arena-account"
            onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>

          {/* Nav Links */}
          <div className="navbar-links" id="arena-links" onClick={() => setMenuOpen(false)}>
            {!isAdminUser && navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`navbar-link ${isActive ? 'navbar-link-active' : ''}`}
                >
                  <span className="navbar-link-icon">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
            {/* Leaderboard — admin only */}
            {isAdminUser && (
              <Link
                href="/leaderboard"
                className={`navbar-link ${pathname === '/leaderboard' ? 'navbar-link-active-gold' : ''}`}
              >
                <span className="navbar-link-icon">🏆</span>
                <span>Leaderboard</span>
              </Link>
            )}
            {isAdminUser && (
              <Link
                href="/admin"
                className={`navbar-link ${pathname === '/admin' || pathname.startsWith('/admin') ? 'navbar-link-active-purple' : ''}`}
              >
                <span className="navbar-link-icon">⚙️</span>
                <span>Admin</span>
              </Link>
            )}
          </div>

          {/* Right Side */}
          <div className="navbar-right">
            {/* Round timer for participants */}
            {!isAdminUser && (
              <div
                className="navbar-round-timer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: roundActive ? 'rgba(255, 122, 26, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${roundActive ? 'rgba(255, 122, 26, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                  color: roundActive ? '#ffa347' : '#ffb4ab',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: roundActive ? '#ff7a1a' : '#ef4444',
                    boxShadow: roundActive ? '0 0 8px rgba(255, 122, 26,0.5)' : '0 0 8px rgba(239,68,68,0.4)',
                    animation: roundActive ? 'pulse-green 2s infinite' : 'none',
                  }}
                />
                {roundActive ? (
                  <>
                    <span>R{round?.round_number}</span>
                    <span className="font-mono" style={{ color: '#ffa347', fontWeight: 700 }}>
                      {formatTime(timeLeft)}
                    </span>
                  </>
                ) : (
                  <span>Waiting for round</span>
                )}
              </div>
            )}

            {!isAdminUser && (
              <div className="navbar-balance-pill">
                <span style={{ fontSize: '14px' }}>🪙</span>
                <span className="font-mono navbar-balance-value">
                  {user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="navbar-account" id="arena-account">
              <div className="navbar-user-info">
                <span style={{ fontSize: '12px' }}>👤</span>
                <span>{user.teamName}</span>
              </div>
              <button
                onClick={() => { logout(); router.push('/login'); }}
                className="navbar-logout-btn"
              >
                Logout
              </button>
              {/* Rules button — participants only */}
              {!isAdminUser && (
                <button
                  onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('openRulesModal')); }}
                  style={{
                    background: 'rgba(255, 122, 26, 0.06)',
                    border: '1px solid rgba(255, 122, 26, 0.12)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffa347',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 122, 26, 0.1)'; e.currentTarget.style.borderColor = 'rgba(255, 122, 26, 0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 122, 26, 0.06)'; e.currentTarget.style.borderColor = 'rgba(255, 122, 26, 0.12)'; }}
                >
                  <span>📖</span>
                  <span>Rules</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
