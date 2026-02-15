import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonToolbar,
} from '@ionic/react';
import {
  bookOutline,
  flagOutline,
  statsChartOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
  personOutline,
  trophyOutline,
  flag,
  schoolOutline,
} from 'ionicons/icons';
import './Learn.css';

const LearnPage: React.FC = () => {
  const location = useLocation();
  const isLearn = location.pathname === '/learn';

  const levels = [
    {
      id: 'newbie',
      emoji: '🪶',
      title: 'Newbie Mode',
      description: 'Learn the basics — greetings, numbers, and simple phrases.',
      progress: 25,
      progressColor: '#206BFF',
      buttonLabel: 'Start Learning',
      buttonBg: '#206BFF',
      cardClass: 'learn-card learn-card--newbie',
    },
    {
      id: 'intermediate',
      emoji: '🌴',
      title: 'Intermediate Mode',
      description: 'Practice daily conversations and local expressions.',
      progress: 60,
      progressColor: '#FF2D55',
      buttonLabel: 'Continue',
      buttonBg: '#FF2D55',
      cardClass: 'learn-card learn-card--intermediate',
    },
    {
      id: 'expert',
      emoji: '🔥',
      title: 'Expert Mode',
      description: 'Master the dialect with real-world scenarios.',
      progress: 90,
      progressColor: '#FF6B8A',
      buttonLabel: 'Continue',
      buttonBg: '#FF6B8A',
      cardClass: 'learn-card learn-card--expert',
    },
  ];

  const achievements = [
    { icon: trophyOutline, label: 'Beginner Badge' },
    { icon: flag, label: 'Streak Goal' },
    { icon: schoolOutline, label: 'Level Up' },
  ];

  return (
    <IonPage>
      <IonHeader className="ion-no-border learn-header-bar">
        <IonToolbar>
          <div className="learn-header-icons" slot="start">
            <IonIcon icon={bookOutline} className="learn-header-icon" />
            <IonIcon icon={flagOutline} className="learn-header-icon learn-header-icon--flag" />
          </div>
          <IonIcon
            icon={statsChartOutline}
            className="learn-header-stats"
            slot="end"
            aria-label="Statistics"
          />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="learn-content">
        <div className="learn-page">
          <section className="learn-hero">
            <h1 className="learn-hero__title">Choose Your Learning Level</h1>
            <p className="learn-hero__subtitle">
              Train your AI language skills, step by step.
            </p>
          </section>

          <section className="learn-cards">
            {levels.map((level) => (
              <article
                key={level.id}
                className={level.cardClass}
                aria-labelledby={`learn-${level.id}-title`}
              >
                <div className="learn-card__header">
                  <span className="learn-card__emoji" aria-hidden>
                    {level.emoji}
                  </span>
                  <h2 id={`learn-${level.id}-title`} className="learn-card__title">
                    {level.title}
                  </h2>
                </div>
                <p className="learn-card__description">{level.description}</p>
                <div className="learn-card__progress-wrap">
                  <span className="learn-card__progress-label">Progress</span>
                  <div className="learn-card__progress-bar" role="progressbar" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="learn-card__progress-fill"
                      style={{
                        width: `${level.progress}%`,
                        backgroundColor: level.progressColor,
                      }}
                    />
                  </div>
                  <span className="learn-card__progress-value">{level.progress}%</span>
                </div>
                <button
                  type="button"
                  className="learn-card__btn"
                  style={{ backgroundColor: level.buttonBg }}
                >
                  {level.buttonLabel}
                </button>
              </article>
            ))}
          </section>

          <section className="learn-achievements" aria-labelledby="learn-achievements-title">
            <h3 id="learn-achievements-title" className="learn-achievements__title">
              Your Achievements
            </h3>
            <div className="learn-achievements__grid">
              {achievements.map((a) => (
                <div key={a.label} className="learn-achievement">
                  <IonIcon icon={a.icon} className="learn-achievement__icon" />
                  <span className="learn-achievement__label">{a.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="learn-spacer" aria-hidden />
        </div>

        <footer className="learn-footer">
          <nav className="learn-nav" aria-label="Main">
            <Link
              to="/learn"
              className={`learn-nav__item ${isLearn ? 'learn-nav__item--active' : ''}`}
            >
              <IonIcon icon={bookOutline} className="learn-nav__icon" />
              <span className="learn-nav__label">Learn</span>
            </Link>
            <Link to="/quiz" className="learn-nav__item">
              <IonIcon icon={documentTextOutline} className="learn-nav__icon" />
              <span className="learn-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className="learn-nav__item">
              <IonIcon icon={homeOutline} className="learn-nav__icon" />
              <span className="learn-nav__label">Home</span>
            </Link>
            <Link to="/chat" className={`learn-nav__item ${location.pathname === '/chat' ? 'learn-nav__item--active' : ''}`}>
              <IonIcon icon={chatbubbleOutline} className="learn-nav__icon" />
              <span className="learn-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className="learn-nav__item">
              <IonIcon icon={personOutline} className="learn-nav__icon" />
              <span className="learn-nav__label">Profile</span>
            </Link>
          </nav>
        </footer>
      </IonContent>
    </IonPage>
  );
};

export default LearnPage;
