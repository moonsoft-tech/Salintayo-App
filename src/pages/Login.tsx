import React, { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { firebaseAuth } from '../firebase';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { isValidEmail } from '../utils/validation';
import './Login.css';

const imgLogo = '/logo.png';
const imgEmailIcon = '/icons/email.svg';
const imgPasswordIcon = '/icons/password.svg';
const imgGoogleIcon = '/icons/google.svg';

export default function LoginPage() {
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(firebaseAuth, email, password);
      history.push(hasSeenWelcome(user.uid) ? '/home' : '/welcome');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'code' in err
        ? (err as { code: string }).code === 'auth/invalid-credential'
          ? 'Invalid email or password.'
          : (err as { code: string }).code === 'auth/user-not-found'
            ? 'No account found for this email.'
            : 'Login failed. Please try again.'
        : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(firebaseAuth, provider);
      history.push(hasSeenWelcome(user.uid) ? '/home' : '/welcome');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'code' in err
        ? (err as { code: string }).code === 'auth/popup-closed-by-user'
          ? 'Sign-in was cancelled.'
          : (err as { code: string }).code === 'auth/cancelled-popup-request'
            ? 'Sign-in was cancelled.'
            : (err as { code: string }).code === 'auth/account-exists-with-different-credential'
              ? 'An account already exists with the same email but different sign-in method. Try signing in with email/password.'
              : 'Google sign-in failed. Please try again.'
        : 'Google sign-in failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__inner">
        {/* Header: Logo + Welcome */}
        <header className="login-header">
          <div className="login-header__logo">
            <img src={imgLogo} alt="SalinTayo" />
          </div>
          <h1 className="login-header__title">Welcome to <span className="login-header__title-brand">SalinTayo!</span></h1>
          <p className="login-header__subtitle">Continue learning and translating with AI.</p>
        </header>

        {/* Form card */}
        <form className="login-form" onSubmit={handleLogin}>
          {/* Email */}
          <div className="login-field">
            <div className="login-input-wrap">
              <span className="login-input-wrap__icon" aria-hidden>
                <img src={imgEmailIcon} alt="" />
              </span>
              <input
                id="login-email"
                type="email"
                placeholder="Email Address"
                aria-label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <div className="login-input-wrap">
              <span className="login-input-wrap__icon" aria-hidden>
                <img src={imgPasswordIcon} alt="" />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input login-input--with-action"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-input-wrap__action"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="login-form__forgot">
            <Link to="/forgot-password" className="login-form__forgot-link">Forgot Password?</Link>
          </div>

          {error && (
            <p className="login-form__error" role="alert">{error}</p>
          )}

          {/* Primary CTA */}
          <button type="submit" className="login-btn login-btn--primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Login'}
          </button>

          {/* Divider */}
          <div className="login-divider">
            <span className="login-divider__text">or continue with</span>
          </div>

          {/* Google */}
          <button
            type="button"
            className="login-btn login-btn--google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <img src={imgGoogleIcon} alt="" className="login-btn__google-icon" />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {/* Register link */}
          <p className="login-form__register">
            <span className="login-form__register-text">Don't have an account?</span>{' '}
            <Link to="/register" className="login-form__register-link">Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
