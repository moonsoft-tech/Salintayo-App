import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  IonContent,
  IonIcon,
  IonPage,
} from '@ionic/react';
import {
  searchOutline,
  filterOutline,
  lockClosedOutline,
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
  personOutline,
} from 'ionicons/icons';
import './Quiz.css';

const QUIZ_DIALECTS = [
  {
    id: 'tagalog',
    name: 'Tagalog',
    description: 'Subukin ang iyong galing sa wikang Tagalog! Sagutin ang mga tanong at tingnan kung gaano ka kahusay.',
    score: 75,
    progressColor: '#206BFF',
    cardClass: 'quiz-card quiz-card--tagalog',
    levels: [
      { id: 'newbie', label: 'Newbie', unlocked: true, active: true },
      { id: 'intermediate', label: 'Intermediate', unlocked: true, active: false },
      { id: 'expert', label: 'Expert', unlocked: false, active: false },
    ],
  },
  {
    id: 'waray',
    name: 'Waray',
    description: 'Subukin ang iyong galing sa wikang Waray! Sagutin ang mga tanong at tingnan kung gaano ka kahusay.',
    score: 5,
    progressColor: '#FBBF24',
    cardClass: 'quiz-card quiz-card--waray',
    levels: [
      { id: 'newbie', label: 'Newbie', unlocked: true, active: true },
      { id: 'intermediate', label: 'Intermediate', unlocked: false, active: false },
      { id: 'expert', label: 'Expert', unlocked: false, active: false },
    ],
  },
  {
    id: 'ilocano',
    name: 'Ilocano',
    description: 'Subukin ang iyong galing sa wikang Ilocano! Sagutin ang mga tanong at tingnan kung gaano ka kahusay.',
    score: 0,
    progressColor: '#F97316',
    cardClass: 'quiz-card quiz-card--ilocano',
    levels: [
      { id: 'newbie', label: 'Newbie', unlocked: true, active: false },
      { id: 'intermediate', label: 'Intermediate', unlocked: false, active: false },
      { id: 'expert', label: 'Expert', unlocked: false, active: false },
    ],
  },
];

const QuizPage: React.FC = () => {
  const location = useLocation();
  const isQuiz = location.pathname === '/quiz';
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDialects = QUIZ_DIALECTS.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <IonPage>
      <IonContent fullscreen className="quiz-content">
        <div className="quiz-page">
          <header className="quiz-header">
            <h1 className="quiz-header__title">Quiz Time!</h1>
            <div className="quiz-search-row">
              <div className="quiz-search-wrap">
                <IonIcon icon={searchOutline} className="quiz-search__icon" aria-hidden />
                <input
                  type="search"
                  className="quiz-search__input"
                  placeholder="Search your dialect here.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search dialect"
                />
              </div>
              <button
                type="button"
                className="quiz-filter-btn"
                aria-label="Filter"
              >
                <IonIcon icon={filterOutline} className="quiz-filter-btn__icon" />
              </button>
            </div>
          </header>

          <section className="quiz-cards" aria-label="Dialect quizzes">
            {filteredDialects.map((dialect) => (
              <article
                key={dialect.id}
                className={dialect.cardClass}
                aria-labelledby={`quiz-${dialect.id}-title`}
              >
                <div className="quiz-card__header">
                  <span className="quiz-card__feather" aria-hidden>🪶</span>
                  <h2 id={`quiz-${dialect.id}-title`} className="quiz-card__title">
                    {dialect.name}
                  </h2>
                </div>
                <p className="quiz-card__description">{dialect.description}</p>
                <div className="quiz-card__score-wrap">
                  <span className="quiz-card__score-label">Score</span>
                  <div
                    className="quiz-card__score-bar"
                    role="progressbar"
                    aria-valuenow={dialect.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="quiz-card__score-fill"
                      style={{
                        width: `${dialect.score}%`,
                        backgroundColor: dialect.progressColor,
                      }}
                    />
                  </div>
                  <span className="quiz-card__score-value">{dialect.score}%</span>
                </div>
                <div className="quiz-card__levels">
                  {dialect.levels.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      className={`quiz-level-btn ${level.unlocked ? 'quiz-level-btn--unlocked' : 'quiz-level-btn--locked'} ${level.active ? 'quiz-level-btn--active' : ''}`}
                      disabled={!level.unlocked}
                      aria-pressed={level.active}
                    >
                      {!level.unlocked && (
                        <IonIcon icon={lockClosedOutline} className="quiz-level-btn__lock" aria-hidden />
                      )}
                      <span>{level.label}</span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <div className="quiz-spacer" aria-hidden />
        </div>

        <footer className="quiz-footer">
          <nav className="quiz-nav" aria-label="Main">
            <Link to="/learn" className="quiz-nav__item">
              <IonIcon icon={bookOutline} className="quiz-nav__icon" />
              <span className="quiz-nav__label">Learn</span>
            </Link>
            <Link
              to="/quiz"
              className={`quiz-nav__item ${isQuiz ? 'quiz-nav__item--active' : ''}`}
            >
              <IonIcon icon={documentTextOutline} className="quiz-nav__icon" />
              <span className="quiz-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className="quiz-nav__item">
              <IonIcon icon={homeOutline} className="quiz-nav__icon" />
              <span className="quiz-nav__label">Home</span>
            </Link>
            <Link to="/chat" className="quiz-nav__item">
              <IonIcon icon={chatbubbleOutline} className="quiz-nav__icon" />
              <span className="quiz-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className="quiz-nav__item">
              <IonIcon icon={personOutline} className="quiz-nav__icon" />
              <span className="quiz-nav__label">Profile</span>
            </Link>
          </nav>
        </footer>
      </IonContent>
    </IonPage>
  );
};

export default QuizPage;
