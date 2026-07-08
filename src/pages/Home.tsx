import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage, useIonViewWillEnter } from '@ionic/react';
import {
  personCircleOutline,
  personOutline,
  bookOutline,
  documentTextOutline,
  homeOutline,
  chatbubbleOutline,
} from 'ionicons/icons';
import './Home.css';
import { useAuth } from '../contexts/AuthContext';
import { firebaseDb } from '../firebase';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { hasSeenWelcome } from '../utils/welcomeStorage';
import { LANGUAGES, type Language } from './LanguageModal';
import { getResolvedDialectLangCode } from '../utils/dialectPreference';
import CardDetailModal from './CardDetailModal';
import {
  LEARN_ACTIVITY_DATES_KEY,
  LEARN_STREAK_CHANGED_EVENT,
  LOGIN_ACTIVITY_DATES_KEY,
  LOGIN_STREAK_CHANGED_EVENT,
  buildLoginStreakWeekRow,
  computeCurrentLoginStreakFromDates,
  mergeActivityDateStrings,
  phDateKey,
  readLocalLoginDates,
} from '../utils/learnStreak';
import {
  LOGIN_STREAK_SYNCED_EVENT,
  type LoginStreakSyncEventDetail,
  syncLoginStreakOnAuth,
} from '../utils/loginStreakFirestore';
import {
  QUIZ_PROGRESS_UPDATED_EVENT,
  computeLearningLevel,
  loadLocalQuizAttemptsMerged,
  mergeQuizAttempts,
  parseQuizHistoryDoc,
  type QuizAttemptRecord,
} from '../utils/learningLevel';

const imgLogo = '/logo.png';

/** Same key as CulturalIntroSlide / Profile — preferred dialect to learn. */
const DIALECT_LANG_KEY = 'salintayo_dialect_lang';
const QCB_LANG_KEY = 'salintayo_qcb_dialect_lang';

function readDialectCodeFromStorage(): string {
  try {
    return getResolvedDialectLangCode();
  } catch {
    return 'fil';
  }
}

function getPreferredLanguageDisplayName(): string {
  const code = readDialectCodeFromStorage();
  const lang = LANGUAGES.find((l: Language) => l.code === code);
  return lang ? lang.name : 'Filipino';
}

const LEARN_SECTIONS: Record<string, { label: string; preview: string }[]> = {
  cebuano: [
    { label: 'Pronunciation Guide', preview: 'Cebuano uses 5 pure vowels — a, e, i, o, u — with consistent sounds unlike English.' },
    { label: 'Origins & History', preview: 'Cebuano traces roots to Austronesian settlers, refined through Spanish colonial contact.' },
    { label: 'Common Phrases', preview: 'Greetings like "Kumusta ka?" are your first step into daily Cebuano conversation.' },
    { label: 'Grammar Basics', preview: 'Verbo-centric: the verb carries tense through affixes like -on, -an, and mag-.' },
    { label: 'Numbers & Counting', preview: 'Cebuano numbers mix native and Spanish roots: usa, duha, tulo vs. singko, dies.' },
  ],
  filipino: [
    { label: 'Pronunciation Guide', preview: 'Filipino pronunciation is phonetic — each letter has one consistent sound.' },
    { label: 'Origins & History', preview: 'Filipino evolved from Tagalog and was standardized as the national language in 1937.' },
    { label: 'Common Phrases', preview: '"Mabuhay!" means welcome/long live — a perfect first phrase for learners.' },
    { label: 'Grammar Basics', preview: 'Focus system: "Ang" marks the topic, shifting meaning without changing word order.' },
    { label: 'Numbers & Counting', preview: 'Filipino numbers blend native Tagalog and Spanish: isa, dalawa vs. singko, dies.' },
  ],
  hiligaynon: [
    { label: 'Pronunciation Guide', preview: 'Hiligaynon is known for its melodic, soft tone — vowels are elongated and flowing.' },
    { label: 'Origins & History', preview: 'Ilonggo developed in Panay island and spread through Western Visayas trade routes.' },
    { label: 'Common Phrases', preview: '"Kamusta ka?" in Ilonggo sounds different — the musicality is distinct and warm.' },
    { label: 'Grammar Basics', preview: 'Like other Philippine languages, Hiligaynon uses focus markers and verbal affixes.' },
    { label: 'Numbers & Counting', preview: 'Counting in Hiligaynon: isa, duha, tatlo — closely related to Cebuano numerals.' },
  ],
  ilocano: [
    { label: 'Pronunciation Guide', preview: 'Ilocano has a distinct glottal stop and nasal sounds rarely found in other dialects.' },
    { label: 'Origins & History', preview: 'Over 2,000 years of literary tradition — among the oldest written Philippine languages.' },
    { label: 'Common Phrases', preview: '"Naimbag a bigat" means good morning — Ilocano greetings carry cultural warmth.' },
    { label: 'Grammar Basics', preview: 'Ilocano verbs change with -en, -an, and i- affixes to mark grammatical focus.' },
    { label: 'Numbers & Counting', preview: 'Ilocano counting: maysa, dua, tallo — with unique nasal pronunciations.' },
  ],
  pangasinan: [
    { label: 'Pronunciation Guide', preview: 'Pangasinan uses retroflex consonants unique among Philippine languages.' },
    { label: 'Origins & History', preview: 'One of the oldest Philippine languages, spoken since pre-colonial Central Luzon.' },
    { label: 'Common Phrases', preview: '"Maong labi" means good evening — Pangasinan phrases reflect deep cultural ties.' },
    { label: 'Grammar Basics', preview: 'Pangasinan grammar uses focus and aspect — verbs are the sentence backbone.' },
    { label: 'Numbers & Counting', preview: 'Counting in Pangasinan: sakey, duara, talo — distinct from Visayan roots.' },
  ],
};


