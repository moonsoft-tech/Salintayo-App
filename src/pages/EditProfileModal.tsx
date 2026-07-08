import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IonIcon } from '@ionic/react';
import {
  personCircleOutline,
  createOutline,
  closeOutline,
  checkmarkOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  warningOutline,
} from 'ionicons/icons';
import './EditProfileModal.css';

import { firebaseAuth, firebaseDb } from '../firebase';
import { updateProfile, updateEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    displayName: string;
    email: string;
    phone: string;
    bio: string;
    photoBase64?: string;
  }) => void;
}

interface FormState {
  displayName: string;
  email: string;
  phone: string;
  bio: string;
  photoBase64: string | null;
}

type ToastType = 'success' | 'error';
type FieldKey = keyof FormState;
type ValidationState = 'idle' | 'valid' | 'error';

interface FieldMeta {
  state: ValidationState;
  message: string;
  touched: boolean;
}

const EMPTY_META: FieldMeta = { state: 'idle', touched: false, message: '' };

const VALIDATORS: Partial<Record<FieldKey, (v: string) => string>> = {
  displayName: (v) => {
    if (!v.trim()) return 'Display name is required.';
    if (v.trim().length < 2) return 'Must be at least 2 characters.';
    return '';
  },
  email: (v) => {
    if (!v.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
    return '';
  },
  phone: (v) => {
    if (v && !/^[+\d\s\-()]{7,20}$/.test(v)) return 'Enter a valid phone number.';
    return '';
  },
  bio: (v) => {
    if (v.length > 160) return 'Bio must be 160 characters or fewer.';
    return '';
  },
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm]         = useState<FormState>({ displayName: '', email: '', phone: '', bio: '', photoBase64: null });
  const [original, setOriginal] = useState<FormState>({ displayName: '', email: '', phone: '', bio: '', photoBase64: null });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast]       = useState<{ message: string; type: ToastType } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [meta, setMeta] = useState<Record<FieldKey, FieldMeta>>({
    displayName: { ...EMPTY_META },
    email:       { ...EMPTY_META },
    phone:       { ...EMPTY_META },
    bio:         { ...EMPTY_META },
    photoBase64: { ...EMPTY_META },
  });

  const [showConfirm, setShowConfirm]               = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  useEffect(() => {
    if (!isOpen) return;
    setShowConfirm(false);
    setShowDiscardConfirm(false);
    const load = async () => {
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const base: FormState = {
        displayName: user.displayName ?? '',
        email:       user.email ?? '',
        phone:       '',
        bio:         '',
        photoBase64: null,
      };
      try {
        const snap = await getDoc(doc(firebaseDb, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.displayName) base.displayName = d.displayName;
          if (d.phone)       base.phone       = d.phone;
          if (d.bio)         base.bio         = d.bio;
          if (d.photoBase64) base.photoBase64  = d.photoBase64;
        }
      } catch (e) { console.error('Firestore load error:', e); }
      setForm({ ...base });
      setOriginal({ ...base });
      setPhotoPreview(base.photoBase64 ?? user.photoURL ?? null);
      setMeta({ displayName: { ...EMPTY_META }, email: { ...EMPTY_META }, phone: { ...EMPTY_META }, bio: { ...EMPTY_META }, photoBase64: { ...EMPTY_META } });
    };
    load();
  }, [isOpen]);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        let b64 = canvas.toDataURL('image/jpeg', 0.75);
        if (b64.length > 700_000) b64 = canvas.toDataURL('image/jpeg', 0.5);
        resolve(b64);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
      img.src = objectUrl;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select a valid image file.', 'error'); return; }
    try {
      const b64 = await compressImage(file);
      setPhotoPreview(b64);
      setForm(p => ({ ...p, photoBase64: b64 }));
    } catch { showToast('Could not process image. Please try another.', 'error'); }
  };

  const validateField = useCallback((field: FieldKey, value: string) => {
    const validator = VALIDATORS[field];
    if (!validator) return;
    const msg = validator(value);
    setMeta(prev => ({ ...prev, [field]: { state: msg ? 'error' : 'valid', message: msg, touched: true } }));
  }, []);

  const handleChange = (field: FieldKey, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
    if (meta[field].touched) validateField(field, value);
  };

  const handleBlur = (field: FieldKey, value: string) => validateField(field, value);

  const validateAll = (): boolean => {
    let valid = true;
    const updatedMeta = { ...meta };
    (Object.keys(VALIDATORS) as FieldKey[]).forEach(field => {
      const validator = VALIDATORS[field]!;
      const value = (form[field] ?? '') as string;
      const msg = validator(value);
      updatedMeta[field] = { state: msg ? 'error' : 'valid', message: msg, touched: true };
      if (msg) valid = false;
    });
    setMeta(updatedMeta);
    return valid;
  };

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveClick = () => {
    if (!validateAll()) return;
    setShowConfirm(true);
  };

  const isShortUrl = (url: string | null): boolean =>
    !!url && url.length < 1000 && !url.startsWith('data:image/');

  const handleConfirmedSave = async () => {
    setShowConfirm(false);
    const user = firebaseAuth.currentUser;
    if (!user) { showToast('You must be logged in.', 'error'); return; }
    setIsSaving(true);
    try {
      await user.getIdToken(true);
      const authUp: { displayName?: string; photoURL?: string } = {};
      if (form.displayName !== original.displayName) authUp.displayName = form.displayName;
      if (form.photoBase64 && form.photoBase64 !== original.photoBase64 && isShortUrl(form.photoBase64))
        authUp.photoURL = form.photoBase64;
      if (Object.keys(authUp).length) await updateProfile(user, authUp);

      if (form.email !== original.email) {
        try {
          await updateEmail(user, form.email);
        } catch (emailErr: unknown) {
          const emailCode = (emailErr as { code?: string }).code;
          if (emailCode === 'auth/requires-recent-login') {
            showToast('Log out and back in to change your email.', 'error');
            setIsSaving(false);
            return;
          }
          throw emailErr;
        }
      }

      const payload: Record<string, string | null> = {
        displayName: form.displayName,
        email:       form.email,
        phone:       form.phone,
        bio:         form.bio,
      };
      if (form.photoBase64 !== original.photoBase64) payload.photoBase64 = form.photoBase64;

      let errorMessage = '';
      try {
        await setDoc(doc(firebaseDb, 'users', user.uid), payload, { merge: true });
      } catch (fsErr: unknown) {
        const fsCode = (fsErr as { code?: string }).code;
        errorMessage = fsCode === 'permission-denied' ? 'Permission denied. Check Firestore rules.' : 'Could not save to database.';
      }

      if (!errorMessage) {
        showToast('Profile updated!', 'success');
        onSave({ displayName: form.displayName, email: form.email, phone: form.phone, bio: form.bio, photoBase64: form.photoBase64 ?? undefined });
        setOriginal({ ...form });
        setTimeout(() => onClose(), 1400);
      } else {
        showToast(errorMessage, 'error');
      }
    } catch (err: unknown) {
      const errCode = (err as { code?: string }).code;
      showToast(errCode ?? 'Update failed. Please try again.', 'error');
      console.error('Profile update error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    if (showConfirm) { setShowConfirm(false); return; }
    if (isDirty) { setShowDiscardConfirm(true); return; }
    doClose();
  };

  const doClose = () => {
    setForm({ ...original });
    setPhotoPreview(original.photoBase64 ?? firebaseAuth.currentUser?.photoURL ?? null);
    setMeta({ displayName: { ...EMPTY_META }, email: { ...EMPTY_META }, phone: { ...EMPTY_META }, bio: { ...EMPTY_META }, photoBase64: { ...EMPTY_META } });
    setShowDiscardConfirm(false);
    setShowConfirm(false);
    onClose();
  };

  if (!isOpen) return null;

  const changedFields: string[] = [];
  if (form.displayName !== original.displayName) changedFields.push('Display name');
  if (form.email !== original.email)             changedFields.push('Email address');
  if (form.phone !== original.phone)             changedFields.push('Phone number');
  if (form.bio !== original.bio)                 changedFields.push('Bio');
  if (form.photoBase64 !== original.photoBase64) changedFields.push('Profile photo');

  return createPortal(
    <>
      <div className="epm-backdrop" onClick={handleClose} aria-hidden="true" />

      <div className="epm-modal" role="dialog" aria-modal="true" aria-labelledby="epm-title">

        <div className="epm-header">
          <h2 id="epm-title" className="epm-title">
            {showConfirm ? 'Confirm Changes' : showDiscardConfirm ? 'Discard Changes?' : 'Edit Profile'}
          </h2>
          <button type="button" className="epm-close-btn" onClick={handleClose} disabled={isSaving} aria-label="Close modal">
            <IonIcon icon={closeOutline} />
          </button>
        </div>

        {/* ── Discard guard ── */}
        {showDiscardConfirm && (
          <div className="epm-body epm-confirm-body">
            <div className="epm-confirm-icon epm-confirm-icon--warn">
              <IonIcon icon={warningOutline} />
            </div>
            <p className="epm-confirm-title">Discard unsaved changes?</p>
            <p className="epm-confirm-sub">Your edits haven't been saved and will be lost.</p>
            <div className="epm-confirm-actions">
              <button className="epm-btn epm-btn--cancel" onClick={() => setShowDiscardConfirm(false)}>Keep Editing</button>
              <button className="epm-btn epm-btn--discard" onClick={doClose}>Discard</button>
            </div>
          </div>
        )}

        {/* ── Save confirm ── */}
        {showConfirm && !showDiscardConfirm && (
          <div className="epm-body epm-confirm-body">
            <div className="epm-confirm-icon epm-confirm-icon--success">
              <IonIcon icon={checkmarkCircleOutline} />
            </div>
            <p className="epm-confirm-title">Save these changes?</p>
            <p className="epm-confirm-sub">
              {changedFields.length ? `Updating: ${changedFields.join(', ')}.` : 'No changes detected.'}
            </p>
            {form.email !== original.email && (
              <div className="epm-confirm-notice">
                <IonIcon icon={alertCircleOutline} />
                Changing your email requires re-authentication.
              </div>
            )}
            <div className="epm-confirm-changes">
              {changedFields.map(f => (
                <span key={f} className="epm-confirm-tag">
                  <IonIcon icon={checkmarkOutline} /> {f}
                </span>
              ))}
            </div>
            <div className="epm-confirm-actions">
              <button className="epm-btn epm-btn--cancel" onClick={() => setShowConfirm(false)}>Go Back</button>
              <button className="epm-btn epm-btn--save" onClick={handleConfirmedSave} disabled={changedFields.length === 0}>
                <IonIcon icon={checkmarkOutline} className="epm-btn-icon" />Confirm Save
              </button>
            </div>
          </div>
        )}

        {/* ── Main form ── */}
        {!showConfirm && !showDiscardConfirm && (
          <>
            <div className="epm-body">

              <div className="epm-avatar-section">
                <button type="button" className="epm-avatar-wrap" onClick={handlePhotoClick} aria-label="Change profile photo">
                  {photoPreview
                    ? <img src={photoPreview} alt="Profile preview" className="epm-avatar-img" />
                    : <div className="epm-avatar-placeholder"><IonIcon icon={personCircleOutline} className="epm-avatar-placeholder__icon" /></div>
                  }
                  <span className="epm-avatar-badge" aria-hidden="true"><IonIcon icon={createOutline} /></span>
                </button>
                <p className="epm-avatar-hint">Tap to change photo</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="epm-file-input" onChange={handleFileChange} tabIndex={-1} aria-hidden="true" />
              </div>

              <div className="epm-divider" aria-hidden="true" />

              {/* Display Name */}
              <div className={`epm-field epm-field--${meta.displayName.state}`}>
                <label htmlFor="epm-display-name" className="epm-label">
                  Display Name <span className="epm-required" aria-hidden="true">*</span>
                </label>
                <div className="epm-input-wrap">
                  <input
                    id="epm-display-name" type="text" className="epm-input"
                    placeholder="Your full name" value={form.displayName}
                    onChange={e => handleChange('displayName', e.target.value)}
                    onBlur={e => handleBlur('displayName', e.target.value)}
                    maxLength={60} autoComplete="name"
                  />
                  {meta.displayName.state === 'valid' && <span className="epm-field-checkmark" aria-hidden="true"><IonIcon icon={checkmarkCircleOutline} /></span>}
                </div>
                {meta.displayName.state === 'error' && (
                  <span className="epm-error-msg" role="alert"><IonIcon icon={alertCircleOutline} className="epm-error-icon" />{meta.displayName.message}</span>
                )}
              </div>

              {/* Email */}
              <div className={`epm-field epm-field--${meta.email.state}`}>
                <label htmlFor="epm-email" className="epm-label">
                  Email Address <span className="epm-required" aria-hidden="true">*</span>
                </label>
                <div className="epm-input-wrap">
                  <input
                    id="epm-email" type="email" className="epm-input"
                    placeholder="you@example.com" value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                    onBlur={e => handleBlur('email', e.target.value)}
                    autoComplete="email" inputMode="email"
                  />
                  {meta.email.state === 'valid' && <span className="epm-field-checkmark" aria-hidden="true"><IonIcon icon={checkmarkCircleOutline} /></span>}
                </div>
                {meta.email.state === 'error'
                  ? <span className="epm-error-msg" role="alert"><IonIcon icon={alertCircleOutline} className="epm-error-icon" />{meta.email.message}</span>
                  : form.email !== original.email
                    ? <span className="epm-hint epm-hint--warn"><IonIcon icon={warningOutline} />Changing email requires a recent login.</span>
                    : <span className="epm-hint">Used for login and account recovery.</span>
                }
              </div>

              {/* Phone */}
              <div className={`epm-field epm-field--${meta.phone.state}`}>
                <label htmlFor="epm-phone" className="epm-label">Phone Number</label>
                <div className="epm-input-wrap">
                  <input
                    id="epm-phone" type="tel" className="epm-input"
                    placeholder="+63 912 345 6789" value={form.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    onBlur={e => handleBlur('phone', e.target.value)}
                    autoComplete="tel" inputMode="tel"
                  />
                  {meta.phone.state === 'valid' && form.phone && <span className="epm-field-checkmark" aria-hidden="true"><IonIcon icon={checkmarkCircleOutline} /></span>}
                </div>
                {meta.phone.state === 'error'
                  ? <span className="epm-error-msg" role="alert"><IonIcon icon={alertCircleOutline} className="epm-error-icon" />{meta.phone.message}</span>
                  : <span className="epm-hint">Optional · Include country code (e.g. +63)</span>
                }
              </div>

              {/* Bio */}
              <div className={`epm-field epm-field--${meta.bio.state}`}>
                <div className="epm-label-row">
                  <label htmlFor="epm-bio" className="epm-label">Bio</label>
                  <span className={`epm-char-count${form.bio.length > 140 ? ' epm-char-count--warn' : ''}${form.bio.length >= 160 ? ' epm-char-count--over' : ''}`} aria-live="polite">
                    {form.bio.length}/160
                  </span>
                </div>
                <textarea
                  id="epm-bio" className="epm-textarea"
                  placeholder="Tell others a little about yourself…"
                  value={form.bio}
                  onChange={e => handleChange('bio', e.target.value)}
                  onBlur={e => handleBlur('bio', e.target.value)}
                  maxLength={160} rows={3}
                />
                {meta.bio.state === 'error' && (
                  <span className="epm-error-msg" role="alert"><IonIcon icon={alertCircleOutline} className="epm-error-icon" />{meta.bio.message}</span>
                )}
              </div>
            </div>

            <div className="epm-footer">
              {isDirty && (
                <span className="epm-dirty-badge" aria-live="polite">
                  <span className="epm-dirty-dot" />Unsaved changes
                </span>
              )}
              <button type="button" className="epm-btn epm-btn--cancel" onClick={handleClose} disabled={isSaving}>Cancel</button>
              <button type="button" className={`epm-btn epm-btn--save${isSaving ? ' epm-btn--loading' : ''}`} onClick={handleSaveClick} disabled={isSaving}>
                {isSaving ? <span className="epm-spinner" aria-hidden="true" /> : <><IonIcon icon={checkmarkOutline} className="epm-btn-icon" />Save Changes</>}
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className={`epm-toast epm-toast--${toast.type}`} role="status" aria-live="polite">
          <IonIcon icon={toast.type === 'success' ? checkmarkCircleOutline : alertCircleOutline} className="epm-toast-icon" />
          {toast.message}
        </div>
      )}
    </>,
    document.body
  );
};

export default EditProfileModal;
