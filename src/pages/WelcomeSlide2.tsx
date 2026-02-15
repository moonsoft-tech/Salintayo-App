import React, { useState, useEffect } from 'react';
import { useHistory, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenWelcome, setHasSeenWelcome } from '../utils/welcomeStorage';
import './WelcomeSlide2.css';

const imgLogo = 'https://www.figma.com/api/mcp/asset/1cc32414-606a-4f9d-b3a6-d63d911e78b7';

type Experience = 'tourist' | 'local' | null;

const TOURIST_FEATURES = ['Quick translations', 'Essential phrases', 'Cultural tips'];
const LOCAL_FEATURES = ['Learn regional dialects', 'Connect with other regions', 'Deepen cultural understanding'];

export default function WelcomeSlide2() {
  const history = useHistory();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Experience>(null);

  useEffect(() => {
    if (hasSeenWelcome(user?.uid)) {
      history.replace('/home');
    }
  }, [history, user?.uid]);

  const handleContinue = () => {
    setHasSeenWelcome(user?.uid);
    history.push('/home');
  };

  return (
    <div className="welcome-slide2">
      <div className="welcome-slide2__inner">
        <header className="welcome-slide2__header">
          <div className="welcome-slide2__logo">
            <img src={imgLogo} alt="SalinTayo" />
          </div>
          <h1 className="welcome-slide2__title">SalinTayo</h1>
          <p className="welcome-slide2__subtitle">Choose your experience</p>
        </header>

        <div className="welcome-slide2__cards">
          <button
            type="button"
            className={`welcome-slide2__card ${selected === 'tourist' ? 'welcome-slide2__card--selected' : ''}`}
            onClick={() => setSelected('tourist')}
          >
            <span className="welcome-slide2__card-radio" aria-hidden>
              {selected === 'tourist' ? '●' : '○'}
            </span>
            <span className="welcome-slide2__card-icon welcome-slide2__card-icon--tourist" aria-hidden>🧳</span>
            <div className="welcome-slide2__card-body">
              <h2 className="welcome-slide2__card-title">TOURIST</h2>
              <p className="welcome-slide2__card-desc">I&apos;m visiting the Philippines</p>
              <ul className="welcome-slide2__card-features">
                {TOURIST_FEATURES.map((f) => (
                  <li key={f}>
                    <span className="welcome-slide2__check" aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </button>

          <button
            type="button"
            className={`welcome-slide2__card ${selected === 'local' ? 'welcome-slide2__card--selected' : ''}`}
            onClick={() => setSelected('local')}
          >
            <span className="welcome-slide2__card-radio" aria-hidden>
              {selected === 'local' ? '●' : '○'}
            </span>
            <span className="welcome-slide2__card-icon welcome-slide2__card-icon--local" aria-hidden>🏠</span>
            <div className="welcome-slide2__card-body">
              <h2 className="welcome-slide2__card-title">LOCAL</h2>
              <p className="welcome-slide2__card-desc">I live in or know the Philippines</p>
              <ul className="welcome-slide2__card-features">
                {LOCAL_FEATURES.map((f) => (
                  <li key={f}>
                    <span className="welcome-slide2__check" aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </button>
        </div>

        <button
          type="button"
          className="welcome-slide2__cta"
          onClick={handleContinue}
        >
          Continue
        </button>

        <p className="welcome-slide2__signin">
          Already have an account? <Link to="/login" className="welcome-slide2__signin-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
