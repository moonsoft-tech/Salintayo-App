import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useIonContentScrollTopOnEnter } from '../utils/useIonContentScrollTopOnEnter';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import {
  DIALECT_LANG_STORAGE_KEY,
  QCB_DIALECT_LANG_STORAGE_KEY,
  EXPERIENCE_STORAGE_KEY,
} from '../utils/dialectPreference';
import './WelcomeSlide2.css';

const imgLogo = '/logo.png';

type Experience = 'tourist' | 'local' | null;

const TOURIST_FEATURES = ['Quick translations', 'Essential phrases', 'Cultural tips'];
const LOCAL_FEATURES = ['Learn regional dialects', 'Connect with other regions', 'Deepen cultural understanding'];

export default function WelcomeSlide2() {
  const history = useHistory();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Experience>(null);
  const welcomeContentRef = useIonContentScrollTopOnEnter();

  useEffect(() => {
    if (hasSeenWelcome(user?.uid)) {
      history.replace('/home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only redirect when user changes
  }, [user?.uid]);

  const handleContinue = () => {
    if (!selected) return;
    try {
      localStorage.setItem(EXPERIENCE_STORAGE_KEY, selected);
      const dialectCode = selected === 'tourist' ? 'en' : 'fil';
      localStorage.setItem(DIALECT_LANG_STORAGE_KEY, dialectCode);
      localStorage.setItem(QCB_DIALECT_LANG_STORAGE_KEY, dialectCode);
      window.dispatchEvent(new Event('salintayo_lang_changed'));
      window.dispatchEvent(new Event('salintayo_qcb_lang_changed'));
    } catch {}
    history.push('/cultural-intro');
  };

  return (
    <IonPage>
      <IonContent fullscreen ref={welcomeContentRef}>
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
              className={`welcome-slide2__cta${selected ? ' welcome-slide2__cta--active' : ''}`}
              onClick={handleContinue}
            >
              Continue
            </button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}