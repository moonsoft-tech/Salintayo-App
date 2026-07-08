import React, { useEffect, useState } from 'react';
import { useParams, useHistory, useLocation, Link } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  IonFooter,
  IonIcon,
} from '@ionic/react';
import {
  arrowBackOutline,
  bookOutline,
  chatbubbleOutline,
  documentTextOutline,
  homeOutline,
  personOutline,
  volumeHighOutline,
  timeOutline,
  chatboxOutline,
  schoolOutline,
  calculatorOutline,
} from 'ionicons/icons';
import './DialectDetail.css';
import { ACTIVE_DIALECT_KEY } from './Learn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  label: string;
  icon: string;
  preview: string;
  content: ContentItem[];
}

interface ContentItem {
  type: 'phrase' | 'rule' | 'fact' | 'number';
  native: string;
  english?: string;
  note?: string;
}

// ─── Full dialect data ────────────────────────────────────────────────────────

const DIALECT_DATA: Record<string, {
  name: string;
  native: string;
  gradient: string;
  speakers: string;
  region: string;
  difficulty: string;
  sections: Section[];
}> = {
  filipino: {
    name: 'Filipino',
    native: 'Filipino',
    gradient: 'linear-gradient(135deg, #dc2626, #fbbf24)',
    speakers: '90M+',
    region: 'Nationwide',
    difficulty: 'Beginner-friendly',
    sections: [
      {
        id: 'pronunciation-guide',
        label: 'Pronunciation Guide',
        icon: 'volume',
        preview: 'Filipino pronunciation is phonetic — each letter has one consistent sound.',
        content: [
          { type: 'rule', native: 'A', english: 'ah', note: 'Like "father"' },
          { type: 'rule', native: 'E', english: 'eh', note: 'Like "bed"' },
          { type: 'rule', native: 'I', english: 'ee', note: 'Like "see"' },
          { type: 'rule', native: 'O', english: 'oh', note: 'Like "go"' },
          { type: 'rule', native: 'U', english: 'oo', note: 'Like "food"' },
          { type: 'rule', native: 'NG', english: 'ng', note: 'Like "sing" — can start a word' },
        ],
      },
      {
        id: 'origins-history',
        label: 'Origins & History',
        icon: 'time',
        preview: 'Filipino evolved from Tagalog and was standardized as the national language in 1937.',
        content: [
          { type: 'fact', native: '1937', note: 'Filipino declared national language' },
          { type: 'fact', native: 'Tagalog roots', note: 'Based on the Manila dialect of Tagalog' },
          { type: 'fact', native: 'Spanish influence', note: '4,000+ borrowed Spanish words' },
          { type: 'fact', native: 'English influence', note: 'Heavy borrowing post-1898 American era' },
          { type: 'fact', native: 'Baybayin', note: 'Ancient pre-colonial script, still used symbolically' },
        ],
      },
      {
        id: 'common-phrases',
        label: 'Common Phrases',
        icon: 'chat',
        preview: '"Mabuhay!" means welcome/long live — a perfect first phrase for learners.',
        content: [
          { type: 'phrase', native: 'Mabuhay!', english: 'Welcome! / Long live!', note: 'Universal greeting' },
          { type: 'phrase', native: 'Kumusta ka?', english: 'How are you?', note: 'Casual check-in' },
          { type: 'phrase', native: 'Salamat', english: 'Thank you', note: 'Use often!' },
          { type: 'phrase', native: 'Oo / Hindi', english: 'Yes / No', note: 'Basic agreement' },
          { type: 'phrase', native: 'Magandang umaga', english: 'Good morning', note: 'Formal greeting' },
          { type: 'phrase', native: 'Paalam', english: 'Goodbye', note: 'Formal farewell' },
          { type: 'phrase', native: 'Paumanhin', english: 'Excuse me / Sorry', note: 'Polite apology' },
        ],
      },
      {
        id: 'grammar-basics',
        label: 'Grammar Basics',
        icon: 'school',
        preview: 'Focus system: "Ang" marks the topic, shifting meaning without changing word order.',
        content: [
          { type: 'rule', native: 'Ang', note: 'Marks the topic/subject of a sentence' },
          { type: 'rule', native: 'Ng', note: 'Marks the object or possession' },
          { type: 'rule', native: 'Sa', note: 'Marks location or direction' },
          { type: 'rule', native: 'Mag- prefix', note: 'Creates action verbs: magluto (to cook)' },
          { type: 'rule', native: '-in suffix', note: 'Marks object focus: lutuin (to be cooked)' },
        ],
      },
      {
        id: 'numbers-counting',
        label: 'Numbers & Counting',
        icon: 'calculator',
        preview: 'Filipino numbers blend native Tagalog and Spanish: isa, dalawa vs. singko, dies.',
        content: [
          { type: 'number', native: 'Isa', english: '1' },
          { type: 'number', native: 'Dalawa', english: '2' },
          { type: 'number', native: 'Tatlo', english: '3' },
          { type: 'number', native: 'Apat', english: '4' },
          { type: 'number', native: 'Lima', english: '5' },
          { type: 'number', native: 'Anim', english: '6' },
          { type: 'number', native: 'Pito', english: '7' },
          { type: 'number', native: 'Walo', english: '8' },
          { type: 'number', native: 'Siyam', english: '9' },
          { type: 'number', native: 'Sampu', english: '10' },
        ],
      },
    ],
  },
  cebuano: {
    name: 'Cebuano',
    native: 'Bisaya',
    gradient: 'linear-gradient(135deg, #0d9488, #10b981)',
    speakers: '20M+',
    region: 'Visayas & Mindanao',
    difficulty: 'Moderate',
    sections: [
      {
        id: 'pronunciation-guide',
        label: 'Pronunciation Guide',
        icon: 'volume',
        preview: 'Cebuano uses 5 pure vowels — a, e, i, o, u — with consistent sounds unlike English.',
        content: [
          { type: 'rule', native: 'A', english: 'ah', note: 'Short, crisp — like "father"' },
          { type: 'rule', native: 'E', english: 'eh', note: 'Like "bed"' },
          { type: 'rule', native: 'I', english: 'ee', note: 'Like "see"' },
          { type: 'rule', native: 'O', english: 'oh', note: 'Rounded, like "go"' },
          { type: 'rule', native: 'U', english: 'oo', note: 'Like "food"' },
          { type: 'rule', native: 'Glottal stop', note: 'A hard stop between vowels — e.g. "ba-at"' },
        ],
      },
      {
        id: 'origins-history',
        label: 'Origins & History',
        icon: 'time',
        preview: 'Cebuano traces roots to Austronesian settlers, refined through Spanish colonial contact.',
        content: [
          { type: 'fact', native: 'Austronesian', note: 'Part of the Malayo-Polynesian family' },
          { type: 'fact', native: '1521', note: 'Spanish contact with Cebu under Magellan' },
          { type: 'fact', native: 'Bisaya', note: 'Native name; "Cebuano" is the Spanish-influenced term' },
          { type: 'fact', native: '20M+ speakers', note: '2nd most spoken language in the Philippines' },
          { type: 'fact', native: 'Literary heritage', note: 'Rich oral poetry tradition called "Balak"' },
        ],
      },
      {
        id: 'common-phrases',
        label: 'Common Phrases',
        icon: 'chat',
        preview: 'Greetings like "Kumusta ka?" are your first step into daily Cebuano conversation.',
        content: [
          { type: 'phrase', native: 'Kumusta ka?', english: 'How are you?', note: 'Common greeting' },
          { type: 'phrase', native: 'Salamat', english: 'Thank you', note: 'Same as Filipino' },
          { type: 'phrase', native: 'Oo / Dili', english: 'Yes / No', note: 'Note: "Dili" not "Hindi"' },
          { type: 'phrase', native: 'Unsay imong ngalan?', english: 'What is your name?', note: 'Introductions' },
          { type: 'phrase', native: 'Maayong buntag', english: 'Good morning', note: 'Formal greeting' },
          { type: 'phrase', native: 'Palihug', english: 'Please', note: 'Polite requests' },
          { type: 'phrase', native: 'Ambi na lang', english: 'Never mind', note: 'Casual dismissal' },
        ],
      },
      {
        id: 'grammar-basics',
        label: 'Grammar Basics',
        icon: 'school',
        preview: 'Verbo-centric: the verb carries tense through affixes like -on, -an, and mag-.',
        content: [
          { type: 'rule', native: 'Mag- prefix', note: 'Future or ongoing: magluto (will cook)' },
          { type: 'rule', native: '-on suffix', note: 'Object focus: lutoon (to be cooked)' },
          { type: 'rule', native: '-an suffix', note: 'Locative focus: lutoan (the cooking place)' },
          { type: 'rule', native: 'Ang', note: 'Topic marker — same role as in Filipino' },
          { type: 'rule', native: 'Sa', note: 'Location or direction marker' },
        ],
      },
      {
        id: 'numbers-counting',
        label: 'Numbers & Counting',
        icon: 'calculator',
        preview: 'Cebuano numbers mix native and Spanish roots: usa, duha, tulo vs. singko, dies.',
        content: [
          { type: 'number', native: 'Usa', english: '1' },
          { type: 'number', native: 'Duha', english: '2' },
          { type: 'number', native: 'Tulo', english: '3' },
          { type: 'number', native: 'Upat', english: '4' },
          { type: 'number', native: 'Lima', english: '5' },
          { type: 'number', native: 'Unom', english: '6' },
          { type: 'number', native: 'Pito', english: '7' },
          { type: 'number', native: 'Walo', english: '8' },
          { type: 'number', native: 'Siyam', english: '9' },
          { type: 'number', native: 'Napulo', english: '10' },
        ],
      },
    ],
  },
  hiligaynon: {
    name: 'Hiligaynon',
    native: 'Ilonggo',
    gradient: 'linear-gradient(135deg, #db2777, #f472b6)',
    speakers: '9.1M',
    region: 'Western Visayas',
    difficulty: 'Moderate',
    sections: [
      {
        id: 'pronunciation-guide',
        label: 'Pronunciation Guide',
        icon: 'volume',
        preview: 'Hiligaynon is known for its melodic, soft tone — vowels are elongated and flowing.',
        content: [
          { type: 'rule', native: 'Vowels', note: 'Same 5 vowels as Filipino, but pronounced longer and softer' },
          { type: 'rule', native: 'Stress', note: 'Stress falls on the second-to-last syllable by default' },
          { type: 'rule', native: 'L vs R', note: 'Hiligaynon softens R sounds to an L in some words' },
          { type: 'rule', native: '-on endings', note: 'Often elongated — sounds melodic to the ear' },
        ],
      },
      {
        id: 'origins-history',
        label: 'Origins & History',
        icon: 'time',
        preview: 'Ilonggo developed in Panay island and spread through Western Visayas trade routes.',
        content: [
          { type: 'fact', native: 'Panay Island', note: 'Birthplace of Hiligaynon — Iloilo & Antique regions' },
          { type: 'fact', native: 'Negros & Capiz', note: 'Also widely spoken in these provinces' },
          { type: 'fact', native: 'Trade language', note: 'Used across Visayas in pre-colonial trade networks' },
          { type: 'fact', native: '9.1M speakers', note: '3rd most spoken Philippine language' },
        ],
      },
      {
        id: 'common-phrases',
        label: 'Common Phrases',
        icon: 'chat',
        preview: '"Kamusta ka?" in Ilonggo sounds different — the musicality is distinct and warm.',
        content: [
          { type: 'phrase', native: 'Kamusta ka?', english: 'How are you?', note: 'Friendly greeting' },
          { type: 'phrase', native: 'Salamat', english: 'Thank you', note: 'Shared across Philippine languages' },
          { type: 'phrase', native: 'Huo / Indi', english: 'Yes / No', note: '"Indi" is softer than "Hindi"' },
          { type: 'phrase', native: 'Maayong aga', english: 'Good morning', note: 'Warm daily greeting' },
          { type: 'phrase', native: 'Ano ang imo ngalan?', english: 'What is your name?', note: 'Introductions' },
          { type: 'phrase', native: 'Palihog', english: 'Please', note: 'Polite request' },
        ],
      },
      {
        id: 'grammar-basics',
        label: 'Grammar Basics',
        icon: 'school',
        preview: 'Like other Philippine languages, Hiligaynon uses focus markers and verbal affixes.',
        content: [
          { type: 'rule', native: 'Ang', note: 'Topic marker — same as Filipino and Cebuano' },
          { type: 'rule', native: 'Mag- prefix', note: 'Action verb prefix: magkaon (to eat)' },
          { type: 'rule', native: '-on suffix', note: 'Object focus: kaunon (to be eaten)' },
          { type: 'rule', native: 'Ka-', note: 'Stative prefix: kaguol (sadness/sorrow)' },
        ],
      },
      {
        id: 'numbers-counting',
        label: 'Numbers & Counting',
        icon: 'calculator',
        preview: 'Counting in Hiligaynon: isa, duha, tatlo — closely related to Cebuano numerals.',
        content: [
          { type: 'number', native: 'Isa', english: '1' },
          { type: 'number', native: 'Duha', english: '2' },
          { type: 'number', native: 'Tatlo', english: '3' },
          { type: 'number', native: 'Apat', english: '4' },
          { type: 'number', native: 'Lima', english: '5' },
          { type: 'number', native: 'Anom', english: '6' },
          { type: 'number', native: 'Pito', english: '7' },
          { type: 'number', native: 'Walo', english: '8' },
          { type: 'number', native: 'Siyam', english: '9' },
          { type: 'number', native: 'Napulo', english: '10' },
        ],
      },
    ],
  },
  ilocano: {
    name: 'Ilocano',
    native: 'Ilokano',
    gradient: 'linear-gradient(135deg, #0047ab, #06b6d4)',
    speakers: '8M+',
    region: 'Northern Luzon',
    difficulty: 'Intermediate',
    sections: [
      {
        id: 'pronunciation-guide',
        label: 'Pronunciation Guide',
        icon: 'volume',
        preview: 'Ilocano has a distinct glottal stop and nasal sounds rarely found in other dialects.',
        content: [
          { type: 'rule', native: 'Glottal stop', note: 'Very common — marks emphasis between vowels' },
          { type: 'rule', native: 'NG', note: 'Nasal sound — can begin words like "ngata" (perhaps)' },
          { type: 'rule', native: 'Stress', note: 'Often on the last syllable — affects meaning' },
          { type: 'rule', native: 'Double vowels', note: 'Indicate length: "baa" vs "ba" are different words' },
        ],
      },
      {
        id: 'origins-history',
        label: 'Origins & History',
        icon: 'time',
        preview: 'Over 2,000 years of literary tradition — among the oldest written Philippine languages.',
        content: [
          { type: 'fact', native: '2,000+ years', note: 'Among the oldest PH languages with written records' },
          { type: 'fact', native: 'Ilocos Region', note: 'Originating from Ilocos Norte & Ilocos Sur' },
          { type: 'fact', native: 'Diaspora spread', note: 'Widely spoken in Hawaii and California due to labor migration' },
          { type: 'fact', native: 'Biag ni Lam-ang', note: 'Epic folk tale — one of the oldest Philippine literary works' },
        ],
      },
      {
        id: 'common-phrases',
        label: 'Common Phrases',
        icon: 'chat',
        preview: '"Naimbag a bigat" means good morning — Ilocano greetings carry cultural warmth.',
        content: [
          { type: 'phrase', native: 'Naimbag a bigat', english: 'Good morning', note: 'Warm formal greeting' },
          { type: 'phrase', native: 'Kumusta ka?', english: 'How are you?', note: 'Shared across dialects' },
          { type: 'phrase', native: 'Agyamanak', english: 'Thank you', note: 'Distinct from other dialects' },
          { type: 'phrase', native: 'Wen / Saan', english: 'Yes / No', note: 'Unique to Ilocano' },
          { type: 'phrase', native: 'Ania ti naganmo?', english: 'What is your name?', note: 'Introduction' },
          { type: 'phrase', native: 'Pakisuyo', english: 'Please', note: 'Polite request marker' },
        ],
      },
      {
        id: 'grammar-basics',
        label: 'Grammar Basics',
        icon: 'school',
        preview: 'Ilocano verbs change with -en, -an, and i- affixes to mark grammatical focus.',
        content: [
          { type: 'rule', native: 'Ag- prefix', note: 'Actor focus: agkanta (to sing)' },
          { type: 'rule', native: '-en suffix', note: 'Object focus: kantaen (to be sung)' },
          { type: 'rule', native: '-an suffix', note: 'Locative focus: kantaan (the singing place)' },
          { type: 'rule', native: 'Ti', note: 'Topic marker — equivalent of "Ang" in Filipino' },
          { type: 'rule', native: 'Iti', note: 'Location marker — equivalent of "Sa"' },
        ],
      },
      {
        id: 'numbers-counting',
        label: 'Numbers & Counting',
        icon: 'calculator',
        preview: 'Ilocano counting: maysa, dua, tallo — with unique nasal pronunciations.',
        content: [
          { type: 'number', native: 'Maysa', english: '1' },
          { type: 'number', native: 'Dua', english: '2' },
          { type: 'number', native: 'Tallo', english: '3' },
          { type: 'number', native: 'Uppat', english: '4' },
          { type: 'number', native: 'Lima', english: '5' },
          { type: 'number', native: 'Innem', english: '6' },
          { type: 'number', native: 'Pito', english: '7' },
          { type: 'number', native: 'Walo', english: '8' },
          { type: 'number', native: 'Siam', english: '9' },
          { type: 'number', native: 'Sangapulo', english: '10' },
        ],
      },
    ],
  },
  pangasinan: {
    name: 'Pangasinan',
    native: 'Pangasinan',
    gradient: 'linear-gradient(135deg, #ea580c, #fbbf24)',
    speakers: '2.4M',
    region: 'Central Luzon',
    difficulty: 'Intermediate',
    sections: [
      {
        id: 'pronunciation-guide',
        label: 'Pronunciation Guide',
        icon: 'volume',
        preview: 'Pangasinan uses retroflex consonants unique among Philippine languages.',
        content: [
          { type: 'rule', native: 'Retroflex sounds', note: 'Tongue curls back — creates a distinct "D" and "T"' },
          { type: 'rule', native: 'Vowels', note: 'Standard 5 vowels but often nasalized near N or NG' },
          { type: 'rule', native: 'Stress', note: 'Usually penultimate (second-to-last) syllable' },
          { type: 'rule', native: 'Final stops', note: 'Words ending in consonants have hard stops' },
        ],
      },
      {
        id: 'origins-history',
        label: 'Origins & History',
        icon: 'time',
        preview: 'One of the oldest Philippine languages, spoken since pre-colonial Central Luzon.',
        content: [
          { type: 'fact', native: 'Pre-colonial', note: 'Spoken before Spanish contact in 1572' },
          { type: 'fact', native: 'Pangasinan Province', note: 'Named after "asin" (salt) — a key trade resource' },
          { type: 'fact', native: 'Austronesian roots', note: 'Related to other Malayo-Polynesian languages' },
          { type: 'fact', native: '2.4M speakers', note: 'Mostly concentrated in Pangasinan province' },
        ],
      },
      {
        id: 'common-phrases',
        label: 'Common Phrases',
        icon: 'chat',
        preview: '"Maong labi" means good evening — Pangasinan phrases reflect deep cultural ties.',
        content: [
          { type: 'phrase', native: 'Maong labi', english: 'Good evening', note: 'Unique to Pangasinan' },
          { type: 'phrase', native: 'Kumusta ka?', english: 'How are you?', note: 'Shared phrase' },
          { type: 'phrase', native: 'Salamat', english: 'Thank you', note: 'Same as Filipino' },
          { type: 'phrase', native: 'Oo / Andi', english: 'Yes / No', note: '"Andi" is unique to Pangasinan' },
          { type: 'phrase', native: 'Anto so ngaran mo?', english: 'What is your name?', note: 'Introduction' },
          { type: 'phrase', native: 'Palihim', english: 'Please', note: 'Polite request' },
        ],
      },
      {
        id: 'grammar-basics',
        label: 'Grammar Basics',
        icon: 'school',
        preview: 'Pangasinan grammar uses focus and aspect — verbs are the sentence backbone.',
        content: [
          { type: 'rule', native: 'Man- prefix', note: 'Actor focus verb: mangan (to eat)' },
          { type: 'rule', native: '-en suffix', note: 'Object focus: kakaen (to be eaten)' },
          { type: 'rule', native: 'So', note: 'Topic marker — equivalent of "Ang"' },
          { type: 'rule', native: 'Ed', note: 'Location marker — equivalent of "Sa"' },
          { type: 'rule', native: 'Aspect system', note: 'Verbs mark completion rather than tense' },
        ],
      },
      {
        id: 'numbers-counting',
        label: 'Numbers & Counting',
        icon: 'calculator',
        preview: 'Counting in Pangasinan: sakey, duara, talo — distinct from Visayan roots.',
        content: [
          { type: 'number', native: 'Sakey', english: '1' },
          { type: 'number', native: 'Duara', english: '2' },
          { type: 'number', native: 'Talo', english: '3' },
          { type: 'number', native: 'Apat', english: '4' },
          { type: 'number', native: 'Lima', english: '5' },
          { type: 'number', native: 'Anem', english: '6' },
          { type: 'number', native: 'Pito', english: '7' },
          { type: 'number', native: 'Walo', english: '8' },
          { type: 'number', native: 'Siyam', english: '9' },
          { type: 'number', native: 'Samplo', english: '10' },
        ],
      },
    ],
  },
};

