import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import {
  personCircleOutline,
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
} from 'ionicons/icons';
import './Home.css';

/* Figma / SalinTayo assets */
const imgLogo = 'https://www.figma.com/api/mcp/asset/1cc32414-606a-4f9d-b3a6-d63d911e78b7';

const HomePage: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/home';

  return (
    <IonPage>
      <IonContent fullscreen className="home-content">
        <div className="home-page">
          <header className="home-header">
            <div className="home-header__brand">
              <img src={imgLogo} alt="SalinTayo" className="home-header__logo" />
              <h1 className="home-header__title">SalinTayo</h1>
            </div>
            <Link to="/profile" className="home-header__profile-link" aria-label="Profile">
              <IonIcon icon={personCircleOutline} className="home-header__profile-icon" />
            </Link>
          </header>

          <section className="home-greeting">
            <h2 className="home-greeting__title">Mabuhay, Juan!</h2>
            <p className="home-greeting__subtitle">Here&apos;s your learning progress today.</p>
          </section>

          <section className="home-progress">
            <div className="home-progress__card">
              <h3 className="home-progress__label">Fluency Level</h3>
              <p className="home-progress__value">36% Fluent in Cebuano</p>
              <p className="home-progress__change">+12% this week</p>
              <div className="home-progress__bar-wrap">
                <div className="home-progress__bar" role="progressbar" aria-valuenow={36} aria-valuemin={0} aria-valuemax={100}>
                  <div className="home-progress__bar-fill" style={{ width: '36%' }} />
                </div>
              </div>
            </div>
          </section>

          <section className="home-recommendations">
            <h3 className="home-recommendations__title">SalinTayo Recommends</h3>
            <ul className="home-recommendations__list">
              <li className="home-recommendations__item">
                <span className="home-recommendations__icon" aria-hidden>🤖</span>
                Try the new Ilocano Expert Mode
              </li>
              <li className="home-recommendations__item">
                <span className="home-recommendations__icon" aria-hidden>🎤</span>
                Record your pronunciation now
              </li>
              <li className="home-recommendations__item">
                <span className="home-recommendations__icon" aria-hidden>💬</span>
                Chat with AI to review yesterday&apos;s words
              </li>
            </ul>
          </section>

          <div className="home-spacer" aria-hidden />
        </div>

        <footer className="home-footer">
          <nav className="home-nav" aria-label="Main">
            <Link to="/learn" className="home-nav__item">
              <IonIcon icon={bookOutline} className="home-nav__icon" />
              <span className="home-nav__label">Learn</span>
            </Link>
            <Link to="/quiz" className="home-nav__item">
              <IonIcon icon={documentTextOutline} className="home-nav__icon" />
              <span className="home-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className={`home-nav__item ${isHome ? 'home-nav__item--active' : ''}`}>
              <IonIcon icon={homeOutline} className="home-nav__icon" />
              <span className="home-nav__label">Home</span>
            </Link>
            <Link to="/chat" className="home-nav__item">
              <IonIcon icon={chatbubbleOutline} className="home-nav__icon" />
              <span className="home-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className="home-nav__item">
              <IonIcon icon={personCircleOutline} className="home-nav__icon" />
              <span className="home-nav__label">Profile</span>
            </Link>
          </nav>
        </footer>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
