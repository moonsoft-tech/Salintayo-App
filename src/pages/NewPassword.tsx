import React, { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { resetPasswordWithCode } from '../utils/api';
import './NewPassword.css';

const imgPasswordIcon = '/icons/password.svg';

interface LocationState {
  email?: string;
  code?: string;
}

export default function NewPassword() {
  const history = useHistory();
  const location = useLocation<LocationState>();
  const { email, code } = location.state || {};
  const isPasswordReset = Boolean(email && code);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isPasswordReset) {
        await resetPasswordWithCode(email!, code!, password);
        history.push('/login', { message: 'Password updated. You can now sign in.' });
      } else {
        history.push('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-password-page">
      <div className="new-password-page__inner">
        <h1 className="new-password-title">New Password</h1>

        <form className="new-password-form" onSubmit={handleSubmit}>
          <div className="new-password-field">
            <label htmlFor="new-password" className="new-password-label">
              Enter New Password
            </label>
            <div className="new-password-input-wrap">
              <span className="new-password-input-wrap__icon" aria-hidden>
                <img src={imgPasswordIcon} alt="" />
              </span>
              <input
                id="new-password"
                type="password"
                placeholder="Password"
                aria-label="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="new-password-input"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="new-password-field">
            <label htmlFor="confirm-password" className="new-password-label">
              Confirm Password
            </label>
            <div className="new-password-input-wrap">
              <span className="new-password-input-wrap__icon" aria-hidden>
                <img src={imgPasswordIcon} alt="" />
              </span>
              <input
                id="confirm-password"
                type="password"
                placeholder="Password"
                aria-label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="new-password-input"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <p className="new-password-form__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="new-password-btn" disabled={loading}>
            {loading ? 'Updating…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
