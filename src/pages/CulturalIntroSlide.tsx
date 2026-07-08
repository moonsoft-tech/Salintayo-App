import React, { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { IonPage, IonContent, useIonViewWillEnter } from '@ionic/react';
import { LANGUAGES, Language } from './LanguageModal';
import { setHasSeenWelcome } from '../utils/welcomeStorage';
import { useAuth } from '../contexts/AuthContext';
import './CulturalIntroSlide.css';

/* ─── Cultural data keyed by language code ──────────────── */
interface CulturalData {
  imageUrl: string;
  imageAlt: string;
  description: string;
  highlights: string[];
  facts: { value: string; label: string }[];
}

const CULTURAL_MAP: Record<string, CulturalData> = {
  fil: {
    imageUrl: 'Images/Manila.jpg',
    imageAlt: 'Rizal Monument, Manila',
    description:
      'Filipino, rooted in Tagalog, is the heart of Philippine national identity — weaving together Spanish, Malay, and English into a vibrant living language across 7,000 islands.',
    highlights: ['National language of the Philippines', 'Rich with borrowed Spanish & English words', 'Lingua franca uniting all regions'],
    facts: [
      { value: 'Luzon', label: 'Origin' },
      { value: '1937', label: 'Standardized' },
    ],
  },
  en: {
    imageUrl: 'Images/Manila.jpg',
    imageAlt: 'Manila skyline',
    description:
      'English is an official language of the Philippines — the language of law, higher education, and business, woven together with Filipino in everyday life across the islands.',
    highlights: ['Co-official with Filipino in the Philippines', 'Bridge for global connection & media', 'Filipino English has its own vibrant expressions'],
    facts: [
      { value: 'PH / Global', label: 'Reach' },
      { value: 'Official', label: 'Status' },
    ],
  },
  ceb: {
    imageUrl: 'Images/Cebu.jpg',
    imageAlt: 'Lapu-Lapu Monument, Cebu',
    description:
      'Cebuano (Bisaya) is the most widely spoken regional language in the Philippines, pulsing through the markets of Cebu and the shores of Mindanao.',
    highlights: ['Most spoken regional language in PH', 'Spoken across Visayas & Mindanao', 'Close relative of Hiligaynon & Waray'],
    facts: [
      { value: 'Visayas', label: 'Heartland' },
      { value: '3rd', label: 'PH Rank' },
    ],
  },
  hil: {
    imageUrl: 'Images/Iloilo.jpg',
    imageAlt: 'Iloilo Convention Center',
    description:
      'Hiligaynon (Ilonggo) is the language of festivals, fine cuisine, and warm hospitality — from MassKara smiles to the fragrant La Paz batchoy.',
    highlights: ['Language of Western Visayas festivals', 'Spoken in Iloilo, Bacolod & Antique', 'Close to Kinaray-a and Aklanon'],
    facts: [
      { value: 'W. Visayas', label: 'Region' },
      { value: 'Ilonggo', label: 'Endonym' },
    ],
  },
  ilo: {
    imageUrl: '/assets/images/Ilocos.jpg',
    imageAlt: 'Bantay Bell Tower, Ilocos Sur',
    description:
      'Ilocano thrives among the rugged mountains of Northern Luzon. Known for grit and resourcefulness, its speakers carry the language to every corner of the world.',
    highlights: ['Third largest PH language group', 'Strong diaspora in Hawaii & California', 'Deep literary & oral traditions'],
    facts: [
      { value: 'N. Luzon', label: 'Origin' },
      { value: '2000+', label: 'Yrs Old' },
    ],
  },
  pag: {
    imageUrl: 'Images/Pangasinan.jpg',
    imageAlt: 'Hundred Islands, Pangasinan',
    description:
      'Pangasinan echoes through the fertile lowlands and sun-kissed coasts of Central Luzon — the ancient land of salt, the Hundred Islands, and remarkable resilience.',
    highlights: ['One of the oldest PH regional languages', 'Home to Hundred Islands National Park', 'Linked to Ilocano & Kapampangan cultures'],
    facts: [
      { value: 'C. Luzon', label: 'Region' },
      { value: 'Ancient', label: 'Heritage' },
    ],
  },
};

/* ─── Props ─────────────────────────────────────────────── */
interface Props {
  initialLanguageCode?: string;
  onContinue?: (language: Language) => void;
}

const imgLogo = '/logo.png';

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const GLOBE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

/* ─── Component ─────────────────────────────────────────── */
export default function CulturalIntroSlide({ initialLanguageCode, onContinue }: Props) {
  const history = useHistory();
  const { user } = useAuth();
  const contentRef = React.useRef<HTMLIonContentElement>(null);
  const cultureRef = React.useRef<HTMLElement>(null);

  const [selectedCode, setSelectedCode] = useState<string | null>(initialLanguageCode ?? null);
  const [tappedCode, setTappedCode] = useState<string | null>(null);
  const [cardVisible, setCardVisible] = useState(!!initialLanguageCode);

  const selectedLang = LANGUAGES.find(l => l.code === selectedCode) ?? null;
  const culturalData = selectedCode ? CULTURAL_MAP[selectedCode] ?? null : null;

  const LANG_KEY = 'salintayo_dialect_lang';
  const QCB_LANG_KEY = 'salintayo_qcb_dialect_lang';

  useIonViewWillEnter(() => {
    void contentRef.current?.scrollToTop(0);
  });

  const syncToStorage = (lang: Language) => {
    try {
      localStorage.setItem(LANG_KEY, lang.code);
      localStorage.setItem(QCB_LANG_KEY, lang.code);
      window.dispatchEvent(new Event('salintayo_lang_changed'));
      window.dispatchEvent(new Event('salintayo_qcb_lang_changed'));
    } catch {}
  };

  const handleSelect = useCallback(
    (lang: Language) => {
      setTappedCode(lang.code);
      setTimeout(() => setTappedCode(null), 300);

      if (lang.code === selectedCode) return;

      setCardVisible(false);
      syncToStorage(lang);
      setTimeout(() => {
        setSelectedCode(lang.code);
        setCardVisible(true);
        setTimeout(() => {
          if (cultureRef.current && contentRef.current) {
            const el = cultureRef.current;
            const elTop = el.offsetTop;
            const elHeight = el.offsetHeight;
            const scrollTarget = elTop - window.innerHeight / 2 + elHeight / 2;
            contentRef.current.scrollToPoint(0, Math.max(0, scrollTarget), 400);
          }
        }, 50);
      }, 200);
    },
    [selectedCode]
  );

  const handleContinue = () => {
    if (!selectedLang) return;
    syncToStorage(selectedLang);
    setHasSeenWelcome(user?.uid);
    if (onContinue) {
      onContinue(selectedLang);
    } else {
      history.push('/home');
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ci-ion-content" ref={contentRef}>
        <div className="ci-page">
          <div className="ci-inner">

            {/* ═══ HEADER ═══ */}
            <header className="ci-header">
              <div className="ci-logo-wrap" id="ci-logo-wrap">
                <img
                  className="ci-logo-img"
                  src={imgLogo}
                  alt="SalinTayo"
                  onError={(e) => {
                    (e.currentTarget.closest('.ci-logo-wrap') as HTMLElement)?.classList.add('fallback');
                  }}
                />
                <span className="ci-logo-fallback">S</span>
              </div>
              <h1 className="ci-header-title">Welcome to SalinTayo</h1>
              <p className="ci-header-question">
                Where are you <strong>going</strong> or where are you <strong>right now</strong> in the Philippines?
              </p>
            </header>

            {/* ═══ CULTURAL CONTEXT CARD ═══ */}
            <section className="ci-culture-section" ref={cultureRef}>
              <div className="ci-section-label">Cultural context</div>

              {!selectedCode && (
                <div className="ci-empty-card">
                  <div className="ci-empty-icon">{GLOBE}</div>
                  <p className="ci-empty-title">Pick a dialect below</p>
                  <p className="ci-empty-sub">We'll show you cultural highlights and what makes each language special.</p>
                </div>
              )}

              {selectedCode && culturalData && selectedLang && (
                <div className={`ci-card ${cardVisible ? 'ci-card--visible' : 'ci-card--hidden'}`}>
                  <div className="ci-card-img-wrap">
                    <img className="ci-card-img" src={culturalData.imageUrl} alt={culturalData.imageAlt} loading="lazy" />
                    <div className="ci-card-img-grad" />
                    <div className="ci-card-region-pill">
                      <span className="ci-region-dot" style={{ background: selectedLang.gradient }} />
                      {selectedLang.region}
                    </div>
                    <div className="ci-card-name-wrap">
                      <span className="ci-card-lang-name">{selectedLang.name}</span>
                      <span className="ci-card-lang-native">{selectedLang.native}</span>
                    </div>
                  </div>

                  <div className="ci-card-body">
                    <p className="ci-card-desc">{culturalData.description}</p>
                    <ul className="ci-card-highlights">
                      {culturalData.highlights.map(h => (
                        <li key={h}>
                          <span className="ci-check-dot" aria-hidden="true">{CHECK}</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="ci-facts-row">
                      {culturalData.facts.map(f => (
                        <div className="ci-fact" key={f.label}>
                          <span className="ci-fact-val">{f.value}</span>
                          <span className="ci-fact-lbl">{f.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ═══ CTA ═══ */}
            <div className="ci-cta-section">
              <button className="ci-cta" disabled={!selectedCode} onClick={handleContinue}>
                {selectedCode ? `Continue with ${selectedLang?.name}` : 'Select a dialect to continue'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>

            {/* ═══ DIALECT CHOOSER ═══ */}
            <section className="ci-lang-section">
              <div className="ci-section-label">Choose your dialect</div>
              <div className="ci-lang-grid" role="listbox" aria-label="Available dialects">
                {LANGUAGES.map(lang => {
                  const isActive = selectedCode === lang.code;
                  const isTapped = tappedCode === lang.code;
                  return (
                    <button
                      key={lang.code}
                      role="option"
                      aria-selected={isActive}
                      className={[
                        'ci-lang-btn',
                        isActive ? 'ci-lang-btn--active' : '',
                        isTapped ? 'ci-lang-btn--tapped' : '',
                      ].join(' ')}
                      style={{ background: lang.gradient }}
                      onClick={() => handleSelect(lang)}
                    >
                      <span className="ci-btn-icon" aria-hidden="true">
                        {lang.name.charAt(0)}
                      </span>
                      <span className="ci-btn-texts">
                        <span className="ci-btn-name">{lang.name}</span>
                        <span className="ci-btn-meta">
                          {lang.native} · {lang.region}
                        </span>
                      </span>
                      {isActive ? (
                        <span className="ci-btn-check" aria-hidden="true">{CHECK}</span>
                      ) : (
                        <span className="ci-btn-arrow" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}