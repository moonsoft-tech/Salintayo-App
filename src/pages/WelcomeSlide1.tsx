import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import './WelcomeSlide1.css';

const imgLogo = '/logo.png';

const OPTIONS = [
  { icon: '💚', label: 'Filipino reconnecting with roots' },
  { icon: '✈️', label: 'Tourist exploring the Philippines' },
  { icon: '🎓', label: 'Language enthusiast' },
  { icon: '🌐', label: 'Cultural explorer' },
];

export default function WelcomeSlide1() {
  const history = useHistory();
  const { user } = useAuth();

  useEffect(() => {
    if (hasSeenWelcome(user?.uid)) {
      history.replace('/home');
    }
  }, [history, user?.uid]);

  return (
    <div className="welcome-slide1">
      <div className="welcome-slide1__inner">
        <header className="welcome-slide1__header">
          <div className="welcome-slide1__logo">
            <img src={imgLogo} alt="SalinTayo" />
          </div>
          <h1 className="welcome-slide1__title">Ready to begin your journey?</h1>
          <p className="welcome-slide1__intro">Whether you&apos;re a:</p>
        </header>

        <ul className="welcome-slide1__options" aria-label="User type options">
          {OPTIONS.map((opt) => (
            <li key={opt.label}>
              <button type="button" className="welcome-slide1__card">
                <span className="welcome-slide1__card-icon" aria-hidden>{opt.icon}</span>
                <span className="welcome-slide1__card-label">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="welcome-slide1__tagline">
          <strong className="welcome-slide1__tagline-brand">SalinTayo</strong> is here to help you communicate, learn, and connect
        </p>

        <button
          type="button"
          className="welcome-slide1__cta"
          onClick={() => history.push('/welcome-2')}
        >
          Let&apos;s Get Started
        </button>
      </div>
    </div>
  );
}
