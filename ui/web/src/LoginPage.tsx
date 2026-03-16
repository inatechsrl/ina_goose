import React, { useState, FormEvent } from 'react';
import logo from './logo-transparent.png';

export function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('goose-session-token', data.token);
        window.location.reload();
        return;
      }

      if (res.status === 401) {
        setError('Invalid key');
      } else if (res.status === 429) {
        setError('Too many attempts, try again later');
      } else {
        setError('Connection error');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6 w-full max-w-sm px-6"
      >
        <img src={logo} alt="INATECH" className="w-48 mb-2" />
        <h1 className="text-xl font-semibold text-gray-100 tracking-tight">
          Agent Core
        </h1>

        <input
          type="password"
          placeholder="Enter your access key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-gray-100 placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />

        <button
          type="submit"
          disabled={loading || !key}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </form>
    </div>
  );
}

export function logout() {
  localStorage.removeItem('goose-session-token');
  window.location.reload();
}
