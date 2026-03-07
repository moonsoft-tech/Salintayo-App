import React from 'react';
import ProfileSheetModal from './ProfileSheetModal';

type LogoutModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  return (
    <ProfileSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Logout"
      description="Are you sure you want to log out?"
      footer={(
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="profile-btn" onClick={onClose} style={{ background: 'var(--profile-input-bg)' }}>
            Cancel
          </button>
          <button type="button" className="profile-btn profile-btn--primary" onClick={onConfirm}>
            Logout
          </button>
        </div>
      )}
    >
      <div style={{ color: 'var(--profile-text-muted)', fontSize: 13 }}>
        You&apos;ll need to sign in again to access Home, Learn, Quiz, Chat, and Profile.
      </div>
    </ProfileSheetModal>
  );
}

