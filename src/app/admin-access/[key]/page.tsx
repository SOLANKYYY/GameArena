'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function AdminAccessPage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState('Authenticating...');

  const key = params.key as string;

  useEffect(() => {
    if (!key) return;

    fetch('/api/auth/admin-magic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Authentication failed');
        // We received the token. Write it forcefully and reload so AuthContext picks it up beautifully.
        localStorage.setItem('game-arena-token', data.token);
        toast.success(`Welcome back, Admin!`);
        setStatus('Success! Redirecting...');
        window.location.href = '/admin';
      })
      .catch((err) => {
        setStatus(`Error: ${err.message}`);
        toast.error(err.message);
      });
  }, [key]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'monospace',
      fontSize: '20px'
    }}>
      {status}
    </div>
  );
}
