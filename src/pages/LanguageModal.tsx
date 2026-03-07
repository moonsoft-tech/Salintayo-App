import React, { useMemo, useState } from 'react';
import ProfileSheetModal from './ProfileSheetModal';

type LanguageModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const DIALECTS = ['Tagalog', 'Cebuano', 'Ilocano', 'Hiligaynon'] as const;

export default function LanguageModal({ isOpen, onClose }: LanguageModalProps) {
  const [dialect, setDialect] = useState<(typeof DIALECTS)[number]>('Cebuano');
  const desc = useMemo(() => `Current dialect: ${dialect}`, [dialect]);

  return (
    <ProfileSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Language & Region"
      description={desc}
      footer={(
        <button type="button" className="profile-btn profile-btn--primary" onClick={onClose}>
          Done
        </button>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DIALECTS.map((d) => (
          <button
            key={d}
            type="button"
            className="profile-settings-item"
            onClick={() => setDialect(d)}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid var(--profile-border)',
              color: d === dialect ? 'var(--profile-primary)' : 'var(--profile-text)',
              fontWeight: d === dialect ? 700 : 500,
            }}
          >
            <span>{d}</span>
            <span aria-hidden>{d === dialect ? '✓' : ''}</span>
          </button>
        ))}
      </div>
    </ProfileSheetModal>
  );
}

