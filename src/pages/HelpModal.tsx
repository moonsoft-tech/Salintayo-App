import React from 'react';
import ProfileSheetModal from './ProfileSheetModal';

type HelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <ProfileSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Help Center"
      description="Quick answers and support options."
      footer={(
        <button type="button" className="profile-btn profile-btn--primary" onClick={onClose}>
          Close
        </button>
      )}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: 12, border: '1px solid var(--profile-border)', borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Tips</div>
          <div style={{ color: 'var(--profile-text-muted)', fontSize: 13 }}>
            Use Chat for practice, then take a Quiz to reinforce vocabulary.
          </div>
        </div>
        <div style={{ padding: 12, border: '1px solid var(--profile-border)', borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Contact</div>
          <div style={{ color: 'var(--profile-text-muted)', fontSize: 13 }}>
            If something isn&apos;t working, try signing out and back in. For app issues, reach out to your team admin.
          </div>
        </div>
      </div>
    </ProfileSheetModal>
  );
}

