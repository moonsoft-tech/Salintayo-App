import React, { useState } from 'react';
import ProfileSheetModal from './ProfileSheetModal';

type NotifModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function NotifModal({ isOpen, onClose }: NotifModalProps) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [streakReminders, setStreakReminders] = useState(true);

  return (
    <ProfileSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification Preferences"
      description="Choose what you want to be notified about."
    >
      <div className="profile-toggle-row">
        <div className="profile-toggle-label">Push notifications</div>
        <label className="profile-toggle-switch" aria-label="Push notifications">
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={(e) => setPushEnabled(e.target.checked)}
          />
          <span className="profile-toggle-track" />
        </label>
      </div>

      <div className="profile-toggle-row">
        <div className="profile-toggle-label">Email updates</div>
        <label className="profile-toggle-switch" aria-label="Email updates">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
          />
          <span className="profile-toggle-track" />
        </label>
      </div>

      <div className="profile-toggle-row">
        <div className="profile-toggle-label">Streak reminders</div>
        <label className="profile-toggle-switch" aria-label="Streak reminders">
          <input
            type="checkbox"
            checked={streakReminders}
            onChange={(e) => setStreakReminders(e.target.checked)}
          />
          <span className="profile-toggle-track" />
        </label>
      </div>
    </ProfileSheetModal>
  );
}

