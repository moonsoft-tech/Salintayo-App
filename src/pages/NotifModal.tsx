import React, { useState, useEffect } from 'react';
import './NotifModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    className={`nm-toggle ${checked ? 'nm-toggle--on' : ''} ${disabled ? 'nm-toggle--disabled' : ''}`}
    onClick={() => !disabled && onChange(!checked)}
  >
    <span className="nm-toggle-thumb" />
  </button>
);

interface NotifSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  items: { id: string; label: string; desc: string }[];
}

const SECTIONS: NotifSection[] = [
  {
    id: 'learning', label: 'Learning', color: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    items: [
      { id: 'daily_reminder', label: 'Daily Reminder', desc: 'Remind me to practice every day' },
      { id: 'streak_alert',   label: 'Streak Alerts',  desc: 'Alert when my streak is at risk' },
      { id: 'lesson_ready',   label: 'New Lessons',    desc: 'Notify when new content is available' },
    ],
  },
  {
    id: 'progress', label: 'Progress', color: 'teal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    items: [
      { id: 'xp_milestone',  label: 'XP Milestones',  desc: 'Celebrate every 100 XP earned' },
      { id: 'level_up',      label: 'Level Up',        desc: 'Notify when I reach a new level' },
      { id: 'weekly_report', label: 'Weekly Report',   desc: 'Summary of my weekly progress' },
    ],
  },
  {
    id: 'community', label: 'Community', color: 'green',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    items: [
      { id: 'challenges', label: 'Challenges',    desc: 'Friend challenges and invites' },
      { id: 'tips',       label: 'Tips & Tricks', desc: 'Language learning tips from our team' },
    ],
  },
];

type Prefs = Record<string, boolean>;

const DEFAULT_PREFS: Prefs = {
  daily_reminder: true,
  streak_alert:   true,
  lesson_ready:   false,
  xp_milestone:   true,
  level_up:       true,
  weekly_report:  false,
  challenges:     false,
  tips:           true,
};

const QUIET_HOURS = ['8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM', 'Midnight'];
const WAKE_HOURS  = ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM'];

const NotifModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [prefs, setPrefs]       = useState<Prefs>(DEFAULT_PREFS);
  const [original, setOriginal] = useState<{ masterOn: boolean; prefs: Prefs; quietFrom: string; quietTo: string }>({
    masterOn: true, prefs: { ...DEFAULT_PREFS }, quietFrom: '10:00 PM', quietTo: '7:00 AM',
  });
  const [masterOn, setMasterOn] = useState(true);
  const [quietFrom, setQuietFrom] = useState('10:00 PM');
  const [quietTo, setQuietTo]     = useState('7:00 AM');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [visible, setVisible]     = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showConfirm, setShowConfirm]               = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty =
    masterOn !== original.masterOn ||
    quietFrom !== original.quietFrom ||
    quietTo !== original.quietTo ||
    JSON.stringify(prefs) !== JSON.stringify(original.prefs);

  useEffect(() => {
    if (isOpen) {
      setShowConfirm(false);
      setShowDiscardConfirm(false);
      setOriginal({ masterOn: true, prefs: { ...DEFAULT_PREFS }, quietFrom: '10:00 PM', quietTo: '7:00 AM' });
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!visible) return null;

  const toggle = (id: string, val: boolean) => setPrefs(prev => ({ ...prev, [id]: val }));

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  const handleClose = () => {
    if (saving) return;
    if (showConfirm) { setShowConfirm(false); return; }
    if (isDirty) { setShowDiscardConfirm(true); return; }
    onClose();
  };

  const doClose = () => {
    setShowDiscardConfirm(false);
    setShowConfirm(false);
    onClose();
  };

  const handleSaveClick = () => setShowConfirm(true);

  const handleConfirmedSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    await new Promise(r => setTimeout(r, 900));
    setSaving(false);
    setSaved(true);
    setOriginal({ masterOn, prefs: { ...prefs }, quietFrom, quietTo });
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  const changedSummary: string[] = [];
  if (masterOn !== original.masterOn) changedSummary.push(masterOn ? 'Notifications enabled' : 'All notifications paused');
  if (quietFrom !== original.quietFrom || quietTo !== original.quietTo) changedSummary.push(`Quiet hours updated`);
  const changedItems = SECTIONS.flatMap(s => s.items).filter(i => (prefs[i.id] ?? false) !== (original.prefs[i.id] ?? false));
  if (changedItems.length) changedSummary.push(`${changedItems.length} alert${changedItems.length > 1 ? 's' : ''} changed`);

  return (
    <div className={`nm-overlay ${animating ? 'nm-overlay--in' : ''}`} onClick={handleClose}>
      <div className={`nm-sheet ${animating ? 'nm-sheet--in' : ''}`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nm-header">
          <div className="nm-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <h2 className="nm-title">Notifications</h2>
            <p className="nm-subtitle">
              {masterOn ? `${enabledCount} alerts active` : 'All notifications paused'}
            </p>
          </div>
          <button className="nm-close-btn" onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Discard guard ── */}
        {showDiscardConfirm && (
          <div className="nm-confirm-body">
            <div className="nm-confirm-icon nm-confirm-icon--warn">⚠️</div>
            <p className="nm-confirm-title">Discard changes?</p>
            <p className="nm-confirm-sub">Your notification preferences haven't been saved.</p>
            <div className="nm-confirm-actions">
              <button className="nm-cancel-btn" onClick={() => setShowDiscardConfirm(false)}>Keep Editing</button>
              <button className="nm-discard-btn" onClick={doClose}>Discard</button>
            </div>
          </div>
        )}

        {/* ── Save confirm ── */}
        {showConfirm && !showDiscardConfirm && (
          <div className="nm-confirm-body">
            <div className="nm-confirm-icon nm-confirm-icon--success">✅</div>
            <p className="nm-confirm-title">Save preferences?</p>
            <p className="nm-confirm-sub">
              {changedSummary.length ? changedSummary.join(' · ') : 'No changes detected.'}
            </p>
            {!masterOn && (
              <div className="nm-confirm-notice">
                All notifications will be paused, including streak reminders.
              </div>
            )}
            <div className="nm-confirm-actions">
              <button className="nm-cancel-btn" onClick={() => setShowConfirm(false)}>Go Back</button>
              <button className="nm-save-btn nm-save-btn--confirm" onClick={handleConfirmedSave} disabled={changedSummary.length === 0}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><polyline points="20 6 9 17 4 12"/></svg>
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* ── Main body ── */}
        {!showConfirm && !showDiscardConfirm && (
          <>
            <div className="nm-body">
              <div className="nm-master">
                <div className="nm-master-left">
                  <span className="nm-master-emoji">🔔</span>
                  <div>
                    <p className="nm-master-label">All Notifications</p>
                    <p className="nm-master-desc">{masterOn ? 'Notifications are enabled' : 'All notifications paused'}</p>
                  </div>
                </div>
                <Toggle checked={masterOn} onChange={setMasterOn} />
              </div>

              <div className="nm-divider" />

              {SECTIONS.map(section => (
                <div key={section.id} className="nm-section">
                  <div className="nm-section-head">
                    <span className={`nm-section-icon nm-section-icon--${section.color}`}>{section.icon}</span>
                    <span className="nm-section-label">{section.label}</span>
                  </div>
                  <div className="nm-section-items">
                    {section.items.map(item => {
                      const changed = (prefs[item.id] ?? false) !== (original.prefs[item.id] ?? false);
                      return (
                        <div key={item.id} className={`nm-item ${!masterOn ? 'nm-item--disabled' : ''} ${changed ? 'nm-item--changed' : ''}`}>
                          <div className="nm-item-text">
                            <span className="nm-item-label">
                              {item.label}
                              {changed && <span className="nm-item-changed-dot" aria-label="changed" />}
                            </span>
                            <span className="nm-item-desc">{item.desc}</span>
                          </div>
                          <Toggle checked={masterOn && prefs[item.id]} onChange={v => toggle(item.id, v)} disabled={!masterOn} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="nm-quiet">
                <div className="nm-quiet-head">
                  <span className="nm-quiet-icon">🌙</span>
                  <div>
                    <p className="nm-quiet-label">Quiet Hours</p>
                    <p className="nm-quiet-desc">No notifications during this window</p>
                  </div>
                </div>
                <div className="nm-quiet-selects">
                  <div className="nm-select-wrap">
                    <label className="nm-select-label">From</label>
                    <select className="nm-select" value={quietFrom} onChange={e => setQuietFrom(e.target.value)} disabled={!masterOn}>
                      {QUIET_HOURS.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="nm-select-arrow">→</div>
                  <div className="nm-select-wrap">
                    <label className="nm-select-label">Until</label>
                    <select className="nm-select" value={quietTo} onChange={e => setQuietTo(e.target.value)} disabled={!masterOn}>
                      {WAKE_HOURS.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="nm-footer">
              {isDirty && (
                <span className="nm-dirty-badge">
                  <span className="nm-dirty-dot" />Unsaved changes
                </span>
              )}
              <button className="nm-cancel-btn" onClick={handleClose}>Cancel</button>
              <button
                className={`nm-save-btn ${saving ? 'nm-save-btn--loading' : ''} ${saved ? 'nm-save-btn--saved' : ''}`}
                onClick={handleSaveClick}
                disabled={saving || saved}
              >
                {saving ? (
                  <><span className="nm-spinner" />Saving…</>
                ) : saved ? (
                  <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><polyline points="20 6 9 17 4 12"/></svg>Saved!</>
                ) : (
                  'Save Preferences'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotifModal;