/* ── Cultural context data — Philippine dialects + English ── */
const culturalCards = [
  {
    id: 'manila',
    image: '/Images/Manila.jpg',
    tag: 'Tagalog / Filipino',
    tagColor: '#dc2626',
    title: 'Manila',
    nativeName: 'Wikang Filipino',
    region: 'NCR / Luzon',
    speakers: '90M+',
    desc: 'Filipino, rooted in Tagalog, is the national language — enriched by Spanish, English, and voices from over 180 regional tongues.',
    highlights: ['National & official language of PH', 'Lingua franca across all islands', 'Standardized in 1937'],
    facts: [
      { value: '90M+', label: 'Speakers' },
      { value: 'Luzon', label: 'Origin' },
      { value: '1937', label: 'Standardized' },
    ],
    dialectCode: 'fil',
  },
  {
    id: 'english',
    image: '/Images/Manila.jpg',
    tag: 'English',
    tagColor: '#1e40af',
    title: 'English',
    nativeName: 'English',
    region: 'Philippines & worldwide',
    speakers: '1.5B+',
    desc: 'English is an official language of the Philippines — the language of law, education, and global connection, spoken alongside Filipino in classrooms, courts, and daily life.',
    highlights: ['Co-official with Filipino in the PH', 'Lingua franca for business & tech', 'Filipino English is widely understood worldwide'],
    facts: [
      { value: '1.5B+', label: 'Speakers' },
      { value: 'Official', label: 'PH Status' },
      { value: 'Global', label: 'Reach' },
    ],
    dialectCode: 'en',
  },
  {
    id: 'cebu',
    image: '/Images/Cebu.jpg',
    tag: 'Cebuano',
    tagColor: '#0d9488',
    title: 'Cebu',
    nativeName: 'Bisaya / Sinugbuanon',
    region: 'Central Visayas',
    speakers: '20M+',
    desc: 'Cebuano (Bisaya) is the most spoken regional language in the Philippines — "unsa imong ngalan?" warms any first meeting.',
    highlights: ['Most spoken regional PH language', 'Lingua franca of Visayas & Mindanao', 'Home of the Sinulog Festival'],
    facts: [
      { value: '20M+', label: 'Speakers' },
      { value: 'Visayas', label: 'Heartland' },
      { value: '2nd', label: 'PH Rank' },
    ],
    dialectCode: 'ceb',
  },
  {
    id: 'iloilo',
    image: '/Images/Iloilo.jpg',
    tag: 'Hiligaynon',
    tagColor: '#db2777',
    title: 'Iloilo',
    nativeName: 'Ilonggo',
    region: 'Western Visayas',
    speakers: '7M+',
    desc: 'Hiligaynon (Ilonggo) rings with warmth and poetry — from the MassKara smiles of Bacolod to the fragrant batchoy of Iloilo City.',
    highlights: ['Language of Western Visayas festivals', 'Spoken in Iloilo, Bacolod, Capiz & Antique', 'Melodic tone with rich literary tradition'],
    facts: [
      { value: '7M+', label: 'Speakers' },
      { value: 'W. Visayas', label: 'Region' },
      { value: 'Ilonggo', label: 'Endonym' },
    ],
    dialectCode: 'hil',
  },
  {
    id: 'banaue',
    image: '/Images/Ilocos.jpg',
    tag: 'Ilocano',
    tagColor: '#0047ab',
    title: 'Ilocos Region',
    nativeName: 'Ilokano',
    region: 'Northern Luzon',
    speakers: '9M+',
    desc: 'Ilocano thrives among the rugged mountains and golden valleys of Northern Luzon — a language renowned for its grit, frugality, and proud diaspora.',
    highlights: ['Third largest Philippine language group', 'Diaspora communities in Hawaii & California', 'Literary heritage spanning 2,000+ years'],
    facts: [
      { value: '9M+', label: 'Speakers' },
      { value: 'N. Luzon', label: 'Origin' },
      { value: '2000+', label: 'Yrs Old' },
    ],
    dialectCode: 'ilo',
  },
  {
    id: 'pangasinan',
    image: '/Images/Pangasinan.jpg',
    tag: 'Pangasinan',
    tagColor: '#ea580c',
    title: 'Pangasinan',
    nativeName: 'Pangasinan',
    region: 'Central Luzon',
    speakers: '2M+',
    desc: 'Pangasinan echoes through the fertile lowlands and sun-kissed coasts of Central Luzon — the ancient land of salt and remarkable resilience.',
    highlights: ['One of the oldest PH regional languages', 'Home to Hundred Islands National Park', 'Linked to Ilocano & Kapampangan cultures'],
    facts: [
      { value: '2M+', label: 'Speakers' },
      { value: 'C. Luzon', label: 'Region' },
      { value: 'Ancient', label: 'Heritage' },
    ],
    dialectCode: 'pag',
  },
];

