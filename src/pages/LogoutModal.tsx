import React, { useState } from 'react';
import { IonRouterContext } from '@ionic/react';
import { useContext } from 'react';
import { IonIcon } from '@ionic/react';
import { logOutOutline, closeOutline, warningOutline } from 'ionicons/icons';
import { signOut } from 'firebase/auth';
import { firebaseAuth } from '../firebase';
import './LogoutModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
}

const LogoutModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
      await signOut(firebaseAuth);
      // Router handles redirect via guards after auth state change
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoading(false); // only reset on failure so the user can retry
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="lo-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="lo-modal" role="dialog" aria-modal="true" aria-labelledby="lo-title">

        {/* Icon */}
        <div className="lo-icon-wrap">
          <div className="lo-icon-ring">
            <IonIcon icon={logOutOutline} className="lo-icon" />
          </div>
        </div>

        {/* Close button */}
        <button
          className="lo-close"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Cancel"
        >
          <IonIcon icon={closeOutline} />
        </button>

        {/* Text */}
        <h2 id="lo-title" className="lo-title">Log Out</h2>
        <p className="lo-desc">
          Are you sure you want to log out of your account?
        </p>

        {/* Warning note */}
        <div className="lo-note">
          <IonIcon icon={warningOutline} className="lo-note__icon" />
          <span>Your progress and streak are saved to your account.</span>
        </div>

        {/* Actions */}
        <div className="lo-actions">
          <button
            className="lo-btn lo-btn--cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className={`lo-btn lo-btn--confirm${isLoading ? ' lo-btn--loading' : ''}`}
            onClick={handleLogout}
            disabled={isLoading}
          >
            {isLoading
              ? <span className="lo-spinner" aria-hidden="true" />
              : <><IonIcon icon={logOutOutline} className="lo-btn__icon" />Log Out</>
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default LogoutModal;