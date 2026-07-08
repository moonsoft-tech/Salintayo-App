import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  cameraOutline,
  imagesOutline,
  closeOutline,
} from 'ionicons/icons';
import './AttachmentModal.css';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachmentSelect: (type: 'camera' | 'gallery' | 'document' | 'voice' | 'location') => void;
}

const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onAttachmentSelect,
}) => {
  if (!isOpen) return null;

  const handleSelect = (type: 'camera' | 'gallery') => {
    onAttachmentSelect(type);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="am-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Bottom sheet */}
      <div className="am-sheet" role="dialog" aria-modal="true" aria-label="Attach media">

        {/* Handle */}
        <div className="am-handle" aria-hidden="true" />

        {/* Header */}
        <div className="am-header">
          <span className="am-title">Add Attachment</span>
          <button
            type="button"
            className="am-close"
            onClick={onClose}
            aria-label="Close"
          >
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        {/* Options */}
        <div className="am-options">

          {/* Camera */}
          <button
            type="button"
            className="am-option"
            onClick={() => handleSelect('camera')}
            aria-label="Open camera"
          >
            <span className="am-option__icon am-option__icon--camera">
              <IonIcon icon={cameraOutline} />
            </span>
            <span className="am-option__label">Camera</span>
          </button>

          {/* Photo Gallery */}
          <button
            type="button"
            className="am-option"
            onClick={() => handleSelect('gallery')}
            aria-label="Open photo gallery"
          >
            <span className="am-option__icon am-option__icon--gallery">
              <IonIcon icon={imagesOutline} />
            </span>
            <span className="am-option__label">Photo Gallery</span>
          </button>

        </div>

        {/* Cancel */}
        <button type="button" className="am-cancel" onClick={onClose}>
          Cancel
        </button>

      </div>
    </>
  );
};

export default AttachmentModal;