/** Shown when a cultural card image is missing or fails to load (local + onError). */
const CULTURAL_IMAGE_FALLBACK = '/Images/cultural-fallback.svg';

function CulturalContextImage({
  src,
  alt,
  className,
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [resolved, setResolved] = useState(src);

  useEffect(() => {
    setResolved(src);
  }, [src]);

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => {
        setResolved(current => (current === CULTURAL_IMAGE_FALLBACK ? current : CULTURAL_IMAGE_FALLBACK));
      }}
    />
  );
}

interface ToastData {
  message: string;
  sub: string;
  color: string;
  emoji: string;
}

interface ToastProps {
  data: ToastData | null;
  onDismiss: () => void;
}

const SlideToast: React.FC<ToastProps> = ({ data, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (data) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
      timerRef.current = setTimeout(() => {
        setAnimating(false);
        setTimeout(() => {
          setVisible(false);
          onDismissRef.current();
        }, 350);
      }, 3200);
    }
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current); };
  }, [data]);

  if (!visible || !data) return null;

  return ReactDOM.createPortal(
    <div className={`home-toast ${animating ? 'home-toast--in' : ''}`}>
      <span className="home-toast__emoji">{data.emoji}</span>
      <div className="home-toast__text">
        <span className="home-toast__msg">{data.message}</span>
        <span className="home-toast__sub">{data.sub}</span>
      </div>
      <button
        className="home-toast__dismiss"
        onClick={() => {
          setAnimating(false);
          setTimeout(() => { setVisible(false); onDismiss(); }, 350);
        }}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>,
    document.body
  );
};

/* ── Fire Lighting Overlay ── */
interface FireOverlayProps {
  isOpen: boolean;
  streakCount: number;
  streakWeek: { label: string; state: string }[];
  displayName: string;
  onConfirm: () => void;
  onClose: () => void;
}

