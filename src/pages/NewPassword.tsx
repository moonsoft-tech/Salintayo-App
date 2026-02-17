import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import './NewPassword.css';

const imgPasswordIcon =
  '/icons/password.svg';

export default function NewPassword() {
  const history = useHistory();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    // TODO: call API to set new password
    history.push('/login');
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

          <button type="submit" className="new-password-btn">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
