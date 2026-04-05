'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navLinks = [
  { href: '/', label: 'Lobby', icon: '🏠' },
  { href: '/games/limbo', label: 'Limbo', icon: '🚀' },
  { href: '/games/dice', label: 'Dice', icon: '🎲' },
  { href: '/games/mines', label: 'Mines', icon: '💎' },
  { href: '/games/moles', label: 'Moles', icon: '🔨' },
  { href: '/games/wheel', label: 'Wheel', icon: '🎡' },
  { href: '/games/plinko', label: 'Plinko', icon: '📍' },
  { href: '/games/keno', label: 'Keno', icon: '🎯' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(15, 25, 35, 0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: '1400px', margin: '0 auto', padding: '0 24px',
        height: '64px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px',
      }}>
        {/* Logo */}
        <Link href="/" style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center',
          gap: '10px', flexShrink: 0,
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #00e701, #00b300)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 800, color: '#0f1923',
          }}>G</div>
          <span style={{
            fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            Game Arena
          </span>
        </Link>

        {/* Nav Links */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          overflowX: 'auto', flex: 1, justifyContent: 'center',
        }}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '6px 12px', borderRadius: '8px',
                  textDecoration: 'none', fontSize: '13px', fontWeight: 500,
                  color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-green-dim)' : 'transparent',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: '14px' }}>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
          {user.role === 'admin' && (
            <Link
              href="/admin"
              style={{
                padding: '6px 12px', borderRadius: '8px',
                textDecoration: 'none', fontSize: '13px', fontWeight: 500,
                color: pathname === '/admin' ? '#fbbf24' : 'var(--text-secondary)',
                background: pathname === '/admin' ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>⚙️</span><span>Admin</span>
            </Link>
          )}
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '6px 16px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '14px' }}>🪙</span>
            <span className="font-mono" style={{
              fontWeight: 700, fontSize: '14px', color: 'var(--accent-green)',
            }}>
              {user.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '12px' }}>👤</span>
            <span style={{ fontWeight: 500 }}>{user.teamName}</span>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="btn-secondary btn-sm"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
