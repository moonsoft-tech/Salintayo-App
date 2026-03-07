import React, { useMemo, useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
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
import NotifModal from './NotifModal';
import EditProfileModal from './EditProfileModal';
import LanguageModal from './LanguageModal';
import HelpModal from './HelpModal';
import LogoutModal from './LogoutModal';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '../firebase';

const ProfilePage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const isProfile = location.pathname === '/profile';
  const { user } = useAuth();

  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const displayName = useMemo(() => {
    const name = user?.displayName?.trim();
    if (name) return name;
    if (user?.email) return user.email.split('@')[0];
    return 'Juan Dela Cruz';
  }, [user]);

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
                onClick={() => setShowEditProfileModal(true)}
              >
                <IonIcon icon={createOutline} />
              </button>
            </div>
            <h1 className="profile-name">
              {displayName}
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
            <button type="button" className="profile-btn profile-btn--dialect" onClick={() => setShowLanguageModal(true)}>
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
                <button type="button" className="profile-settings-item" onClick={() => setShowEditProfileModal(true)}>
                  <span>Edit Profile</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </button>
              </li>
              <li>
                <button type="button" className="profile-settings-item" onClick={() => setShowLanguageModal(true)}>
                  <span>Language & Region</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </button>
              </li>
              <li>
                <button type="button" className="profile-settings-item" onClick={() => setShowHelpModal(true)}>
                  <span>Help Center</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </button>
              </li>
              <li>
                <button type="button" className="profile-settings-item" onClick={() => setShowNotifModal(true)}>
                  <span>Notification Preferences</span>
                  <IonIcon icon={chevronForwardOutline} className="profile-settings-chevron" />
                </button>
              </li>
              <li>
                <button type="button" className="profile-settings-item profile-settings-item--logout" onClick={() => setShowLogoutModal(true)}>
                  <span>Logout</span>
                  <IonIcon icon={logOutOutline} className="profile-settings-chevron" />
                </button>
              </li>
            </ul>
          </section>

          <div className="profile-spacer" aria-hidden />
        </div>

        {/* Modals */}
        <NotifModal isOpen={showNotifModal} onClose={() => setShowNotifModal(false)} />
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          onSave={(data) => {
            // Keep UI responsive even if auth refresh is delayed
            // eslint-disable-next-line no-console
            console.log('Profile saved:', data);
          }}
        />
        <LanguageModal isOpen={showLanguageModal} onClose={() => setShowLanguageModal(false)} />
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={async () => {
            await signOut(firebaseAuth);
            setShowLogoutModal(false);
            history.replace('/login');
          }}
        />

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
