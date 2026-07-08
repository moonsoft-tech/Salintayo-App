import React, { useCallback, useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { closeOutline, chevronForwardOutline } from 'ionicons/icons';
import './HelpModal.css';
import { useAuth } from '../contexts/AuthContext';
import { submitAppFeedback, submitBugReport } from '../utils/helpCenterFirestore';

type SubModal = null | 'guide' | 'bug' | 'rate';

interface HelpItem {
  icon: string;
  title: string;
  subtitle: string;
}

const BUG_TYPES = [
  { value: 'ui', label: 'UI / layout issue' },
  { value: 'functional', label: 'Functional bug (feature not working)' },
  { value: 'crash', label: 'Crash or freeze' },
  { value: 'audio', label: 'Audio / voice (recording, playback, TTS)' },
  { value: 'translation', label: 'Translation / dialect accuracy' },
  { value: 'login', label: 'Login / account' },
  { value: 'performance', label: 'Performance / slow' },
  { value: 'other', label: 'Other' },
];

function platformLabel(): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform();
  }
  return 'web';
}

const USER_GUIDE_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Home & navigation',
    body:
      'Use the bottom tabs to move between Learn, Quiz, Home, Chat, and Profile. Home highlights dialect content and quick entry points.',
  },
  {
    title: 'Learn',
    body:
      'Pick a dialect path, follow lessons, and track your streak. Your progress is saved on this device and can sync with your profile where enabled.',
  },
  {
    title: 'Quiz',
    body:
      'Practice with quizzes for your selected dialect. Review results to see what to study next.',
  },
  {
    title: 'Chat',
    body:
      'Chat helps you practice conversations. You can type, use quick replies, and use attachments or voice where the app supports them. Choose your dialect context so replies match your learning goal.',
  },
  {
    title: 'Profile & settings',
    body:
      'Update your profile, language or dialect preferences, notifications, and help options here. Sign out from the bottom of the profile screen when you are done.',
  },
];

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [bugType, setBugType] = useState(BUG_TYPES[0].value);
  const [bugText, setBugText] = useState('');
  const [bugBusy, setBugBusy] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);
  const [bugSuccessMsg, setBugSuccessMsg] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState<string | null>(null);

  const helpItems: HelpItem[] = [
    { icon: '📖', title: 'User Guide', subtitle: 'Learn how to use SalinTayo' },
    { icon: '🐛', title: 'Report a Bug', subtitle: 'Help us improve the app' },
    { icon: '⭐', title: 'Rate SalinTayo', subtitle: 'Share your feedback' },
  ];

  const closeAll = useCallback(() => {
    setSubModal(null);
    onClose();
  }, [onClose]);

  const closeSub = useCallback(() => {
    setSubModal(null);
    setBugError(null);
    setFeedbackError(null);
    setBugSuccessMsg(null);
    setFeedbackSuccessMsg(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSubModal(null);
      setSelectedItem(null);
      setBugError(null);
      setFeedbackError(null);
      setBugSuccessMsg(null);
      setFeedbackSuccessMsg(null);
    }
  }, [isOpen]);

  const handleItemClick = (itemTitle: string) => {
    setSelectedItem(itemTitle);
    if (itemTitle === 'User Guide') setSubModal('guide');
    else if (itemTitle === 'Report a Bug') setSubModal('bug');
    else if (itemTitle === 'Rate SalinTayo') setSubModal('rate');
  };

  const submitBug = async () => {
    if (!user) {
      setBugError('Please sign in to submit a bug report.');
      return;
    }
    const t = bugText.trim();
    if (t.length < 8) {
      setBugError('Please describe the issue in at least a few words (8+ characters).');
      return;
    }
    setBugBusy(true);
    setBugError(null);
    setBugSuccessMsg(null);
    try {
      const label = BUG_TYPES.find((b) => b.value === bugType)?.label || bugType;
      await submitBugReport({
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || '',
        bugType: label,
        description: t,
        platform: platformLabel(),
      });
      setBugText('');
      setBugSuccessMsg('Thanks! Your report was sent. You can submit another anytime.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send your report.';
      setBugError(msg);
    } finally {
      setBugBusy(false);
    }
  };

  const submitFeedback = async () => {
    if (!user) {
      setFeedbackError('Please sign in to send feedback.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setFeedbackError('Please choose a star rating.');
      return;
    }
    const c = feedbackText.trim();
    if (c.length < 3) {
      setFeedbackError('Please add a short comment (at least 3 characters).');
      return;
    }
    setFeedbackBusy(true);
    setFeedbackError(null);
    setFeedbackSuccessMsg(null);
    try {
      await submitAppFeedback({
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || '',
        rating,
        comment: c,
        platform: platformLabel(),
      });
      setFeedbackText('');
      setRating(0);
      setFeedbackSuccessMsg('Thanks! Your feedback was sent. You can rate again anytime.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send feedback.';
      setFeedbackError(msg);
    } finally {
      setFeedbackBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="help-backdrop" onClick={closeAll} />
      <div className="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-center-title">
        <div className="help-handle" />
        <div className="help-header">
          <button type="button" className="help-close-btn" onClick={closeAll} aria-label="Close help">
            <IonIcon icon={closeOutline} />
          </button>
          <h2 id="help-center-title" className="help-title">
            Help Center
          </h2>
          <span className="help-header-spacer" aria-hidden="true" />
        </div>
        <div className="help-body">
          <p className="help-subtitle">How can we help you?</p>
          <ul className="help-list">
            {helpItems.map((item, index) => (
              <li
                key={index}
                className={`help-item ${selectedItem === item.title ? 'help-item--selected' : ''}`}
                onClick={() => handleItemClick(item.title)}
              >
                <div className="help-item-left">
                  <span className="help-item-icon">{item.icon}</span>
                  <div>
                    <div className="help-item-text">{item.title}</div>
                    <div className="help-item-sub">{item.subtitle}</div>
                  </div>
                </div>
                <IonIcon icon={chevronForwardOutline} className="help-item-chevron" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {subModal === 'guide' && (
        <>
          <div className="help-sub-backdrop" onClick={closeSub} />
          <div className="help-sub-sheet" role="dialog" aria-modal="true" aria-labelledby="help-guide-title">
            <div className="help-sub-header">
              <button type="button" className="help-close-btn" onClick={closeSub} aria-label="Back">
                <IonIcon icon={closeOutline} />
              </button>
              <h2 id="help-guide-title" className="help-title">
                User Guide
              </h2>
              <span className="help-header-spacer" />
            </div>
            <div className="help-sub-body help-guide-scroll">
              <p className="help-guide-lead">How to use SalinTayo</p>
              {USER_GUIDE_SECTIONS.map((sec) => (
                <section key={sec.title} className="help-guide-block">
                  <h3 className="help-guide-h3">{sec.title}</h3>
                  <p className="help-guide-p">{sec.body}</p>
                </section>
              ))}
            </div>
          </div>
        </>
      )}

      {subModal === 'bug' && (
        <>
          <div className="help-sub-backdrop" onClick={closeSub} />
          <div className="help-sub-sheet" role="dialog" aria-modal="true" aria-labelledby="help-bug-title">
            <div className="help-sub-header">
              <button type="button" className="help-close-btn" onClick={closeSub} aria-label="Back">
                <IonIcon icon={closeOutline} />
              </button>
              <h2 id="help-bug-title" className="help-title">
                Report a Bug
              </h2>
              <span className="help-header-spacer" />
            </div>
            <div className="help-sub-body">
              {!user && (
                <p className="help-form-hint help-form-error">Sign in to submit a bug report.</p>
              )}
              {user && (
                <>
                  {bugSuccessMsg && <p className="help-form-success">{bugSuccessMsg}</p>}
                  <label className="help-label" htmlFor="bug-type">
                    Type of issue
                  </label>
                  <select
                    id="bug-type"
                    className="help-select"
                    value={bugType}
                    onChange={(e) => {
                      setBugType(e.target.value);
                      setBugSuccessMsg(null);
                    }}
                  >
                    {BUG_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <label className="help-label" htmlFor="bug-desc">
                    Describe what happened
                  </label>
                  <textarea
                    id="bug-desc"
                    className="help-textarea"
                    rows={5}
                    placeholder="Steps to reproduce, what you expected, and what you saw instead…"
                    value={bugText}
                    onChange={(e) => {
                      setBugText(e.target.value);
                      setBugSuccessMsg(null);
                    }}
                    maxLength={8000}
                  />
                  {bugError && <p className="help-form-error">{bugError}</p>}
                  <button
                    type="button"
                    className="help-primary-btn"
                    disabled={bugBusy}
                    onClick={() => void submitBug()}
                  >
                    {bugBusy ? 'Sending…' : 'Submit report'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {subModal === 'rate' && (
        <>
          <div className="help-sub-backdrop" onClick={closeSub} />
          <div className="help-sub-sheet" role="dialog" aria-modal="true" aria-labelledby="help-rate-title">
            <div className="help-sub-header">
              <button type="button" className="help-close-btn" onClick={closeSub} aria-label="Back">
                <IonIcon icon={closeOutline} />
              </button>
              <h2 id="help-rate-title" className="help-title">
                Rate SalinTayo
              </h2>
              <span className="help-header-spacer" />
            </div>
            <div className="help-sub-body">
              {!user && (
                <p className="help-form-hint help-form-error">Sign in to send feedback.</p>
              )}
              {user && (
                <>
                  {feedbackSuccessMsg && <p className="help-form-success">{feedbackSuccessMsg}</p>}
                  <p className="help-label">Your rating</p>
                  <div className="help-stars" role="group" aria-label="Star rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`help-star ${rating >= n ? 'help-star--on' : ''}`}
                        onClick={() => {
                          setRating(n);
                          setFeedbackSuccessMsg(null);
                        }}
                        aria-pressed={rating >= n}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <label className="help-label" htmlFor="feedback-text">
                    Comments
                  </label>
                  <textarea
                    id="feedback-text"
                    className="help-textarea"
                    rows={4}
                    placeholder="What do you like? What could be better?"
                    value={feedbackText}
                    onChange={(e) => {
                      setFeedbackText(e.target.value);
                      setFeedbackSuccessMsg(null);
                    }}
                    maxLength={8000}
                  />
                  {feedbackError && <p className="help-form-error">{feedbackError}</p>}
                  <button
                    type="button"
                    className="help-primary-btn"
                    disabled={feedbackBusy}
                    onClick={() => void submitFeedback()}
                  >
                    {feedbackBusy ? 'Sending…' : 'Submit feedback'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default HelpModal;
