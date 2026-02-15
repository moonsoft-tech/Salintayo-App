import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth } from '../firebase';
import { isValidEmail } from '../utils/validation';
import './ForgotPassword.css';

const imgEmailIcon = "https://www.figma.com/api/mcp/asset/c7a27c3d-f2c5-4b1c-b4c4-941d2813623e";

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setSent(true);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      setError(
        code === 'auth/user-not-found'
          ? 'No account found for this email.'
          : 'Failed to send reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-page__inner">
        {/* Header: back button + centered title */}
        <header className="forgot-password-header">
          <Link
            to="/login"
            className="forgot-password-header__back"
            aria-label="Go back"
          >
            ‹
          </Link>
          <h1 className="forgot-password-header__title">Forgot Password</h1>
        </header>

        <form className="forgot-password-form" onSubmit={handleSubmit}>
            <label htmlFor="forgot-password-email" className="forgot-password-form__label">
              Enter Email Address
            </label>
            <div className="forgot-password-field">
              <div className="forgot-password-input-wrap">
                <span className="forgot-password-input-wrap__icon" aria-hidden>
                  <img src={imgEmailIcon} alt="" />
                </span>
                <input
                  id="forgot-password-email"
                  type="email"
                  placeholder="Email Address"
                  aria-label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="forgot-password-input"
                  autoComplete="email"
                />
              </div>
            </div>

            {error && (
              <p className="forgot-password-form__error" role="alert">{error}</p>
            )}
            {sent && (
              <p className="forgot-password-form__success" role="status">
                Check your email for a link to reset your password.
              </p>
            )}

            <Link to="/login" className="forgot-password-form__back-link">
              Back to Sign in
            </Link>

            <button type="submit" className="forgot-password-btn forgot-password-btn--primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send'}
            </button>
          </form>

        <div className="forgot-password-signup">
          <p className="forgot-password-signup__text">Don't have an Account</p>
          <Link to="/register" className="forgot-password-btn forgot-password-btn--secondary">
            Signup
          </Link>
        </div>
      </div>
    </div>
  );
}
