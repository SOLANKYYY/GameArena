'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import HauntedEmblem from '@/components/HauntedEmblem';


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
      toast.success('Welcome back to Hollow House');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-root" id="main-content" role="main">
      {/* Background effects */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />
      <div className="login-scene" aria-hidden="true" />
      <div className="login-masthead"><span className="login-wordmark"><HauntedEmblem size={32} /> GameArena</span><span className="season-label">The Halloween chapter</span></div>
      <section className="login-story" aria-labelledby="house-title">
        <p className="gothic-eyebrow">Beyond the gates of Hollow House</p>
        <h1 id="house-title">Some games<br />stay with you.<br /><em>Forever.</em></h1>
        <p>Seven cursed games. One restless house.<br />Step into the shadows and tempt your fate.</p>
        <div className="story-seal"><span aria-hidden="true">✧</span> A Halloween mystery awaits <span aria-hidden="true">✧</span></div>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="login-container"
      >
        {/* Logo */}
        <div className="login-logo-section">
          <div className="login-logo-glow">
            <HauntedEmblem size={56} />
          </div>
          <p className="gothic-eyebrow">Hollow House invites you</p>
          <h2 className="login-title">Enter the unknown</h2>
          <p className="login-subtitle">Sign in to begin your haunting.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">Username</label>
            <input
              id="login-username"
              autoComplete="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="login-input"
            />
          </div>

          <div className="login-field" style={{ marginBottom: '28px' }}>
            <label htmlFor="login-password" className="login-label">Password</label>
            <input
              id="login-password"
              autoComplete="current-password"
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
            aria-busy={isLoading}
          >
            {isLoading ? 'Opening the gates...' : 'Enter Hollow House'}
          </button>
        </form>

        <p className="login-footer">
          Contact your admin to get team credentials
        </p>
      </motion.div>
    </div>
  );
}
