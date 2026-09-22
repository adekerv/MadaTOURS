import { useId, useState, type FormEvent } from 'react';
import type { User } from '../../types';
import { api, errorMessage } from '../../lib/api';
import { Modal } from '../ui/Modal';
export function AuthModal({
  onClose,
  onLoginSuccess,
}: {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}) {
  const passwordHint = useId();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await api<{ user: User }>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onLoginSuccess(result.user);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal title={register ? 'Create your account' : 'Welcome to MadaTours'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
        <p className="text-sm text-slate-600">
          Save your favorite places and keep a list of places to visit again.
        </p>
        <label className="field-label">
          Email
          <input
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="field-label">
          Password
          <input
            aria-label="Password"
            aria-describedby={register ? passwordHint : undefined}
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 12 : 1}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
          {register && (
            <span id={passwordHint} className="text-sm font-normal text-slate-600">
              Use at least 12 characters. A few memorable words work well.
            </span>
          )}
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button disabled={loading} className="primary-button w-full">
          {loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="w-full text-sm font-semibold text-orange-700"
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </Modal>
  );
}
