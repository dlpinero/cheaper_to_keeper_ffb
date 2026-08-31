import { useState } from 'react';
import { sendMagicLink } from '../lib/auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendMagicLink(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <h1>Check your email</h1>
        <p>We sent a login link to {email}. Click it to sign in.</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <h1>Keeper League Manager</h1>
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
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send magic link'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
