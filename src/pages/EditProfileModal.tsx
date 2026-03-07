import React, { useEffect, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import ProfileSheetModal from './ProfileSheetModal';
import { firebaseAuth } from '../firebase';

type EditProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: { displayName: string }) => void;
};

export default function EditProfileModal({ isOpen, onClose, onSave }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSaving(false);
    setDisplayName(firebaseAuth.currentUser?.displayName || '');
  }, [isOpen]);

  const handleSave = async () => {
    setError('');
    const next = displayName.trim();
    if (!next) {
      setError('Please enter your name.');
      return;
    }

    setSaving(true);
    try {
      if (firebaseAuth.currentUser) {
        await updateProfile(firebaseAuth.currentUser, { displayName: next });
      }
      onSave?.({ displayName: next });
      onClose();
    } catch {
      setError('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProfileSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      description="Update your account details."
      footer={(
        <button
          type="button"
          className="profile-btn profile-btn--primary"
          onClick={handleSave}
          disabled={saving}
          style={{ opacity: saving ? 0.8 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Full name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--profile-border)',
            background: 'var(--profile-input-bg)',
            fontFamily: 'var(--profile-font)',
          }}
        />
        {error ? <div style={{ color: 'var(--profile-red)', fontSize: 13 }}>{error}</div> : null}
      </div>
    </ProfileSheetModal>
  );
}

