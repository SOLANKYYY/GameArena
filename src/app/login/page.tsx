'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

function ArenaLogoLarge() {
  return (
    <svg width="64" height="64" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradLg" x1="0" y1="0" x2="36" y2="36">
          <stop offset="0%" stopColor="#00e701" />
          <stop offset="100%" stopColor="#7dff67" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#logoGradLg)" />
      <path
        d="M18 8L26 12V19C26 23.5 22.5 27 18 28.5C13.5 27 10 23.5 10 19V12L18 8Z"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.8"
      />
      <path d="M14 22L22 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 22L14 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="16" y="16" width="4" height="4" rx="1" fill="white" transform="rotate(45 18 18)" />
    </svg>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  if (user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Background effects */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />
      <div className="login-bg-grid" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="login-container"
      >
        {/* Logo */}
        <div className="login-logo-section">
          <div className="login-logo-glow">
            <ArenaLogoLarge />
          </div>
          <h1 className="login-title">Game Arena</h1>
          <p className="login-subtitle">Sign in to start playing</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="login-input"
            />
          </div>

          <div className="login-field" style={{ marginBottom: '28px' }}>
            <label className="login-label">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="login-input"
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={isLoading}
            className="login-submit-btn"
          >
            {isLoading ? '⏳ Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          Contact your admin to get team credentials
        </p>
      </motion.div>
    </div>
  );
}