const FireOverlay: React.FC<FireOverlayProps> = ({
  isOpen,
  streakCount,
  streakWeek,
  displayName,
  onConfirm,
  onClose,
}) => {
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setAnimIn(true));
    } else {
      setAnimIn(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`home-fire-overlay${animIn ? ' home-fire-overlay--in' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Streak celebration"
    >
      <div
        className="home-fire-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="home-fire-emoji-wrap">
          <div className={`home-fire-bg-circle${animIn ? ' home-fire-bg-circle--explode' : ''}`} />
          <span className={`home-fire-emoji${animIn ? ' home-fire-emoji--pop' : ''}`}>🔥</span>
        </div>

        <h3 className="home-fire-title">Streak lit! 🎉</h3>
        <p className="home-fire-sub">
          {streakCount} Day Streak — keep it up, {displayName}!
        </p>

        <div className="home-fire-day-row" aria-label="Weekly streak progress">
          {streakWeek.map((d, i) => (
            <div
              key={`${d.label}-${i}`}
              className={[
                'home-fire-day-pip',
                d.state === 'completed' ? 'home-fire-day-pip--lit' : '',
                d.state === 'today' ? 'home-fire-day-pip--today' : '',
              ].filter(Boolean).join(' ')}
            >
              {d.label}
            </div>
          ))}
        </div>

        <button className="home-fire-dismiss-btn" onClick={onConfirm}>
          Awesome!
        </button>
      </div>
    </div>,
    document.body
  );
};

const HomePage: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/home';
  const { user } = useAuth();
  const history = useHistory();
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Juan');
  const [fluencyLanguageName, setFluencyLanguageName] = useState(getPreferredLanguageDisplayName);
  const [learnStreakCount, setLearnStreakCount] = useState(0);
  const [loginActivityDateKeys, setLoginActivityDateKeys] = useState<string[]>([]);
  const [mergedQuizAttempts, setMergedQuizAttempts] = useState<QuizAttemptRecord[]>([]);

  const [activeLanguageCode, setActiveLanguageCode] = useState(readDialectCodeFromStorage);
  const [selectedCard, setSelectedCard] = useState<(typeof culturalCards)[number] | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const cultureCarouselTrackRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const lessonsCarouselRef = useRef<HTMLDivElement>(null);
  const [lessonsCarouselIndex, setLessonsCarouselIndex] = useState(0);
  const homeContentRef = useRef<HTMLIonContentElement>(null);
  const quizHistoryFirestoreRef = useRef<QuizAttemptRecord[]>([]);

  /* ── Streak state ── */
  const [todayStreakLit, setTodayStreakLit] = useState(false);
  const [showFireOverlay, setShowFireOverlay] = useState(false);

  /* Check whether today is already recorded in login dates */
  useEffect(() => {
    const today = phDateKey();
    setTodayStreakLit(loginActivityDateKeys.includes(today));
  }, [loginActivityDateKeys]);

  const syncFluencyLanguageLabel = useCallback(() => {
    setFluencyLanguageName(getPreferredLanguageDisplayName());
  }, []);

  const loadHomeProfile = useCallback(async () => {
    if (!user) return;
    setDisplayName(user.displayName ?? 'Juan');
    setPhotoSrc(user.photoURL ?? null);

    try {
      const snap = await getDoc(doc(firebaseDb, 'users', user.uid));
      const data = snap.exists() ? snap.data() : null;

      const rawDates = data?.loginActivityDates;
      const fireDates = Array.isArray(rawDates)
        ? rawDates.filter((x): x is string => typeof x === 'string')
        : undefined;
      const merged = mergeActivityDateStrings(readLocalLoginDates(), fireDates);
      try {
        localStorage.setItem(LOGIN_ACTIVITY_DATES_KEY, JSON.stringify(merged));
      } catch { /* ignore */ }
      setLoginActivityDateKeys(merged);

      const streakFromDb =
        typeof data?.streakCount === 'number' && Number.isFinite(data.streakCount)
          ? Math.floor(data.streakCount)
          : typeof data?.loginStreak === 'number' && Number.isFinite(data.loginStreak)
            ? Math.floor(data.loginStreak)
            : null;
      const computed = computeCurrentLoginStreakFromDates(new Set(merged));
      setLearnStreakCount(streakFromDb !== null ? streakFromDb : computed);

      if (data) {
        if (typeof data.displayName === 'string' && data.displayName.trim()) {
          setDisplayName(data.displayName);
        }
        if (typeof data.photoBase64 === 'string' && data.photoBase64.trim()) {
          setPhotoSrc(data.photoBase64);
        }
      }
    } catch (e) {
      console.error('Home profile load error:', e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadHomeProfile();
  }, [user?.uid, loadHomeProfile]);

  /** Quiz history (Firestore + local fallback, real-time) — filtered by active dialect below. */
  useEffect(() => {
    if (!user?.uid) {
      setMergedQuizAttempts(loadLocalQuizAttemptsMerged());
      return;
    }

    const colRef = collection(firebaseDb, 'users', user.uid, 'quizHistory');
    const unsub = onSnapshot(
      colRef,
      snapshot => {
        const fromFs: QuizAttemptRecord[] = [];
        snapshot.forEach(d => {
          const parsed = parseQuizHistoryDoc(d.id, d.data() as Record<string, unknown>);
          if (parsed) fromFs.push(parsed);
        });
        quizHistoryFirestoreRef.current = fromFs;
        setMergedQuizAttempts(mergeQuizAttempts(fromFs, loadLocalQuizAttemptsMerged()));
      },
      err => {
        console.error('Learning level quizHistory listener:', err);
        quizHistoryFirestoreRef.current = [];
        setMergedQuizAttempts(mergeQuizAttempts([], loadLocalQuizAttemptsMerged()));
      }
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const onQuizUpdated = () => {
      const local = loadLocalQuizAttemptsMerged();
      if (!user?.uid) {
        setMergedQuizAttempts(local);
        return;
      }
      setMergedQuizAttempts(mergeQuizAttempts(quizHistoryFirestoreRef.current, local));
    };
    window.addEventListener(QUIZ_PROGRESS_UPDATED_EVENT, onQuizUpdated);
    return () => window.removeEventListener(QUIZ_PROGRESS_UPDATED_EVENT, onQuizUpdated);
  }, [user?.uid]);

  useEffect(() => {
    syncFluencyLanguageLabel();
    const onDialectChanged = () => {
      syncFluencyLanguageLabel();
      setActiveLanguageCode(readDialectCodeFromStorage());
    };
    window.addEventListener('salintayo_lang_changed', onDialectChanged);
    return () => window.removeEventListener('salintayo_lang_changed', onDialectChanged);
  }, [syncFluencyLanguageLabel]);

  const scrollCarouselTo = useCallback((index: number) => {
    const track = cultureCarouselTrackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, culturalCards.length - 1));
    setCarouselIndex(clamped);
    const items = track.querySelectorAll<HTMLElement>('.home-culture__snap-item');
    if (items[clamped]) {
      items[clamped].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  /* Sync index on manual swipe/scroll */
  useEffect(() => {
    const track = cultureCarouselTrackRef.current;
    if (!track) return;
    const handleScroll = () => {
      const items = track.querySelectorAll<HTMLElement>('.home-culture__snap-item');
      let closest = 0;
      let minDist = Infinity;
      const trackCenter = track.getBoundingClientRect().left + track.offsetWidth / 2;
      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - trackCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setCarouselIndex(closest);
    };
    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => track.removeEventListener('scroll', handleScroll);
  }, []);

  /* Lessons carousel scroll handler */
  useEffect(() => {
    const track = lessonsCarouselRef.current;
    if (!track) return;
    const handleScroll = () => {
      const items = track.querySelectorAll<HTMLElement>('.home-lessons__card');
      let closest = 0;
      let minDist = Infinity;
      const trackCenter = track.getBoundingClientRect().left + track.offsetWidth / 2;
      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - trackCenter);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setLessonsCarouselIndex(closest);
    };
    track.addEventListener('scroll', handleScroll, { passive: true });
    return () => track.removeEventListener('scroll', handleScroll);
  }, []);

  /* Scroll carousel to the active dialect card on mount + whenever dialect changes */
  useEffect(() => {
    const activeIndex = culturalCards.findIndex(c => c.dialectCode === activeLanguageCode);
    if (activeIndex === -1) return;

    const doScroll = () => {
      const track = cultureCarouselTrackRef.current;
      if (!track) return;
      const items = track.querySelectorAll<HTMLElement>('.home-culture__snap-item-wrap');
      if (items[activeIndex]) {
        setCarouselIndex(activeIndex);
        items[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    };

    requestAnimationFrame(() => {
      doScroll();
      setTimeout(doScroll, 120);
    });
  }, [activeLanguageCode]);

  const dismissToast = useCallback(() => setToast(null), []);

  const handleDialectSelect = useCallback((lang: Language) => {
    setActiveLanguageCode(lang.code);
    try {
      localStorage.setItem(DIALECT_LANG_KEY, lang.code);
      localStorage.setItem(QCB_LANG_KEY, lang.code);
      window.dispatchEvent(new Event('salintayo_lang_changed'));
      window.dispatchEvent(new Event('salintayo_qcb_lang_changed'));
    } catch { /* ignore */ }
    setToast({
      message: `Dialect switched to ${lang.name}`,
      sub: `${lang.native} · ${lang.region}`,
      color: '#0047ab',
      emoji: '🌏',
    });
  }, []);

  /* Handle streak fire overlay confirm */
  const handleFireConfirm = useCallback(async () => {
    setShowFireOverlay(false);
    setTodayStreakLit(true);
    if (user) {
      try {
        const r = await syncLoginStreakOnAuth(user.uid);
        setLearnStreakCount(r.streakCount);
        setLoginActivityDateKeys(r.loginActivityDates);
        try {
          localStorage.setItem(LOGIN_ACTIVITY_DATES_KEY, JSON.stringify(r.loginActivityDates));
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.error('Streak sync on confirm failed:', e);
      }
    }
    window.dispatchEvent(new Event(LOGIN_STREAK_CHANGED_EVENT));
  }, [user]);

  useEffect(() => {
    const onLearn = () => {
      if (!user) return;
      void loadHomeProfile();
    };
    window.addEventListener(LOGIN_STREAK_CHANGED_EVENT, onLearn);
    return () => window.removeEventListener(LOGIN_STREAK_CHANGED_EVENT, onLearn);
  }, [user?.uid, loadHomeProfile]);

  /** Overlay when auth streak sync finishes (avoids racing `useIonViewWillEnter`). */
  useEffect(() => {
    const onSynced = (ev: Event) => {
      const d = (ev as CustomEvent<LoginStreakSyncEventDetail>).detail;
      if (!d?.shouldShowCelebration) return;
      setLearnStreakCount(d.streakCount);
      setShowFireOverlay(true);
    };
    window.addEventListener(LOGIN_STREAK_SYNCED_EVENT, onSynced as EventListener);
    return () => window.removeEventListener(LOGIN_STREAK_SYNCED_EVENT, onSynced as EventListener);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!hasSeenWelcome(user.uid)) {
      history.replace('/welcome');
    }
  }, [user?.uid, history]);

  useIonViewWillEnter(() => {
    void homeContentRef.current?.scrollToTop(0);
    // Check if we just logged in today for the first time
    syncFluencyLanguageLabel();
    const code = readDialectCodeFromStorage();
    setActiveLanguageCode(code);

    const activeIndex = culturalCards.findIndex(c => c.dialectCode === code);
    if (activeIndex !== -1) {
      setTimeout(() => {
        const track = cultureCarouselTrackRef.current;
        if (!track) return;
        const items = track.querySelectorAll<HTMLElement>('.home-culture__snap-item-wrap');
        if (items[activeIndex]) {
          setCarouselIndex(activeIndex);
          items[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 80);
    }

    if (!user) return;
    loadHomeProfile();
  });

  const learningLevel = useMemo(
    () =>
      computeLearningLevel(
        mergedQuizAttempts.filter(a => a.dialectId === activeLanguageCode)
      ),
    [mergedQuizAttempts, activeLanguageCode]
  );

  const progressPercent = learningLevel.proficiencyPercent;

  const circleSize = 80;
  const circleStroke = 8;
  const circleRadius = (circleSize - circleStroke) / 2;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference * (1 - progressPercent / 100);

  const streakWeek = useMemo(
    () => buildLoginStreakWeekRow(new Set(loginActivityDateKeys)),
    [loginActivityDateKeys]
  );

  const streakTitle =
    learnStreakCount === 1 ? '1 Day Streak!' : `${learnStreakCount} Day Streak!`;
  const streakSubtitle =
    learnStreakCount > 0
      ? "Keep it up! You're logging in every day."
      : 'Log in daily to start your streak.';

  const activeDialect = readDialectCodeFromStorage();
  const dialectSections = LEARN_SECTIONS[activeDialect] || LEARN_SECTIONS.filipino;

  const recentLessons = useMemo(() => {
    return dialectSections.map((section, idx) => {
      let status: string;
      let active: boolean;
      if (idx === 0) {
        status = 'Completed';
        active = true;
      } else if (idx === 1) {
        status = 'In Progress';
        active = false;
      } else {
        status = 'Locked';
        active = false;
      }
      const icons = ['📖', '📜', '💬', '📝', '🔢'];
      return {
        icon: icons[idx] || '📚',
        title: section.label,
        desc: section.preview.split(' — ')[0] || section.preview.substring(0, 50) + '...',
        status,
        active,
      };
    });
  }, [activeDialect]);

  return (
    <IonPage>
      <IonContent fullscreen className="home-content" ref={homeContentRef}>
        <SlideToast data={toast} onDismiss={dismissToast} />

        <CardDetailModal
          card={selectedCard}
          isOpen={cardModalOpen}
          onClose={() => setCardModalOpen(false)}
          onSelectDialect={handleDialectSelect}
          currentLanguageCode={activeLanguageCode}
        />

        {/* Fire lighting overlay — rendered via portal to document.body */}
        <FireOverlay
          isOpen={showFireOverlay}
          streakCount={learnStreakCount}
          streakWeek={streakWeek}
          displayName={displayName}
          onConfirm={handleFireConfirm}
          onClose={() => setShowFireOverlay(false)}
        />

        <div className="home-page">
          <header className="home-header">
            <div className="hero-banner"></div>
            
            <svg className="hero-wave" viewBox="0 0 1200 40" preserveAspectRatio="none">
              <path d="M0,20 C240,40 540,0 840,20 C1050,35 1200,10 1200,18 L1200,40 L0,40 Z" fill="#ffffff"/>
            </svg>

            <div className="home-header__brand">
              <img src={imgLogo} alt="SalinTayo" className="home-header__logo" />
              <h1 className="home-header__title">SalinTayo</h1>
            </div>
            <div className="home-header__greeting">
              <h2 id='homemabu' className="home-greeting__title">Mabuhay, {displayName}!</h2>
              <p className="home-greeting__subtitle">Here&apos;s your learning progress today.</p>
            </div>
            <Link to="/profile" className="home-header__profile-link" aria-label="Profile">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Your profile photo"
                  className="home-header__profile-img"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <IonIcon icon={personCircleOutline} className="home-header__profile-icon" />
              )}
            </Link>
          </header>

          <section className="home-culture" aria-label="Cultural context">
            <div className="home-culture__header">
              <h3 className="home-culture__title">Cultural Context</h3>
            </div>

            <div className="home-culture__snap-viewport">
              <div
                className="home-culture__snap-track"
                ref={cultureCarouselTrackRef}
              >
                {culturalCards.map((c, idx) => {
                  const isActive = c.dialectCode === activeLanguageCode;
                  const isCurrent = idx === carouselIndex;
                  const langGradient = LANGUAGES.find((l: Language) => l.code === c.dialectCode)?.gradient ?? 'linear-gradient(135deg, #0047ab, #7c3aed)';
                  return (
                    <div key={c.id} className="home-culture__snap-item-wrap">
                      {isActive && (
                        <div className="home-culture__active-badge">
                          <span className="home-culture__active-badge-dot" style={{ background: c.tagColor }} />
                          Active Dialect
                        </div>
                      )}
                      <div
                        data-culture-id={c.id}
                        className={`home-culture__snap-item${isActive ? ' home-culture__snap-item--active-dialect' : ''}${isCurrent ? ' home-culture__snap-item--focused' : ''}`}
                        style={{ '--card-gradient': langGradient } as React.CSSProperties}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedCard(c);
                            setCardModalOpen(true);
                          }
                        }}
                        onClick={() => {
                          setSelectedCard(c);
                          setCardModalOpen(true);
                        }}
                        aria-label={`View details for ${c.title}`}
                      >
                        <div className="home-culture__strip-img-wrap">
                          <CulturalContextImage src={c.image} alt={c.title} className="home-culture__strip-img" loading="lazy" />
                          <div className="home-culture__strip-img-grad" />

                          <div className="home-culture__strip-region-pill">
                            <span
                              className="home-culture__strip-region-dot"
                              style={{ background: c.tagColor }}
                            />
                            {c.region}
                          </div>

                          <div className="home-culture__strip-speakers-pill">
                            {c.speakers} speakers
                          </div>

                          <div className="home-culture__strip-name-wrap">
                            <span className="home-culture__strip-lang-name">{c.title}</span>
                            <span className="home-culture__strip-lang-native">{c.nativeName}</span>
                          </div>

                          <div className="home-culture__strip-tap-hint" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="16"/>
                              <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            Tap for details
                          </div>
                        </div>

                        <div className="home-culture__strip-body">
                          <span
                            className="home-culture__strip-tag"
                            style={{ '--tag-color': c.tagColor } as React.CSSProperties}
                          >
                            {c.tag}
                          </span>
                          <p className="home-culture__strip-desc">{c.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom nav: arrow ← | dots | arrow → */}
            <div className="home-culture__bottom-nav">
              <button
                className="home-culture__arrow"
                onClick={() => scrollCarouselTo(carouselIndex - 1)}
                disabled={carouselIndex === 0}
                aria-label="Previous dialect"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <div className="home-culture__dots" aria-hidden="true">
                {culturalCards.map((c, idx) => (
                  <button
                    key={c.id}
                    className={`home-culture__dot${idx === carouselIndex ? ' home-culture__dot--active' : ''}`}
                    onClick={() => scrollCarouselTo(idx)}
                    style={idx === carouselIndex ? { background: culturalCards[carouselIndex].tagColor } : undefined}
                    aria-label={`Go to ${c.title}`}
                  />
                ))}
              </div>

              <button
                className="home-culture__arrow"
                onClick={() => scrollCarouselTo(carouselIndex + 1)}
                disabled={carouselIndex === culturalCards.length - 1}
                aria-label="Next dialect"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </section>

          {/* ===== Progress / Mastery Card ===== */}
          <section className="home-progress">
            <div className="home-progress__card">
              <div className="home-progress__content">
                <div className="home-progress__info">
                  <h3 className="home-progress__label">Learning Level</h3>
                  <p className="home-progress__value">
                    {learningLevel.tier} proficiency sa {fluencyLanguageName}
                  </p>
                  <p className="home-progress__change">{learningLevel.weekChangeLabel}</p>
                  <div className="home-progress__bar-wrap">
                    <div
                      className="home-progress__bar"
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="home-progress__bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
                <div className="home-progress__circle-wrap" aria-label={`${progressPercent}% Proficiency`}>
                  <svg className="home-progress__circle" viewBox={`0 0 ${circleSize} ${circleSize}`} role="img" aria-hidden="true">
                    <circle
                      className="home-progress__circle-bg"
                      cx={circleSize / 2}
                      cy={circleSize / 2}
                      r={circleRadius}
                      fill="none"
                      strokeWidth={circleStroke}
                    />
                    <circle
                      className="home-progress__circle-fill"
                      cx={circleSize / 2}
                      cy={circleSize / 2}
                      r={circleRadius}
                      fill="none"
                      strokeWidth={circleStroke}
                      strokeLinecap="round"
                      strokeDasharray={`${circleCircumference} ${circleCircumference}`}
                      strokeDashoffset={circleOffset}
                    />
                  </svg>
                  <div className="home-progress__circle-text" aria-hidden="true">
                    <span className="home-progress__circle-value">{progressPercent}</span>
                    <span className="home-progress__circle-percent">%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== Day Streak ===== */}
          <section className="home-streak">

            {/* Reminder badge — only when today hasn't been lit */}
            {!todayStreakLit && learnStreakCount > 0 && (
              <div className="home-streak__reminder" role="alert">
                <span className="home-streak__reminder-dot" aria-hidden="true" />
                <span>You haven&apos;t logged today yet — keep your streak alive!</span>
              </div>
            )}
            {!todayStreakLit && learnStreakCount === 0 && (
              <div className="home-streak__reminder" role="alert">
                <span className="home-streak__reminder-dot" aria-hidden="true" />
                <span>Complete a lesson today to start your streak!</span>
              </div>
            )}

            <div
              className={`home-streak__card${!todayStreakLit ? ' home-streak__card--tappable' : ''}`}
              onClick={() => { if (!todayStreakLit) setShowFireOverlay(true); }}
              role={!todayStreakLit ? 'button' : undefined}
              tabIndex={!todayStreakLit ? 0 : undefined}
              aria-label={!todayStreakLit ? "Tap to light today's streak" : undefined}
              onKeyDown={e => {
                if (!todayStreakLit && (e.key === 'Enter' || e.key === ' ')) {
                  setShowFireOverlay(true);
                }
              }}
            >
              {/* Hover overlay — fades in on hover */}
              <div className="home-streak__hover-overlay" aria-hidden="true">
                <span className="home-streak__hover-icon">🔥</span>
                <span className="home-streak__hover-text">
                  {todayStreakLit
                    ? "You've lit today's streak!"
                    : "Tap to light today's streak!"}
                </span>
              </div>

              <div className="home-streak__header">
                <div className="home-streak__icon-wrap" aria-hidden>
                  <span className="home-streak__icon">🔥</span>
                </div>
                <div className="home-streak__info">
                  <h3 className="home-streak__title">{streakTitle}</h3>
                  <p className="home-streak__subtitle">{streakSubtitle}</p>
                </div>
              </div>
              <div className="home-streak__days" aria-label="Weekly streak">
                {streakWeek.map((d, idx) => (
                  <div
                    key={`${d.label}-${idx}`}
                    className={[
                      'home-streak__day',
                      d.state === 'completed' ? 'home-streak__day--completed' : '',
                      d.state === 'today' ? 'home-streak__day--today' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="home-streak__day-label">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="home-lessons" aria-label="Recent lessons">
            <h3 className="home-lessons__title">Recent Lessons</h3>
            <div className="home-lessons__carousel" ref={lessonsCarouselRef}>
              {recentLessons.map((l, idx) => (
                <div
                  key={idx}
                  className={[
                    'home-lessons__card',
                    l.active ? 'home-lessons__card--active' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="home-lessons__card-icon" aria-hidden>{l.icon}</div>
                  <h4 className="home-lessons__card-title">{l.title}</h4>
                  <p className="home-lessons__card-desc">{l.desc}</p>
                  <span className="home-lessons__card-status">{l.status}</span>
                </div>
              ))}
            </div>
            <div className="home-lessons__dots" aria-hidden>
              {recentLessons.map((_, idx) => (
                <span
                  key={idx}
                  className={[
                    'home-lessons__dot',
                    idx === lessonsCarouselIndex ? 'home-lessons__dot--active' : '',
                  ].filter(Boolean).join(' ')}
                />
              ))}
            </div>
          </section>

          <section className="home-recommendations">
            <h3 className="home-recommendations__title">SalinTayo Recommends</h3>
            <ul className="home-recommendations__list">
              <li className="home-recommendations__item">
                <span className="home-recommendations__icon" aria-hidden>📚</span>
                Start learning {getPreferredLanguageDisplayName()}
              </li>
              <li className="home-recommendations__item">
                <span className="home-recommendations__icon" aria-hidden>🎤</span>
                Practice pronunciation with voice recording
              </li>
              <li className="home-recommendations__item">
                <span className="home-recommendations__icon" aria-hidden>🧠</span>
                Take a quiz to test your knowledge
              </li>
            </ul>
          </section>

          <div className="home-spacer" aria-hidden />
        </div>

        <footer className="home-footer">
          <nav className="home-nav" aria-label="Main">
            <Link to="/learn" className="home-nav__item">
              <IonIcon icon={bookOutline} className="home-nav__icon" />
              <span className="home-nav__label">Learn</span>
            </Link>
            <Link to="/quiz" className="home-nav__item">
              <IonIcon icon={documentTextOutline} className="home-nav__icon" />
              <span className="home-nav__label">Quiz</span>
            </Link>
            <Link to="/home" className={`home-nav__item ${isHome ? 'home-nav__item--active' : ''}`}>
              <IonIcon icon={homeOutline} className="home-nav__icon" />
              <span className="home-nav__label">Home</span>
            </Link>
            <Link to="/chat" className="home-nav__item">
              <IonIcon icon={chatbubbleOutline} className="home-nav__icon" />
              <span className="home-nav__label">Chat</span>
            </Link>
            <Link to="/profile" className="home-nav__item">
              <IonIcon icon={personOutline} className="home-nav__icon" />
              <span className="home-nav__label">Profile</span>
            </Link>
          </nav>
        </footer>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;