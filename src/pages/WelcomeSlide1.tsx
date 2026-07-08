import React, { useEffect } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useIonContentScrollTopOnEnter } from '../utils/useIonContentScrollTopOnEnter';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import './WelcomeSlide1.css';

const imgLogo = '/logo.png';

/** Static highlights for Slide 1 — not selectable; overview only. */
const FEATURES = [
  { icon: '💬', label: 'Chat & practice with AI' },
  { icon: '📝', label: 'Quizzes & bite-sized lessons' },
  { icon: '🔥', label: 'Streaks & learning progress' },
  { icon: '🌏', label: 'Dialects & cultural context' },
];

export default function WelcomeSlide1() {
  const history = useHistory();
  const { user } = useAuth();
  const welcomeContentRef = useIonContentScrollTopOnEnter();

  useEffect(() => {
    if (hasSeenWelcome(user?.uid)) {
      history.replace('/home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only redirect when user changes
  }, [user?.uid]);

  return (
    <IonPage>
      <IonContent fullscreen ref={welcomeContentRef}>
        <div className="welcome-slide1">
          <div className="welcome-slide1__inner">
            <header className="welcome-slide1__header">
              <div className="welcome-slide1__logo">
                <img src={imgLogo} alt="SalinTayo" />
              </div>
              <h1 className="welcome-slide1__title">SalinTayo</h1>
              <p className="welcome-slide1__subtitle">Philippine languages, made approachable</p>
              <p className="welcome-slide1__lede">
                Explore regional dialects, practice real conversations, and grow your skills at your own pace—whether
                you&apos;re learning for travel, family, or curiosity.
              </p>
            </header>

            <ul className="welcome-slide1__features" aria-label="What you can do in SalinTayo">
              {FEATURES.map((item) => (
                <li key={item.label} className="welcome-slide1__feature">
                  <span className="welcome-slide1__feature-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="welcome-slide1__feature-label">{item.label}</span>
                </li>
              ))}
            </ul>

            <p className="welcome-slide1__tagline">
              <strong className="welcome-slide1__tagline-brand">SalinTayo</strong> helps you communicate with confidence
              and connect more deeply with Filipino culture.
            </p>

            <Link to="/welcome-2" className="welcome-slide1__cta">
              Let&apos;s Get Started
            </Link>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
