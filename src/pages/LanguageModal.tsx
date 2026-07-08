import React, { useState, useEffect } from 'react';
import { getDefaultDialectCodeForExperience } from '../utils/dialectPreference';
import './LanguageModal.css';

export interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
  gradient: string;
  region: string;
  speakers: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (language: Language) => void;
  currentLanguageCode?: string;
}

export const LANGUAGES: Language[] = [
  { code: 'fil', name: 'Filipino', native: 'Filipino', flag: '🇵🇭', gradient: 'linear-gradient(135deg, #dc2626, #fbbf24)', region: 'Philippines', speakers: '90M+' },
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧', gradient: 'linear-gradient(135deg, #1e40af, #6366f1)', region: 'International', speakers: '1.5B+' },
  { code: 'ceb', name: 'Cebuano', native: 'Bisaya', flag: '🌴', gradient: 'linear-gradient(135deg, #0d9488, #10b981)', region: 'Visayas / Mindanao', speakers: '20M+' },
  { code: 'hil', name: 'Hiligaynon', native: 'Ilonggo', flag: '🌺', gradient: 'linear-gradient(135deg, #db2777, #f472b6)', region: 'Western Visayas', speakers: '7M+' },
  { code: 'ilo', name: 'Ilocano', native: 'Ilokano', flag: '🏝️', gradient: 'linear-gradient(135deg, #0047ab, #06b6d4)', region: 'Northern Luzon', speakers: '9M+' },
  { code: 'pag', name: 'Pangasinan', native: 'Pangasinan', flag: '🌾', gradient: 'linear-gradient(135deg, #ea580c, #fbbf24)', region: 'Central Luzon', speakers: '2M+' },
];

const LanguageModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  currentLanguageCode = getDefaultDialectCodeForExperience(),
}) => {
  const [selectedCode, setSelectedCode] = useState(currentLanguageCode);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCode(currentLanguageCode);
    }
  }, [currentLanguageCode, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timeout = window.setTimeout(() => setVisible(false), 320);
      return () => window.clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!visible) return null;

  const filtered = LANGUAGES.filter((lang) => {
    const query = search.toLowerCase();
    return (
      lang.name.toLowerCase().includes(query) ||
      lang.native.toLowerCase().includes(query) ||
      lang.region.toLowerCase().includes(query)
    );
  });

  const handleSelect = (language: Language) => {
    setSelectedCode(language.code);
    onSave(language);
    onClose();
  };

  return (
    <div
      className={`lm-overlay ${animating ? 'lm-overlay--in' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Dialect selector"
    >
      <div
        className={`lm-sheet ${animating ? 'lm-sheet--in' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lm-header">
          <div className="lm-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h2 className="lm-title">Choose Dialect</h2>
            <p className="lm-subtitle">Select your preferred dialect</p>
          </div>
          <button className="lm-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="lm-search-wrap">
          <svg className="lm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="lm-search"
            type="text"
            placeholder="Search dialects…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search dialects"
          />
          {search && (
            <button className="lm-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <div className="lm-body">
          <div className="lm-list" role="listbox" aria-label="Available dialects">
            {filtered.length === 0 ? (
              <p className="lm-empty">No dialects found for "{search}"</p>
            ) : (
              filtered.map((language) => (
                <button
                  key={language.code}
                  role="option"
                  aria-selected={selectedCode === language.code}
                  className={`lm-lang-item ${selectedCode === language.code ? 'lm-lang-item--active' : ''}`}
                  onClick={() => handleSelect(language)}
                >
                  <span className="lm-lang-flag" style={{ background: language.gradient }}>
                    {language.name.charAt(0)}
                  </span>
                  <div className="lm-lang-info">
                    <span className="lm-lang-name">
                      {language.name}
                      {language.code === getDefaultDialectCodeForExperience() && (
                        <span className="lm-default-badge"> Default</span>
                      )}
                    </span>
                    <span className="lm-lang-meta">
                      {language.native} · {language.region} · {language.speakers} speakers
                    </span>
                  </div>
                  {selectedCode === language.code && (
                    <span className="lm-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageModal;