// ─── Icon helper ──────────────────────────────────────────────────────────────

function getSectionIcon(iconKey: string): string {
  const map: Record<string, string> = {
    volume:     volumeHighOutline,
    time:       timeOutline,
    chat:       chatboxOutline,
    school:     schoolOutline,
    calculator: calculatorOutline,
  };
  return map[iconKey] ?? bookOutline;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DialectDetail: React.FC = () => {
  const { dialectId } = useParams<{ dialectId: string }>();
  const history = useHistory();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const dialect = dialectId ? DIALECT_DATA[dialectId] : undefined;

  // Scroll to a lesson section when the URL contains a hash
  useEffect(() => {
    if (!dialect) return;
    const sectionId = location.hash.replace('#', '');
    if (!sectionId) return;

    const target = document.getElementById(`section-${dialectId}-${sectionId}`);
    if (target) {
      setActiveSection(sectionId);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('dialect-section--highlight');
      const timer = window.setTimeout(() => {
        target.classList.remove('dialect-section--highlight');
      }, 2000);
      return () => window.clearTimeout(timer);
    }
  }, [dialect, dialectId, location.hash]);

  // Mark this dialect as active globally
  useEffect(() => {
    if (dialect && dialectId) {
      const nativeMap: Record<string, string> = {
        filipino: 'Filipino', cebuano: 'Bisaya', hiligaynon: 'Ilonggo',
        ilocano: 'Ilokano', pangasinan: 'Pangasinan',
      };
      const codeMap: Record<string, string> = {
        filipino: 'fil', cebuano: 'ceb', hiligaynon: 'hil',
        ilocano: 'ilo', pangasinan: 'pag',
      };
      localStorage.setItem(
        ACTIVE_DIALECT_KEY,
        JSON.stringify({
          id: dialectId,
          code: codeMap[dialectId] ?? 'fil',
          name: dialect.name,
          native: nativeMap[dialectId] ?? dialect.name,
        }),
      );
    }
  }, [dialectId, dialect]);

  if (!dialect) {
    return (
      <IonPage>
        <IonContent>
          <div className="dialect-detail__not-found">
            <p>Dialect not found.</p>
            <button type="button" onClick={() => history.push('/learn')}>← Back to Learn</button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const toggleSection = (sectionId: string) => {
    setActiveSection(prev => (prev === sectionId ? null : sectionId));
  };

  return (
    <IonPage>
      <IonContent fullscreen className="dialect-detail-content">
        <div className="dialect-detail">

          {/* ── Hero header ── */}
          <header className="dialect-detail__header" style={{ background: dialect.gradient }}>
            <button type="button" className="dialect-detail__back" onClick={() => history.push('/learn')}>
              <IonIcon icon={arrowBackOutline} />
            </button>
            <div className="dialect-detail__hero-text">
              <h1 className="dialect-detail__name">{dialect.name}</h1>
              <p className="dialect-detail__native">{dialect.native}</p>
              <div className="dialect-detail__meta">
                <span className="dialect-detail__badge">{dialect.speakers} speakers</span>
                <span className="dialect-detail__badge">{dialect.region}</span>
                <span className="dialect-detail__badge dialect-detail__badge--difficulty">{dialect.difficulty}</span>
              </div>
            </div>
            <svg className="dialect-detail__wave" viewBox="0 0 430 40" preserveAspectRatio="none">
              <path d="M0,20 C80,40 180,0 280,20 C350,35 400,10 430,18 L430,40 L0,40 Z" fill="#F8F9FA"/>
            </svg>
          </header>

          {/* ── Sections ── */}
          <div className="dialect-detail__sections">
            {dialect.sections.map((section, index) => {
              const isOpen = activeSection === section.id;
              return (
                <div
                  key={section.id}
                  id={`section-${dialectId}-${section.id}`}
                  className={`dialect-section${isOpen ? ' dialect-section--open' : ''}`}
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  {/* Section header — tap to expand */}
                  <button
                    type="button"
                    className="dialect-section__header"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="dialect-section__header-left">
                      <div className="dialect-section__icon" style={{ background: dialect.gradient }}>
                        <IonIcon icon={getSectionIcon(section.icon)} />
                      </div>
                      <div>
                        <h2 className="dialect-section__label">{section.label}</h2>
                        <p className="dialect-section__preview">{section.preview}</p>
                      </div>
                    </div>
                    <span className={`dialect-section__chevron${isOpen ? ' dialect-section__chevron--open' : ''}`}>
                      ›
                    </span>
                  </button>

                  {/* Section content */}
                  {isOpen && (
                    <div className="dialect-section__content">
                      {section.content.map((item, i) => (
                        <div key={i} className={`dialect-item dialect-item--${item.type}`}>
                          <div className="dialect-item__main">
                            <span className="dialect-item__native">{item.native}</span>
                            {item.english && (
                              <span className="dialect-item__english">{item.english}</span>
                            )}
                          </div>
                          {item.note && (
                            <p className="dialect-item__note">{item.note}</p>
                          )}
                        </div>
                      ))}

                      {/* Practice prompt */}
                      <button
                        type="button"
                        className="dialect-section__practice-btn"
                        onClick={() => history.push('/chat')}
                        style={{ background: dialect.gradient }}
                      >
                        Practice this in Chat →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ height: '100px' }} aria-hidden />
        </div>
      </IonContent>

      {/* ── Bottom nav ── */}
      <IonFooter className="learn-footer ion-no-border">
        <nav className="learn-nav" aria-label="Main">
          <Link to="/learn" className="learn-nav__item learn-nav__item--active">
            <IonIcon icon={bookOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Learn</span>
          </Link>
          <Link to="/quiz" className="learn-nav__item">
            <IonIcon icon={documentTextOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Quiz</span>
          </Link>
          <Link to="/home" className="learn-nav__item">
            <IonIcon icon={homeOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Home</span>
          </Link>
          <Link to="/chat" className="learn-nav__item">
            <IonIcon icon={chatbubbleOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Chat</span>
          </Link>
          <Link to="/profile" className="learn-nav__item">
            <IonIcon icon={personOutline} className="learn-nav__icon" />
            <span className="learn-nav__label">Profile</span>
          </Link>
        </nav>
      </IonFooter>
    </IonPage>
  );
};

export default DialectDetail;
