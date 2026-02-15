import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import {
  personCircleOutline,
  createOutline,
  flagOutline,
  statsChartOutline,
  globeOutline,
  settingsOutline,
  chevronForwardOutline,
  logOutOutline,
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
} from 'ionicons/icons';
import './Profile.css';

const ProfilePage: React.FC = () => {
  const location = useLocation();
  const isProfile = location.pathname === '/profile';

  return (
    <IonPage>
      <IonContent fullscreen className="profile-content">
        <div className="profile-page">
          {/* Profile header: avatar + edit, name, flag, learning status */}
          <header className="profile-header">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar-bg" aria-hidden />
              <IonIcon icon={personCircleOutline} className="profile-avatar-icon" aria-hidden />
              <button
                type="button"
                className="profile-avatar-edit"
                aria-label="Edit profile photo"
              >
                <IonIcon icon={createOutline} />
              </button>
            </div>
            <h1 className="profile-name">
              Juan Dela Cruz
              <IonIcon icon={flagOutline} className="profile-name-flag" aria-hidden />
            </h1>
            <p className="profile-learning">Learning: Cebuano | Level: Intermediate</p>
            <div className="profile-arrow" aria-hidden>
              <IonIcon icon={chevronForwardOutline} className="profile-arrow-icon" />
            </div>
          </header>

          {/* Progress Overview card */}
          <section className="profile-card">
            <div className="profile-card__head">
              <IonIcon icon={statsChartOutline} className="profile-card__icon profile-card__icon--blue" />
              <h2 className="profile-card__title">Progress Overview</h2>
            </div>
            <div className="profile-progress-bar-wrap" role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>
              <span className="profile-progress-label profile-progress-label--left">Newbie</span>
              <div className="profile-progress-bar">
                <div className="profile-progress-bar-fill" style={{ width: '50%' }} />
              </div>
              <span className="profile-progress-label profile-progress-label--right">Expert</span>
            </div>
            <div className="profile-progress-label-row">
              <span className="profile-progress-label">Intermediate</span>
            </div>
            <div className="profile-metrics">
              <div className="profile-metric profile-metric--streak">
                <span className="profile-metric__value">7</span>
                <span className="profile-metric__label">Current Streak 🔥</span>
              </div>
              <div className="profile-metric profile-metric--lessons">
                <span className="profile-metric__value">24</span>
                <span className="profile-metric__label">Lessons Completed</span>
              </div>
            </div>
          </section>

          {/* Preferred Dialects card */}
          <section className="profile-card">
            <div className="profile-card__head">
              <IonIcon icon={globeOutline} className="profile-card__icon profile-card__icon--yellow" />
              <h2 className="profile-card__title">Preferred Dialects</h2>
            </div>
            <div className="profile-dialects">
              <span className="profile-dialect-tag">
                <IonIcon icon={flagOutline} className="profile-dialect-tag__icon" />
                Tagalog
              </span>
              <span className="profile-dialect-tag profile-dialect-tag--active">
                🌴 Cebuano
              </span>
            </div>
            <button type="button" className="profile-btn profile-btn--dialect">
              Change Dialect
            </button>
          </section>

          {/* Account Settings card */}
          <section className="profile-card">
            <div className="profile-card__head">
              <IonIcon icon={settingsOutline} className="profile-card__icon profile-card__icon--grey" />
              <h2 className="profile-card__title">Account Settings</h2>
            </div>
            <ul className="profile-settings-list">
              <li>
                <a href="#edit-profile" className="profile-settings-item">
                  <span>Edit Profile</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </a>
              </li>
              <li>
                <a href="#language" className="profile-settings-item">
                  <span>Language & Region</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </a>
              </li>
              <li>
                <a href="#help" className="profile-settings-item">
                  <span>Help Center</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </a>
              </li>
              <li>
                <a href="#logout" className="profile-settings-item profile-settings-item--logout">
                  <span>Logout</span>
                  <IonIcon icon={logOutOutline} className="profile-settings-chevron" />
                </a>
              </li>
            </ul>
          </section>

          <div className="profile-spacer" aria-hidden />
        </div>

        <footer className="profile-footer">
          <nav className="profile-nav" aria-label="Main">
            <Link to="/learn" className="profile-nav__item">
              <IonIcon icon={bookOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Learn</span>
            </Link>
            <Link to="/quiz" className="profile-nav__item">
              <IonIcon icon={documentTextOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className="profile-nav__item">
              <IonIcon icon={homeOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Home</span>
            </Link>
            <Link to="/chat" className={`profile-nav__item ${location.pathname === '/chat' ? 'profile-nav__item--active' : ''}`}>
              <IonIcon icon={chatbubbleOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className={`profile-nav__item ${isProfile ? 'profile-nav__item--active' : ''}`}>
              <IonIcon icon={personCircleOutline} className="profile-nav__icon" />
              <span className="profile-nav__label">Profile</span>
            </Link>
          </nav>
        </footer>
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
