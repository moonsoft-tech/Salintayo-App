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

const imgLogo = '/logo.png';

const HomePage: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/home';
  const progressPercent = 36;
  const streakDays = 5;

  const circleSize = 80;
  const circleStroke = 8;
  const circleRadius = (circleSize - circleStroke) / 2; // 36
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference * (1 - progressPercent / 100);

  const streakWeek = [
    { label: 'M', state: 'completed' as const },
    { label: 'T', state: 'completed' as const },
    { label: 'W', state: 'completed' as const },
    { label: 'T', state: 'completed' as const },
    { label: 'F', state: 'completed' as const },
    { label: 'S', state: 'today' as const },
    { label: 'S', state: 'upcoming' as const },
  ];

  const recentLessons = [
    {
      icon: '📖',
      title: 'Basic Greetings',
      desc: 'Learn common Filipino greetings',
      status: 'Completed',
      active: true,
    },
    {
      icon: '💬',
      title: 'Common Phrases',
      desc: 'Everyday conversations',
      status: 'In Progress',
      active: false,
    },
    {
      icon: '🗣️',
      title: 'Pronunciation',
      desc: 'Master Filipino sounds',
      status: 'Locked',
      active: false,
    },
  ];

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
              <div className="home-progress__content">
                <div className="home-progress__info">
                  <h3 className="home-progress__label">Fluency Level</h3>
                  <p className="home-progress__value">{progressPercent}% Fluent in Cebuano</p>
                  <p className="home-progress__change">+12% this week</p>
                  <div className="home-progress__bar-wrap">
                    <div
                      className="home-progress__bar"
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="home-progress__bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
                <div className="home-progress__circle-wrap" aria-label={`${progressPercent}% fluency`}>
                  <svg className="home-progress__circle" viewBox={`0 0 ${circleSize} ${circleSize}`} role="img" aria-hidden="true">
                    <circle
                      className="home-progress__circle-bg"
                      cx={circleSize / 2}
                      cy={circleSize / 2}
                      r={circleRadius}
                      fill="none"
                      strokeWidth={circleStroke}
                    />
                    <circle
                      className="home-progress__circle-fill"
                      cx={circleSize / 2}
                      cy={circleSize / 2}
                      r={circleRadius}
                      fill="none"
                      strokeWidth={circleStroke}
                      strokeLinecap="round"
                      strokeDasharray={`${circleCircumference} ${circleCircumference}`}
                      strokeDashoffset={circleOffset}
                    />
                  </svg>
                  <div className="home-progress__circle-text" aria-hidden="true">
                    <span className="home-progress__circle-value">{progressPercent}</span>
                    <span className="home-progress__circle-percent">%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="home-streak">
            <div className="home-streak__card">
              <div className="home-streak__header">
                <div className="home-streak__icon-wrap" aria-hidden>
                  <span className="home-streak__icon">🔥</span>
                </div>
                <div className="home-streak__info">
                  <h3 className="home-streak__title">{streakDays} Day Streak!</h3>
                  <p className="home-streak__subtitle">Keep it up! You&apos;re learning every day.</p>
                </div>
              </div>
              <div className="home-streak__days" aria-label="Weekly streak">
                {streakWeek.map((d, idx) => (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${d.label}-${idx}`}
                    className={[
                      'home-streak__day',
                      d.state === 'completed' ? 'home-streak__day--completed' : '',
                      d.state === 'today' ? 'home-streak__day--today' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="home-streak__day-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="home-lessons" aria-label="Recent lessons">
            <h3 className="home-lessons__title">Recent Lessons</h3>
            <div className="home-lessons__carousel">
              {recentLessons.map((l) => (
                <div
                  key={l.title}
                  className={[
                    'home-lessons__card',
                    l.active ? 'home-lessons__card--active' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="home-lessons__card-icon" aria-hidden>{l.icon}</div>
                  <h4 className="home-lessons__card-title">{l.title}</h4>
                  <p className="home-lessons__card-desc">{l.desc}</p>
                  <span className="home-lessons__card-status">{l.status}</span>
                </div>
              ))}
            </div>
            <div className="home-lessons__dots" aria-hidden>
              <span className="home-lessons__dot home-lessons__dot--active" />
              <span className="home-lessons__dot" />
              <span className="home-lessons__dot" />
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
