import { useState } from 'react';
import { sendMagicLink, sendPasswordReset, signInWithPassword } from '../lib/auth';

type Mode = 'password' | 'magic' | 'reset';

export function Login() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'password') {
        await signInWithPassword(email, password);
      } else if (mode === 'magic') {
        await sendMagicLink(email);
        setSent(true);
      } else {
        await sendPasswordReset(email);
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent && mode === 'magic') {
    return (
      <div className="auth-page">
        <h1>Check your email</h1>
        <p>We sent a login link to {email}. Click it to sign in.</p>
      </div>
    );
  }

  if (sent && mode === 'reset') {
    return (
      <div className="auth-page">
        <h1>Check your email</h1>
        <p>We sent a password reset link to {email}. Click it to set a new password.</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Cheaper To Keeper Manager</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        {mode === 'password' && (
          <>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}

        <button type="submit" disabled={submitting}>
          {submitting
            ? 'Please wait...'
            : mode === 'password'
              ? 'Sign in'
              : mode === 'magic'
                ? 'Send magic link'
                : 'Send reset link'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="auth-links">
        {mode === 'password' && (
          <>
            <button type="button" className="link-button" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>
            <button type="button" className="link-button" onClick={() => switchMode('magic')}>
              Use a magic link instead
            </button>
          </>
        )}
        {mode !== 'password' && (
          <button type="button" className="link-button" onClick={() => switchMode('password')}>
            Back to password sign-in
          </button>
        )}
      </div>
    </div>
  );
}
