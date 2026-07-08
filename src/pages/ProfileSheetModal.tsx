import React, { useEffect } from 'react';

type ProfileSheetModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function ProfileSheetModal({
  isOpen,
  title,
  description,
  onClose,
  children,
  footer,
}: ProfileSheetModalProps) {
  useEffect(() => {
    if (!isOpen) return () => {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`profile-modal-overlay ${isOpen ? 'active' : ''}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="profile-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-modal-handle" aria-hidden />
        <div className="profile-modal-top-bar">
          <button type="button" className="profile-modal-back" onClick={onClose}>
            Back
          </button>
          <div className="profile-modal-title">{title}</div>
          <span style={{ width: 40 }} aria-hidden />
        </div>
        <div className="profile-modal-body">
          {description ? <div className="profile-modal-desc">{description}</div> : null}
          {children}
          {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
